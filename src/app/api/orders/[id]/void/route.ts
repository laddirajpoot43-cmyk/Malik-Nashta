import { NextResponse } from 'next/server';
import { localStore, withTransaction, logAuditEvent, generateUUID } from '@/lib/db';
import { subtractMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { admin_pin, void_reason, cashier_name = 'Admin' } = body;

    const store = localStore.get();
    const settings = store.pos_settings?.[0] || { admin_pin: '1234' };

    // Verify Supervisor / Admin PIN
    if (!admin_pin || String(admin_pin).trim() !== String(settings.admin_pin).trim()) {
      return NextResponse.json({ success: false, error: 'Valid Supervisor / Admin PIN is required to void orders.' }, { status: 403 });
    }

    if (!void_reason || String(void_reason).trim().length < 3) {
      return NextResponse.json({ success: false, error: 'A mandatory void reason is required.' }, { status: 400 });
    }

    const order = (store.orders || []).find((o: any) => o.id === id || o.receipt_number === id || o.order_number === id);
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }

    if (order.status === 'voided') {
      return NextResponse.json({ success: false, error: 'Order is already voided.' }, { status: 400 });
    }

    const prevStatus = order.status;
    order.status = 'voided';
    order.void_reason = void_reason;

    // Check if paid in cash
    const cashPaidPayment = (order.payments || []).find((p: any) => p.method_id === 'cash');
    const cashAmountToRevert = cashPaidPayment ? Number(order.grand_total || order.total_paid || 0) : 0;

    // If active register exists and cash was involved, create automatic negative ADJUSTMENT in drawer
    const activeRegister = (store.register_sessions || []).find((s: any) => s.status === 'open');
    let drawerAdjustmentTx = null;

    if (activeRegister && cashAmountToRevert > 0) {
      drawerAdjustmentTx = {
        id: generateUUID(),
        register_session_id: activeRegister.id,
        type: 'ADJUSTMENT',
        amount: -cashAmountToRevert,
        order_id: order.id,
        refund_id: null,
        reason: `Order Voided #${order.receipt_number}`,
        note: `Reason: ${void_reason}`,
        user_name_snapshot: cashier_name,
        created_at: new Date().toISOString(),
      };
      store.register_transactions.unshift(drawerAdjustmentTx);
    }

    // Write audit log
    await logAuditEvent({
      user_name: cashier_name,
      action: 'ORDER_VOIDED',
      entity_type: 'order',
      entity_id: order.id,
      description: `Order ${order.receipt_number} voided by ${cashier_name}. Reason: ${void_reason}`,
      old_values: { status: prevStatus, grand_total: order.grand_total },
      new_values: { status: 'voided', void_reason, cash_reverted: cashAmountToRevert },
    });

    localStore.save();

    return NextResponse.json({
      success: true,
      order,
      drawer_adjustment: drawerAdjustmentTx,
    });
  } catch (error: any) {
    console.error('Order void error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

