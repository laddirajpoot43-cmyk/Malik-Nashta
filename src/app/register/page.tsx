'use client';

import React, { useState, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/money';
import {
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingUp,
  Receipt,
  User,
  Plus,
} from 'lucide-react';

export default function RegisterPage() {
  const { activeRegister, setOpenRegisterModal } = usePOS();
  const { currentUser } = useAuth();

  const [registerData, setRegisterData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchRegister = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/register');
      const data = await res.json();
      if (data.success) {
        setRegisterData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegister();
  }, [activeRegister]);

  const summary = registerData?.summary || {
    opening_float: 0,
    cash_sales: 0,
    cash_in: 0,
    cash_out: 0,
    refunds: 0,
    adjustments: 0,
    digital_sales: 0,
    expected_cash: 0,
    orders_count: 0,
  };

  const txs = registerData?.transactions || [];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Cash Register & Shift Handover</h1>
            <p className="text-xs text-slate-400">
              Shift reconciliation, float auditing, petty cash expenses, and drawer discrepancy tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpenRegisterModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
          >
            {activeRegister ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>{activeRegister ? 'Manage Shift / Close Drawer' : 'Open Register Shift'}</span>
          </button>
        </div>
      </div>

      {/* Primary Reconciliation Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Expected Cash in Hand */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Expected Cash in Hand</span>
            <span className={`w-2.5 h-2.5 rounded-full ${activeRegister ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">
            {formatMoney(summary.expected_cash)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Status: {activeRegister ? 'LIVE REGISTER OPEN' : 'REGISTER CLOSED'}
          </div>
        </div>

        {/* Cash Sales Today */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Counter Cash Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2">
            {formatMoney(summary.cash_sales)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {summary.orders_count} completed orders
          </div>
        </div>

        {/* Digital Payments */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Digital / JazzCash / Card</span>
            <Receipt className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400 mt-2">
            {formatMoney(summary.digital_sales)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Settled to Bank / Wallet
          </div>
        </div>

        {/* Drawer Expenses (Petty Cash Out) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Cash Out (Expenses + Refunds)</span>
            <ArrowUpRight className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2">
            -{formatMoney(summary.cash_out + summary.refunds)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Expenses: {formatMoney(summary.cash_out)} • Refunds: {formatMoney(summary.refunds)}
          </div>
        </div>
      </div>

      {/* Live Transaction Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">Current Shift Cash Movements ({txs.length})</h3>
          </div>
          <button
            onClick={() => setOpenRegisterModal(true)}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Record Movement
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reason / Reference</th>
                <th className="px-4 py-3">Cashier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {txs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No cash transactions recorded in this shift yet.
                  </td>
                </tr>
              ) : (
                txs.map((tx: any) => {
                  const isPositive = tx.type === 'OPENING' || tx.type === 'SALE' || tx.type === 'CASH_IN' || (tx.type === 'ADJUSTMENT' && tx.amount > 0);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 text-slate-400 font-mono">
                        {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            tx.type === 'SALE'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : tx.type === 'CASH_IN' || tx.type === 'OPENING'
                              ? 'bg-cyan-500/20 text-cyan-400'
                              : tx.type === 'REFUND'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-black text-sm ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? `+${formatMoney(tx.amount)}` : formatMoney(tx.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">{tx.reason || 'General'}</div>
                        {tx.note && <div className="text-[10px] text-slate-500">{tx.note}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{tx.user_name_snapshot}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

