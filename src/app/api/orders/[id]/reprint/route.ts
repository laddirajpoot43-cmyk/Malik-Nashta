import { NextResponse } from 'next/server';
import { localStore, logAuditEvent } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const cashier_name = body.cashier_name || 'Counter Cashier';

    const store = await localStore.ensureFresh(1500);
    const order = (store.orders || []).find((o: any) => o.id === id || o.receipt_number === id);

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }

    order.reprint_count = (order.reprint_count || 0) + 1;

    await logAuditEvent({
      user_name: cashier_name,
      action: 'RECEIPT_REPRINT',
      entity_type: 'order',
      entity_id: order.id,
      description: `Thermal receipt reprint #${order.reprint_count} requested for receipt ${order.receipt_number} by ${cashier_name}`,
      new_values: { reprint_count: order.reprint_count },
    });

    await localStore.saveAndSync();

    const items = (order.items && order.items.length > 0)
      ? order.items
      : (store.order_items || []).filter((item: any) => item.order_id === order.id);
    const payments = (order.payments && order.payments.length > 0)
      ? order.payments
      : (store.order_payments || []).filter((p: any) => p.order_id === order.id);

    return NextResponse.json({
      success: true,
      reprint_count: order.reprint_count,
      order: {
        ...order,
        items,
        payments,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

