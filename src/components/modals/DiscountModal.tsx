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
  const requiresPin = type === 'percentage' && numVal > maxCashierPct && !isAdmin;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Apply Order Discount</h2>
              <p className="text-xs text-slate-400">Cart Subtotal: {formatMoney(subtotal)}</p>
            </div>
          </div>
          <button
            onClick={() => setOpenDiscountModal(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-200 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setType('percentage')}
              className={`py-2 rounded-md transition ${type === 'percentage' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Percentage (%)
            </button>
            <button
              type="button"
              onClick={() => setType('fixed')}
              className={`py-2 rounded-md transition ${type === 'fixed' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Fixed Rupees (Rs)
            </button>
          </div>

          {/* Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {type === 'percentage' ? 'Discount Percentage (%):' : 'Discount Amount (PKR):'}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => { setValue(e.target.value); setErrorMsg(''); }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-bold text-lg focus:outline-none focus:border-emerald-500"
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
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          )}

          {/* Supervisor PIN Guard notice if > 15% */}
          {requiresPin && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Discounts above {maxCashierPct}% require Supervisor / Admin PIN</span>
              </div>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter 4-digit Admin PIN"
                className="w-full px-3 py-1.5 bg-slate-900 border border-amber-500/50 rounded-lg text-white text-sm font-bold tracking-widest text-center focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setDiscount('percentage', 0); setOpenDiscountModal(false); }}
              className="px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-slate-800 rounded-lg font-semibold"
            >
              Remove Discount
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Apply Discount
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

