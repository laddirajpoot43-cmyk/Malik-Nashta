import { NextResponse } from 'next/server';
import { localStore } from '@/lib/db';
import { addMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'today';
    const startDateParam = searchParams.get('start_date');
    const endDateParam = searchParams.get('end_date');

    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (range === 'today') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'this_week') {
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Monday
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (range === 'all_time') {
      startDate = new Date(0);
      endDate = new Date(now.getTime() + 86400000);
    } else if (range === 'custom' && startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
    }

    const startTs = startDate.getTime();
    const endTs = endDate.getTime();

    const store = await localStore.ensureFresh(1500);

    // Filter orders in date range
    const orders = (store.orders || []).filter((o: any) => {
      const ts = new Date(o.created_at).getTime();
      return ts >= startTs && ts <= endTs;
    });

    const completedOrders = orders.filter((o: any) => o.status !== 'voided');
    const voidedOrders = orders.filter((o: any) => o.status === 'voided');

    // 1. Payment breakdown
    const paymentBreakdown: Record<string, { method: string; count: number; total: number }> = {
      cash: { method: 'Cash (Naqad)', count: 0, total: 0 },
      jazzcash: { method: 'JazzCash Digital', count: 0, total: 0 },
      easypaisa: { method: 'EasyPaisa Digital', count: 0, total: 0 },
      bank: { method: 'Bank Transfer / Card', count: 0, total: 0 },
    };

    for (const o of completedOrders) {
      const oPayments = (o.payments && o.payments.length > 0) ? o.payments : (store.order_payments || []).filter((pay: any) => pay.order_id === o.id);
      for (const p of oPayments) {
        const m = p.method_id || 'cash';
        if (!paymentBreakdown[m]) {
          paymentBreakdown[m] = { method: m, count: 0, total: 0 };
        }
        paymentBreakdown[m].count += 1;
        paymentBreakdown[m].total = addMoney(paymentBreakdown[m].total, Number(p.amount || 0));
      }
    }

    // 2. Itemized Product Sales & Category Distribution
    const productSalesMap: Record<string, { name: string; quantity: number; revenue: number; category: string }> = {};
    const categorySalesMap: Record<string, { name: string; revenue: number; itemsSold: number }> = {};

    for (const o of completedOrders) {
      const oItems = (o.items && o.items.length > 0) ? o.items : (store.order_items || []).filter((it: any) => it.order_id === o.id);
      for (const item of oItems) {
        const pName = item.product_name_snapshot || 'Item';
        const pId = item.product_id;
        const prod = (store.products || []).find((p: any) => p.id === pId);
        const cat = (store.categories || []).find((c: any) => c.id === prod?.category_id);
        const catName = cat?.name || 'General';

        if (!productSalesMap[pName]) {
          productSalesMap[pName] = { name: pName, quantity: 0, revenue: 0, category: catName };
        }
        productSalesMap[pName].quantity = addMoney(productSalesMap[pName].quantity, Number(item.quantity || 0));
        productSalesMap[pName].revenue = addMoney(productSalesMap[pName].revenue, Number(item.line_total || 0));

        if (!categorySalesMap[catName]) {
          categorySalesMap[catName] = { name: catName, revenue: 0, itemsSold: 0 };
        }
        categorySalesMap[catName].revenue = addMoney(categorySalesMap[catName].revenue, Number(item.line_total || 0));
        categorySalesMap[catName].itemsSold = addMoney(categorySalesMap[catName].itemsSold, Number(item.quantity || 0));
      }
    }

    const totalUnitsSold = Object.values(productSalesMap).reduce((sum, p) => sum + p.quantity, 0);
    const topProducts = Object.values(productSalesMap)
      .map((p) => ({
        ...p,
        percentage_of_units: totalUnitsSold > 0 ? Math.round((p.quantity / totalUnitsSold) * 100) : 0,
      }))
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);

    const categoryDistribution = Object.values(categorySalesMap).sort((a, b) => b.revenue - a.revenue);

    // 3. Dynamic Sales Trend Points based on Date Range
    let salesTrend: { label: string; fullDate?: string; revenue: number; orders: number }[] = [];

    if (range === 'today' || range === 'yesterday') {
      // Hourly trend for single day (5 AM to 11 PM)
      const hourlyMap: Record<number, { label: string; revenue: number; orders: number }> = {};
      for (let h = 5; h <= 23; h++) {
        const lbl = h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`;
        hourlyMap[h] = { label: lbl, revenue: 0, orders: 0 };
      }
      for (const o of completedOrders) {
        const h = new Date(o.created_at).getHours();
        if (hourlyMap[h]) {
          hourlyMap[h].orders += 1;
          hourlyMap[h].revenue = addMoney(hourlyMap[h].revenue, Number(o.grand_total || 0));
        }
      }
      salesTrend = Object.values(hourlyMap);
    } else if (range === 'this_week') {
      // 7 days of the week: Mon through Sun
      const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const weekDaysMap: { label: string; fullDate: string; revenue: number; orders: number }[] = [];
      const monday = new Date(startDate);

      for (let i = 0; i < 7; i++) {
        const currentD = new Date(monday);
        currentD.setDate(monday.getDate() + i);
        const dayStr = currentD.toISOString().slice(0, 10);
        weekDaysMap.push({
          label: dayLabels[i],
          fullDate: dayStr,
          revenue: 0,
          orders: 0,
        });
      }

      for (const o of completedOrders) {
        const oDay = o.created_at.slice(0, 10);
        const target = weekDaysMap.find((d) => d.fullDate === oDay);
        if (target) {
          target.orders += 1;
          target.revenue = addMoney(target.revenue, Number(o.grand_total || 0));
        }
      }
      salesTrend = weekDaysMap;
    } else if (range === 'this_month') {
      // Days of current month (1 to daysInMonth)
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthMap: { label: string; fullDate: string; revenue: number; orders: number }[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(now.getFullYear(), now.getMonth(), d);
        const dayStr = dateObj.toISOString().slice(0, 10);
        monthMap.push({
          label: `${d}`,
          fullDate: dayStr,
          revenue: 0,
          orders: 0,
        });
      }

      for (const o of completedOrders) {
        const oDay = o.created_at.slice(0, 10);
        const target = monthMap.find((d) => d.fullDate === oDay);
        if (target) {
          target.orders += 1;
          target.revenue = addMoney(target.revenue, Number(o.grand_total || 0));
        }
      }
      salesTrend = monthMap;
    } else {
      // All time or custom: aggregate by recent 14 days or all active dates
      const dateAggregate: Record<string, { label: string; fullDate: string; revenue: number; orders: number }> = {};
      for (const o of completedOrders) {
        const oDay = o.created_at.slice(0, 10);
        if (!dateAggregate[oDay]) {
          const dObj = new Date(o.created_at);
          const shortMonth = dObj.toLocaleString('en-US', { month: 'short' });
          dateAggregate[oDay] = {
            label: `${shortMonth} ${dObj.getDate()}`,
            fullDate: oDay,
            revenue: 0,
            orders: 0,
          };
        }
        dateAggregate[oDay].orders += 1;
        dateAggregate[oDay].revenue = addMoney(dateAggregate[oDay].revenue, Number(o.grand_total || 0));
      }
      salesTrend = Object.values(dateAggregate).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
      if (salesTrend.length === 0) {
        salesTrend = [
          { label: 'Day 1', revenue: 0, orders: 0 },
          { label: 'Day 2', revenue: 0, orders: 0 },
          { label: 'Day 3', revenue: 0, orders: 0 },
        ];
      }
    }

    // 4. Shift Sessions in this period
    const shiftSessions = (store.register_sessions || []).filter((s: any) => {
      const ts = new Date(s.opened_at).getTime();
      return ts >= startTs && ts <= endTs;
    });

    let totalGross = 0;
    let totalDiscount = 0;
    let totalNet = 0;

    for (const o of completedOrders) {
      totalGross = addMoney(totalGross, Number(o.subtotal || 0));
      totalDiscount = addMoney(totalDiscount, Number(o.discount_amount || 0));
      totalNet = addMoney(totalNet, Number(o.grand_total || 0));
    }

    // Calculate Payment Percentages
    const paymentsWithPct = Object.values(paymentBreakdown).map((p) => ({
      ...p,
      percentage: totalNet > 0 ? Math.round((p.total / totalNet) * 100) : 0,
    }));

    // Performance Metrics
    const totalTransactions = completedOrders.length;
    const averageOrderValue = totalTransactions > 0 ? Math.round(totalNet / totalTransactions) : 0;

    return NextResponse.json({
      success: true,
      range,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: {
        total_orders: totalTransactions,
        voided_orders: voidedOrders.length,
        gross_sales: totalGross,
        total_discount: totalDiscount,
        net_sales: totalNet,
        average_order_value: averageOrderValue,
      },
      performance: {
        total_sales: totalNet,
        total_transactions: totalTransactions,
        average_order_value: averageOrderValue,
        completion_rate: (totalTransactions + voidedOrders.length) > 0 ? Math.round((totalTransactions / (totalTransactions + voidedOrders.length)) * 100) : 100,
        total_items_sold: totalUnitsSold,
      },
      paymentBreakdown: paymentsWithPct,
      topProducts,
      salesTrend,
      categoryDistribution,
      hourlyTrends: salesTrend,
      shiftSessions,
      voidedOrdersList: voidedOrders,
    });
  } catch (error: any) {
    console.error('Reports error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

