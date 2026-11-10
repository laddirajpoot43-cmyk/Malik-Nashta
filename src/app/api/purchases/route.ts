import { NextResponse } from 'next/server';
import { localStore, withTransaction, logAuditEvent, generateUUID } from '@/lib/db';
import { addMoney, subtractMoney, multiplyMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const store = localStore.get();
    const invoices = (store.purchase_invoices || []).map((inv: any) => {
      const items = (store.purchase_items || []).filter((item: any) => item.purchase_invoice_id === inv.id);
      return { ...inv, items };
    });
    return NextResponse.json({ success: true, purchases: invoices });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      vendor_id,
      invoice_date = new Date().toISOString().slice(0, 10),
      items = [], // [{ raw_material_id, name, quantity, unit, unit_price }]
      discount_amount = 0,
      paid_amount = 0,
      payment_method = 'cash',
      deduct_from_register = false,
      cashier_name = 'Admin',
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one raw material item is required.' }, { status: 400 });
    }

    const store = localStore.get();
    const vendor = (store.vendors || []).find((v: any) => v.id === vendor_id);
    const vendorName = vendor ? vendor.name : body.vendor_name || 'Market Supplier';

    // Calculate line totals and subtotal
    let subtotal = 0;
    const invoiceId = generateUUID();
    const itemsToInsert: any[] = [];

    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.unit_price) || 0;
      const lineTotal = multiplyMoney(rate, qty);
      subtotal = addMoney(subtotal, lineTotal);

      itemsToInsert.push({
        id: generateUUID(),
        purchase_invoice_id: invoiceId,
        raw_material_id: it.raw_material_id || null,
        raw_material_name: it.name || it.raw_material_name || it.item_name || 'Raw Ingredient',
        quantity: qty,
        unit: it.unit || 'kg',
        unit_price: rate,
        line_total: lineTotal,
      });
    }

    const discount = Number(discount_amount) || 0;
    const totalAmount = Math.max(0, subtractMoney(subtotal, discount));
    const paid = Number(paid_amount) || 0;
    const balance = Math.max(0, subtractMoney(totalAmount, paid));

    const paymentStatus = paid >= totalAmount ? 'paid' : paid > 0 ? 'partial' : 'credit';

    // Generate sequential purchase invoice number PUR-01001
    const invoiceNumber = localStore.nextSeq('purchase_seq');

    // If deduct_from_register is true and paid > 0, deduct from active cash register
    let registerTx = null;
    if (deduct_from_register && paid > 0) {
      const activeRegister = (store.register_sessions || []).find((s: any) => s.status === 'open');
      if (activeRegister) {
        registerTx = {
          id: generateUUID(),
          register_session_id: activeRegister.id,
          type: 'CASH_OUT',
          amount: paid,
          order_id: null,
          refund_id: null,
          reason: `Maal Kharidari: ${invoiceNumber} (${vendorName})`,
          note: `Auto-deducted from drawer for raw material purchase`,
          user_name_snapshot: cashier_name,
          created_at: new Date().toISOString(),
        };
        store.register_transactions.unshift(registerTx);
      }
    }

    // Update vendor balance: increment current_balance with the unpaid credit balance
    if (vendor && balance > 0) {
      vendor.current_balance = addMoney(vendor.current_balance || 0, balance);
    }

    const newInvoice = {
      id: invoiceId,
      invoice_number: invoiceNumber,
      vendor_id: vendor ? vendor.id : null,
      vendor_name_snapshot: vendorName,
      invoice_date,
      subtotal,
      discount_amount: discount,
      total_amount: totalAmount,
      paid_amount: paid,
      balance_amount: balance,
      payment_method,
      payment_status: paymentStatus,
      deduct_from_register: Boolean(deduct_from_register),
      created_at: new Date().toISOString(),
      items: itemsToInsert,
    };

    store.purchase_invoices.unshift(newInvoice);
    for (const item of itemsToInsert) {
      store.purchase_items.push(item);
    }

    await logAuditEvent({
      user_name: cashier_name,
      action: 'PURCHASE_CREATED',
      entity_type: 'purchase_invoice',
      entity_id: invoiceId,
      description: `Purchase invoice ${invoiceNumber} created for ${vendorName}. Total: Rs. ${totalAmount}, Paid: Rs. ${paid}, Udhaar: Rs. ${balance}`,
      new_values: { invoice_number: invoiceNumber, total_amount: totalAmount, balance_amount: balance },
    });

    localStore.save();

    return NextResponse.json({
      success: true,
      invoice: newInvoice,
      register_transaction: registerTx,
      vendor_balance: vendor ? vendor.current_balance : null,
    });
  } catch (error: any) {
    console.error('Purchase invoice error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const cashier_name = searchParams.get('cashier_name') || 'Admin';

    if (!id) {
      return NextResponse.json({ success: false, error: 'Purchase invoice ID is required' }, { status: 400 });
    }

    const store = localStore.get();
    const index = (store.purchase_invoices || []).findIndex((inv: any) => inv.id === id || inv.invoice_number === id);

    if (index === -1) {
      return NextResponse.json({ success: false, error: 'Purchase invoice not found' }, { status: 404 });
    }

    const removed = store.purchase_invoices.splice(index, 1)[0];

    // Remove associated purchase items
    store.purchase_items = (store.purchase_items || []).filter((pi: any) => pi.purchase_invoice_id !== removed.id);

    // Reverse vendor credit balance if applicable
    if (removed.vendor_id && Number(removed.balance_amount || 0) > 0) {
      const vendor = (store.vendors || []).find((v: any) => v.id === removed.vendor_id);
      if (vendor) {
        vendor.current_balance = Math.max(0, subtractMoney(vendor.current_balance || 0, Number(removed.balance_amount || 0)));
      }
    }

    // If deducted from register, remove matching CASH_OUT tx
    if (removed.deduct_from_register && removed.invoice_number) {
      store.register_transactions = (store.register_transactions || []).filter(
        (tx: any) => !(tx.type === 'CASH_OUT' && String(tx.reason || '').includes(removed.invoice_number))
      );
    }

    await logAuditEvent({
      user_name: cashier_name,
      action: 'PURCHASE_DELETED',
      entity_type: 'purchase_invoice',
      entity_id: removed.id,
      description: `Purchase invoice ${removed.invoice_number} (Rs. ${removed.total_amount}) deleted by ${cashier_name}`,
      old_values: removed,
    });

    localStore.save();
    return NextResponse.json({ success: true, deletedInvoice: removed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

