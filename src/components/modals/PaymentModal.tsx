'use client';

import React, { useState, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { formatMoney, subtractMoney, addMoney } from '@/lib/money';
import { CreditCard, DollarSign, Smartphone, Check, X, AlertTriangle, BookOpen } from 'lucide-react';

interface KhataCustomer {
  id: string;
  name: string;
  phone?: string;
  current_balance: number;
}

export const PaymentModal: React.FC = () => {
  const { openPaymentModal, setOpenPaymentModal, grandTotal, customCheckout, customerName, setCustomerName, customerPhone, setCustomerPhone } = usePOS();

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'jazzcash' | 'easypaisa' | 'bank' | 'udhaar'>('cash');
  const [tenderedAmount, setTenderedAmount] = useState<string>('');
  const [customers, setCustomers] = useState<KhataCustomer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (openPaymentModal) {
      setTenderedAmount(String(grandTotal));
      setErrorMsg('');
      setLoading(false);
      setSelectedCustomerId('');
      fetch('/api/customers')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.customers)) {
            setCustomers(d.customers);
          }
        })
        .catch(() => {});
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

    if (paymentMethod === 'udhaar' && !selectedCustomerId) {
      setErrorMsg('Please select a Customer Khata account for Udhaar billing.');
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

    const result = await customCheckout(
      payments,
      undefined,
      paymentMethod === 'udhaar' ? { udhaar_customer_id: selectedCustomerId } : undefined
    );
    setLoading(false);
    if (!result.success) {
      setErrorMsg(result.error || 'Checkout failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Settle Payment & Print Bill</h2>
              <p className="text-xs text-slate-500">Total Due: <strong className="text-indigo-600 font-bold text-sm">{formatMoney(grandTotal)}</strong></p>
            </div>
          </div>
          <button
            onClick={() => setOpenPaymentModal(false)}
            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Info (Optional) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Customer / Table Name:</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in / Table 4"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone Number (Optional):</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0300-1234567"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Method:</label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: 'cash', label: 'Cash (نقدی)', icon: DollarSign },
                { id: 'jazzcash', label: 'JazzCash', icon: Smartphone },
                { id: 'easypaisa', label: 'EasyPaisa', icon: Smartphone },
                { id: 'bank', label: 'Bank / Card', icon: CreditCard },
                { id: 'udhaar', label: 'Udhaar (کھاتہ)', icon: BookOpen },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      paymentMethod === m.id
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-800 shadow-sm font-bold ring-1 ring-indigo-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-indigo-600" />
                    <span className="text-[10px] font-bold leading-tight">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* If Udhaar, Select Customer Khata */}
          {paymentMethod === 'udhaar' && (
            <div className="space-y-2 bg-amber-50 p-4 rounded-xl border border-amber-200">
              <label className="block text-xs font-bold text-amber-900">
                Select Customer Khata Account (کسٹمر منتخب کریں):
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  const cid = e.target.value;
                  setSelectedCustomerId(cid);
                  const found = customers.find((c) => c.id === cid);
                  if (found) {
                    setCustomerName(found.name);
                    if (found.phone) setCustomerPhone(found.phone);
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Choose Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''} — Bal: Rs. {c.current_balance || 0}
                  </option>
                ))}
              </select>
              {customers.length === 0 && (
                <p className="text-[11px] font-semibold text-amber-800">
                  No customers found. Add customers from Admin &rarr; Customer Udhaar Khata first.
                </p>
              )}
            </div>
          )}

          {/* If Cash, Tender & Change Calculator */}
          {paymentMethod === 'cash' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cash Tendered by Customer (وصول رقم):
                </label>
                <input
                  type="number"
                  value={tenderedAmount}
                  onChange={(e) => setTenderedAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-indigo-600 font-black text-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickTender(grandTotal)}
                  className="text-xs px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold transition"
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
                        className="text-xs px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-md font-semibold border border-slate-300 transition"
                      >
                        Rs. {amt}
                      </button>
                    );
                  }
                  return null;
                })}
              </div>

              {/* Change Returned Highlight */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-xs font-semibold text-slate-600">Change to Return (بقایا):</span>
                <span className="font-black text-indigo-700 text-lg">{formatMoney(changeReturned)}</span>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex gap-2">
            <button
              onClick={() => setOpenPaymentModal(false)}
              className="py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              {loading ? 'Processing Transaction...' : `Confirm & Print Receipt (${formatMoney(grandTotal)})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

