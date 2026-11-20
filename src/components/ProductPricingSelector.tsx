'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product } from '@/types/pos';
import { formatMoney, multiplyMoney } from '@/lib/money';
import { Utensils, Check, X, AlertCircle, Plus, Calculator, ArrowRightLeft, DollarSign, Layers } from 'lucide-react';

export interface ProductPricingSelectorProps {
  product: Product;
  autoFocusTrigger?: number;
  resetTrigger?: number;
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
  autoFocusTrigger = 0,
  resetTrigger = 0,
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

  // Reset when product changes or resetTrigger increments
  useEffect(() => {
    setPortion('full_plate');
    setQuantity(1);
    setQtyInput('1');
    setAmountInput(String(fullPlatePrice));
    setLastEdited('quantity');
    setErrorMsg('');
  }, [product, fullPlatePrice, resetTrigger]);

  // Only focus quantity input when user explicitly selects an item
  useEffect(() => {
    if (autoFocusTrigger > 0) {
      setTimeout(() => {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }, 40);
    }
  }, [autoFocusTrigger]);

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
      className="bg-white border-2 border-indigo-500 rounded-2xl p-3 shadow-md mb-2.5 ring-2 ring-indigo-500/15 text-slate-900 select-none outline-none shrink-0"
    >
      {/* Header: Item Details & Reset Button */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 font-bold">
            <i className="fa-solid fa-utensils text-base" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base text-slate-900 leading-tight">{product.name}</h3>
              {product.category_name && (
                <span className="text-[11px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full border border-indigo-200">
                  {product.category_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-600 mt-0.5 font-semibold">
              <span>
                Full Rate: <strong className="text-indigo-700 font-black">{formatMoney(fullPlatePrice)}</strong>
              </span>
              {hasHalfPlate && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>
                    Half Rate: <strong className="text-indigo-700 font-black">{formatMoney(halfPlatePrice)}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RESET BUTTON */}
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-500 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer text-xs font-bold flex items-center gap-1"
          title="Reset Quantity & Focus Search (Esc)"
        >
          <i className="fa-solid fa-rotate-left" />
          <span>Reset</span>
        </button>
      </div>

      {/* Validation Error Alert */}
      {errorMsg && (
        <div className="mb-2 p-2 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-rose-600" />
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
        className={`p-2.5 rounded-xl border transition cursor-pointer mb-2 ${
          lastEdited === 'quantity'
            ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/25 shadow-sm'
            : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-black px-2 py-0.5 rounded border transition ${
                lastEdited === 'quantity'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              [Q]
            </span>
            <span className="text-sm font-black text-slate-900">
              Quantity (تعداد / پلیٹیں):
            </span>
          </div>
          {lastEdited === 'quantity' ? (
            <span className="text-[11px] font-extrabold text-indigo-700 flex items-center gap-1 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-300">
              <i className="fa-solid fa-check text-indigo-700" /> Active Mode (Press Q)
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 font-semibold">Click or Press [Q]</span>
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
              className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-900 font-black text-base active:scale-95 transition cursor-pointer"
              title="Decrease Quantity (-)"
            >
              <i className="fa-solid fa-minus text-xs" />
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
              className="w-24 text-center py-1 bg-white border border-slate-300 rounded-lg font-black text-base text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                adjustQuantity(1);
                qtyInputRef.current?.focus();
              }}
              className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-900 font-black text-base active:scale-95 transition cursor-pointer"
              title="Increase Quantity (+)"
            >
              <i className="fa-solid fa-plus text-xs" />
            </button>
          </div>

          {/* Quick Qty Buttons */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuantityChange(String(n));
                  qtyInputRef.current?.focus();
                }}
                className={`text-sm px-2.5 py-1 rounded-lg font-black transition border cursor-pointer ${
                  quantity === n && lastEdited === 'quantity'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
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
        className={`p-2.5 rounded-xl border transition cursor-pointer mb-2 ${
          lastEdited === 'amount'
            ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/25 shadow-sm'
            : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-black px-2 py-0.5 rounded border transition ${
                lastEdited === 'amount'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              [A]
            </span>
            <span className="text-sm font-black text-slate-900">
              Custom Amount (رقم - PKR):
            </span>
          </div>
          {lastEdited === 'amount' ? (
            <span className="text-[11px] font-extrabold text-indigo-700 flex items-center gap-1 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-300">
              <i className="fa-solid fa-arrow-right-arrow-left text-indigo-700" /> Auto Quantity ({quantity} plates)
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 font-semibold">Click or Press [A]</span>
          )}
        </div>

        {/* Amount Input with Rs. prefix & Quick Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1.5 text-sm font-black text-indigo-700">Rs.</span>
            <input
              ref={amountInputRef}
              type="number"
              step="any"
              value={amountInput}
              onChange={(e) => handleAmountChange(e.target.value)}
              onFocus={() => setLastEdited('amount')}
              placeholder={`e.g. 50, 100 (${activeBaseRate})`}
              className="w-full pl-11 pr-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-900 font-black text-base focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
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
                className={`text-xs px-2.5 py-1 rounded-lg font-extrabold transition border cursor-pointer ${
                  parseFloat(amountInput) === amt && lastEdited === 'amount'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Rs. {amt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 font-semibold">
          <span>
            Base Rate: <strong className="text-slate-800">{formatMoney(activeBaseRate)}</strong> ({portion === 'half_plate' ? 'Half Plate' : 'Full Plate'})
          </span>
          {quantity > 0 && (
            <span className="font-extrabold text-indigo-700">
              = {quantity} plate(s)
            </span>
          )}
        </div>
      </div>

      {/* CARD 3: PLATE SELECTION (FULL PLATE VS. HALF PLATE) */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-black text-slate-800 flex items-center gap-1.5">
            <i className="fa-solid fa-calculator text-indigo-600" />
            <span>Plate Selection (پلیٹ سلیکشن):</span>
          </span>
          <span className="text-[11px] text-slate-500 font-semibold">
            Press [1] / Alt+1 Full, [2] / Alt+2 Half
          </span>
        </div>

        <div className={`grid gap-2 ${hasHalfPlate ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {/* Full Plate Base Rate Option */}
          <button
            type="button"
            onClick={() => switchPortion('full_plate')}
            className={`p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              portion === 'full_plate'
                ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/35 shadow-sm'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                [1]
              </span>
              <div>
                <div className="font-extrabold text-sm text-slate-900">Full Plate (مکمل پلیٹ)</div>
                <div className="text-[11px] text-slate-500 font-semibold">Standard Portion</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-black text-sm text-indigo-700">{formatMoney(fullPlatePrice)}</div>
              {portion === 'full_plate' && (
                <span className="text-[10px] text-indigo-600 font-extrabold flex items-center justify-end gap-1 mt-0.5">
                  <i className="fa-solid fa-check" /> Selected
                </span>
              )}
            </div>
          </button>

          {/* Half Plate Base Rate Option */}
          {hasHalfPlate && (
            <button
              type="button"
              onClick={() => switchPortion('half_plate')}
              className={`p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                portion === 'half_plate'
                  ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/35 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                  [2]
                </span>
                <div>
                  <div className="font-extrabold text-sm text-slate-900">Half Plate (ہاف پلیٹ)</div>
                  <div className="text-[11px] text-slate-500 font-semibold">Half Portion</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-sm text-indigo-700">{formatMoney(halfPlatePrice)}</div>
                {portion === 'half_plate' && (
                  <span className="text-[10px] text-indigo-600 font-extrabold flex items-center justify-end gap-1 mt-0.5">
                    <i className="fa-solid fa-check" /> Selected
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
          <span className="text-sm text-slate-700 font-bold">Line Total: </span>
          <span className="font-black text-indigo-700 text-xl tabular-nums">{formatMoney(lineTotal)}</span>
          <span className="text-xs text-slate-600 font-bold ml-2">
            ({quantity} plate(s) @ {formatMoney(activeBaseRate)})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* ROSE BUTTON: Reset */}
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            <i className="fa-solid fa-xmark" />
            <span>Reset [Esc]</span>
          </button>
          {/* TEAL BUTTON: Add to Bill */}
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 text-sm font-black text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-plus" />
            <span>Add to Bill [Enter]</span>
          </button>
        </div>
      </div>
    </div>
  );
};
