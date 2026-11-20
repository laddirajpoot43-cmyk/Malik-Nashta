import { localStore, logAuditEvent } from '@/lib/db';
import { insforgeAdmin } from '@/lib/insforge';
import { jsonResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase().trim() || '';
    const status = searchParams.get('status');
    const sessionId = searchParams.get('session_id');
    const tab = searchParams.get('tab'); // 'recent' | 'history' | 'all'
    const date = searchParams.get('date'); // YYYY-MM-DD
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const store = await localStore.ensureFresh(1500);
    const allStoreOrders = store.orders || [];

    // Precalculate counts across entire order dataset
    const recentCount = allStoreOrders.filter((o: any) => !o.daily_closed).length;
    const historyCount = allStoreOrders.filter((o: any) => o.daily_closed === true).length;
    const totalCount = allStoreOrders.length;

    let orders = [...allStoreOrders];

    // Filter by tab
    if (tab === 'recent') {
      orders = orders.filter((o: any) => !o.daily_closed);
    } else if (tab === 'history') {
      orders = orders.filter((o: any) => o.daily_closed === true);
    }

    // Filter by date
    if (date) {
      orders = orders.filter((o: any) => {
        const oDate = o.created_at ? o.created_at.slice(0, 10) : '';
        return oDate === date;
      });
    }

    if (dateFrom) {
      orders = orders.filter((o: any) => (o.created_at?.slice(0, 10) || '') >= dateFrom);
    }

    if (dateTo) {
      orders = orders.filter((o: any) => (o.created_at?.slice(0, 10) || '') <= dateTo);
    }

    if (search) {
      orders = orders.filter((o: any) =>
        (o.receipt_number && o.receipt_number.toLowerCase().includes(search)) ||
        (o.order_number && o.order_number.toLowerCase().includes(search)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(search)) ||
        (o.customer_phone && o.customer_phone.includes(search))
      );
    }

    if (status && status !== 'all') {
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

    return jsonResponse({
      success: true,
      orders: fullOrders,
      total: fullOrders.length,
      counts: {
        recent: recentCount,
        history: historyCount,
        total: totalCount,
      },
    });
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, date, cashier_name = 'Admin' } = body;

    if (action === 'daily_close') {
      const store = localStore.get();
      const allOrders = store.orders || [];
      const targetDate = date || new Date().toISOString().slice(0, 10);
      let closedCount = 0;

      for (const ord of allOrders) {
        const ordDate = ord.created_at ? ord.created_at.slice(0, 10) : '';
        if (!ord.daily_closed && (!date || ordDate <= targetDate)) {
          ord.daily_closed = true;
          ord.daily_closed_at = new Date().toISOString();
          closedCount++;
        }
      }

      await logAuditEvent({
        user_name: cashier_name,
        action: 'DAILY_CLOSING_EXECUTED',
        entity_type: 'orders',
        entity_id: targetDate,
        description: `Daily closing executed for ${targetDate} by ${cashier_name}. ${closedCount} orders moved to Order History.`,
        new_values: { targetDate, closedCount },
      });

      await localStore.saveAndSync();

      return jsonResponse({
        success: true,
        message: `Daily closing completed. ${closedCount} order(s) moved to Order History.`,
        closedCount,
      });
    }

    return jsonResponse({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const cashier_name = searchParams.get('cashier_name') || 'Admin';
    const reason = searchParams.get('reason') || 'Administrative Order Deletion';

    if (!id) {
      return jsonResponse({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    const store = localStore.get();
    const orderIndex = (store.orders || []).findIndex((o: any) => o.id === id || o.receipt_number === id);

    if (orderIndex === -1) {
      return jsonResponse({ success: false, error: 'Order not found' }, { status: 404 });
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

    await localStore.saveAndSync();

    // Direct synchronous Cloud PostgreSQL persistence
    try {
      await insforgeAdmin.database.from('order_items').delete().eq('order_id', order.id);
      await insforgeAdmin.database.from('order_payments').delete().eq('order_id', order.id);
      await insforgeAdmin.database.from('orders').delete().eq('id', order.id);
    } catch (e) {
      console.warn('Cloud sync error for order delete:', e);
    }

    return jsonResponse({ success: true, message: `Order ${order.receipt_number} deleted successfully.`, deletedOrder: order });
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message }, { status: 500 });
  }
}

