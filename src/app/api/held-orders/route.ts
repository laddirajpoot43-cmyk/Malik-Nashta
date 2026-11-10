import { NextResponse } from 'next/server';
import { localStore, logAuditEvent, generateUUID } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const store = localStore.get();
    const held = (store.held_orders || []).filter((h: any) => h.status === 'held');
    return NextResponse.json({ success: true, heldOrders: held });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { customer_name, cart_data, cashier_name = 'Counter Cashier' } = body;

    if (!cart_data || (Array.isArray(cart_data) && cart_data.length === 0)) {
      return NextResponse.json({ success: false, error: 'Cannot hold an empty cart.' }, { status: 400 });
    }

    const holdNumber = localStore.nextSeq('hold_seq');
    const store = localStore.get();

    const newHold = {
      id: generateUUID(),
      hold_number: holdNumber,
      customer_name: customer_name || `Held Order #${holdNumber}`,
      cart_data,
      cashier_name,
      status: 'held',
      created_at: new Date().toISOString(),
    };

    store.held_orders.unshift(newHold);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'ORDER_HELD',
      entity_type: 'held_order',
      entity_id: newHold.id,
      description: `Cart temporarily held as ${newHold.hold_number} for "${newHold.customer_name}"`,
      new_values: { hold_number: holdNumber, items_count: cart_data.length },
    });

    localStore.save();

    return NextResponse.json({ success: true, heldOrder: newHold });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'resume'; // 'resume' or 'cancel'

    if (!id) {
      return NextResponse.json({ success: false, error: 'Held order ID is required.' }, { status: 400 });
    }

    const store = localStore.get();
    const hold = (store.held_orders || []).find((h: any) => h.id === id || h.hold_number === id);

    if (!hold) {
      return NextResponse.json({ success: false, error: 'Held order not found.' }, { status: 404 });
    }

    hold.status = action === 'cancel' ? 'cancelled' : 'resumed';
    localStore.save();

    return NextResponse.json({ success: true, heldOrder: hold });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

