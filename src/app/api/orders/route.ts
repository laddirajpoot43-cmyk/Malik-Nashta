import { NextResponse } from 'next/server';
import { localStore } from '@/lib/db';

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

