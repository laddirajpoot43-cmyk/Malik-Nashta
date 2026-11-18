import { NextResponse } from 'next/server';
import { localStore, logAuditEvent } from '@/lib/db';
import { insforgeAdmin } from '@/lib/insforge';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase().trim() || '';
    const status = searchParams.get('status');
    const sessionId = searchParams.get('session_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const store = localStore.get();
    let orders = [...(store.orders || [])];

    if (search) {
      orders = orders.filter((o: any) =>
        (o.receipt_number && o.receipt_number.toLowerCase().includes(search)) ||
        (o.order_number && o.order_number.toLowerCase().includes(search)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(search)) ||
        (o.customer_phone && o.customer_phone.includes(search))
      );
    }

    if (status) {
      orders = orders.filter((o: any) => o.status === status);
    }

    if (sessionId) {
      orders = orders.filter((o: any) => o.register_session_id === sessionId);
    }

    const orderItems = store.order_items || [];
    const orderPayments = store.order_payments || [];

    const fullOrders = orders.slice(0, limit).map((o: any) => ({
      ...o,
      items: (o.items && o.items.length > 0) ? o.items : orderItems.filter((i: any) => i.order_id === o.id),
      payments: (o.payments && o.payments.length > 0) ? o.payments : orderPayments.filter((p: any) => p.order_id === o.id),
    }));

    return NextResponse.json({
      success: true,
      orders: fullOrders,
      total: fullOrders.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const cashier_name = searchParams.get('cashier_name') || 'Admin';
    const reason = searchParams.get('reason') || 'Administrative Order Deletion';

    if (!id) {
      return NextResponse.json({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    const store = localStore.get();
    const orderIndex = (store.orders || []).findIndex((o: any) => o.id === id || o.receipt_number === id);

    if (orderIndex === -1) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const order = store.orders[orderIndex];

    store.orders.splice(orderIndex, 1);
    store.order_items = (store.order_items || []).filter((item: any) => item.order_id !== order.id);
    store.order_payments = (store.order_payments || []).filter((p: any) => p.order_id !== order.id);
    store.register_transactions = (store.register_transactions || []).filter((tx: any) => tx.order_id !== order.id);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'ORDER_DELETED',
      entity_type: 'order',
      entity_id: order.id,
      description: `Order ${order.receipt_number} deleted by ${cashier_name}. Reason: ${reason}`,
      old_values: order,
    });

    localStore.save();

    // Direct synchronous Cloud PostgreSQL persistence
    try {
      await insforgeAdmin.database.from('order_items').delete().eq('order_id', order.id);
      await insforgeAdmin.database.from('order_payments').delete().eq('order_id', order.id);
      await insforgeAdmin.database.from('orders').delete().eq('id', order.id);
    } catch (e) {
      console.warn('Cloud sync error for order delete:', e);
    }

    return NextResponse.json({ success: true, message: `Order ${order.receipt_number} deleted successfully.`, deletedOrder: order });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

