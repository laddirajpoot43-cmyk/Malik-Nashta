'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Product, CartItem } from '@/types/pos';
import { formatMoney } from '@/lib/money';
import { InlineItemSelector } from '@/components/InlineItemSelector';
import {
  Search,
  ShoppingCart,
  Trash2,
  Zap,
  CreditCard,
  PauseCircle,
  Percent,
  Plus,
  Minus,
  Utensils,
  Tag,
  Keyboard,
  Info,
  Clock,
  Check,
} from 'lucide-react';

export default function POSPage() {
  const {
    products,
    categories,
    addons,
    quickNotes,
    cart,
    selectedCartIndex,
    setSelectedCartIndex,
    customerName,
    setCustomerName,
    subtotal,
    discountAmount,
    discountType,
    discountValue,
    roundingAmount,
    grandTotal,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    quickCashCheckout,
    setOpenPaymentModal,
    setOpenDiscountModal,
    setOpenHeldOrdersModal,
    holdCurrentOrder,
    activeRegister,
    setOpenRegisterModal,
  } = usePOS();

  const { currentUser } = useAuth();
  const { settings } = useSettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeProductForSelection, setActiveProductForSelection] = useState<Product | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input on page mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Global Keyboard Shortcuts (F2, F6, Shift+Enter, F4, D, Delete, Arrows, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input other than our main search
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // F2: Focus search bar
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Quick Cash Checkout & Print: Shift + Enter or F6
      if (e.key === 'F6' || (e.shiftKey && e.key === 'Enter')) {
        e.preventDefault();
        triggerQuickCheckout();
        return;
      }

      // F4: Hold Cart
      if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          handleHoldOrder();
        }
        return;
      }

      // F9: Settle Payment modal
      if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) setOpenPaymentModal(true);
        return;
      }

      // D or Ctrl+D or Alt+D: Discount
      if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.altKey || (!isInput && cart.length > 0))) {
        e.preventDefault();
        setOpenDiscountModal(true);
        return;
      }

      // Delete: Remove selected item from active cart
      if (e.key === 'Delete' && !isInput && selectedCartIndex >= 0 && selectedCartIndex < cart.length) {
        e.preventDefault();
        removeFromCart(selectedCartIndex);
        return;
      }

      // Arrow Up / Down in cart
      if (!isInput && cart.length > 0) {
        if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'ArrowUp')) {
          e.preventDefault();
          setSelectedCartIndex(Math.max(0, selectedCartIndex - 1));
        } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'ArrowDown')) {
          e.preventDefault();
          setSelectedCartIndex(Math.min(cart.length - 1, selectedCartIndex + 1));
        }
      }

      // Escape: Cancel active selector or search
      if (e.key === 'Escape') {
        if (activeProductForSelection) {
          setActiveProductForSelection(null);
          searchInputRef.current?.focus();
        } else if (searchQuery) {
          setSearchQuery('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedCartIndex, activeProductForSelection, searchQuery]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => p.is_active && p.availability !== 'inactive' && p.availability !== 'hidden');

    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category_id === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.short_name && p.short_name.toLowerCase().includes(q)) ||
          (p.category_name && p.category_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [products, selectedCategory, searchQuery]);

  const triggerQuickCheckout = async () => {
    if (cart.length === 0) {
      showFeedback('Cart is empty. Add items first!', 'error');
      return;
    }
    if (!activeRegister) {
      setOpenRegisterModal(true);
      showFeedback('Cash register is closed! Please open shift.', 'error');
      return;
    }

    setCheckoutLoading(true);
    const res = await quickCashCheckout();
    setCheckoutLoading(false);

    if (res.success && res.order) {
      showFeedback(`Bill #${res.order.receipt_number} finalized! Printing receipt...`, 'success');
      searchInputRef.current?.focus();
    } else {
      showFeedback(res.error || 'Checkout failed', 'error');
    }
  };

  const handleHoldOrder = async () => {
    const res = await holdCurrentOrder();
    if (res.success) {
      showFeedback('Order paused and held successfully!', 'success');
    } else {
      showFeedback(res.error || 'Failed to hold order', 'error');
    }
  };

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  const handleSelectProduct = (product: Product) => {
    setActiveProductForSelection(product);
  };

  const handleAddItemFromSelector = (
    product: Product,
    quantity: number,
    customUnitPrice?: number,
    note?: string,
    selectedAddons: any[] = []
  ) => {
    addToCart(product, quantity, customUnitPrice, note, selectedAddons);
    setActiveProductForSelection(null);
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-5.5rem)]">
      {/* LEFT PANE: Search, Categories, Products & Reciprocal Selector (60% width) */}
      <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-4">
        {/* Search Input Bar with Shortcut Badge */}
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5 text-emerald-400" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Channay, Daleem, Paratha, Chai... (Press F2 to focus)"
            className="w-full pl-11 pr-24 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 font-medium text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-inner"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1">
            <kbd className="hidden sm:inline-block px-2 py-1 text-[10px] font-bold text-slate-400 bg-slate-800 border border-slate-700 rounded shadow-sm">
              F2
            </kbd>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Inline Reciprocal Item Selector (When Product is chosen) */}
        {activeProductForSelection && (
          <InlineItemSelector
            product={activeProductForSelection}
            addonsList={addons}
            quickNotes={quickNotes}
            onAdd={handleAddItemFromSelector}
            onCancel={() => {
              setActiveProductForSelection(null);
              searchInputRef.current?.focus();
            }}
          />
        )}

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition border ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            All Items ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition border ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
              <Utensils className="w-12 h-12 mb-3 opacity-30 text-emerald-400" />
              <p className="text-sm font-semibold">No breakfast items found</p>
              <p className="text-xs text-slate-600 mt-1">Try another keyword or category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredProducts.map((p) => {
                const isSelected = activeProductForSelection?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className={`text-left p-3 rounded-xl border transition flex flex-col justify-between h-28 relative group cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-400 shadow-md ring-1 ring-emerald-400'
                        : 'bg-slate-950/70 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-slate-100 text-xs sm:text-sm line-clamp-2 leading-tight group-hover:text-emerald-300 transition">
                          {p.name}
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                        {p.category_name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 mt-1">
                      <span className="font-extrabold text-emerald-400 text-xs sm:text-sm">
                        {formatMoney(p.selling_price)}
                      </span>
                      <span className="text-[10px] bg-slate-800 group-hover:bg-emerald-600 group-hover:text-white text-slate-400 px-1.5 py-0.5 rounded transition">
                        Select
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Global Keyboard Shortcut Helper Bar */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 overflow-x-auto">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">F2</kbd>
              Search
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">Shift+Enter / F6</kbd>
              Quick Cash
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">F4</kbd>
              Hold
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">D</kbd>
              Discount
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">Del</kbd>
              Delete
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">Esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT PANE: Cart, Financial Calculations & Fast Checkout (40% width) */}
      <div className="w-full lg:w-[460px] xl:w-[500px] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-4">
        {/* Cart Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">Current Order Cart</h2>
              <span className="text-[10px] text-slate-400">
                {cart.length} item(s) • Cashier: {currentUser?.display_name || 'Cashier'}
              </span>
            </div>
          </div>

          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-rose-950/40 border border-transparent hover:border-rose-900 transition"
              title="Clear all cart items"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Customer / Table Info input bar */}
        <div className="mb-3">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Guest / Table Name (e.g. Table 4 - Chaudhry Sahib)"
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Toast / Feedback Message */}
        {feedbackMsg && (
          <div
            className={`p-2.5 mb-3 rounded-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200'
                : 'bg-rose-950/80 border border-rose-500 text-rose-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-20 text-slate-400" />
              <p className="text-sm font-semibold">Cart is currently empty</p>
              <p className="text-xs text-slate-600 mt-1">Select breakfast items or type in search</p>
            </div>
          ) : (
            cart.map((item, idx) => {
              const isHighlighted = idx === selectedCartIndex;
              return (
                <div
                  key={item.uid}
                  onClick={() => setSelectedCartIndex(idx)}
                  className={`p-2.5 rounded-xl border transition text-xs cursor-pointer ${
                    isHighlighted
                      ? 'bg-slate-800/90 border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">{item.product_name}</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-1.5 py-0.2 rounded">
                          {item.quantity}x
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Rate: {formatMoney(item.unit_price)}
                      </div>

                      {/* Addons List */}
                      {item.addons && item.addons.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {item.addons.map((ad, i) => (
                            <span key={i} className="text-[10px] text-teal-300 bg-teal-950/60 border border-teal-800 px-1 rounded">
                              +{ad.name} ({formatMoney(ad.price)})
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Kitchen Note */}
                      {item.note && (
                        <div className="text-[10px] italic text-amber-300/90 pt-0.5">
                          Note: {item.note}
                        </div>
                      )}
                    </div>

                    <div className="text-right flex flex-col items-end justify-between">
                      <span className="font-black text-slate-100 text-sm">{formatMoney(item.line_total)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCart(idx);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1 mt-1 rounded"
                        title="Delete Item (Del)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Financial Summary & Penny Rounding */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 mb-3">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Subtotal:</span>
            <span className="font-semibold text-slate-200">{formatMoney(subtotal)}</span>
          </div>

          {/* Discount Row */}
          <div className="flex justify-between items-center text-xs">
            <button
              onClick={() => setOpenDiscountModal(true)}
              className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 underline underline-offset-2"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Discount ({discountValue > 0 ? (discountType === 'percentage' ? `${discountValue}%` : 'Flat') : 'Add [D]'}):</span>
            </button>
            <span className="font-semibold text-emerald-400">
              {discountAmount > 0 ? `-${formatMoney(discountAmount)}` : 'Rs. 0'}
            </span>
          </div>

          {/* Rounding Adjustment */}
          {roundingAmount !== 0 && (
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Penny Rounding:</span>
              <span>{roundingAmount > 0 ? `+${formatMoney(roundingAmount)}` : formatMoney(roundingAmount)}</span>
            </div>
          )}

          {/* Net Grand Total */}
          <div className="flex justify-between items-center pt-2 border-t border-slate-800">
            <span className="text-sm font-black text-slate-100">GRAND TOTAL:</span>
            <span className="text-2xl font-black text-emerald-400">{formatMoney(grandTotal)}</span>
          </div>
        </div>

        {/* Action Buttons: Quick Cash Checkout & Modal Payment */}
        <div className="space-y-2">
          {/* Main Primary Button: Fast Cash Checkout & Auto-Print (< 3.5s Flow) */}
          <button
            onClick={triggerQuickCheckout}
            disabled={checkoutLoading || cart.length === 0}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-current text-amber-300" />
            <span>
              {checkoutLoading ? 'Processing & Printing...' : `Quick Cash Bill & Print [Shift+Enter / F6]`}
            </span>
          </button>

          {/* Secondary Buttons: Custom Payment & Hold */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setOpenPaymentModal(true)}
              disabled={cart.length === 0}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Split / Digital [F9]</span>
            </button>

            <button
              onClick={handleHoldOrder}
              disabled={cart.length === 0}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              <span>Hold Cart [F4]</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

