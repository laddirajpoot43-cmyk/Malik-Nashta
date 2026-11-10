import { NextResponse } from 'next/server';
import { localStore, logAuditEvent, generateUUID } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';

    const store = localStore.get();
    const materials = (store.raw_materials || []).filter((m: any) => includeInactive || m.is_active !== false);
    return NextResponse.json({ success: true, rawMaterials: materials });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, unit = 'kg', default_price = 0, category = 'General', cashier_name = 'Admin' } = body;

    if (!name || String(name).trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Raw material name is required.' }, { status: 400 });
    }

    const store = localStore.get();
    if (!store.raw_materials) {
      store.raw_materials = [];
    }

    const newMaterial = {
      id: generateUUID(),
      name: String(name).trim(),
      unit: String(unit).trim(),
      default_price: Number(default_price) || 0,
      category: String(category).trim() || 'General',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    store.raw_materials.push(newMaterial);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'RAW_MATERIAL_CREATED',
      entity_type: 'raw_material',
      entity_id: newMaterial.id,
      description: `New raw ingredient "${newMaterial.name}" added at Rs. ${newMaterial.default_price}/${newMaterial.unit}`,
      new_values: newMaterial,
    });

    localStore.save();

    return NextResponse.json({ success: true, rawMaterial: newMaterial });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, unit, default_price, category, is_active, cashier_name = 'Admin' } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Raw material ID is required' }, { status: 400 });
    }

    const store = localStore.get();
    const material = (store.raw_materials || []).find((m: any) => m.id === id);

    if (!material) {
      return NextResponse.json({ success: false, error: 'Raw material not found' }, { status: 404 });
    }

    const oldValues = { ...material };

    if (name !== undefined) material.name = String(name).trim();
    if (unit !== undefined) material.unit = String(unit).trim();
    if (default_price !== undefined) material.default_price = Number(default_price);
    if (category !== undefined) material.category = String(category).trim();
    if (is_active !== undefined) material.is_active = Boolean(is_active);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'RAW_MATERIAL_UPDATED',
      entity_type: 'raw_material',
      entity_id: id,
      description: `Raw material "${material.name}" updated`,
      old_values: oldValues,
      new_values: material,
    });

    localStore.save();
    return NextResponse.json({ success: true, rawMaterial: material });
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
      return NextResponse.json({ success: false, error: 'Raw material ID is required' }, { status: 400 });
    }

    const store = localStore.get();
    const index = (store.raw_materials || []).findIndex((m: any) => m.id === id);

    if (index === -1) {
      return NextResponse.json({ success: false, error: 'Raw material not found' }, { status: 404 });
    }

    const removed = store.raw_materials.splice(index, 1)[0];

    await logAuditEvent({
      user_name: cashier_name,
      action: 'RAW_MATERIAL_DELETED',
      entity_type: 'raw_material',
      entity_id: id,
      description: `Raw material "${removed.name}" deleted by ${cashier_name}`,
      old_values: removed,
    });

    localStore.save();
    return NextResponse.json({ success: true, deletedMaterial: removed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
