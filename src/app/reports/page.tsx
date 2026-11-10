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
    <AdminGuard
      fallbackTitle="Business Analytics & Financial Reports Protected"
      fallbackDescription="Please enter Admin PIN to view revenue reports, sales velocity, and financial metrics."
    >
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
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Sales & Operational Analytics</h1>
            <p className="text-xs text-slate-400">
              Payment channels, category revenue, peak breakfast rush hours, and itemized menu rankings
            </p>
          </div>
        </div>

        {/* Date Range Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRange(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition ${
                range === tab.id
                  ? 'bg-emerald-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <a
            href="/api/export/excel?type=all"
            download
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition flex items-center gap-1.5 shadow"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Export</span>
          </a>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-xs text-slate-400 font-medium">Net Sales Revenue</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {formatMoney(summary.net_sales)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Discounts: -{formatMoney(summary.total_discount)}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-xs text-slate-400 font-medium">Completed Orders</span>
          <div className="text-2xl font-black text-white mt-1">
            {summary.total_orders} Orders
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Avg Bill: {summary.total_orders > 0 ? formatMoney(summary.net_sales / summary.total_orders) : 'Rs. 0'}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-xs text-slate-400 font-medium">Voided / Cancelled Orders</span>
          <div className="text-2xl font-black text-rose-400 mt-1">
            {summary.voided_orders}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Logged in audit trail with supervisor PIN</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-xs text-slate-400 font-medium">Top Selling Category</span>
          <div className="text-2xl font-black text-cyan-400 mt-1 truncate">
            {categories[0]?.name || 'Nashta Special'}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Revenue: {formatMoney(categories[0]?.revenue || 0)}</p>
        </div>
      </div>

      {/* Middle Grid: Payment Breakdown & Hourly Rush Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Payment Channels Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Payment Channels Breakdown</span>
          </h3>

          <div className="space-y-2">
            {payments.map((p: any) => {
              const pct = summary.net_sales > 0 ? Math.round((p.total / summary.net_sales) * 100) : 0;
              return (
                <div key={p.method} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-200">{p.method}</span>
                    <span className="font-black text-emerald-400">{formatMoney(p.total)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{p.count} transactions</span>
                    <span>{pct}% of net sales</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Morning Rush Hourly Trend (5 AM - 1 PM) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Morning Peak Rush Hours (5:00 AM - 1:00 PM)</span>
            </h3>
            <span className="text-[10px] text-slate-500">Hourly counter sales activity</span>
          </div>

          <div className="h-44 flex items-end gap-2 pt-6 pb-2 overflow-x-auto">
            {hourlyTrends.map((h: any) => {
              const maxRev = Math.max(...hourlyTrends.map((x: any) => x.revenue), 100);
              const heightPct = Math.round((h.revenue / maxRev) * 100);

              return (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end min-w-8">
                  <span className="text-[9px] font-bold text-emerald-400">{h.revenue > 0 ? formatMoney(h.revenue).replace('Rs. ', '') : ''}</span>
                  <div
                    className="w-full bg-slate-800 hover:bg-emerald-500 rounded-t transition cursor-pointer relative group"
                    style={{ height: `${Math.max(8, heightPct)}%` }}
                  >
                    <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-950 border border-slate-700 px-2 py-0.5 rounded text-[10px] whitespace-nowrap z-10 text-white font-bold">
                      {h.orders} orders ({formatMoney(h.revenue)})
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono rotate-45 sm:rotate-0 mt-1">{h.label.replace(':00', '')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Products Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">Top Menu Item Rankings</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-4 py-3"># Rank</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-center">Portions Sold</th>
                <th className="px-4 py-3 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {topProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    No sales recorded for this date range yet.
                  </td>
                </tr>
              ) : (
                topProducts.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-bold text-slate-200">{p.name}</td>
                    <td className="px-4 py-3 text-slate-400">{p.category}</td>
                    <td className="px-4 py-3 text-center font-bold text-white">{p.quantity} portions</td>
                    <td className="px-4 py-3 text-right font-black text-emerald-400 text-sm">{formatMoney(p.revenue)}</td>
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

