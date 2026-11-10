'use client';

import React, { useState, useEffect } from 'react';
import { formatMoney } from '@/lib/money';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { useAuth } from '@/context/AuthContext';
import {
  FileText,
  Calendar,
  DollarSign,
  TrendingUp,
  Truck,
  BookOpen,
  PieChart,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  FileSpreadsheet,
  Download,
  Lock,
  Check,
  RefreshCw,
  X,
} from 'lucide-react';

export default function DailySummaryPage() {
  return (
    <AdminGuard
      fallbackTitle="Daily Hisaab Kitab & Closing Protected"
      fallbackDescription="Please enter Admin PIN to view daily profit & loss reconciliation, close the business day, or download Excel audit sheets."
    >
      <DailySummaryContent />
    </AdminGuard>
  );
}

function DailySummaryContent() {
  const { currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Daily Close Modal State
  const [showCloseDayModal, setShowCloseDayModal] = useState(false);
  const [actualDrawerCash, setActualDrawerCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [closingInProgress, setClosingInProgress] = useState(false);
  const [closeSuccessMsg, setCloseSuccessMsg] = useState('');

  const fetchSummary = async (dateStr: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/daily-summary?date=${dateStr}`);
      const data = await res.json();
      if (data.success) {
        setSummaryData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(selectedDate);
  }, [selectedDate]);

  const sales = summaryData?.sales || { gross_sales: 0, discounts: 0, net_sales: 0, cash_sales: 0, digital_sales: 0, total_orders: 0 };
  const purchases = summaryData?.purchases || { total_purchases: 0, cash_paid: 0, unpaid_credit: 0, total_bills: 0, top_raw_materials: [] };
  const drawer = summaryData?.cash_drawer || { opening_float: 0, cash_sales: 0, cash_in: 0, cash_out: 0, refunds: 0, expected_cash: 0, actual_counted_cash: null, difference: null };
  const vendors = summaryData?.vendors || { total_market_debt: 0, payments_made_today: 0 };
  const margin = summaryData?.margin || { day_gross_margin: 0, net_cash_flow: 0 };

  const handleDownloadExcel = (type: 'all' | 'sales' | 'purchases' | 'register') => {
    const url = `/api/export/excel?date=${selectedDate}&type=${type}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `Malik_Nashta_${type.toUpperCase()}_${selectedDate}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePerformDailyClose = async (e: React.FormEvent) => {
    e.preventDefault();
    setClosingInProgress(true);
    setCloseSuccessMsg('');

    try {
      const counted = parseFloat(actualDrawerCash) || drawer.expected_cash;

      // Close open active register shift if any
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          actual_amount: counted,
          closing_note: closingNotes || `End of Day Closing by ${currentUser?.display_name || 'Admin'} for ${selectedDate}`,
          cashier_name: currentUser?.display_name || 'Admin',
        }),
      });

      setClosingInProgress(false);
      setShowCloseDayModal(false);
      setCloseSuccessMsg(`Daily Sale for ${selectedDate} has been successfully closed! Automatic Excel report download started.`);

      // Automatically trigger full multi-sheet Excel download
      handleDownloadExcel('all');

      // Refresh data
      fetchSummary(selectedDate);
      setTimeout(() => setCloseSuccessMsg(''), 6000);
    } catch (err: any) {
      setClosingInProgress(false);
      alert('Failed to close day: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              Roozana Hisaab Kitab & Daily Closing (روزانہ حساب و کلوزنگ)
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                Excel Ready
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Single-pane owner dashboard: Net Sales, Raw Material Purchases, Expected Cash, and Daily Closing with native Excel spreadsheet export
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-200">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none font-semibold cursor-pointer"
            />
          </div>

          {/* Excel Export Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => handleDownloadExcel('all')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-md transition flex items-center gap-1.5"
              title="Download full multi-sheet Excel with Summary, Sales, Purchases, and Shifts"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Full Excel (.xlsx)</span>
            </button>

            <button
              onClick={() => handleDownloadExcel('sales')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition"
              title="Download Sales Line Items Sheet"
            >
              Sales Sheet
            </button>

            <button
              onClick={() => handleDownloadExcel('purchases')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition"
              title="Download Mandi Maal Kharidari Sheet"
            >
              Purchases Sheet
            </button>
          </div>

          {/* Daily Sale Close Button */}
          <button
            onClick={() => {
              setActualDrawerCash(String(drawer.expected_cash || ''));
              setShowCloseDayModal(true);
            }}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-950/40 border border-amber-500/40 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-4 h-4 text-amber-200" />
            <span>Daily Sale Close & Export</span>
          </button>

          <button
            onClick={() => window.print()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition"
            title="Print Summary"
          >
            <Printer className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      {closeSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{closeSuccessMsg}</span>
        </div>
      )}

      {/* 4 Flagship Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Net Sales */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-300">1. Total Net Sales (کل بکری)</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-2">
              {formatMoney(sales.net_sales)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Gross: {formatMoney(sales.gross_sales)} • Disc: -{formatMoney(sales.discounts)}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800/80 mt-3 flex justify-between text-[11px]">
            <span className="text-emerald-300 font-semibold">Cash: {formatMoney(sales.cash_sales)}</span>
            <span className="text-cyan-300 font-semibold">Digital: {formatMoney(sales.digital_sales)}</span>
          </div>
        </div>

        {/* 2. Total Raw Material Purchases */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-300">2. Maal Kharidari (خریداری)</span>
              <Truck className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 mt-2">
              {formatMoney(purchases.total_purchases)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {purchases.total_bills} bills recorded from Mandi
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800/80 mt-3 flex justify-between text-[11px]">
            <span className="text-slate-300 font-semibold">Naqad Paid: {formatMoney(purchases.cash_paid)}</span>
            <span className="text-rose-400 font-semibold">Udhaar Credit: {formatMoney(purchases.unpaid_credit)}</span>
          </div>
        </div>

        {/* 3. Cash Drawer In-Hand */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-300">3. Cash Drawer In-Hand (گلا)</span>
              <DollarSign className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-cyan-400 mt-2">
              {formatMoney(drawer.expected_cash)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Float: {formatMoney(drawer.opening_float)} • Sales: +{formatMoney(drawer.cash_sales)}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800/80 mt-3 flex justify-between text-[11px]">
            <span className="text-slate-400">Drawer Expenses: -{formatMoney(drawer.cash_out + drawer.refunds)}</span>
            <span className={`font-bold ${drawer.difference === 0 ? 'text-emerald-400' : drawer.difference < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {drawer.actual_counted_cash !== null ? `Actual: ${formatMoney(drawer.actual_counted_cash)}` : 'Shift Live'}
            </span>
          </div>
        </div>

        {/* 4. Market Payables & Daily Margin */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-300">4. Day Gross Margin (منافع)</span>
              <PieChart className="w-4 h-4 text-emerald-400" />
            </div>
            <div className={`text-2xl font-black mt-2 ${margin.day_gross_margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatMoney(margin.day_gross_margin)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Formula: Net Sales - Total Purchases
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800/80 mt-3 flex justify-between text-[11px]">
            <span className="text-slate-300">Market Debt: {formatMoney(vendors.total_market_debt)}</span>
            <span className="text-emerald-300 font-semibold">Net Flow: {formatMoney(margin.net_cash_flow)}</span>
          </div>
        </div>
      </div>

      {/* Breakdown Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Drawer Inflow & Outflow Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Counter Cash Flow Detail (گلے کی تفصیل)</span>
            </span>
            <button
              onClick={() => handleDownloadExcel('register')}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Drawer Shift</span>
            </button>
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400">Shift Opening Float:</span>
              <span className="font-bold text-slate-200">{formatMoney(drawer.opening_float)}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" /> Counter Cash Sales:
              </span>
              <span className="font-bold text-emerald-400">+{formatMoney(drawer.cash_sales)}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5 text-cyan-400" /> Cash In (Change / Float Additions):
              </span>
              <span className="font-bold text-cyan-400">+{formatMoney(drawer.cash_in)}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" /> Drawer Petty Expenses (Ice, Milk, Chai Patti):
              </span>
              <span className="font-bold text-rose-400">-{formatMoney(drawer.cash_out)}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" /> Cash Refunds Issued:
              </span>
              <span className="font-bold text-rose-400">-{formatMoney(drawer.refunds)}</span>
            </div>
            <div className="flex justify-between p-3 bg-slate-950 rounded-xl border border-emerald-500/40 text-sm font-black">
              <span className="text-white">Expected Cash in Drawer:</span>
              <span className="text-emerald-400">{formatMoney(drawer.expected_cash)}</span>
            </div>
          </div>
        </div>

        {/* Top Raw Materials Bought Today */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-400" />
              <span>Top Raw Materials Purchased Today ({purchases.top_raw_materials?.length || 0})</span>
            </span>
            <button
              onClick={() => handleDownloadExcel('purchases')}
              className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Purchases</span>
            </button>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-semibold">
                <tr>
                  <th className="px-3 py-2">Ingredient</th>
                  <th className="px-3 py-2 text-center">Quantity</th>
                  <th className="px-3 py-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {purchases.top_raw_materials?.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500">
                      No raw materials purchased today.
                    </td>
                  </tr>
                ) : (
                  purchases.top_raw_materials.map((m: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-950/50">
                      <td className="px-3 py-2 font-bold text-slate-200">{m.name}</td>
                      <td className="px-3 py-2 text-center text-slate-400 font-semibold">{m.quantity} {m.unit}</td>
                      <td className="px-3 py-2 text-right font-black text-amber-400">{formatMoney(m.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Daily Sale Close Modal */}
      {showCloseDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Daily Sale Close (روزانہ کلوزنگ)</h3>
                  <p className="text-xs text-slate-400">Date: {selectedDate}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCloseDayModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Review */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block">Total Net Sales:</span>
                <span className="text-emerald-400 font-black text-base">{formatMoney(sales.net_sales)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Maal Kharidari:</span>
                <span className="text-amber-400 font-black text-base">{formatMoney(purchases.total_purchases)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Cash Collected:</span>
                <span className="text-cyan-400 font-bold">{formatMoney(sales.cash_sales)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Expected Drawer Cash:</span>
                <span className="text-white font-bold">{formatMoney(drawer.expected_cash)}</span>
              </div>
            </div>

            <form onSubmit={handlePerformDailyClose} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Actual Counted Cash in Drawer (گلے میں موجود نقدی) PKR:
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={actualDrawerCash}
                  onChange={(e) => setActualDrawerCash(e.target.value)}
                  placeholder="Enter counted cash in rupees"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-lg font-black text-emerald-400 focus:outline-none focus:border-amber-400"
                />
                {actualDrawerCash && (
                  <div className="text-[11px] font-semibold mt-1 flex justify-between">
                    <span className="text-slate-400">Difference (فرق):</span>
                    {parseFloat(actualDrawerCash) - drawer.expected_cash === 0 ? (
                      <span className="text-emerald-400 font-bold">PERFECT MATCH (No discrepancy)</span>
                    ) : parseFloat(actualDrawerCash) - drawer.expected_cash > 0 ? (
                      <span className="text-cyan-400 font-bold">Excess +{formatMoney(parseFloat(actualDrawerCash) - drawer.expected_cash)}</span>
                    ) : (
                      <span className="text-rose-400 font-bold">Shortage -{formatMoney(Math.abs(parseFloat(actualDrawerCash) - drawer.expected_cash))}</span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Closing Notes / Remarks (Optional):
                </label>
                <textarea
                  rows={2}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="e.g. All staff shifts reconciled, Rs. 5000 kept as next morning opening float"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseDayModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={closingInProgress}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {closingInProgress ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                  <span>{closingInProgress ? 'Closing...' : 'Close & Download Excel'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
