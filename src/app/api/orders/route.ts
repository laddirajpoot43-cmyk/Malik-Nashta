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

    orders = orders.slice(0, limit);

    return NextResponse.json({
      success: true,
      orders,
      total: orders.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

