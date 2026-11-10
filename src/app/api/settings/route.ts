import { NextResponse } from 'next/server';
import { localStore, logAuditEvent } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const store = localStore.get();
    const settings = store.pos_settings?.[0] || {
      id: '33333333-3333-3333-3333-333333333301',
      business_name: 'MALIK TASTY NASHTA POINT',
      address: 'Vehari Road, Hasilpur, Punjab, Pakistan',
      phone: '0300-1234567',
      greeting_message: 'Fresh & Crispy Nashta Everyday',
      admin_pin: '1234',
      cash_rounding_enabled: true,
      require_admin_pin_refunds: true,
      default_tax_rate: 0,
      max_cashier_discount_percent: 15,
    };

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const store = localStore.get();
    let current = store.pos_settings?.[0];

    if (!current) {
      current = { id: '33333333-3333-3333-3333-333333333301' };
      store.pos_settings = [current];
    }

    const oldValues = { ...current };

    if (body.business_name !== undefined) current.business_name = body.business_name;
    if (body.address !== undefined) current.address = body.address;
    if (body.phone !== undefined) current.phone = body.phone;
    if (body.greeting_message !== undefined) current.greeting_message = body.greeting_message;
    if (body.admin_pin !== undefined && body.admin_pin.trim().length > 0) current.admin_pin = String(body.admin_pin).trim();
    if (body.cash_rounding_enabled !== undefined) current.cash_rounding_enabled = Boolean(body.cash_rounding_enabled);
    if (body.require_admin_pin_refunds !== undefined) current.require_admin_pin_refunds = Boolean(body.require_admin_pin_refunds);
    if (body.default_tax_rate !== undefined) current.default_tax_rate = Number(body.default_tax_rate);
    if (body.max_cashier_discount_percent !== undefined) current.max_cashier_discount_percent = Number(body.max_cashier_discount_percent);
    if (body.receipt_template !== undefined) {
      current.receipt_template = {
        ...(current.receipt_template || {}),
        ...body.receipt_template,
      };
    }

    await logAuditEvent({
      user_name: body.cashier_name || 'Admin',
      action: 'SETTINGS_UPDATE',
      entity_type: 'pos_settings',
      entity_id: current.id,
      description: `POS Settings updated by ${body.cashier_name || 'Admin'}`,
      old_values: oldValues,
      new_values: current,
    });

    localStore.save();

    return NextResponse.json({ success: true, settings: current });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

