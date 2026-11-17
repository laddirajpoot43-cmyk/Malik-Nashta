'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Product, CartItem, getProductPricingOptions } from '@/types/pos';
import { formatMoney } from '@/lib/money';
import { ProductPricingSelector } from '@/components/ProductPricingSelector';
import {
  Search,
  ShoppingCart,
  Trash2,
  Edit2,
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
  AlertCircle,
  X,
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeProductForSelection, setActiveProductForSelection] = useState<Product | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals for keyboard confirmations and editing
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ index: number; item: CartItem } | null>(null);
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);
  const [editingCartItem, setEditingCartItem] = useState<{ index: number; item: CartItem; quantity: number; unit_price: number; note: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-focus search input on page mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Filtered products list for main grid
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

  // Search dropdown matching products (dynamic as cashier types)
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return products
      .filter((p) => p.is_active && p.availability !== 'inactive' && p.availability !== 'hidden')
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.short_name && p.short_name.toLowerCase().includes(q)) ||
          (p.category_name && p.category_name.toLowerCase().includes(q))
      );
  }, [products, searchQuery]);

  // Reset highlightedIndex when search matches change
  useEffect(() => {
    setHighlightedIndex(0);
    if (searchQuery.trim().length > 0) {
      setDropdownOpen(true);
    } else {
      setDropdownOpen(false);
    }
  }, [searchQuery]);

  // Auto-scroll dropdown to keep highlighted item visible
  useEffect(() => {
    if (dropdownRef.current && dropdownOpen) {
      const activeEl = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, dropdownOpen]);

  // Global Keyboard Shortcuts (F2, F4, Delete, Ctrl+Enter, F6, Shift+Enter, Arrows, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // 1. F2: Focus product search
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        if (searchQuery.trim()) setDropdownOpen(true);
        return;
      }

      // 2. F4: Focus payment section / open payment modal
      if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          setOpenPaymentModal(true);
        } else {
          showFeedback('Add items to cart before proceeding to payment!', 'error');
        }
        return;
      }

      // 3. Ctrl + Enter: Complete bill, subject to confirmation
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length > 0) {
          setCheckoutConfirmOpen(true);
        } else {
          showFeedback('Cart is empty. Add items first!', 'error');
        }
        return;
      }

      // 4. Quick Cash Bill & Print: Shift + Enter or F6
      if (e.key === 'F6' || (e.shiftKey && e.key === 'Enter')) {
        e.preventDefault();
        triggerQuickCheckout();
        return;
      }

      // 5. Delete: Remove selected cart item with confirmation (when not typing in an input)
      if (e.key === 'Delete' && !isInput && selectedCartIndex >= 0 && selectedCartIndex < cart.length) {
        e.preventDefault();
        setDeleteConfirmItem({ index: selectedCartIndex, item: cart[selectedCartIndex] });
        return;
      }

      // 6. Arrow Up / Down navigation in active cart (when not typing in an input)
      if (!isInput && cart.length > 0 && !activeProductForSelection && !deleteConfirmItem && !checkoutConfirmOpen && !editingCartItem) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedCartIndex(Math.max(0, selectedCartIndex - 1));
          return;
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedCartIndex(Math.min(cart.length - 1, selectedCartIndex + 1));
          return;
        }
      }

      // 7. Escape: Close open dropdown, selector, or confirmation modal
      if (e.key === 'Escape') {
        if (deleteConfirmItem) {
          e.preventDefault();
          setDeleteConfirmItem(null);
          return;
        }
        if (checkoutConfirmOpen) {
          e.preventDefault();
          setCheckoutConfirmOpen(false);
          return;
        }
        if (editingCartItem) {
          e.preventDefault();
          setEditingCartItem(null);
          return;
        }
        if (activeProductForSelection) {
          e.preventDefault();
          setActiveProductForSelection(null);
          searchInputRef.current?.focus();
          return;
        }
        if (dropdownOpen) {
          e.preventDefault();
          setDropdownOpen(false);
          return;
        }
        if (searchQuery) {
          e.preventDefault();
          setSearchQuery('');
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cart,
    selectedCartIndex,
    activeProductForSelection,
    searchQuery,
    dropdownOpen,
    deleteConfirmItem,
    checkoutConfirmOpen,
    editingCartItem,
  ]);

  // Keyboard navigation inside the Search Input for dropdown results
  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || searchMatches.length === 0) {
      if (e.key === 'ArrowDown' && searchMatches.length > 0) {
        e.preventDefault();
        setDropdownOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % searchMatches.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = searchMatches[highlightedIndex];
      if (selected) {
        handleSelectProduct(selected);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setDropdownOpen(false);
      return;
    }
  };

  const handleSelectProduct = (product: Product) => {
    setActiveProductForSelection(product);
    setDropdownOpen(false);
  };

  const handleAddItemFromSelector = (
    product: Product,
    quantity: number,
    unitPrice: number,
    note?: string,
    selectedAddons: any[] = [],
    pricingMethod: string = 'Full Plate',
    pricingType?: string
  ) => {
    addToCart(product, quantity, unitPrice, note, selectedAddons, pricingMethod, pricingType);
    setActiveProductForSelection(null);
    setSearchQuery('');
    setDropdownOpen(false);

    // Step 9 & 10: The cursor automatically returns to the product search field; cashier can immediately search for the next item
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 40);
  };

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
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
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

  const openEditModal = (idx: number, item: CartItem) => {
    setEditingCartItem({
      index: idx,
      item,
      quantity: item.quantity,
      unit_price: item.unit_price,
      note: item.note || '',
    });
  };

  const handleSaveCartEdit = () => {
    if (!editingCartItem) return;
    if (editingCartItem.quantity <= 0) {
      showFeedback('Quantity must be greater than zero.', 'error');
      return;
    }
    if (editingCartItem.unit_price <= 0) {
      showFeedback('Price must be greater than zero.', 'error');
      return;
    }

    updateCartItem(editingCartItem.index, {
      quantity: editingCartItem.quantity,
      unit_price: editingCartItem.unit_price,
      custom_unit_price: editingCartItem.unit_price,
      note: editingCartItem.note.trim() || undefined,
    });

    setEditingCartItem(null);
    showFeedback('Cart item updated successfully.', 'success');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-5.5rem)] relative">
      {/* LEFT PANE: Search, Dropdown, Pricing Selector, Categories, & Menu Grid */}
      <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-4 relative">
        {/* Search Input Bar with Smart Dropdown Container */}
        <div className="relative mb-3 z-30">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5 text-emerald-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchInputKeyDown}
              onFocus={() => {
                if (searchQuery.trim().length > 0) setDropdownOpen(true);
              }}
              placeholder="Search product (e.g. Chana, Daleem, Paratha...) - Press F2 to focus"
              className="w-full pl-11 pr-24 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 font-medium text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-inner"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
              <kbd className="hidden sm:inline-block px-2 py-1 text-[10px] font-bold text-slate-400 bg-slate-800 border border-slate-700 rounded shadow-sm">
                F2
              </kbd>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setDropdownOpen(false);
                    searchInputRef.current?.focus();
                  }}
                  className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-slate-800 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* 1. Smart Product Search Dropdown */}
          {dropdownOpen && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-950 border-2 border-emerald-500/80 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-100">
              <div className="p-2 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/80">
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Matching Items ({searchMatches.length}): Use Up/Down Arrows & Enter</span>
                </span>
                <span className="text-[10px] text-slate-500">Press Esc to close</span>
              </div>

              <div ref={dropdownRef} className="max-h-64 overflow-y-auto divide-y divide-slate-850">
                {searchMatches.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs font-medium">
                    No matching products found for &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  searchMatches.map((product, idx) => {
                    const isHighlighted = idx === highlightedIndex;
                    const pricingOpts = getProductPricingOptions(product);

                    return (
                      <div
                        key={product.id}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => handleSelectProduct(product)}
                        className={`p-2.5 transition flex items-center justify-between cursor-pointer ${
                          isHighlighted
                            ? 'bg-emerald-950/70 text-white border-l-4 border-emerald-400 pl-3'
                            : 'hover:bg-slate-900 text-slate-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-100">{product.name}</span>
                            {product.category_name && (
                              <span className="text-[10px] bg-slate-800 text-slate-400 font-semibold px-2 py-0.5 rounded-full border border-slate-700">
                                {product.category_name}
                              </span>
                            )}
                          </div>

                          {/* Pricing Options Summary Chips */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {pricingOpts.map((opt) => (
                              <span
                                key={opt.id}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                                  isHighlighted
                                    ? 'bg-emerald-900/60 text-emerald-200 border-emerald-600/60'
                                    : 'bg-slate-800/80 text-slate-300 border-slate-700'
                                }`}
                              >
                                {opt.label}:{' '}
                                <strong className="text-emerald-300">
                                  {opt.type === 'by_price' ? 'Custom' : formatMoney(opt.price)}
                                </strong>
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="text-right pl-3">
                          <div className="text-[11px] font-bold text-emerald-400">
                            {formatMoney(product.selling_price)}
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-semibold transition ${
                              isHighlighted ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            Press Enter
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. Multiple Pricing Methods Selection Engine (When Product is chosen) */}
        {activeProductForSelection && (
          <ProductPricingSelector
            product={activeProductForSelection}
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
                const opts = getProductPricingOptions(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className={`text-left p-3 rounded-xl border transition flex flex-col justify-between h-32 relative group cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-400 shadow-md ring-1 ring-emerald-400'
                        : 'bg-slate-950/70 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-slate-100 text-xs sm:text-sm line-clamp-1 leading-tight group-hover:text-emerald-300 transition">
                          {p.name}
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                        {p.category_name}
                      </span>
                    </div>

                    {/* Quick Pricing Chips on Card */}
                    <div className="flex flex-wrap gap-1 my-1">
                      {opts.slice(0, 2).map((op) => (
                        <span key={op.id} className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1 py-0.2 rounded truncate">
                          {op.label}: {op.type === 'by_price' ? 'Custom' : formatMoney(op.price)}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 mt-auto">
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
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">Enter</kbd>
              Select / Add
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">F2</kbd>
              Search
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">F4</kbd>
              Pay
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">Ctrl+Enter</kbd>
              Complete Bill
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">Del</kbd>
              Delete Item
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono border border-slate-700">Esc</kbd>
              Cancel / Close
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT PANE: Cart / Current Bill, Pricing Display & Fast Checkout (40% width) */}
      <div className="w-full lg:w-[480px] xl:w-[520px] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-4">
        {/* Cart Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">Current Order Bill</h2>
              <span className="text-[10px] text-slate-400">
                {cart.length} item(s) • Cashier: {currentUser?.display_name || 'Cashier'}
              </span>
            </div>
          </div>

          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-rose-950/40 border border-transparent hover:border-rose-900 transition cursor-pointer"
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

        {/* 4. Dynamic Bill / Cart Integration Table */}
        <div className="flex-1 overflow-y-auto pr-1 mb-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-20 text-slate-400" />
              <p className="text-sm font-semibold">Bill is currently empty</p>
              <p className="text-xs text-slate-600 mt-1">Search items or select from menu</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800 pb-1.5 px-2">
                <span className="col-span-4">Product</span>
                <span className="col-span-3 text-center">Pricing</span>
                <span className="col-span-1 text-center">Qty</span>
                <span className="col-span-2 text-right">Price</span>
                <span className="col-span-2 text-right">Total</span>
              </div>

              {cart.map((item, idx) => {
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
                    <div className="grid grid-cols-12 items-center gap-1">
                      {/* Product Name */}
                      <div className="col-span-4">
                        <div className="font-bold text-slate-100 text-xs truncate" title={item.product_name}>
                          {item.product_name}
                        </div>
                        {item.note && (
                          <div className="text-[10px] italic text-amber-300 truncate" title={item.note}>
                            {item.note}
                          </div>
                        )}
                        {item.addons && item.addons.length > 0 && (
                          <div className="text-[9px] text-teal-300 truncate">
                            +{item.addons.map((a) => a.name).join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Pricing Method Badge */}
                      <div className="col-span-3 text-center">
                        <span className="text-[10px] bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-semibold px-2 py-0.5 rounded-full inline-block max-w-full truncate">
                          {item.pricing_method || 'Full Plate'}
                        </span>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-1 text-center font-bold text-slate-200">
                        {item.quantity}
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-2 text-right text-slate-300 font-medium">
                        {formatMoney(item.unit_price)}
                      </div>

                      {/* Total Price */}
                      <div className="col-span-2 text-right font-black text-emerald-400">
                        {formatMoney(item.line_total)}
                      </div>
                    </div>

                    {/* Actions bar (Edit & Remove) */}
                    <div className="flex items-center justify-end gap-2 pt-1.5 mt-1 border-t border-slate-800/50">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(idx, item);
                        }}
                        className="text-[10px] text-slate-400 hover:text-amber-300 font-medium flex items-center gap-1 hover:bg-slate-800 px-1.5 py-0.5 rounded transition"
                      >
                        <Edit2 className="w-3 h-3 text-amber-400" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmItem({ index: idx, item });
                        }}
                        className="text-[10px] text-slate-400 hover:text-rose-400 font-medium flex items-center gap-1 hover:bg-rose-950/50 px-1.5 py-0.5 rounded transition"
                      >
                        <Trash2 className="w-3 h-3 text-rose-400" />
                        <span>Remove [Del]</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
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
              <span>Discount ({discountValue > 0 ? (discountType === 'percentage' ? `${discountValue}%` : 'Flat') : 'Add'}):</span>
            </button>
            <span className="font-semibold text-emerald-400">
              {discountAmount > 0 ? `-${formatMoney(discountAmount)}` : 'Rs. 0'}
            </span>
          </div>

          {/* Rounding Adjustment */}
          {roundingAmount !== 0 && (
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Rounding:</span>
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
          {/* Main Primary Button: Fast Cash Checkout & Auto-Print */}
          <button
            onClick={() => {
              if (cart.length > 0) setCheckoutConfirmOpen(true);
            }}
            disabled={checkoutLoading || cart.length === 0}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-current text-amber-300" />
            <span>
              {checkoutLoading ? 'Processing & Printing...' : `Complete Bill & Print [Ctrl+Enter / F6]`}
            </span>
          </button>

          {/* Secondary Buttons: Payment Section [F4] & Hold */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (cart.length > 0) setOpenPaymentModal(true);
              }}
              disabled={cart.length === 0}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payment Section [F4]</span>
            </button>

            <button
              onClick={handleHoldOrder}
              disabled={cart.length === 0}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              <span>Hold Cart</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL: Delete Item (Subject to Confirmation) */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-rose-500/80 rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-white">Confirm Remove Item</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Are you sure you want to remove{' '}
              <strong className="text-white font-bold">{deleteConfirmItem.item.product_name}</strong>{' '}
              ({deleteConfirmItem.item.pricing_method}, Qty: {deleteConfirmItem.item.quantity}) from the bill?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
              >
                Cancel [Esc]
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  removeFromCart(deleteConfirmItem.index);
                  setDeleteConfirmItem(null);
                  showFeedback('Item removed from bill.', 'success');
                }}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition shadow-lg shadow-rose-950"
              >
                Delete [Enter]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: Complete Bill (Ctrl + Enter, Subject to Confirmation) */}
      {checkoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-emerald-400 mb-3">
              <Zap className="w-6 h-6 shrink-0 fill-current text-amber-300" />
              <h3 className="font-bold text-base text-white">Complete & Print Bill</h3>
            </div>
            <div className="text-xs text-slate-300 space-y-2 mb-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span>Total Items:</span>
                <span className="font-bold text-white">{cart.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Guest / Customer:</span>
                <span className="font-semibold text-slate-200">{customerName || 'Walk-in Guest'}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800 text-sm">
                <span className="font-black text-white">Grand Total:</span>
                <span className="font-black text-emerald-400">{formatMoney(grandTotal)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCheckoutConfirmOpen(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
              >
                Cancel [Esc]
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setCheckoutConfirmOpen(false);
                  triggerQuickCheckout();
                }}
                className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-lg shadow-emerald-950 flex items-center justify-center gap-1.5"
              >
                Confirm & Print [Enter]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL: Edit Cart Item Quantity / Price / Note */}
      {editingCartItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-white">Edit Bill Item</h3>
                <span className="text-[10px] text-emerald-400 font-semibold">
                  {editingCartItem.item.product_name} ({editingCartItem.item.pricing_method})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingCartItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Quantity:</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={editingCartItem.quantity}
                  onChange={(e) => setEditingCartItem({ ...editingCartItem, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Unit Rate (PKR):</label>
                <input
                  type="number"
                  step="any"
                  value={editingCartItem.unit_price}
                  onChange={(e) => setEditingCartItem({ ...editingCartItem, unit_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Kitchen Note:</label>
                <input
                  type="text"
                  value={editingCartItem.note}
                  onChange={(e) => setEditingCartItem({ ...editingCartItem, note: e.target.value })}
                  placeholder="Optional instruction..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingCartItem(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 rounded-xl"
              >
                Cancel [Esc]
              </button>
              <button
                type="button"
                onClick={handleSaveCartEdit}
                className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow"
              >
                Save Changes [Enter]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
