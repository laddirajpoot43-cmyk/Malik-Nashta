import { NextResponse } from 'next/server';
import { localStore } from '@/lib/db';
import { addMoney, subtractMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date') || new Date().toISOString().slice(0, 10);

    const store = localStore.get();

    // 1. Filter Orders for today
    const orders = (store.orders || []).filter((o: any) => {
      const orderDate = (o.created_at || '').slice(0, 10);
      return orderDate === dateParam;
    });

    const activeOrders = orders.filter((o: any) => o.status !== 'voided');

    let grossSales = 0;
    let discounts = 0;
    let netSales = 0;
    let cashSales = 0;
    let digitalSales = 0;

    for (const o of activeOrders) {
      grossSales = addMoney(grossSales, Number(o.subtotal || 0));
      discounts = addMoney(discounts, Number(o.discount_amount || 0));
      netSales = addMoney(netSales, Number(o.grand_total || 0));

      for (const p of o.payments || []) {
        if (p.method_id === 'cash') {
          cashSales = addMoney(cashSales, Number(p.amount || 0));
        } else {
          digitalSales = addMoney(digitalSales, Number(p.amount || 0));
        }
      }
    }

    // 2. Filter Raw Material Purchases for today
    const purchases = (store.purchase_invoices || []).filter((inv: any) => {
      const invDate = (inv.invoice_date || inv.created_at || '').slice(0, 10);
      return invDate === dateParam;
    });

    let totalPurchases = 0;
    let purchaseCashPaid = 0;
    let purchaseUnpaidCredit = 0;

    for (const p of purchases) {
      totalPurchases = addMoney(totalPurchases, Number(p.total_amount || 0));
      purchaseCashPaid = addMoney(purchaseCashPaid, Number(p.paid_amount || 0));
      purchaseUnpaidCredit = addMoney(purchaseUnpaidCredit, Number(p.balance_amount || 0));
    }

    // Top raw materials bought today
    const matSummaryMap: Record<string, { name: string; quantity: number; unit: string; total: number }> = {};
    for (const p of purchases) {
      for (const item of p.items || []) {
        const key = item.raw_material_name || 'Material';
        if (!matSummaryMap[key]) {
          matSummaryMap[key] = { name: key, quantity: 0, unit: item.unit || 'kg', total: 0 };
        }
        matSummaryMap[key].quantity = addMoney(matSummaryMap[key].quantity, Number(item.quantity || 0));
        matSummaryMap[key].total = addMoney(matSummaryMap[key].total, Number(item.line_total || 0));
      }
    }
    const topRawMaterials = Object.values(matSummaryMap).sort((a, b) => b.total - a.total).slice(0, 10);

    // 3. Cash Drawer reconciliation
    const activeRegister = (store.register_sessions || []).find((s: any) => s.status === 'open');
    const todaySessions = (store.register_sessions || []).filter((s: any) => (s.opened_at || '').slice(0, 10) === dateParam);
    const primarySession = activeRegister || todaySessions[0] || null;

    let openingFloat = primarySession ? Number(primarySession.opening_amount || 0) : 0;
    let drawerCashIn = 0;
    let drawerCashOut = 0;
    let drawerRefunds = 0;
    let drawerAdjustments = 0;

    if (primarySession) {
      const sessionTxs = (store.register_transactions || []).filter((tx: any) => tx.register_session_id === primarySession.id);
      for (const tx of sessionTxs) {
        const amt = Number(tx.amount || 0);
        if (tx.type === 'CASH_IN') drawerCashIn = addMoney(drawerCashIn, amt);
        if (tx.type === 'CASH_OUT') drawerCashOut = addMoney(drawerCashOut, amt);
        if (tx.type === 'REFUND') drawerRefunds = addMoney(drawerRefunds, amt);
        if (tx.type === 'ADJUSTMENT') drawerAdjustments = addMoney(drawerAdjustments, amt);
      }
    }

    const expectedCash = addMoney(
      subtractMoney(addMoney(openingFloat, cashSales, drawerCashIn), drawerCashOut, drawerRefunds),
      drawerAdjustments
    );

    const actualCountedCash = primarySession?.actual_amount !== null && primarySession?.actual_amount !== undefined
      ? Number(primarySession.actual_amount)
      : null;

    const discrepancy = actualCountedCash !== null ? subtractMoney(actualCountedCash, expectedCash) : null;

    // 4. Vendors
    let totalOutstandingMarketDebt = 0;
    for (const v of store.vendors || []) {
      totalOutstandingMarketDebt = addMoney(totalOutstandingMarketDebt, Number(v.current_balance || 0));
    }

    const todayVendorPayments = (store.vendor_payments || []).filter((vp: any) => {
      const pDate = (vp.payment_date || vp.created_at || '').slice(0, 10);
      return pDate === dateParam;
    });

    let vendorPaymentsToday = 0;
    for (const vp of todayVendorPayments) {
      vendorPaymentsToday = addMoney(vendorPaymentsToday, Number(vp.amount || 0));
    }

    // 5. Margin & Cash Flow
    // day_gross_margin = net_sales - total_purchases
    const dayGrossMargin = subtractMoney(netSales, totalPurchases);

    // net_cash_flow = (Cash Sales + Cash In) - (Cash Out + Vendor Cash Payments + Refunds)
    const totalCashInflow = addMoney(cashSales, drawerCashIn);
    const totalCashOutflow = addMoney(drawerCashOut, drawerRefunds);
    const netCashFlow = subtractMoney(totalCashInflow, totalCashOutflow);

    return NextResponse.json({
      success: true,
      date: dateParam,
      sales: {
        total_orders: activeOrders.length,
        voided_orders: orders.length - activeOrders.length,
        gross_sales: grossSales,
        discounts: discounts,
        net_sales: netSales,
        cash_sales: cashSales,
        digital_sales: digitalSales,
      },
      purchases: {
        total_bills: purchases.length,
        total_purchases: totalPurchases,
        cash_paid: purchaseCashPaid,
        unpaid_credit: purchaseUnpaidCredit,
        top_raw_materials: topRawMaterials,
      },
      cash_drawer: {
        session_id: primarySession?.id || null,
        status: primarySession?.status || 'closed',
        opening_float: openingFloat,
        cash_sales: cashSales,
        cash_in: drawerCashIn,
        cash_out: drawerCashOut,
        refunds: drawerRefunds,
        adjustments: drawerAdjustments,
        expected_cash: expectedCash,
        actual_counted_cash: actualCountedCash,
        difference: discrepancy,
      },
      vendors: {
        total_market_debt: totalOutstandingMarketDebt,
        payments_made_today: vendorPaymentsToday,
        payments_count: todayVendorPayments.length,
      },
      margin: {
        day_gross_margin: dayGrossMargin,
        net_cash_flow: netCashFlow,
      },
    });
  } catch (error: any) {
    console.error('Daily summary error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

