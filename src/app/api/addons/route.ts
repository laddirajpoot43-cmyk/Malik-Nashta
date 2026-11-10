import { NextResponse } from 'next/server';
import { localStore, logAuditEvent, generateUUID } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const store = localStore.get();
    const addons = store.product_addons || [];
    return NextResponse.json({ success: true, addons });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, price, is_active = true, cashier_name = 'Admin' } = body;

    if (!name || price === undefined) {
      return NextResponse.json({ success: false, error: 'Addon name and price are required.' }, { status: 400 });
    }

    const store = localStore.get();
    if (!store.product_addons) {
      store.product_addons = [];
    }

    const newAddon = {
      id: generateUUID(),
      name: String(name).trim(),
      price: Number(price) || 0,
      is_active: Boolean(is_active),
    };

    store.product_addons.push(newAddon);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'ADDON_CREATED',
      entity_type: 'addon',
      entity_id: newAddon.id,
      description: `New addon "${newAddon.name}" created at Rs. ${newAddon.price}`,
      new_values: newAddon,
    });

    localStore.save();
    return NextResponse.json({ success: true, addon: newAddon });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, price, is_active, cashier_name = 'Admin' } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Addon ID is required' }, { status: 400 });
    }

    const store = localStore.get();
    const addon = (store.product_addons || []).find((a: any) => a.id === id);

    if (!addon) {
      return NextResponse.json({ success: false, error: 'Addon not found' }, { status: 404 });
    }

    const oldPrice = addon.price;
    if (name !== undefined) addon.name = String(name).trim();
    if (price !== undefined) addon.price = Number(price);
    if (is_active !== undefined) addon.is_active = Boolean(is_active);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'ADDON_UPDATED',
      entity_type: 'addon',
      entity_id: id,
      description: `Addon "${addon.name}" updated. Price: Rs. ${oldPrice} -> Rs. ${addon.price}`,
      new_values: addon,
    });

    localStore.save();
    return NextResponse.json({ success: true, addon });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const cashier_name = searchParams.get('cashier_name') || 'Admin';

    if (!id) {
      return NextResponse.json({ success: false, error: 'Addon ID is required' }, { status: 400 });
    }

    const store = localStore.get();
    const index = (store.product_addons || []).findIndex((a: any) => a.id === id);

    if (index === -1) {
      return NextResponse.json({ success: false, error: 'Addon not found' }, { status: 404 });
    }

    const removed = store.product_addons.splice(index, 1)[0];

    await logAuditEvent({
      user_name: cashier_name,
      action: 'ADDON_DELETED',
      entity_type: 'addon',
      entity_id: id,
      description: `Addon "${removed.name}" deleted by ${cashier_name}`,
      old_values: removed,
    });

    localStore.save();
    return NextResponse.json({ success: true, deletedAddon: removed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

