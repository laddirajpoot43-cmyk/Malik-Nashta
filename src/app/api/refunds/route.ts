import { NextResponse } from 'next/server';
import { localStore, withTransaction, logAuditEvent, generateUUID } from '@/lib/db';
import { addMoney, subtractMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      order_id,
      items = [], // [{ order_item_id, quantity, amount }]
      refund_amount,
      reason,
      admin_pin,
      cashier_name = 'Counter Staff',
    } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: 'Order ID is required.' }, { status: 400 });
    }

    if (!reason || String(reason).trim().length < 2) {
      return NextResponse.json({ success: false, error: 'A valid refund reason is mandatory.' }, { status: 400 });
    }

    const store = localStore.get();
    const settings = store.pos_settings?.[0] || { require_admin_pin_refunds: true, admin_pin: '1234' };

    // Check PIN requirement if enabled in settings
    if (settings.require_admin_pin_refunds) {
      if (!admin_pin || String(admin_pin).trim() !== String(settings.admin_pin).trim()) {
        return NextResponse.json(
          { success: false, error: 'Supervisor / Admin PIN is required for refunds.' },
          { status: 403 }
        );
      }
    }

    const order = (store.orders || []).find((o: any) => o.id === order_id || o.receipt_number === order_id);
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }

    if (order.status === 'voided') {
      return NextResponse.json({ success: false, error: 'Cannot refund a voided order.' }, { status: 400 });
    }

    // Calculate previous refunds for this order
    const existingRefunds = (store.refunds || []).filter((r: any) => r.order_id === order.id);
    let totalAlreadyRefunded = 0;
    for (const r of existingRefunds) {
      totalAlreadyRefunded = addMoney(totalAlreadyRefunded, Number(r.amount || 0));
    }

    const remainingAllowable = subtractMoney(order.grand_total, totalAlreadyRefunded);
    if (remainingAllowable <= 0) {
      return NextResponse.json({ success: false, error: 'This order has already been fully refunded.' }, { status: 400 });
    }

    // Calculate requested refund amount
    let targetRefundAmt = 0;
    const processedRefundItems: any[] = [];
    const refundId = generateUUID();

    if (items.length > 0) {
      for (const reqItem of items) {
        const orderItem = (order.items || []).find((oi: any) => oi.id === reqItem.order_item_id);
        if (!orderItem) continue;

        const maxRefundableQty = subtractMoney(orderItem.quantity, orderItem.refunded_quantity || 0);
        const qtyToRefund = Math.min(Number(reqItem.quantity) || 0, maxRefundableQty);
        if (qtyToRefund <= 0) continue;

        const perUnitPrice = Number(orderItem.unit_price || 0);
        const itemRefundAmt = reqItem.amount !== undefined ? Number(reqItem.amount) : Math.round(perUnitPrice * qtyToRefund * 100) / 100;

        orderItem.refunded_quantity = addMoney(orderItem.refunded_quantity || 0, qtyToRefund);
        targetRefundAmt = addMoney(targetRefundAmt, itemRefundAmt);

        processedRefundItems.push({
          id: generateUUID(),
          refund_id: refundId,
          order_item_id: orderItem.id,
          product_name: orderItem.product_name_snapshot,
          quantity: qtyToRefund,
          amount: itemRefundAmt,
          created_at: new Date().toISOString(),
        });
      }
    } else {
      targetRefundAmt = refund_amount !== undefined ? Number(refund_amount) : remainingAllowable;
    }

    if (targetRefundAmt <= 0) {
      return NextResponse.json({ success: false, error: 'Refund amount must be greater than zero.' }, { status: 400 });
    }

    if (targetRefundAmt > remainingAllowable) {
      return NextResponse.json(
        {
          success: false,
          error: `Refund amount (Rs. ${targetRefundAmt}) cannot exceed remaining balance (Rs. ${remainingAllowable}).`,
        },
        { status: 400 }
      );
    }

    // Determine new order status
    const newTotalRefunded = addMoney(totalAlreadyRefunded, targetRefundAmt);
    const isFullRefund = newTotalRefunded >= order.grand_total;
    order.status = isFullRefund ? 'refunded' : 'partially_refunded';

    // Generate sequential refund number
    const refundNumber = localStore.nextSeq('refund_seq');

    // Check active register session for drawer deduction
    const activeRegister = (store.register_sessions || []).find((s: any) => s.status === 'open');
    let drawerRefundTx = null;

    if (activeRegister) {
      drawerRefundTx = {
        id: generateUUID(),
        register_session_id: activeRegister.id,
        type: 'REFUND',
        amount: targetRefundAmt,
        order_id: order.id,
        refund_id: refundId,
        reason: `Refund Voucher #${refundNumber}`,
        note: `Reason: ${reason}`,
        user_name_snapshot: cashier_name,
        created_at: new Date().toISOString(),
      };
      store.register_transactions.unshift(drawerRefundTx);
    }

    const refundRecord = {
      id: refundId,
      refund_number: refundNumber,
      order_id: order.id,
      register_session_id: activeRegister?.id || null,
      amount: targetRefundAmt,
      reason,
      admin_pin_used: Boolean(admin_pin),
      cashier_name,
      created_at: new Date().toISOString(),
      items: processedRefundItems,
    };

    store.refunds.unshift(refundRecord);
    for (const item of processedRefundItems) {
      store.refund_items.push(item);
    }

    await logAuditEvent({
      user_name: cashier_name,
      action: 'REFUND_CREATED',
      entity_type: 'refund',
      entity_id: refundId,
      description: `Refund ${refundNumber} of Rs. ${targetRefundAmt} issued for order ${order.receipt_number}. Reason: ${reason}`,
      new_values: { refund_number: refundNumber, amount: targetRefundAmt, status: order.status },
    });

    localStore.save();

    return NextResponse.json({
      success: true,
      refund: refundRecord,
      order_status: order.status,
      drawer_transaction: drawerRefundTx,
    });
  } catch (error: any) {
    console.error('Refund error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const order_id = searchParams.get('order_id');
    const store = localStore.get();

    let list = store.refunds || [];
    if (order_id) {
      list = list.filter((r: any) => r.order_id === order_id);
    }

    return NextResponse.json({ success: true, refunds: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

