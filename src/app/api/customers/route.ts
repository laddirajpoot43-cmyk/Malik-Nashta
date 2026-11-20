import { localStore, logAuditEvent, generateUUID } from '@/lib/db';
import { addMoney, subtractMoney } from '@/lib/money';
import { jsonResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase().trim() || '';
    const customerId = searchParams.get('id');

    const store = await localStore.ensureFresh(1500);
    let customers = [...(store.customers || [])];
    const transactions = [...(store.customer_transactions || [])];

    if (customerId) {
      const customer = customers.find((c: any) => c.id === customerId);
      if (!customer) {
        return jsonResponse({ success: false, error: 'Customer not found' }, { status: 404 });
      }
      const ledger = transactions
        .filter((t: any) => t.customer_id === customerId)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return jsonResponse({ success: true, customer, transactions: ledger });
    }

    if (search) {
      customers = customers.filter(
        (c: any) =>
          (c.name && c.name.toLowerCase().includes(search)) ||
          (c.phone && c.phone.includes(search))
      );
    }

    const totalUdhaarReceivable = (store.customers || []).reduce(
      (sum: number, c: any) => addMoney(sum, Number(c.current_balance || 0)),
      0
    );

    const totalCollected = transactions
      .filter((t: any) => t.type === 'PAYMENT')
      .reduce((sum: number, t: any) => addMoney(sum, Number(t.amount || 0)), 0);

    return jsonResponse({
      success: true,
      customers,
      transactions: transactions.slice(0, 100),
      summary: {
        total_customers: (store.customers || []).length,
        total_udhaar_receivable: totalUdhaarReceivable,
        total_collected: totalCollected,
      },
    });
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      action = 'create',
      customer_id,
      name,
      phone,
      address,
      opening_balance = 0,
      credit_limit = 0,
      amount,
      payment_method = 'cash',
      add_to_register = true,
      note,
      cashier_name = 'Admin',
    } = body;

    const store = await localStore.ensureFresh(1500);
    if (!Array.isArray(store.customers)) store.customers = [];
    if (!Array.isArray(store.customer_transactions)) store.customer_transactions = [];

    // Action: Record Payment OR Manual Udhaar Entry
    if (action === 'payment' || action === 'add_udhaar') {
      const cust = store.customers.find((c: any) => c.id === customer_id);
      if (!cust) {
        return jsonResponse({ success: false, error: 'Customer not found.' }, { status: 404 });
      }
      const amt = Number(amount);
      if (!amt || amt <= 0) {
        return jsonResponse({ success: false, error: 'Valid positive amount is required.' }, { status: 400 });
      }

      const prevBal = Number(cust.current_balance || 0);
      const isPayment = action === 'payment';
      const newBal = isPayment ? Math.max(0, subtractMoney(prevBal, amt)) : addMoney(prevBal, amt);
      cust.current_balance = newBal;

      const voucherNo = localStore.nextSeq('customer_pay_seq');
      const tx = {
        id: generateUUID(),
        customer_id: cust.id,
        customer_name: cust.name,
        voucher_no: voucherNo,
        type: isPayment ? 'PAYMENT' : 'UDHAAR',
        amount: amt,
        payment_method: isPayment ? payment_method : 'udhaar',
        balance_after: newBal,
        note: note || (isPayment ? 'Udhaar Payment Received' : 'Manual Udhaar Added'),
        created_by: cashier_name,
        created_at: new Date().toISOString(),
      };
      store.customer_transactions.unshift(tx);

      // If cash received from udhaar customer and drawer is open, record CASH_IN
      const activeRegister = (store.register_sessions || []).find((s: any) => s.status === 'open');
      if (isPayment && payment_method === 'cash' && add_to_register && activeRegister) {
        store.register_transactions.unshift({
          id: generateUUID(),
          register_session_id: activeRegister.id,
          type: 'CASH_IN',
          amount: amt,
          order_id: null,
          refund_id: null,
          reason: `Customer Udhaar Recovery (${cust.name})`,
          note: `Voucher: ${voucherNo}`,
          user_name_snapshot: cashier_name,
          created_at: new Date().toISOString(),
        });
      }

      await logAuditEvent({
        user_name: cashier_name,
        action: isPayment ? 'CUSTOMER_UDHAAR_PAID' : 'CUSTOMER_UDHAAR_ADDED',
        entity_type: 'customer',
        entity_id: cust.id,
        description: `${isPayment ? 'Received' : 'Added'} Rs. ${amt} ${isPayment ? 'from' : 'to'} ${cust.name} (${voucherNo})`,
        old_values: { current_balance: prevBal },
        new_values: { current_balance: newBal, amount: amt },
      });

      await localStore.saveAndSync();
      return jsonResponse({ success: true, customer: cust, transaction: tx });
    }

    // Action: Create New Customer
    if (!name || !String(name).trim()) {
      return jsonResponse({ success: false, error: 'Customer name is required.' }, { status: 400 });
    }

    const openBal = Math.max(0, Number(opening_balance) || 0);
    const newCustomer = {
      id: generateUUID(),
      name: String(name).trim(),
      phone: phone ? String(phone).trim() : '',
      address: address ? String(address).trim() : '',
      opening_balance: openBal,
      current_balance: openBal,
      credit_limit: Math.max(0, Number(credit_limit) || 0),
      is_active: true,
      created_at: new Date().toISOString(),
    };

    store.customers.unshift(newCustomer);

    if (openBal > 0) {
      store.customer_transactions.unshift({
        id: generateUUID(),
        customer_id: newCustomer.id,
        customer_name: newCustomer.name,
        voucher_no: 'OPEN-BAL',
        type: 'UDHAAR',
        amount: openBal,
        payment_method: 'opening',
        balance_after: openBal,
        note: 'Opening Udhaar Balance',
        created_by: cashier_name,
        created_at: new Date().toISOString(),
      });
    }

    await logAuditEvent({
      user_name: cashier_name,
      action: 'CUSTOMER_CREATED',
      entity_type: 'customer',
      entity_id: newCustomer.id,
      description: `Customer Khata "${newCustomer.name}" created with opening balance Rs. ${openBal}`,
      new_values: newCustomer,
    });

    await localStore.saveAndSync();
    return jsonResponse({ success: true, customer: newCustomer });
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, phone, address, credit_limit, cashier_name = 'Admin' } = body;

    if (!id) return jsonResponse({ success: false, error: 'Customer ID is required' }, { status: 400 });

    const store = await localStore.ensureFresh(1500);
    const cust = (store.customers || []).find((c: any) => c.id === id);
    if (!cust) return jsonResponse({ success: false, error: 'Customer not found' }, { status: 404 });

    if (name !== undefined) cust.name = String(name).trim();
    if (phone !== undefined) cust.phone = String(phone).trim();
    if (address !== undefined) cust.address = String(address).trim();
    if (credit_limit !== undefined) cust.credit_limit = Math.max(0, Number(credit_limit) || 0);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'CUSTOMER_UPDATED',
      entity_type: 'customer',
      entity_id: id,
      description: `Customer "${cust.name}" updated by ${cashier_name}`,
      new_values: cust,
    });

    await localStore.saveAndSync();
    return jsonResponse({ success: true, customer: cust });
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const cashier_name = searchParams.get('cashier_name') || 'Admin';

    if (!id) return jsonResponse({ success: false, error: 'Customer ID is required' }, { status: 400 });

    const store = await localStore.ensureFresh(1500);
    if (!Array.isArray(store.customers)) store.customers = [];
    const idx = store.customers.findIndex((c: any) => c.id === id);
    if (idx === -1) return jsonResponse({ success: false, error: 'Customer not found' }, { status: 404 });

    const cust = store.customers[idx];
    if (Number(cust.current_balance || 0) > 0) {
      return jsonResponse(
        { success: false, error: `Cannot delete customer with unpaid Udhaar balance of Rs. ${cust.current_balance}. Collect payment first.` },
        { status: 400 }
      );
    }

    store.customers.splice(idx, 1);
    store.customer_transactions = (store.customer_transactions || []).filter((t: any) => t.customer_id !== id);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'CUSTOMER_DELETED',
      entity_type: 'customer',
      entity_id: id,
      description: `Customer "${cust.name}" removed by ${cashier_name}`,
      old_values: cust,
    });

    await localStore.saveAndSync();
    return jsonResponse({ success: true });
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message }, { status: 500 });
  }
}
