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
    } else if (range === 'custom' && startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
    }

    const startTs = startDate.getTime();
    const endTs = endDate.getTime();

    const store = localStore.get();

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
      for (const p of o.payments || []) {
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
      for (const item of o.items || []) {
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

    const topProducts = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue);
    const categoryDistribution = Object.values(categorySalesMap).sort((a, b) => b.revenue - a.revenue);

    // 3. Hourly Trends (5:00 AM to 1:00 PM peak rush)
    const hourlyMap: Record<number, { hour: number; label: string; orders: number; revenue: number }> = {};
    for (let h = 5; h <= 23; h++) {
      const displayLabel = h <= 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
      hourlyMap[h] = { hour: h, label: displayLabel, orders: 0, revenue: 0 };
    }

    for (const o of completedOrders) {
      const d = new Date(o.created_at);
      const h = d.getHours();
      if (hourlyMap[h]) {
        hourlyMap[h].orders += 1;
        hourlyMap[h].revenue = addMoney(hourlyMap[h].revenue, Number(o.grand_total || 0));
      }
    }

    const hourlyTrends = Object.values(hourlyMap).slice(0, 16); // 5 AM to 8 PM

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

    return NextResponse.json({
      success: true,
      range,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: {
        total_orders: completedOrders.length,
        voided_orders: voidedOrders.length,
        gross_sales: totalGross,
        total_discount: totalDiscount,
        net_sales: totalNet,
      },
      paymentBreakdown: Object.values(paymentBreakdown),
      topProducts,
      categoryDistribution,
      hourlyTrends,
      shiftSessions,
      voidedOrdersList: voidedOrders,
    });
  } catch (error: any) {
    console.error('Reports error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

