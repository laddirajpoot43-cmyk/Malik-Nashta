import { NextResponse } from 'next/server';
import { localStore, logAuditEvent, generateUUID } from '@/lib/db';
import { addMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const store = localStore.get();
    const vendors = store.vendors || [];

    let totalPayables = 0;
    const vendorList = vendors.map((v: any) => {
      const balance = Number(v.current_balance || 0);
      totalPayables = addMoney(totalPayables, balance);

      // Invoices count & payments count
      const invCount = (store.purchase_invoices || []).filter((p: any) => p.vendor_id === v.id).length;
      const payCount = (store.vendor_payments || []).filter((vp: any) => vp.vendor_id === v.id).length;

      return {
        ...v,
        invoices_count: invCount,
        payments_count: payCount,
      };
    });

    return NextResponse.json({
      success: true,
      vendors: vendorList,
      totalPayables,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, category = 'General', address, opening_balance = 0, cashier_name = 'Admin' } = body;

    if (!name || String(name).trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Vendor name is required.' }, { status: 400 });
    }

    const store = localStore.get();
    if (!store.vendors) {
      store.vendors = [];
    }

    const openBal = Number(opening_balance) || 0;

    const newVendor = {
      id: generateUUID(),
      name: String(name).trim(),
      phone: phone || null,
      category: category || 'General',
      address: address || null,
      opening_balance: openBal,
      current_balance: openBal,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    store.vendors.push(newVendor);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'VENDOR_CREATED',
      entity_type: 'vendor',
      entity_id: newVendor.id,
      description: `New vendor "${newVendor.name}" created with opening balance Rs. ${openBal}`,
      new_values: { name: newVendor.name, opening_balance: openBal },
    });

    localStore.save();

    return NextResponse.json({ success: true, vendor: newVendor });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, phone, category, address, is_active, cashier_name = 'Admin' } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Vendor ID is required' }, { status: 400 });
    }

    const store = localStore.get();
    const vendor = (store.vendors || []).find((v: any) => v.id === id);

    if (!vendor) {
      return NextResponse.json({ success: false, error: 'Vendor not found' }, { status: 404 });
    }

    const oldValues = { ...vendor };

    if (name !== undefined) vendor.name = String(name).trim();
    if (phone !== undefined) vendor.phone = String(phone).trim() || null;
    if (category !== undefined) vendor.category = String(category).trim();
    if (address !== undefined) vendor.address = String(address).trim() || null;
    if (is_active !== undefined) vendor.is_active = Boolean(is_active);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'VENDOR_UPDATED',
      entity_type: 'vendor',
      entity_id: id,
      description: `Vendor "${vendor.name}" profile updated`,
      old_values: oldValues,
      new_values: vendor,
    });

    localStore.save();
    return NextResponse.json({ success: true, vendor });
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
      return NextResponse.json({ success: false, error: 'Vendor ID is required' }, { status: 400 });
    }

    const store = localStore.get();
    const vendor = (store.vendors || []).find((v: any) => v.id === id);

    if (!vendor) {
      return NextResponse.json({ success: false, error: 'Vendor not found' }, { status: 404 });
    }

    // Check if vendor has purchase invoices or payments
    const hasInvoices = (store.purchase_invoices || []).some((p: any) => p.vendor_id === id);
    const hasPayments = (store.vendor_payments || []).some((vp: any) => vp.vendor_id === id);

    if (hasInvoices || hasPayments) {
      // Soft-delete / deactivate so financial khata integrity is preserved
      vendor.is_active = false;
      await logAuditEvent({
        user_name: cashier_name,
        action: 'VENDOR_DEACTIVATED',
        entity_type: 'vendor',
        entity_id: id,
        description: `Vendor "${vendor.name}" deactivated (preserved for ledger history)`,
      });
      localStore.save();
      return NextResponse.json({ success: true, message: 'Vendor has transaction history, marked as inactive.', vendor });
    }

    // If no transactions exist, hard delete safely
    const index = store.vendors.findIndex((v: any) => v.id === id);
    const removed = store.vendors.splice(index, 1)[0];

    await logAuditEvent({
      user_name: cashier_name,
      action: 'VENDOR_DELETED',
      entity_type: 'vendor',
      entity_id: id,
      description: `Vendor "${removed.name}" deleted by ${cashier_name}`,
      old_values: removed,
    });

    localStore.save();
    return NextResponse.json({ success: true, deletedVendor: removed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
