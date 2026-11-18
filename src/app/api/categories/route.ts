import { NextResponse } from 'next/server';
import { localStore, logAuditEvent, generateUUID } from '@/lib/db';
import { insforgeAdmin } from '@/lib/insforge';

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

    // Direct synchronous Cloud PostgreSQL persistence
    try {
      await insforgeAdmin.database.from('categories').upsert([newCat], { onConflict: 'id' });
    } catch (e) {
      console.warn('Cloud sync error for category create:', e);
    }

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

    // Direct synchronous Cloud PostgreSQL persistence
    try {
      await insforgeAdmin.database.from('categories').upsert([{
        id: category.id,
        name: category.name,
        display_order: category.display_order,
        is_active: category.is_active,
        created_at: category.created_at,
      }], { onConflict: 'id' });
    } catch (e) {
      console.warn('Cloud sync error for category update:', e);
    }

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

    const categoryToDelete = store.categories[index];
    const assignedProducts = (store.products || []).filter((p: any) => p.category_id === id);
    if (assignedProducts.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot delete category "${categoryToDelete.name}". It is currently assigned to ${assignedProducts.length} product(s) (${assignedProducts.slice(0, 3).map((p: any) => p.name).join(', ')}${assignedProducts.length > 3 ? '...' : ''}). Please reassign or remove these products first.`,
      }, { status: 400 });
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

    // Direct synchronous Cloud PostgreSQL persistence
    try {
      await insforgeAdmin.database.from('categories').delete().eq('id', id);
    } catch (e) {
      console.warn('Cloud sync error for category delete:', e);
    }

    return NextResponse.json({ success: true, deletedCategory: removed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
