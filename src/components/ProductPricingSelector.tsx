'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product } from '@/types/pos';
import { formatMoney, multiplyMoney } from '@/lib/money';
import { Utensils, Check, X, AlertCircle, Plus, Calculator, ArrowRightLeft, DollarSign, Layers } from 'lucide-react';

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

export type PortionType = 'full_plate' | 'half_plate';

export const ProductPricingSelector: React.FC<ProductPricingSelectorProps> = ({
  product,
  onAdd,
  onCancel,
}) => {
  // Base rates calculation (strictly Full Plate vs. Half Plate)
  const fullPlatePrice = useMemo(() => {
    if (product.pricing_config?.full_plate_price && Number(product.pricing_config.full_plate_price) > 0) {
      return Number(product.pricing_config.full_plate_price);
    }
    return Number(product.selling_price) || 0;
  }, [product]);

  const halfPlatePrice = useMemo(() => {
    if (product.pricing_config?.half_plate_price && Number(product.pricing_config.half_plate_price) > 0) {
      return Number(product.pricing_config.half_plate_price);
    }
    // Default fallback half plate price: 55% rounded to nearest 5
    const fallback = Math.round((fullPlatePrice * 0.55) / 5) * 5;
    return fallback > 0 && fallback < fullPlatePrice ? fallback : 0;
  }, [product, fullPlatePrice]);

  const hasHalfPlate = halfPlatePrice > 0;

  // Selected portion state
  const [portion, setPortion] = useState<PortionType>('full_plate');
  const [quantity, setQuantity] = useState<number>(1);
  const [qtyInput, setQtyInput] = useState<string>('1');
  const [amountInput, setAmountInput] = useState<string>(String(fullPlatePrice));
  const [lastEdited, setLastEdited] = useState<'quantity' | 'amount'>('quantity');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Active base rate depending solely on selected portion
  const activeBaseRate = portion === 'half_plate' ? halfPlatePrice : fullPlatePrice;

  // Line total calculated strictly from base rate and quantity
  const lineTotal = useMemo(() => {
    if (quantity <= 0 || activeBaseRate <= 0) return 0;
    return multiplyMoney(activeBaseRate, quantity);
  }, [activeBaseRate, quantity]);

  // Initial focus and reset when product changes
  useEffect(() => {
    setPortion('full_plate');
    setQuantity(1);
    setQtyInput('1');
    setAmountInput(String(fullPlatePrice));
    setLastEdited('quantity');
    setErrorMsg('');

    // Focus the quantity input directly so cashier can immediately type quantity or press Enter
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 40);
  }, [product, fullPlatePrice]);

  // Handle switching portion (Full Plate vs. Half Plate)
  const switchPortion = (newPortion: PortionType) => {
    if (newPortion === portion) return;
    if (newPortion === 'half_plate' && !hasHalfPlate) return;

    const newRate = newPortion === 'half_plate' ? halfPlatePrice : fullPlatePrice;
    setPortion(newPortion);

    if (lastEdited === 'amount') {
      // Re-calculate quantity proportionally against the new base rate
      const parsedAmt = parseFloat(amountInput);
      if (!isNaN(parsedAmt) && parsedAmt > 0 && newRate > 0) {
        const propQty = parseFloat((parsedAmt / newRate).toFixed(2));
        setQuantity(propQty);
        setQtyInput(String(propQty));
      }
    } else {
      // Re-calculate amount from existing quantity and new base rate
      if (quantity > 0 && newRate > 0) {
        const newAmt = multiplyMoney(newRate, quantity);
        setAmountInput(String(newAmt));
      }
    }
  };

  // Handle Quantity Change: automatically updates Amount
  const handleQuantityChange = (val: string) => {
    setQtyInput(val);
    setLastEdited('quantity');

    const parsedQty = parseFloat(val);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setQuantity(0);
      setAmountInput('');
      setErrorMsg('Please enter a valid quantity greater than 0.');
      return;
    }

    setQuantity(parsedQty);
    const newAmt = multiplyMoney(activeBaseRate, parsedQty);
    setAmountInput(String(newAmt));
    setErrorMsg('');
  };

  // Handle Custom Amount Change: ENFORCE AUTOMATIC PROPORTIONAL RECALCULATION OF QUANTITY
  const handleAmountChange = (val: string) => {
    setAmountInput(val);
    setLastEdited('amount');

    const parsedAmt = parseFloat(val);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setQuantity(0);
      setQtyInput('');
      setErrorMsg('Please enter a valid rupee amount.');
      return;
    }

    if (activeBaseRate <= 0) {
      setErrorMsg('Invalid base rate for this product.');
      return;
    }

    // Proportional quantity calculation: qty = enteredAmount / activeBaseRate
    const propQty = parseFloat((parsedAmt / activeBaseRate).toFixed(2));
    setQuantity(propQty);
    setQtyInput(String(propQty));
    setErrorMsg('');
  };

  // Step quantity up/down
  const adjustQuantity = (delta: number) => {
    const current = quantity > 0 ? quantity : 0;
    let next: number;
    if (delta > 0) {
      next = current < 1 ? Number((current + 0.25).toFixed(2)) : Math.floor(current) + 1;
    } else {
      if (current <= 0.25) {
        next = 0.25;
      } else if (current <= 1) {
        next = Number((current - 0.25).toFixed(2));
      } else {
        next = Math.ceil(current) - 1;
      }
    }
    handleQuantityChange(String(next));
  };

  const handleConfirm = () => {
    setErrorMsg('');

    if (quantity <= 0) {
      setErrorMsg('Quantity must be greater than 0.');
      qtyInputRef.current?.focus();
      return;
    }

    if (activeBaseRate <= 0) {
      setErrorMsg('Invalid rate for this item.');
      return;
    }

    const portionLabel = portion === 'half_plate' ? 'Half Plate' : 'Full Plate';

    onAdd(
      product,
      quantity,
      activeBaseRate,
      '',
      [],
      portionLabel,
      portion
    );
  };

  // Keyboard navigation handler with dedicated 'Q', 'A', '1', '2' hotkeys
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

    // Hotkey 'Q' (or Alt+Q): Switch to Quantity Mode & Focus Input
    if (e.key === 'q' || e.key === 'Q' || (e.altKey && (e.key === 'q' || e.key === 'Q'))) {
      e.preventDefault();
      setLastEdited('quantity');
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
      return;
    }

    // Hotkey 'A' (or Alt+A): Switch to Custom Amount Mode & Focus Input
    if (e.key === 'a' || e.key === 'A' || (e.altKey && (e.key === 'a' || e.key === 'A'))) {
      e.preventDefault();
      setLastEdited('amount');
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
      return;
    }

    const activeEl = document.activeElement;
    const isTyping = activeEl === qtyInputRef.current || activeEl === amountInputRef.current;

    // Alt+1 / Alt+2 work even when focused inside an input field
    if (e.altKey && e.key === '1') {
      e.preventDefault();
      switchPortion('full_plate');
      return;
    }
    if (e.altKey && e.key === '2' && hasHalfPlate) {
      e.preventDefault();
      switchPortion('half_plate');
      return;
    }

    // Hotkey '1' for Full Plate, '2' for Half Plate when not typing inside an input
    if (!isTyping && !e.ctrlKey && !e.altKey) {
      if (e.key === '1') {
        e.preventDefault();
        switchPortion('full_plate');
        return;
      }
      if (e.key === '2' && hasHalfPlate) {
        e.preventDefault();
        switchPortion('half_plate');
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        switchPortion('full_plate');
        return;
      }
      if (e.key === 'ArrowRight' && hasHalfPlate) {
        e.preventDefault();
        switchPortion('half_plate');
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        adjustQuantity(1);
        return;
      }
      if (e.key === '-') {
        e.preventDefault();
        adjustQuantity(-1);
        return;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="bg-white border-2 border-emerald-500 rounded-2xl p-4 shadow-xl mb-3 ring-1 ring-emerald-500/20 text-slate-900 select-none animate-in fade-in outline-none"
    >
      {/* Header: Item Details & Red Close Button */}
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
            <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5 font-medium">
              <span>
                Full Rate: <strong className="text-emerald-700 font-bold">{formatMoney(fullPlatePrice)}</strong>
              </span>
              {hasHalfPlate && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>
                    Half Rate: <strong className="text-emerald-700 font-bold">{formatMoney(halfPlatePrice)}</strong>
                  </span>
                </>
              )}
            </div>
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
        <div className="mb-3 p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* CARD 1: QUANTITY CARD [Q] */}
      <div
        onClick={() => {
          setLastEdited('quantity');
          qtyInputRef.current?.focus();
          qtyInputRef.current?.select();
        }}
        className={`p-3 rounded-xl border transition cursor-pointer mb-2.5 ${
          lastEdited === 'quantity'
            ? 'bg-emerald-50/60 border-emerald-600 ring-2 ring-emerald-500/30 shadow-sm'
            : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded border transition ${
                lastEdited === 'quantity'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              [Q]
            </span>
            <span className="text-xs font-extrabold text-slate-900">
              Quantity (تعداد / پلیٹیں):
            </span>
          </div>
          {lastEdited === 'quantity' ? (
            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
              <Check className="w-3 h-3 text-emerald-700" /> Active Mode (Press Q)
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-medium">Click or Press [Q]</span>
          )}
        </div>

        {/* Quantity Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                adjustQuantity(-1);
                qtyInputRef.current?.focus();
              }}
              className="w-9 h-9 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 font-black text-base active:scale-95 transition cursor-pointer"
              title="Decrease Quantity (-)"
            >
              -
            </button>
            <input
              ref={qtyInputRef}
              type="number"
              min="0.1"
              step="any"
              value={qtyInput}
              onChange={(e) => handleQuantityChange(e.target.value)}
              onFocus={() => setLastEdited('quantity')}
              placeholder="1"
              className="w-24 text-center py-1.5 bg-white border border-slate-300 rounded-lg font-black text-base text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                adjustQuantity(1);
                qtyInputRef.current?.focus();
              }}
              className="w-9 h-9 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 font-black text-base active:scale-95 transition cursor-pointer"
              title="Increase Quantity (+)"
            >
              +
            </button>
          </div>

          {/* Quick Qty Buttons */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuantityChange(String(n));
                  qtyInputRef.current?.focus();
                }}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold transition border cursor-pointer ${
                  quantity === n && lastEdited === 'quantity'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {n}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CARD 2: CUSTOM AMOUNT CARD [A] */}
      <div
        onClick={() => {
          setLastEdited('amount');
          amountInputRef.current?.focus();
          amountInputRef.current?.select();
        }}
        className={`p-3 rounded-xl border transition cursor-pointer mb-2.5 ${
          lastEdited === 'amount'
            ? 'bg-emerald-50/60 border-emerald-600 ring-2 ring-emerald-500/30 shadow-sm'
            : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded border transition ${
                lastEdited === 'amount'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              [A]
            </span>
            <span className="text-xs font-extrabold text-slate-900">
              Custom Amount (رقم - PKR):
            </span>
          </div>
          {lastEdited === 'amount' ? (
            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
              <ArrowRightLeft className="w-3 h-3 text-emerald-700" /> Auto-calculates Quantity ({quantity} plates)
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-medium">Click or Press [A]</span>
          )}
        </div>

        {/* Amount Input with Rs. prefix & Quick Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-2 text-sm font-bold text-emerald-700">Rs.</span>
            <input
              ref={amountInputRef}
              type="number"
              step="any"
              value={amountInput}
              onChange={(e) => handleAmountChange(e.target.value)}
              onFocus={() => setLastEdited('amount')}
              placeholder={`e.g. 50, 100 (${activeBaseRate})`}
              className="w-full pl-11 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-black text-base focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Quick Preset Amount Buttons */}
          <div className="flex items-center gap-1">
            {[50, 100, 150, 200].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAmountChange(String(amt));
                  amountInputRef.current?.focus();
                }}
                className={`text-xs px-2 py-1 rounded-lg font-bold transition border cursor-pointer ${
                  parseFloat(amountInput) === amt && lastEdited === 'amount'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Rs. {amt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500 font-medium">
          <span>
            Base Rate: <strong>{formatMoney(activeBaseRate)}</strong> ({portion === 'half_plate' ? 'Half Plate' : 'Full Plate'})
          </span>
          {quantity > 0 && (
            <span className="font-bold text-emerald-700">
              = {quantity} plate(s)
            </span>
          )}
        </div>
      </div>

      {/* CARD 3: PLATE SELECTION (FULL PLATE VS. HALF PLATE) */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-emerald-600" />
            <span>Plate Selection (پلیٹ سلیکشن):</span>
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            Press [1] / Alt+1 for Full, [2] / Alt+2 for Half
          </span>
        </div>

        <div className={`grid gap-2 ${hasHalfPlate ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {/* Full Plate Base Rate Option */}
          <button
            type="button"
            onClick={() => switchPortion('full_plate')}
            className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              portion === 'full_plate'
                ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/40 shadow-sm'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                [1]
              </span>
              <div>
                <div className="font-bold text-xs text-slate-900">Full Plate (مکمل پلیٹ)</div>
                <div className="text-[10px] text-slate-500">Standard Portion</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-black text-sm text-emerald-700">{formatMoney(fullPlatePrice)}</div>
              {portion === 'full_plate' && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center justify-end gap-0.5 mt-0.5">
                  <Check className="w-3 h-3" /> Selected
                </span>
              )}
            </div>
          </button>

          {/* Half Plate Base Rate Option */}
          {hasHalfPlate && (
            <button
              type="button"
              onClick={() => switchPortion('half_plate')}
              className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                portion === 'half_plate'
                  ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/40 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                  [2]
                </span>
                <div>
                  <div className="font-bold text-xs text-slate-900">Half Plate (ہاف پلیٹ)</div>
                  <div className="text-[10px] text-slate-500">Half Portion</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-sm text-emerald-700">{formatMoney(halfPlatePrice)}</div>
                {portion === 'half_plate' && (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center justify-end gap-0.5 mt-0.5">
                    <Check className="w-3 h-3" /> Selected
                  </span>
                )}
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Footer / Confirm Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
        <div>
          <span className="text-xs text-slate-600 font-medium">Line Total: </span>
          <span className="font-black text-emerald-700 text-lg">{formatMoney(lineTotal)}</span>
          <span className="text-xs text-slate-600 font-semibold ml-2">
            ({quantity} plate(s) @ {formatMoney(activeBaseRate)})
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
