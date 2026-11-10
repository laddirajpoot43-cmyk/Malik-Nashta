import { NextResponse } from 'next/server';
import { localStore, withTransaction, logAuditEvent, generateUUID } from '@/lib/db';
import { addMoney, subtractMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const store = localStore.get();
    const activeRegister = (store.register_sessions || []).find((s: any) => s.status === 'open') || null;

    if (!activeRegister) {
      // Find latest closed register session if any
      const lastSession = store.register_sessions?.[0] || null;
      return NextResponse.json({
        success: true,
        activeRegister: null,
        lastSession,
        hasOpenShift: false,
      });
    }

    // Calculate live transactions for this shift
    const txs = (store.register_transactions || []).filter(
      (tx: any) => tx.register_session_id === activeRegister.id
    );

    let openingFloat = Number(activeRegister.opening_amount || 0);
    let cashSales = 0;
    let cashIn = 0;
    let cashOut = 0;
    let refunds = 0;
    let adjustments = 0;

    for (const tx of txs) {
      const amt = Number(tx.amount || 0);
      switch (tx.type) {
        case 'OPENING':
          // opening amount already tracked in openingFloat
          break;
        case 'SALE':
          cashSales = addMoney(cashSales, amt);
          break;
        case 'CASH_IN':
          cashIn = addMoney(cashIn, amt);
          break;
        case 'CASH_OUT':
          cashOut = addMoney(cashOut, amt);
          break;
        case 'REFUND':
          refunds = addMoney(refunds, amt);
          break;
        case 'ADJUSTMENT':
          adjustments = addMoney(adjustments, amt);
          break;
      }
    }

    // Expected drawer cash: Opening + Sales + Cash In - Cash Out - Refunds + Adjustments
    const expectedCash = addMoney(
      subtractMoney(addMoney(openingFloat, cashSales, cashIn), cashOut, refunds),
      adjustments
    );

    // Calculate digital sales in this shift
    const shiftOrders = (store.orders || []).filter(
      (o: any) => o.register_session_id === activeRegister.id && o.status !== 'voided'
    );
    let digitalSales = 0;
    for (const ord of shiftOrders) {
      const digitalPayments = (ord.payments || []).filter((p: any) => p.method_id !== 'cash');
      for (const dp of digitalPayments) {
        digitalSales = addMoney(digitalSales, Number(dp.amount || 0));
      }
    }

    return NextResponse.json({
      success: true,
      hasOpenShift: true,
      activeRegister,
      transactions: txs,
      summary: {
        opening_float: openingFloat,
        cash_sales: cashSales,
        cash_in: cashIn,
        cash_out: cashOut,
        refunds: refunds,
        adjustments: adjustments,
        digital_sales: digitalSales,
        expected_cash: expectedCash,
        orders_count: shiftOrders.length,
      },
    });
  } catch (error: any) {
    console.error('Register GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, opening_amount, amount, reason, note, actual_amount, closing_note, cashier_name = 'Admin' } = body;

    const store = localStore.get();

    if (action === 'open') {
      // Check if already open
      const existingOpen = (store.register_sessions || []).find((s: any) => s.status === 'open');
      if (existingOpen) {
        return NextResponse.json(
          { success: false, error: 'A cash register shift is already currently open.' },
          { status: 400 }
        );
      }

      const openingFloat = Number(opening_amount) >= 0 ? Number(opening_amount) : 5000;
      const sessionId = generateUUID();

      const newSession = {
        id: sessionId,
        user_id: null,
        user_name_snapshot: cashier_name,
        opened_at: new Date().toISOString(),
        opening_amount: openingFloat,
        closed_at: null,
        expected_amount: null,
        actual_amount: null,
        difference: null,
        closing_note: null,
        status: 'open',
      };

      const openingTx = {
        id: generateUUID(),
        register_session_id: sessionId,
        type: 'OPENING',
        amount: openingFloat,
        order_id: null,
        refund_id: null,
        reason: 'Shift Opening Float',
        note: `Opened by ${cashier_name}`,
        user_name_snapshot: cashier_name,
        created_at: new Date().toISOString(),
      };

      store.register_sessions.unshift(newSession);
      store.register_transactions.unshift(openingTx);

      await logAuditEvent({
        user_name: cashier_name,
        action: 'REGISTER_OPEN',
        entity_type: 'register_session',
        entity_id: sessionId,
        description: `Cash register shift opened with Rs. ${openingFloat} float by ${cashier_name}`,
        new_values: { opening_amount: openingFloat },
      });

      localStore.save();
      return NextResponse.json({ success: true, session: newSession, transaction: openingTx });
    }

    // For other actions, register must be open
    const activeRegister = (store.register_sessions || []).find((s: any) => s.status === 'open');
    if (!activeRegister) {
      return NextResponse.json(
        { success: false, error: 'No active cash register shift is currently open.' },
        { status: 400 }
      );
    }

    if (action === 'cash_in') {
      const inAmt = Number(amount);
      if (!inAmt || inAmt <= 0) {
        return NextResponse.json({ success: false, error: 'Valid positive amount is required for Cash In.' }, { status: 400 });
      }

      const tx = {
        id: generateUUID(),
        register_session_id: activeRegister.id,
        type: 'CASH_IN',
        amount: inAmt,
        order_id: null,
        refund_id: null,
        reason: reason || 'Change Float / Cash Deposit',
        note: note || '',
        user_name_snapshot: cashier_name,
        created_at: new Date().toISOString(),
      };

      store.register_transactions.unshift(tx);

      await logAuditEvent({
        user_name: cashier_name,
        action: 'CASH_IN',
        entity_type: 'register_transaction',
        entity_id: tx.id,
        description: `Cash In: Rs. ${inAmt} added to drawer (${reason || 'No reason'}) by ${cashier_name}`,
        new_values: { amount: inAmt, reason },
      });

      localStore.save();
      return NextResponse.json({ success: true, transaction: tx });
    }

    if (action === 'cash_out') {
      const outAmt = Number(amount);
      if (!outAmt || outAmt <= 0) {
        return NextResponse.json({ success: false, error: 'Valid positive amount is required for Cash Out.' }, { status: 400 });
      }

      const tx = {
        id: generateUUID(),
        register_session_id: activeRegister.id,
        type: 'CASH_OUT',
        amount: outAmt,
        order_id: null,
        refund_id: null,
        reason: reason || 'Drawer Petty Expense',
        note: note || '',
        user_name_snapshot: cashier_name,
        created_at: new Date().toISOString(),
      };

      store.register_transactions.unshift(tx);

      await logAuditEvent({
        user_name: cashier_name,
        action: 'CASH_OUT',
        entity_type: 'register_transaction',
        entity_id: tx.id,
        description: `Cash Out: Rs. ${outAmt} removed from drawer (${reason || 'No reason'}) by ${cashier_name}`,
        new_values: { amount: outAmt, reason },
      });

      localStore.save();
      return NextResponse.json({ success: true, transaction: tx });
    }

    if (action === 'close') {
      const actualCounted = Number(actual_amount);
      if (isNaN(actualCounted) || actualCounted < 0) {
        return NextResponse.json({ success: false, error: 'Physically counted cash amount is required.' }, { status: 400 });
      }

      // Calculate expected cash
      const txs = (store.register_transactions || []).filter(
        (tx: any) => tx.register_session_id === activeRegister.id
      );

      let openingFloat = Number(activeRegister.opening_amount || 0);
      let cashSales = 0;
      let cashIn = 0;
      let cashOut = 0;
      let refunds = 0;
      let adjustments = 0;

      for (const tx of txs) {
        const a = Number(tx.amount || 0);
        if (tx.type === 'SALE') cashSales = addMoney(cashSales, a);
        if (tx.type === 'CASH_IN') cashIn = addMoney(cashIn, a);
        if (tx.type === 'CASH_OUT') cashOut = addMoney(cashOut, a);
        if (tx.type === 'REFUND') refunds = addMoney(refunds, a);
        if (tx.type === 'ADJUSTMENT') adjustments = addMoney(adjustments, a);
      }

      const expectedCash = addMoney(
        subtractMoney(addMoney(openingFloat, cashSales, cashIn), cashOut, refunds),
        adjustments
      );

      const difference = subtractMoney(actualCounted, expectedCash);

      activeRegister.status = 'closed';
      activeRegister.closed_at = new Date().toISOString();
      activeRegister.expected_amount = expectedCash;
      activeRegister.actual_amount = actualCounted;
      activeRegister.difference = difference;
      activeRegister.closing_note = closing_note || (difference === 0 ? 'Shift balanced' : `Difference: ${difference}`);

      await logAuditEvent({
        user_name: cashier_name,
        action: 'REGISTER_CLOSE',
        entity_type: 'register_session',
        entity_id: activeRegister.id,
        description: `Shift closed. Expected: Rs. ${expectedCash}, Actual: Rs. ${actualCounted}, Discrepancy: Rs. ${difference}`,
        new_values: {
          expected_amount: expectedCash,
          actual_amount: actualCounted,
          difference: difference,
          closing_note: activeRegister.closing_note,
        },
      });

      localStore.save();
      return NextResponse.json({
        success: true,
        session: activeRegister,
        summary: {
          expected_cash: expectedCash,
          actual_counted: actualCounted,
          difference: difference,
          is_balanced: difference === 0,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action specified' }, { status: 400 });
  } catch (error: any) {
    console.error('Register POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

