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
    <AdminGuard fallbackTitle="Supplier Khata Statement Protected">
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
    <div className="space-y-3 select-none">
      {/* Back button & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <Link
            href="/vendors"
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
            title="Back to all suppliers"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-900">{vendor?.name || 'Supplier Khata'}</h1>
              <span className="text-[9.5px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                {vendor?.category}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {vendor?.phone ? `Phone: ${vendor.phone}` : 'No phone recorded'} • {vendor?.address || 'Hasilpur Mandi'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => {
              document.body.classList.add('print-page-mode');
              const cleanup = () => {
                document.body.classList.remove('print-page-mode');
                window.removeEventListener('afterprint', cleanup);
              };
              window.addEventListener('afterprint', cleanup);
              setTimeout(() => window.print(), 50);
              setTimeout(cleanup, 3000);
            }}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            title="Print Supplier Khata Statement"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Statement</span>
          </button>

          <button
            onClick={() => {
              setShowPayModal(true);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Pay Supplier (ادائیگی واؤچر)</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
      )}

      {/* Financial Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Live Payable Balance (موجودہ ادھار)</span>
          <div className="text-xl font-black text-rose-600 mt-0.5">
            {formatMoney(vendor?.current_balance || vendorData?.running_balance || 0)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Opening Balance on Onboarding</span>
          <div className="text-xl font-black text-slate-800 mt-0.5">
            {formatMoney(vendor?.opening_balance || 0)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Khata Transactions</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {statement.length} Entries
          </div>
        </div>
      </div>

      {/* Chronological Statement Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Unified Chronological Statement (کھاتہ اسٹیٹمنٹ)</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Voucher #</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Debit (Paid)</th>
                <th className="px-4 py-3 text-right">Credit (Purchased)</th>
                <th className="px-4 py-3 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading Khata ledger...
                  </td>
                </tr>
              ) : statement.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No ledger entries for this vendor yet.
                  </td>
                </tr>
              ) : (
                statement.map((row: any) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-slate-500 font-mono">{row.date}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{row.voucher_no}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{row.description}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                      {row.debit > 0 ? formatMoney(row.debit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600">
                      {row.credit > 0 ? formatMoney(row.credit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-900 text-sm">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>Record Payment Voucher to {vendor?.name}</span>
              </div>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {errorMsg && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Amount (PKR):</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-emerald-600 font-black text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Deduct from counter drawer checkbox */}
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deductFromRegister}
                  onChange={(e) => setDeductFromRegister(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-700">
                  Deduct this payment from <strong>active cash drawer</strong> (CASH_OUT)
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method:</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="cash">Cash (نقدی)</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ref / Cheque #:</label>
                  <input
                    type="text"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Note:</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Atta balance settlement"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md transition"
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

