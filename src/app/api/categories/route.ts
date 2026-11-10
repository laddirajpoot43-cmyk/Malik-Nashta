import { NextResponse } from 'next/server';
import { localStore, logAuditEvent, generateUUID } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const store = localStore.get();
    const categories = (store.categories || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, display_order, cashier_name = 'Admin' } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Category name is required.' }, { status: 400 });
    }

    const store = localStore.get();
    const newCat = {
      id: generateUUID(),
      name,
      display_order: Number(display_order) || (store.categories?.length || 0) + 1,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    store.categories.push(newCat);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'CATEGORY_CREATED',
      entity_type: 'category',
      entity_id: newCat.id,
      description: `Category "${name}" created`,
    });

    localStore.save();

    return NextResponse.json({ success: true, category: newCat });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, display_order, is_active, cashier_name = 'Admin' } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
    }

    const store = localStore.get();
    const category = (store.categories || []).find((c: any) => c.id === id);
    if (!category) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    if (name !== undefined) category.name = name;
    if (display_order !== undefined) category.display_order = Number(display_order);
    if (is_active !== undefined) category.is_active = Boolean(is_active);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'CATEGORY_UPDATED',
      entity_type: 'category',
      entity_id: id,
      description: `Category "${category.name}" updated`,
    });

    localStore.save();
    return NextResponse.json({ success: true, category });
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
      return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
    }

    const store = localStore.get();
    const index = (store.categories || []).findIndex((c: any) => c.id === id);
    if (index === -1) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    const removed = store.categories.splice(index, 1)[0];

    await logAuditEvent({
      user_name: cashier_name,
      action: 'CATEGORY_DELETED',
      entity_type: 'category',
      entity_id: id,
      description: `Category "${removed.name}" deleted by ${cashier_name}`,
    });

    localStore.save();
    return NextResponse.json({ success: true, deletedCategory: removed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
