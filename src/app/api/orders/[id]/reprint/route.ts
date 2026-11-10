import { NextResponse } from 'next/server';
import { localStore, logAuditEvent } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const cashier_name = body.cashier_name || 'Counter Cashier';

    const store = localStore.get();
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

    localStore.save();

    return NextResponse.json({
      success: true,
      reprint_count: order.reprint_count,
      order,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

