'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Vendor } from '@/types/pos';
import { formatMoney } from '@/lib/money';
import { useAuth } from '@/context/AuthContext';
import { usePOS } from '@/context/POSContext';
import { AdminGuard } from '@/components/auth/AdminGuard';
import {
  ArrowLeft,
  DollarSign,
  Plus,
  Receipt,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Printer,
  CreditCard,
} from 'lucide-react';

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AdminGuard
      fallbackTitle="Supplier Khata Statement Protected"
      fallbackDescription="Please enter Admin PIN to view or record payments in this Mandi Khata statement."
    >
      <VendorDetailContent params={params} />
    </AdminGuard>
  );
}

function VendorDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { currentUser } = useAuth();
  const { refreshPOSData } = usePOS();

  const [vendorData, setVendorData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Payment Voucher Modal
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'cheque'>('cash');
  const [refNumber, setRefNumber] = useState<string>('');
  const [deductFromRegister, setDeductFromRegister] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchStatement = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/vendors/${id}`);
      const data = await res.json();
      if (data.success) {
        setVendorData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement();
  }, [id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      setErrorMsg('Please enter a valid positive payment amount.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const res = await fetch('/api/vendor-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: id,
          amount: amt,
          payment_method: paymentMethod,
          reference_number: refNumber.trim() || undefined,
          deduct_from_register: deductFromRegister,
          note: note.trim() || undefined,
          cashier_name: currentUser?.display_name || 'Admin',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Payment Voucher #${data.payment.payment_number} recorded! Rs. ${amt} paid.`);
        setShowPayModal(false);
        setPayAmount('');
        setRefNumber('');
        setNote('');
        fetchStatement();
        refreshPOSData();
      } else {
        setErrorMsg(data.error || 'Failed to record payment');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const vendor: Vendor = vendorData?.vendor;
  const statement = vendorData?.statement || [];

  return (
    <div className="space-y-4">
      {/* Back button & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <Link
            href="/vendors"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Back to all suppliers"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white">{vendor?.name || 'Supplier Khata'}</h1>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                {vendor?.category}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {vendor?.phone ? `Phone: ${vendor.phone}` : 'No phone recorded'} • {vendor?.address || 'Hasilpur Mandi'}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setShowPayModal(true);
            setErrorMsg('');
            setSuccessMsg('');
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
        >
          <DollarSign className="w-4 h-4" />
          <span>Pay Supplier (ادائیگی واؤچر)</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400">✕</button>
        </div>
      )}

      {/* Financial Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-xs text-slate-400">Live Payable Balance (موجودہ ادھار):</span>
          <div className="text-3xl font-black text-rose-400 mt-1">
            {formatMoney(vendor?.current_balance || vendorData?.running_balance || 0)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Net amount owed to {vendor?.name}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-xs text-slate-400">Opening Balance on Onboarding:</span>
          <div className="text-2xl font-black text-slate-100 mt-1">
            {formatMoney(vendor?.opening_balance || 0)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Initial debt when supplier was registered</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-xs text-slate-400">Total Khata Transactions:</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {statement.length} Entries
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Purchase bills + settlement vouchers</p>
        </div>
      </div>

      {/* Chronological Statement Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">Unified Chronological Statement (کھاتہ اسٹیٹمنٹ)</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Voucher #</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Debit (Paid)</th>
                <th className="px-4 py-3 text-right">Credit (Purchased)</th>
                <th className="px-4 py-3 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Loading Khata ledger...
                  </td>
                </tr>
              ) : statement.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No ledger entries for this vendor yet.
                  </td>
                </tr>
              ) : (
                statement.map((row: any) => (
                  <tr key={row.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 text-slate-400 font-mono">{row.date}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-200">{row.voucher_no}</td>
                    <td className="px-4 py-3 font-medium text-slate-300">{row.description}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">
                      {row.debit > 0 ? formatMoney(row.debit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-rose-400">
                      {row.credit > 0 ? formatMoney(row.credit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-amber-400 text-sm">
                      {formatMoney(row.running_balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD PAYMENT VOUCHER MODAL */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span>Record Payment Voucher to {vendor?.name}</span>
              </div>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {errorMsg && (
              <div className="p-2 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-200 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Amount (PKR):</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 font-black text-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Deduct from counter drawer checkbox */}
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deductFromRegister}
                  onChange={(e) => setDeductFromRegister(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded bg-slate-900 border-slate-700"
                />
                <span className="text-xs text-slate-200">
                  Deduct this payment from <strong>active cash drawer</strong> (CASH_OUT)
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Method:</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="cash">Cash (نقدی)</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Ref / Cheque #:</label>
                  <input
                    type="text"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Remarks / Note:</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Atta balance settlement"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md"
                >
                  {submitting ? 'Processing...' : 'Confirm Voucher & Settle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

