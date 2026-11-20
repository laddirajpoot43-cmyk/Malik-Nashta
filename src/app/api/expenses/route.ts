import { localStore, logAuditEvent, generateUUID } from '@/lib/db';
import { addMoney } from '@/lib/money';
import { jsonResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const date = searchParams.get('date');

    const store = await localStore.ensureFresh(1500);
    let expenses = [...(store.expenses || [])];

    const todayStr = new Date().toISOString().slice(0, 10);
    const monthPrefix = todayStr.slice(0, 7);

    const todayTotal = expenses
      .filter((e: any) => (e.expense_date || e.created_at || '').slice(0, 10) === todayStr)
      .reduce((sum: number, e: any) => addMoney(sum, Number(e.amount || 0)), 0);

    const monthTotal = expenses
      .filter((e: any) => (e.expense_date || e.created_at || '').slice(0, 7) === monthPrefix)
      .reduce((sum: number, e: any) => addMoney(sum, Number(e.amount || 0)), 0);

    const allTimeTotal = expenses.reduce((sum: number, e: any) => addMoney(sum, Number(e.amount || 0)), 0);

    if (category && category !== 'all') {
      expenses = expenses.filter((e: any) => e.category === category);
    }

    if (date) {
      expenses = expenses.filter((e: any) => (e.expense_date || e.created_at || '').slice(0, 10) === date);
    }

    expenses.sort((a: any, b: any) => new Date(b.created_at || b.expense_date || 0).getTime() - new Date(a.created_at || a.expense_date || 0).getTime());

    return jsonResponse({
      success: true,
      expenses,
      summary: {
        today_total: todayTotal,
        month_total: monthTotal,
        all_time_total: allTimeTotal,
        count: (store.expenses || []).length,
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
      title,
      category = 'Utilities & Bills',
      amount,
      expense_date,
      payment_method = 'cash',
      deduct_from_register = true,
      note,
      cashier_name = 'Admin',
    } = body;

    const amt = Number(amount);
    if (!title || !String(title).trim()) {
      return jsonResponse({ success: false, error: 'Expense title is required.' }, { status: 400 });
    }
    if (!amt || amt <= 0) {
      return jsonResponse({ success: false, error: 'Valid positive amount is required.' }, { status: 400 });
    }

    const store = await localStore.ensureFresh(1500);
    if (!Array.isArray(store.expenses)) store.expenses = [];

    const voucherNo = localStore.nextSeq('expense_seq');
    const activeRegister = (store.register_sessions || []).find((s: any) => s.status === 'open');
    const didDeduct = Boolean(deduct_from_register && payment_method === 'cash' && activeRegister);

    const newExpense = {
      id: generateUUID(),
      voucher_no: voucherNo,
      title: String(title).trim(),
      category,
      amount: amt,
      expense_date: expense_date || new Date().toISOString().slice(0, 10),
      payment_method,
      deducted_from_register: didDeduct,
      note: note ? String(note).trim() : '',
      recorded_by: cashier_name,
      created_at: new Date().toISOString(),
    };

    store.expenses.unshift(newExpense);

    if (didDeduct && activeRegister) {
      store.register_transactions.unshift({
        id: generateUUID(),
        register_session_id: activeRegister.id,
        type: 'CASH_OUT',
        amount: amt,
        order_id: null,
        refund_id: null,
        reason: `Hotel Expense (${category}): ${newExpense.title}`,
        note: `Voucher: ${voucherNo}`,
        user_name_snapshot: cashier_name,
        created_at: new Date().toISOString(),
      });
    }

    await logAuditEvent({
      user_name: cashier_name,
      action: 'EXPENSE_RECORDED',
      entity_type: 'expense',
      entity_id: newExpense.id,
      description: `Expense "${newExpense.title}" (${category}) Rs. ${amt} recorded by ${cashier_name}`,
      new_values: newExpense,
    });

    await localStore.saveAndSync();
    return jsonResponse({ success: true, expense: newExpense });
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const cashier_name = searchParams.get('cashier_name') || 'Admin';

    if (!id) return jsonResponse({ success: false, error: 'Expense ID is required' }, { status: 400 });

    const store = await localStore.ensureFresh(1500);
    if (!Array.isArray(store.expenses)) store.expenses = [];
    const idx = store.expenses.findIndex((e: any) => e.id === id);
    if (idx === -1) return jsonResponse({ success: false, error: 'Expense not found' }, { status: 404 });

    const removed = store.expenses[idx];
    store.expenses.splice(idx, 1);

    await logAuditEvent({
      user_name: cashier_name,
      action: 'EXPENSE_DELETED',
      entity_type: 'expense',
      entity_id: id,
      description: `Expense "${removed.title}" (Rs. ${removed.amount}) deleted by ${cashier_name}`,
      old_values: removed,
    });

    await localStore.saveAndSync();
    return jsonResponse({ success: true });
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message }, { status: 500 });
  }
}
