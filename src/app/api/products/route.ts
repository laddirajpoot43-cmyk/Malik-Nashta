import { NextResponse } from 'next/server';
import { localStore, logAuditEvent, generateUUID } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const store = localStore.get();
    const categories = store.categories || [];
    const products = (store.products || []).map((p: any) => {
      const cat = categories.find((c: any) => c.id === p.category_id);
      return {
        ...p,
        category_name: cat?.name || 'Uncategorized',
      };
    });
    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      category_id,
      name,
      short_name,
      selling_price,
      cost_price = 0,
      availability = 'available',
      cashier_name = 'Admin',
    } = body;

    if (!name || selling_price === undefined) {
      return NextResponse.json({ success: false, error: 'Product name and selling price are required.' }, { status: 400 });
    }

    const store = localStore.get();
    const newProduct = {
      id: generateUUID(),
      category_id: category_id || store.categories?.[0]?.id,
      name,
      short_name: short_name || name,
      selling_price: Number(selling_price),
      cost_price: Number(cost_price),
      availability,
      is_active: true,
      sort_order: (store.products?.length || 0) + 1,
    };

    store.products.push(newProduct);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'PRODUCT_CREATED',
      entity_type: 'product',
      entity_id: newProduct.id,
      description: `New menu product "${name}" added at Rs. ${newProduct.selling_price}`,
    });

    localStore.save();

    return NextResponse.json({ success: true, product: newProduct });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, short_name, selling_price, cost_price, availability, is_active, category_id, cashier_name = 'Admin' } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Product ID is required.' }, { status: 400 });
    }

    const store = localStore.get();
    const product = (store.products || []).find((p: any) => p.id === id);

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
    }

    const oldPrice = product.selling_price;

    if (name !== undefined) product.name = name;
    if (short_name !== undefined) product.short_name = short_name;
    if (selling_price !== undefined) product.selling_price = Number(selling_price);
    if (cost_price !== undefined) product.cost_price = Number(cost_price);
    if (availability !== undefined) product.availability = availability;
    if (is_active !== undefined) product.is_active = Boolean(is_active);
    if (category_id !== undefined) product.category_id = category_id;

    await logAuditEvent({
      user_name: cashier_name,
      action: 'PRODUCT_UPDATED',
      entity_type: 'product',
      entity_id: product.id,
      description: `Product "${product.name}" updated. Price: Rs. ${oldPrice} -> Rs. ${product.selling_price}`,
      old_values: { selling_price: oldPrice },
      new_values: { selling_price: product.selling_price, availability: product.availability },
    });

    localStore.save();

    return NextResponse.json({ success: true, product });
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
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const store = localStore.get();
    const index = (store.products || []).findIndex((p: any) => p.id === id);
    if (index === -1) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const removed = store.products.splice(index, 1)[0];

    await logAuditEvent({
      user_name: cashier_name,
      action: 'PRODUCT_DELETED',
      entity_type: 'product',
      entity_id: id,
      description: `Product "${removed.name}" deleted by ${cashier_name}`,
      old_values: removed,
    });

    localStore.save();
    return NextResponse.json({ success: true, deletedProduct: removed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
