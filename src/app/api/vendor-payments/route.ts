import { NextResponse } from 'next/server';
import { localStore, logAuditEvent, generateUUID } from '@/lib/db';
import { subtractMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const vendor_id = searchParams.get('vendor_id');
    const store = localStore.get();

    let list = store.vendor_payments || [];
    if (vendor_id) {
      list = list.filter((p: any) => p.vendor_id === vendor_id);
    }

    return NextResponse.json({ success: true, payments: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      vendor_id,
      amount,
      payment_date = new Date().toISOString().slice(0, 10),
      payment_method = 'cash',
      reference_number,
      deduct_from_register = false,
      note,
      cashier_name = 'Admin',
    } = body;

    const payAmt = Number(amount);
    if (!vendor_id || !payAmt || payAmt <= 0) {
      return NextResponse.json({ success: false, error: 'Valid vendor and positive payment amount are required.' }, { status: 400 });
    }

    const store = localStore.get();
    const vendor = (store.vendors || []).find((v: any) => v.id === vendor_id);

    if (!vendor) {
      return NextResponse.json({ success: false, error: 'Vendor not found.' }, { status: 404 });
    }

    // Decrement vendor's current_balance
    vendor.current_balance = subtractMoney(vendor.current_balance || 0, payAmt);

    // Generate sequential voucher VPAY-01001
    const paymentNumber = localStore.nextSeq('vendor_pay_seq');

    // If deduct_from_register is true, deduct from active drawer
    let registerTx = null;
    if (deduct_from_register) {
      const activeRegister = (store.register_sessions || []).find((s: any) => s.status === 'open');
      if (activeRegister) {
        registerTx = {
          id: generateUUID(),
          register_session_id: activeRegister.id,
          type: 'CASH_OUT',
          amount: payAmt,
          order_id: null,
          refund_id: null,
          reason: `Supplier Payment: ${paymentNumber} (${vendor.name})`,
          note: note || `Khata payment deducted from counter drawer`,
          user_name_snapshot: cashier_name,
          created_at: new Date().toISOString(),
        };
        store.register_transactions.unshift(registerTx);
      }
    }

    const newPayment = {
      id: generateUUID(),
      payment_number: paymentNumber,
      vendor_id: vendor.id,
      amount: payAmt,
      payment_date,
      payment_method,
      reference_number: reference_number || null,
      deduct_from_register: Boolean(deduct_from_register),
      note: note || null,
      created_at: new Date().toISOString(),
      vendor_name: vendor.name,
    };

    store.vendor_payments.unshift(newPayment);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'VENDOR_PAYMENT',
      entity_type: 'vendor_payment',
      entity_id: newPayment.id,
      description: `Payment ${paymentNumber} of Rs. ${payAmt} made to ${vendor.name} via ${payment_method}. New Balance: Rs. ${vendor.current_balance}`,
      new_values: { payment_number: paymentNumber, amount: payAmt, current_balance: vendor.current_balance },
    });

    localStore.save();

    return NextResponse.json({
      success: true,
      payment: newPayment,
      vendor_balance: vendor.current_balance,
      register_transaction: registerTx,
    });
  } catch (error: any) {
    console.error('Vendor payment error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
