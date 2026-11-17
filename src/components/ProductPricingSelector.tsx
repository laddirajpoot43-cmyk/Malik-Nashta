'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product } from '@/types/pos';
import { formatMoney } from '@/lib/money';
import { getProductPricingOptions } from '@/lib/pricing';
import { Utensils, Tag, Check, X, AlertCircle, Plus } from 'lucide-react';

export interface ProductPricingSelectorProps {
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
  const [errorMsg, setErrorMsg] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const currentOption = options[selectedOptionIndex] || options[0];
  const isByPrice = currentOption?.type === 'by_price';

  // Compute unit price
  const unitPrice = useMemo(() => {
    if (!currentOption) return Number(product.selling_price) || 0;
    if (currentOption.type === 'by_price') {
      const parsed = parseFloat(customPriceInput);
      return isNaN(parsed) ? 0 : parsed;
    }
    return Number(currentOption.price) || 0;
  }, [currentOption, customPriceInput, product.selling_price]);

  const lineTotal = useMemo(() => {
    return unitPrice * quantity;
  }, [unitPrice, quantity]);

  // Initial focus and setup
  useEffect(() => {
    setSelectedOptionIndex(0);
    setQuantity(1);
    setErrorMsg('');

    if (options[0]?.type === 'by_price') {
      setCustomPriceInput(String(options[0]?.price || ''));
      setTimeout(() => {
        priceInputRef.current?.focus();
        priceInputRef.current?.select();
      }, 50);
    } else {
      setTimeout(() => {
        containerRef.current?.focus();
      }, 50);
    }
  }, [product, options]);

  // When switching to by_price, focus the price input
  useEffect(() => {
    if (isByPrice) {
      if (!customPriceInput && currentOption?.price) {
        setCustomPriceInput(String(currentOption.price));
      }
      setTimeout(() => {
        priceInputRef.current?.focus();
        priceInputRef.current?.select();
      }, 50);
    }
  }, [isByPrice, currentOption]);

  const handleConfirm = () => {
    setErrorMsg('');

    // Price validation
    if (unitPrice <= 0) {
      setErrorMsg('Price must be greater than Rs. 0. Please enter a valid amount.');
      priceInputRef.current?.focus();
      return;
    }

    if (currentOption?.min_price && unitPrice < currentOption.min_price) {
      setErrorMsg(
        `Price is below minimum allowed rate of Rs. ${currentOption.min_price} for this item.`
      );
      priceInputRef.current?.focus();
      return;
    }

    if (quantity <= 0) {
      setErrorMsg('Quantity must be at least 1.');
      qtyInputRef.current?.focus();
      return;
    }

    onAdd(
      product,
      quantity,
      unitPrice,
      '',
      [],
      currentOption?.label || 'Plate',
      currentOption?.type || 'full_plate'
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleConfirm();
      return;
    }

    // Number keys (1 to 9) to pick pricing option directly
    const num = parseInt(e.key);
    if (!isNaN(num) && num >= 1 && num <= options.length && !e.ctrlKey && !e.altKey) {
      const activeEl = document.activeElement;
      if (activeEl === priceInputRef.current || activeEl === qtyInputRef.current) {
        // typing inside numeric input
      } else {
        e.preventDefault();
        setSelectedOptionIndex(num - 1);
        return;
      }
    }

    // Arrow keys for option navigation
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      const activeEl = document.activeElement;
      if (activeEl !== priceInputRef.current && activeEl !== qtyInputRef.current) {
        e.preventDefault();
        setSelectedOptionIndex((prev) => (prev + 1) % options.length);
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      const activeEl = document.activeElement;
      if (activeEl !== priceInputRef.current && activeEl !== qtyInputRef.current) {
        e.preventDefault();
        setSelectedOptionIndex((prev) => (prev - 1 + options.length) % options.length);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="bg-white border-2 border-emerald-500 rounded-2xl p-4 shadow-xl mb-3 ring-1 ring-emerald-500/20 text-slate-900 select-none animate-in fade-in"
    >
      {/* Header with item details & Cancel Button */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0 font-bold">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-900">{product.name}</h3>
              {product.category_name && (
                <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full border border-slate-300">
                  {product.category_name}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              Standard Base Rate: <strong className="text-emerald-700 font-bold">{formatMoney(product.selling_price)}</strong>
            </p>
          </div>
        </div>

        {/* RED CANCEL ICON BUTTON */}
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
          title="Cancel (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Validation Error Alert */}
      {errorMsg && (
        <div className="mb-3 p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Pricing Method Selection Grid */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-emerald-600" />
            <span>Select Pricing Method (Press 1-{options.length} or Arrow Keys):</span>
          </span>
          <span className="text-[10px] text-slate-500 font-medium">Use Enter to confirm</span>
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
                    ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/40 shadow'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                    [{idx + 1}]
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>

                <div className="font-bold text-xs text-slate-900 truncate">{opt.label}</div>

                <div className="mt-1 font-black text-sm text-emerald-700">
                  {opt.type === 'by_price' ? (
                    <span className="text-xs text-emerald-800 font-bold">Custom PKR</span>
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
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3 space-y-3">
        {isByPrice && (
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Custom Amount (PKR / روپے):
            </label>
            <div className="relative max-w-sm">
              <span className="absolute left-3 top-2 text-sm font-bold text-emerald-700">Rs.</span>
              <input
                ref={priceInputRef}
                type="number"
                step="any"
                value={customPriceInput}
                onChange={(e) => setCustomPriceInput(e.target.value)}
                placeholder="Enter custom price (e.g. 100, 120)"
                className="w-full pl-11 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-black text-base focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            {currentOption?.min_price ? (
              <div className="text-[10px] text-slate-600 mt-1 font-medium">
                Min. Allowed Price: <strong>Rs. {currentOption.min_price}</strong>
              </div>
            ) : null}
          </div>
        )}

        {/* Quantity Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Quantity (تعداد):</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 font-black text-base active:scale-95 transition cursor-pointer"
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
                className="w-20 text-center py-1.5 bg-white border border-slate-300 rounded-lg font-black text-base text-slate-900 focus:outline-none focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-9 h-9 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 font-black text-base active:scale-95 transition cursor-pointer"
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
                    className={`text-xs px-2.5 py-1 rounded-lg font-bold transition border cursor-pointer ${
                      quantity === n
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {n}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="block text-[11px] text-slate-600 font-medium">Selected Rate:</span>
            <div className="text-lg font-black text-emerald-700">
              {formatMoney(unitPrice)}
              <span className="text-xs font-semibold text-slate-600 ml-1.5">({currentOption?.label})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Confirm Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
        <div>
          <span className="text-xs text-slate-600 font-medium">Line Total: </span>
          <span className="font-black text-emerald-700 text-lg">{formatMoney(lineTotal)}</span>
          <span className="text-xs text-slate-600 font-semibold ml-2">
            ({quantity}x @ {formatMoney(unitPrice)})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* RED BUTTON: Cancel */}
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition cursor-pointer shadow-sm"
          >
            Cancel [Esc]
          </button>
          {/* GREEN BUTTON: Add to Bill */}
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add to Bill [Enter]
          </button>
        </div>
      </div>
    </div>
  );
};
