'use client';

import React, { useState, useEffect } from 'react';
import { formatMoney } from '@/lib/money';
import { AdminGuard } from '@/components/auth/AdminGuard';
import {
  BarChart3,
  Calendar,
  CreditCard,
  DollarSign,
  PieChart,
  Clock,
  TrendingUp,
  Download,
  FileSpreadsheet,
} from 'lucide-react';

export default function ReportsPage() {
  return (
    <AdminGuard fallbackTitle="Business Analytics & Financial Reports Protected">
      <ReportsContent />
    </AdminGuard>
  );
}

function ReportsContent() {
  const [range, setRange] = useState<string>('today');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchReports = async (r: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports?range=${r}`);
      const data = await res.json();
      if (data.success) {
        setReportData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(range);
  }, [range]);

  const summary = reportData?.summary || { total_orders: 0, gross_sales: 0, total_discount: 0, net_sales: 0, voided_orders: 0 };
  const payments = reportData?.paymentBreakdown || [];
  const topProducts = reportData?.topProducts || [];
  const categories = reportData?.categoryDistribution || [];
  const hourlyTrends = reportData?.hourlyTrends || [];

  return (
    <div className="space-y-3 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl font-bold">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900">Sales & Operational Analytics</h1>
          </div>
        </div>

        {/* Date Range Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRange(tab.id)}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                range === tab.id
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <a
            href="/api/export/excel?type=all"
            download
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition flex items-center gap-1 shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Export</span>
          </a>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Net Sales Revenue</span>
          <div className="text-xl font-black text-indigo-700 mt-0.5">
            {formatMoney(summary.net_sales)}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Discounts: -{formatMoney(summary.total_discount)}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Completed Orders</span>
          <div className="text-xl font-black text-slate-900 mt-0.5">
            {summary.total_orders} Orders
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Avg: {summary.total_orders > 0 ? formatMoney(summary.net_sales / summary.total_orders) : 'Rs. 0'}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Voided / Cancelled Orders</span>
          <div className="text-xl font-black text-rose-600 mt-0.5">
            {summary.voided_orders}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Top Selling Category</span>
          <div className="text-xl font-black text-indigo-800 mt-0.5 truncate">
            {categories[0]?.name || 'Nashta Special'}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Revenue: {formatMoney(categories[0]?.revenue || 0)}</p>
        </div>
      </div>

      {/* Middle Grid: Payment Breakdown & Hourly Rush Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Payment Channels Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm space-y-2">
          <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
            <span>Payment Channels Breakdown</span>
          </h3>

          <div className="space-y-1.5">
            {payments.map((p: any) => {
              const pct = summary.net_sales > 0 ? Math.round((p.total / summary.net_sales) * 100) : 0;
              return (
                <div key={p.method} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-900">{p.method}</span>
                    <span className="font-black text-indigo-700">{formatMoney(p.total)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{p.count} transactions</span>
                    <span>{pct}% of net sales</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Morning Rush Hourly Trend (5 AM - 1 PM) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Morning Peak Rush Hours (5:00 AM - 1:00 PM)</span>
            </h3>
            <span className="text-[10px] text-slate-500">Hourly counter sales activity</span>
          </div>

          <div className="h-36 flex items-end gap-2 pt-4 pb-1 overflow-x-auto">
            {hourlyTrends.map((h: any) => {
              const maxRev = Math.max(...hourlyTrends.map((x: any) => x.revenue), 100);
              const heightPct = Math.round((h.revenue / maxRev) * 100);

              return (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 h-full justify-end min-w-8">
                  <span className="text-[9px] font-bold text-indigo-700">{h.revenue > 0 ? formatMoney(h.revenue).replace('Rs. ', '') : ''}</span>
                  <div
                    className="w-full bg-slate-100 hover:bg-indigo-600 rounded-t transition cursor-pointer relative group border border-slate-200"
                    style={{ height: `${Math.max(8, heightPct)}%` }}
                  >
                    <div className="hidden group-hover:block absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-[9.5px] whitespace-nowrap z-10 text-white font-bold shadow-md">
                      {h.orders} orders ({formatMoney(h.revenue)})
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono rotate-45 sm:rotate-0 mt-0.5">{h.label.replace(':00', '')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Products Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-xs text-slate-900">Top Menu Item Rankings</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-3 py-2"># Rank</th>
                <th className="px-3 py-2">Product Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-center">Portions Sold</th>
                <th className="px-3 py-2 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No sales recorded for this date range yet.
                  </td>
                </tr>
              ) : (
                topProducts.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    <td className="px-3 py-2 font-mono text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 font-bold text-slate-900">{p.name}</td>
                    <td className="px-3 py-2 text-slate-600">{p.category}</td>
                    <td className="px-3 py-2 text-center font-bold text-slate-900">{p.quantity} portions</td>
                    <td className="px-3 py-2 text-right font-black text-indigo-700">{formatMoney(p.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

