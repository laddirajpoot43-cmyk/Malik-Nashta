'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Product, ProductAddon } from '@/types/pos';
import { calculatePortionFromAmount, calculateAmountFromPortion, formatMoney } from '@/lib/money';
import { Check, Plus, Utensils, X } from 'lucide-react';

interface InlineItemSelectorProps {
  product: Product;
  addonsList: ProductAddon[];
  quickNotes: string[];
  onAdd: (product: Product, quantity: number, customUnitPrice?: number, note?: string, selectedAddons?: ProductAddon[]) => void;
  onCancel: () => void;
}

export const InlineItemSelector: React.FC<InlineItemSelectorProps> = ({
  product,
  addonsList,
  quickNotes,
  onAdd,
  onCancel,
}) => {
  // Mode: either 'portion' or 'rupee'
  const [portion, setPortion] = useState<number>(1.0);
  const [rupeeAmount, setRupeeAmount] = useState<string>(String(product.selling_price));
  const [selectedNote, setSelectedNote] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');
  const [selectedAddons, setSelectedAddons] = useState<ProductAddon[]>([]);

  const rupeeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus rupee input by default
    rupeeInputRef.current?.focus();
    rupeeInputRef.current?.select();
  }, [product]);

  // When cashier types custom rupee amount (e.g. 50)
  const handleRupeeChange = (val: string) => {
    setRupeeAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      const calculatedQty = calculatePortionFromAmount(product.selling_price, num);
      setPortion(calculatedQty);
    }
  };

  // When cashier clicks quick portion chip (e.g. 0.5 Aadha)
  const handlePortionSelect = (qty: number) => {
    setPortion(qty);
    const calculatedRupee = calculateAmountFromPortion(product.selling_price, qty);
    setRupeeAmount(String(calculatedRupee));
  };

  // When cashier clicks quick rupee chip (e.g. Rs. 50)
  const handleRupeeSelect = (amt: number) => {
    setRupeeAmount(String(amt));
    const calculatedQty = calculatePortionFromAmount(product.selling_price, amt);
    setPortion(calculatedQty);
  };

  const toggleAddon = (addon: ProductAddon) => {
    setSelectedAddons((prev) => {
      const exists = prev.some((a) => a.id === addon.id);
      if (exists) {
        return prev.filter((a) => a.id !== addon.id);
      }
      return [...prev, addon];
    });
  };

  const handleConfirm = () => {
    const finalNote = customNote.trim() ? customNote.trim() : selectedNote;
    const finalPrice = parseFloat(rupeeAmount) || product.selling_price;
    // Call onAdd
    onAdd(product, portion, product.selling_price, finalNote, selectedAddons);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="bg-emerald-950/20 border-2 border-emerald-500 rounded-xl p-4 shadow-xl backdrop-blur-md mb-4 animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {/* Header with item details */}
      <div className="flex items-center justify-between pb-3 border-b border-emerald-500/30 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-slate-100">{product.name}</h3>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                {product.category_name || 'Nashta'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Standard Full Plate: <strong className="text-emerald-400 font-bold">{formatMoney(product.selling_price)}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
          title="Cancel (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Rupee & Portion Reciprocation Engine */}
        <div className="space-y-3">
          {/* Rupee Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Custom Amount (Rupees / روپے):
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-bold text-emerald-400">Rs.</span>
              <input
                ref={rupeeInputRef}
                type="number"
                step="any"
                value={rupeeAmount}
                onChange={(e) => handleRupeeChange(e.target.value)}
                placeholder="Enter Rs (e.g. 50, 100)"
                className="w-full pl-11 pr-3 py-2 bg-slate-900 border border-emerald-500/50 rounded-lg text-slate-100 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>

          {/* Quick Rupee Chips */}
          <div>
            <div className="text-[11px] font-medium text-slate-400 mb-1.5">Quick Rupee Buttons:</div>
            <div className="flex flex-wrap gap-1.5">
              {[50, 100, 150, 200, 300].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleRupeeSelect(amt)}
                  className={`text-xs px-2.5 py-1.5 rounded-md font-semibold transition border ${
                    parseFloat(rupeeAmount) === amt
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                      : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:border-emerald-500/50 hover:bg-slate-700'
                  }`}
                >
                  Rs. {amt}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Portion Chips */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-1.5">
              <span>Portion (حصہ):</span>
              <span className="text-emerald-400 font-bold">{portion} Portion(s)</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { qty: 0.25, label: '0.25 (Pao)' },
                { qty: 0.5, label: '0.5 (Aadha)' },
                { qty: 1.0, label: '1.0 (Poora)' },
                { qty: 1.5, label: '1.5 Plate' },
                { qty: 2.0, label: '2.0 Plate' },
              ].map((p) => (
                <button
                  key={p.qty}
                  type="button"
                  onClick={() => handlePortionSelect(p.qty)}
                  className={`text-xs py-1.5 px-1 text-center rounded-md font-semibold transition border ${
                    portion === p.qty
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                      : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:border-emerald-500/50 hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Kitchen Notes & Addons */}
        <div className="space-y-3">
          {/* Quick Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Kitchen Instructions / نوٹ:
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {quickNotes.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => setSelectedNote(selectedNote === note ? '' : note)}
                  className={`text-[11px] px-2 py-1 rounded-md transition border ${
                    selectedNote === note
                      ? 'bg-emerald-700 text-white border-emerald-500'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {note}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Or write custom kitchen note..."
              className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Add-ons Checklist */}
          {addonsList.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Add-ons / ایکسٹرا:
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto pr-1">
                {addonsList.map((addon) => {
                  const isChecked = selectedAddons.some((a) => a.id === addon.id);
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => toggleAddon(addon)}
                      className={`flex items-center justify-between text-left text-xs px-2 py-1.5 rounded-md border transition ${
                        isChecked
                          ? 'bg-emerald-900/60 border-emerald-500 text-emerald-200'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="truncate">{addon.name}</span>
                      <span className="font-bold text-[10px] ml-1">+{formatMoney(addon.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer / Confirm Bar */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-emerald-500/30">
        <div className="text-xs text-slate-300">
          Line Total:{' '}
          <span className="font-black text-emerald-400 text-base">
            {formatMoney(
              (parseFloat(rupeeAmount) || product.selling_price) +
                selectedAddons.reduce((acc, a) => acc + a.price, 0)
            )}
          </span>{' '}
          ({portion}x portion)
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition"
          >
            Cancel (Esc)
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-lg shadow-md transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add to Cart (Enter)
          </button>
        </div>
      </div>
    </div>
  );
};

