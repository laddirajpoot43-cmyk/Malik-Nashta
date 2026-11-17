'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, ProductPricingOption, getProductPricingOptions } from '@/types/pos';
import { formatMoney, multiplyMoney } from '@/lib/money';
import { Utensils, X, Plus, AlertCircle, Check, Tag } from 'lucide-react';

interface ProductPricingSelectorProps {
  product: Product;
  onAdd: (
    product: Product,
    quantity: number,
    unitPrice: number,
    note?: string,
    selectedAddons?: any[],
    pricingMethod?: string,
    pricingType?: string
  ) => void;
  onCancel: () => void;
}

export const ProductPricingSelector: React.FC<ProductPricingSelectorProps> = ({
  product,
  onAdd,
  onCancel,
}) => {
  const options = useMemo(() => getProductPricingOptions(product), [product]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [customPriceInput, setCustomPriceInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const priceInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption: ProductPricingOption = options[selectedOptionIndex] || options[0];
  const isByPrice = currentOption?.type === 'by_price';

  // Whenever product or selected option changes, update inputs and focus
  useEffect(() => {
    setErrorMsg(null);
    if (isByPrice) {
      if (!customPriceInput || customPriceInput === '0') {
        setCustomPriceInput(currentOption.min_price ? String(currentOption.min_price) : '100');
      }
      setTimeout(() => {
        priceInputRef.current?.focus();
        priceInputRef.current?.select();
      }, 30);
    } else {
      setTimeout(() => {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }, 30);
    }
  }, [selectedOptionIndex, isByPrice, currentOption]);

  const unitPrice = useMemo(() => {
    if (isByPrice) {
      const p = parseFloat(customPriceInput);
      return isNaN(p) ? 0 : p;
    }
    return currentOption?.price || product.selling_price;
  }, [isByPrice, customPriceInput, currentOption, product.selling_price]);

  const lineTotal = multiplyMoney(unitPrice, quantity);

  const handleConfirm = () => {
    setErrorMsg(null);
    if (quantity <= 0 || isNaN(quantity)) {
      setErrorMsg('Quantity must be at least 1.');
      qtyInputRef.current?.focus();
      return;
    }

    if (unitPrice <= 0) {
      setErrorMsg('Price must be greater than Rs. 0.');
      if (isByPrice) priceInputRef.current?.focus();
      return;
    }

    if (currentOption?.min_price && unitPrice < currentOption.min_price) {
      setErrorMsg(`Price cannot be less than minimum allowed Rs. ${currentOption.min_price}.`);
      if (isByPrice) priceInputRef.current?.focus();
      return;
    }

    const methodLabel = isByPrice ? 'Custom Price' : currentOption.label;

    onAdd(
      product,
      quantity,
      unitPrice,
      undefined,
      [],
      methodLabel,
      currentOption.type
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
      return;
    }

    // Number keys (1 to options.length) to quickly choose pricing option
    // (Only if not typing inside price input)
    const activeEl = document.activeElement;
    const isTypingText = activeEl === priceInputRef.current;

    if (!isTypingText && e.key >= '1' && e.key <= String(options.length)) {
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < options.length) {
        e.preventDefault();
        setSelectedOptionIndex(idx);
        return;
      }
    }

    // Left / Right arrow navigation among pricing methods
    if (!isTypingText) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedOptionIndex((prev) => (prev + 1) % options.length);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedOptionIndex((prev) => (prev - 1 + options.length) % options.length);
        return;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="bg-slate-900 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md mb-3 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-emerald-500/30"
    >
      {/* Header with item details & Cancel Button */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-white">{product.name}</h3>
              {product.category_name && (
                <span className="text-[10px] bg-slate-800 text-slate-300 font-semibold px-2 py-0.5 rounded-full border border-slate-700">
                  {product.category_name}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Standard Base Price: <strong className="text-emerald-400 font-semibold">{formatMoney(product.selling_price)}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          title="Cancel (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Validation Error Alert */}
      {errorMsg && (
        <div className="mb-3 p-2 bg-rose-950/80 border border-rose-500/50 rounded-lg text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Pricing Method Selection Grid */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-emerald-400" />
            <span>Select Pricing Method (Press 1-{options.length} or Arrow Keys):</span>
          </span>
          <span className="text-[10px] text-slate-400">Use Enter to confirm</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {options.map((opt, idx) => {
            const isSelected = idx === selectedOptionIndex;
            return (
              <button
                key={opt.id || idx}
                type="button"
                onClick={() => setSelectedOptionIndex(idx)}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between relative cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-950/70 border-emerald-400 ring-2 ring-emerald-500/40 shadow-lg'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700">
                    [{idx + 1}]
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>

                <div className="font-bold text-xs text-slate-100 truncate">{opt.label}</div>

                <div className="mt-1 font-extrabold text-sm text-emerald-400">
                  {opt.type === 'by_price' ? (
                    <span className="text-xs text-amber-300 font-semibold">Custom PKR</span>
                  ) : (
                    formatMoney(opt.price)
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pricing Parameters: Quantity & Custom Price input */}
      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 mb-3 space-y-3">
        {isByPrice && (
          <div>
            <label className="block text-xs font-bold text-amber-300 mb-1">
              Custom Amount (PKR / روپے):
            </label>
            <div className="relative max-w-sm">
              <span className="absolute left-3 top-2.5 text-sm font-bold text-emerald-400">Rs.</span>
              <input
                ref={priceInputRef}
                type="number"
                step="any"
                value={customPriceInput}
                onChange={(e) => setCustomPriceInput(e.target.value)}
                placeholder="Enter custom price (e.g. 100, 120)"
                className="w-full pl-11 pr-3 py-2 bg-slate-900 border border-emerald-500/60 rounded-lg text-slate-100 font-bold text-base focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            {currentOption?.min_price ? (
              <div className="text-[10px] text-slate-400 mt-1">
                Min. Allowed Price: <strong>Rs. {currentOption.min_price}</strong>
              </div>
            ) : null}
          </div>
        )}

        {/* Quantity Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity (تعداد):</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 font-bold active:scale-95 transition cursor-pointer"
              >
                -
              </button>
              <input
                ref={qtyInputRef}
                type="number"
                min="1"
                step="any"
                value={quantity}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setQuantity(isNaN(val) ? 1 : val);
                }}
                className="w-20 text-center py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-bold text-base text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 font-bold active:scale-95 transition cursor-pointer"
              >
                +
              </button>

              {/* Quick Qty Buttons */}
              <div className="flex items-center gap-1 ml-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuantity(n)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition border cursor-pointer ${
                      quantity === n
                        ? 'bg-emerald-600 text-white border-emerald-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {n}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="block text-[11px] text-slate-400">Selected Method Rate:</span>
            <div className="text-lg font-black text-emerald-400">
              {formatMoney(unitPrice)}
              <span className="text-xs font-normal text-slate-400 ml-1.5">({currentOption?.label})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Confirm Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <div>
          <span className="text-xs text-slate-400">Line Total: </span>
          <span className="font-black text-emerald-400 text-lg">{formatMoney(lineTotal)}</span>
          <span className="text-xs text-slate-400 ml-2">
            ({quantity}x @ {formatMoney(unitPrice)})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
          >
            Cancel [Esc]
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 rounded-xl shadow-lg shadow-emerald-950/60 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add to Bill [Enter]
          </button>
        </div>
      </div>
    </div>
  );
};
