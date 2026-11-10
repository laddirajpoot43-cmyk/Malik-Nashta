'use client';

import React, { useState, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { formatMoney, subtractMoney, addMoney } from '@/lib/money';
import { CreditCard, DollarSign, Smartphone, Check, X, AlertTriangle } from 'lucide-react';

export const PaymentModal: React.FC = () => {
  const { openPaymentModal, setOpenPaymentModal, grandTotal, customCheckout, customerName, setCustomerName, customerPhone, setCustomerPhone } = usePOS();

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'jazzcash' | 'easypaisa' | 'bank'>('cash');
  const [tenderedAmount, setTenderedAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (openPaymentModal) {
      setTenderedAmount(String(grandTotal));
      setErrorMsg('');
      setLoading(false);
    }
  }, [openPaymentModal, grandTotal]);

  if (!openPaymentModal) return null;

  const tenderedNum = parseFloat(tenderedAmount) || 0;
  const changeReturned = Math.max(0, subtractMoney(tenderedNum, grandTotal));

  const handleQuickTender = (amt: number) => {
    setTenderedAmount(String(amt));
  };

  const handleSubmit = async () => {
    if (tenderedNum < grandTotal && paymentMethod === 'cash') {
      setErrorMsg(`Tendered amount (Rs. ${tenderedNum}) cannot be less than Grand Total (Rs. ${grandTotal}).`);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const payments = [
      {
        method_id: paymentMethod,
        amount: grandTotal,
        amount_tendered: paymentMethod === 'cash' ? tenderedNum : grandTotal,
      },
    ];

    const result = await customCheckout(payments);
    setLoading(false);
    if (!result.success) {
      setErrorMsg(result.error || 'Checkout failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Settle Payment & Print Bill</h2>
              <p className="text-xs text-slate-400">Total Due: <strong className="text-emerald-400 font-bold text-sm">{formatMoney(grandTotal)}</strong></p>
            </div>
          </div>
          <button
            onClick={() => setOpenPaymentModal(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Info (Optional) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Customer / Table Name:</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in / Table 4"
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Phone Number (Optional):</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0300-1234567"
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Payment Method:</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'cash', label: 'Cash (نقدی)', icon: DollarSign },
                { id: 'jazzcash', label: 'JazzCash', icon: Smartphone },
                { id: 'easypaisa', label: 'EasyPaisa', icon: Smartphone },
                { id: 'bank', label: 'Bank / Card', icon: CreditCard },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      paymentMethod === m.id
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] font-bold">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* If Cash, Tender & Change Calculator */}
          {paymentMethod === 'cash' && (
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cash Tendered by Customer (وصول رقم):
                </label>
                <input
                  type="number"
                  value={tenderedAmount}
                  onChange={(e) => setTenderedAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 font-black text-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickTender(grandTotal)}
                  className="text-xs px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-md font-bold"
                >
                  Exact (Rs. {grandTotal})
                </button>
                {[500, 1000, 2000, 5000].map((amt) => {
                  if (amt >= grandTotal) {
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickTender(amt)}
                        className="text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md font-semibold border border-slate-700"
                      >
                        Rs. {amt}
                      </button>
                    );
                  }
                  return null;
                })}
              </div>

              {/* Change Returned Highlight */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="text-xs font-semibold text-slate-400">Change to Return (بقایا):</span>
                <span className="font-black text-amber-400 text-lg">{formatMoney(changeReturned)}</span>
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            {loading ? 'Processing Transaction...' : `Confirm & Print Receipt (${formatMoney(grandTotal)})`}
          </button>
        </div>
      </div>
    </div>
  );
};

