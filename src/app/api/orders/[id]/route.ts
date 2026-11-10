import { NextResponse } from 'next/server';
import { localStore, logAuditEvent } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const store = localStore.get();
    const order = (store.orders || []).find((o: any) => o.id === id || o.receipt_number === id);

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }

    const items = (store.order_items || []).filter((item: any) => item.order_id === order.id);
    const payments = (store.order_payments || []).filter((p: any) => p.order_id === order.id);
    const refunds = (store.refunds || []).filter((r: any) => r.order_id === order.id);

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        items,
        payments,
        refunds,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const cashier_name = searchParams.get('cashier_name') || 'Admin';
    const reason = searchParams.get('reason') || 'Administrative Order Deletion';

    const store = localStore.get();
    const orderIndex = (store.orders || []).findIndex((o: any) => o.id === id || o.receipt_number === id);

    if (orderIndex === -1) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const order = store.orders[orderIndex];

    // Remove the order
    store.orders.splice(orderIndex, 1);

    // Remove corresponding items, payments, and register txs
    store.order_items = (store.order_items || []).filter((item: any) => item.order_id !== order.id);
    store.order_payments = (store.order_payments || []).filter((p: any) => p.order_id !== order.id);
    store.register_transactions = (store.register_transactions || []).filter((tx: any) => tx.order_id !== order.id);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'ORDER_DELETED',
      entity_type: 'order',
      entity_id: order.id,
      description: `Order ${order.receipt_number} (Rs. ${order.grand_total ?? order.total_amount ?? 0}) deleted by ${cashier_name}. Reason: ${reason}`,
      old_values: order,
    });

    localStore.save();

    return NextResponse.json({ success: true, message: `Order ${order.receipt_number} deleted successfully.`, deletedOrder: order });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
