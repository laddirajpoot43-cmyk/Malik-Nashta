'use client';

import React, { useState, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/money';
import { Percent, ShieldAlert, Check, X } from 'lucide-react';

export const DiscountModal: React.FC = () => {
  const { openDiscountModal, setOpenDiscountModal, subtotal, discountType, discountValue, setDiscount } = usePOS();
  const { settings } = useSettings();
  const { verifyAdminPin, isAdmin } = useAuth();

  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState<string>('0');
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (openDiscountModal) {
      setType(discountType);
      setValue(String(discountValue));
      setPin('');
      setErrorMsg('');
    }
  }, [openDiscountModal, discountType, discountValue]);

  if (!openDiscountModal) return null;

  const numVal = parseFloat(value) || 0;
  const maxCashierPct = settings.max_cashier_discount_percent || 15;
  const effectivePct = type === 'percentage'
    ? numVal
    : (subtotal > 0 ? (numVal / subtotal) * 100 : 0);
  const requiresPin = effectivePct > maxCashierPct && !isAdmin;

  const handleApply = async () => {
    if (numVal < 0) {
      setErrorMsg('Discount cannot be negative.');
      return;
    }

    if (requiresPin) {
      if (!pin.trim()) {
        setErrorMsg(`Supervisor PIN required for discounts above ${maxCashierPct}%.`);
        return;
      }
      const valid = await verifyAdminPin(pin);
      if (!valid) {
        setErrorMsg('Invalid Supervisor / Admin PIN.');
        return;
      }
    }

    setDiscount(type, numVal, pin.trim());
    setOpenDiscountModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Apply Order Discount</h2>
              <p className="text-xs text-slate-500">Cart Subtotal: {formatMoney(subtotal)}</p>
            </div>
          </div>
          <button
            onClick={() => setOpenDiscountModal(false)}
            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setType('percentage')}
              className={`py-2 rounded-lg transition ${type === 'percentage' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Percentage (%)
            </button>
            <button
              type="button"
              onClick={() => setType('fixed')}
              className={`py-2 rounded-lg transition ${type === 'fixed' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Fixed Rupees (Rs)
            </button>
          </div>

          {/* Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {type === 'percentage' ? 'Discount Percentage (%):' : 'Discount Amount (PKR):'}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => { setValue(e.target.value); setErrorMsg(''); }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Quick Percentage Chips */}
          {type === 'percentage' && (
            <div className="flex gap-2">
              {[5, 10, 15, 20, 25].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => { setValue(String(pct)); setErrorMsg(''); }}
                  className={`text-xs px-2.5 py-1.5 rounded-md font-semibold border transition ${
                    numVal === pct
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          )}

          {/* Supervisor PIN Guard notice if > 15% */}
          {requiresPin && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Discounts above {maxCashierPct}% require Supervisor / Admin PIN</span>
              </div>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter 4-digit Admin PIN"
                className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-slate-900 text-sm font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setDiscount('percentage', 0); setOpenDiscountModal(false); }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow transition"
            >
              Remove Discount
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Apply Discount
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

