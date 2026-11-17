'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Product, CartItem } from '@/types/pos';
import { formatMoney, multiplyMoney } from '@/lib/money';
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
  const [editingCartItem, setEditingCartItem] = useState<{
    index: number;
    item: CartItem;
    quantity: number;
    unit_price: number;
    amount: number;
    note: string;
  } | null>(null);

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
      amount: item.line_total,
      note: item.note || '',
    });
  };

  const handleEditQuantityChange = (newQty: number) => {
    if (!editingCartItem) return;
    const qty = Math.max(0, newQty);
    const newAmt = multiplyMoney(editingCartItem.unit_price, qty);
    setEditingCartItem({
      ...editingCartItem,
      quantity: qty,
      amount: newAmt,
    });
  };

  const handleEditAmountChange = (newAmt: number) => {
    if (!editingCartItem) return;
    const amt = Math.max(0, newAmt);
    // Automatic proportional recalculation of quantity
    const propQty = editingCartItem.unit_price > 0 ? parseFloat((amt / editingCartItem.unit_price).toFixed(2)) : 0;
    setEditingCartItem({
      ...editingCartItem,
      amount: amt,
      quantity: propQty,
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
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-5.5rem)] relative select-none">
      {/* LEFT PANE: Search, Dropdown, Pricing Selector, Categories, & Menu Grid */}
      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-4 relative">
        {/* Search Input Bar with Smart Dropdown Container */}
        <div className="relative mb-3 z-30">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5 text-emerald-600" />
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
              className="w-full pl-11 pr-24 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-bold text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-sm"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
              <kbd className="hidden sm:inline-block px-2 py-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-300 rounded shadow-sm">
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
                  className="text-slate-500 hover:text-rose-600 text-xs px-1.5 py-0.5 rounded hover:bg-slate-100 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* 1. Smart Product Search Dropdown */}
          {dropdownOpen && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border-2 border-emerald-500 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
              <div className="p-2 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-600 bg-slate-50">
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Matching Items ({searchMatches.length}): Use Up/Down Arrows & Enter</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Press Esc to close</span>
              </div>

              <div ref={dropdownRef} className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {searchMatches.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs font-semibold">
                    No matching products found for &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  searchMatches.map((product, idx) => {
                    const isHighlighted = idx === highlightedIndex;
                    const fullPlateRate = product.pricing_config?.full_plate_price && Number(product.pricing_config.full_plate_price) > 0
                      ? Number(product.pricing_config.full_plate_price)
                      : Number(product.selling_price) || 0;
                    const halfPlateRate = product.pricing_config?.half_plate_price && Number(product.pricing_config.half_plate_price) > 0
                      ? Number(product.pricing_config.half_plate_price)
                      : Math.round((fullPlateRate * 0.55) / 5) * 5;
                    const hasHalf = halfPlateRate > 0 && halfPlateRate < fullPlateRate;

                    return (
                      <div
                        key={product.id}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => handleSelectProduct(product)}
                        className={`p-2.5 transition flex items-center justify-between cursor-pointer ${
                          isHighlighted
                            ? 'bg-emerald-50 text-emerald-950 border-l-4 border-emerald-600 pl-3 font-semibold'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900">{product.name}</span>
                            {product.category_name && (
                              <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                                {product.category_name}
                              </span>
                            )}
                          </div>

                          {/* Base Rates Summary Chips */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                                isHighlighted
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              Full Plate: <strong className="text-emerald-700">{formatMoney(fullPlateRate)}</strong>
                            </span>
                            {hasHalf && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                                  isHighlighted
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                Half Plate: <strong className="text-emerald-700">{formatMoney(halfPlateRate)}</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right pl-3">
                          <div className="text-[11px] font-black text-emerald-700">
                            {formatMoney(product.selling_price)}
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold transition ${
                              isHighlighted ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
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
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            All Items ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
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
              <Utensils className="w-12 h-12 mb-3 opacity-30 text-emerald-600" />
              <p className="text-sm font-bold text-slate-800">No breakfast items found</p>
              <p className="text-xs text-slate-500 mt-1">Try another keyword or category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredProducts.map((p) => {
                const isSelected = activeProductForSelection?.id === p.id;
                const fullPlateRate = p.pricing_config?.full_plate_price && Number(p.pricing_config.full_plate_price) > 0
                  ? Number(p.pricing_config.full_plate_price)
                  : Number(p.selling_price) || 0;
                const halfPlateRate = p.pricing_config?.half_plate_price && Number(p.pricing_config.half_plate_price) > 0
                  ? Number(p.pricing_config.half_plate_price)
                  : Math.round((fullPlateRate * 0.55) / 5) * 5;
                const hasHalf = halfPlateRate > 0 && halfPlateRate < fullPlateRate;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className={`text-left p-3 rounded-2xl border transition flex flex-col justify-between h-32 relative group cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
                        : 'bg-white border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm line-clamp-1 leading-tight group-hover:text-emerald-700 transition">
                          {p.name}
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5 block truncate font-medium">
                        {p.category_name}
                      </span>
                    </div>

                    {/* Base Rates Chips on Card */}
                    <div className="flex flex-wrap gap-1 my-1">
                      <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold truncate">
                        Full: {formatMoney(fullPlateRate)}
                      </span>
                      {hasHalf && (
                        <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold truncate">
                          Half: {formatMoney(halfPlateRate)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-auto">
                      <span className="font-black text-emerald-700 text-xs sm:text-sm">
                        {formatMoney(p.selling_price)}
                      </span>
                      <span className="text-[10px] bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-700 font-bold px-2 py-0.5 rounded-lg transition">
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
        <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600 overflow-x-auto">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium">
              <kbd className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-mono border border-slate-300 font-bold">Enter</kbd>
              Select / Add
            </span>
            <span className="flex items-center gap-1 font-medium">
              <kbd className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-mono border border-slate-300 font-bold">F2</kbd>
              Search
            </span>
            <span className="flex items-center gap-1 font-medium">
              <kbd className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-mono border border-slate-300 font-bold">F4</kbd>
              Pay
            </span>
            <span className="flex items-center gap-1 font-medium">
              <kbd className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-mono border border-slate-300 font-bold">Ctrl+Enter</kbd>
              Complete Bill
            </span>
            <span className="flex items-center gap-1 font-medium">
              <kbd className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-mono border border-slate-300 font-bold">Del</kbd>
              Delete Item
            </span>
            <span className="flex items-center gap-1 font-medium">
              <kbd className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-mono border border-slate-300 font-bold">Esc</kbd>
              Cancel / Close
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT PANE: Cart / Current Bill, Pricing Display & Fast Checkout (40% width) */}
      <div className="w-full lg:w-[480px] xl:w-[520px] flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-4">
        {/* Cart Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-slate-900">Current Order Bill</h2>
              <span className="text-[10px] text-slate-500 font-medium">
                {cart.length} item(s) • Cashier: <strong>{currentUser?.display_name || 'Cashier'}</strong>
              </span>
            </div>
          </div>

          {/* RED BUTTON: Clear Cart */}
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold flex items-center gap-1 px-3 py-1.5 rounded-xl shadow-sm transition cursor-pointer"
              title="Clear all cart items"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Cart</span>
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
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* Toast / Feedback Message */}
        {feedbackMsg && (
          <div
            className={`p-2.5 mb-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                : 'bg-rose-50 border border-rose-300 text-rose-800'
            }`}
          >
            {feedbackMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* 4. Dynamic Bill / Cart Integration Table */}
        <div className="flex-1 overflow-y-auto pr-1 mb-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-20 text-slate-500" />
              <p className="text-sm font-bold text-slate-700">Bill is currently empty</p>
              <p className="text-xs text-slate-500 mt-1">Search items or select from menu</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-12 text-[10px] font-extrabold text-slate-500 uppercase border-b border-slate-200 pb-1.5 px-2">
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
                        ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="grid grid-cols-12 items-center gap-1">
                      {/* Product Name */}
                      <div className="col-span-4">
                        <div className="font-extrabold text-slate-900 text-xs truncate" title={item.product_name}>
                          {item.product_name}
                        </div>
                        {item.note && (
                          <div className="text-[10px] italic text-slate-600 truncate" title={item.note}>
                            {item.note}
                          </div>
                        )}
                        {item.addons && item.addons.length > 0 && (
                          <div className="text-[9px] text-emerald-700 font-semibold truncate">
                            +{item.addons.map((a) => a.name).join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Pricing Method Badge */}
                      <div className="col-span-3 text-center">
                        <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-full inline-block max-w-full truncate">
                          {item.pricing_method || 'Full Plate'}
                        </span>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-1 text-center font-black text-slate-900">
                        {item.quantity}
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-2 text-right text-slate-700 font-bold">
                        {formatMoney(item.unit_price)}
                      </div>

                      {/* Total Price */}
                      <div className="col-span-2 text-right font-black text-emerald-700">
                        {formatMoney(item.line_total)}
                      </div>
                    </div>

                    {/* Actions bar (Edit & Remove) */}
                    <div className="flex items-center justify-end gap-2 pt-1.5 mt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(idx, item);
                        }}
                        className="text-[10px] text-slate-600 hover:text-emerald-700 font-bold flex items-center gap-1 hover:bg-slate-100 px-2 py-0.5 rounded-lg transition"
                      >
                        <Edit2 className="w-3 h-3 text-emerald-600" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmItem({ index: idx, item });
                        }}
                        className="text-[10px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 hover:bg-rose-50 px-2 py-0.5 rounded-lg transition"
                      >
                        <Trash2 className="w-3 h-3 text-rose-600" />
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
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 mb-3">
          <div className="flex justify-between text-xs text-slate-600 font-medium">
            <span>Subtotal:</span>
            <span className="font-bold text-slate-900">{formatMoney(subtotal)}</span>
          </div>

          {/* Discount Row */}
          <div className="flex justify-between items-center text-xs">
            <button
              onClick={() => setOpenDiscountModal(true)}
              className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 underline underline-offset-2"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Discount ({discountValue > 0 ? (discountType === 'percentage' ? `${discountValue}%` : 'Flat') : 'Add'}):</span>
            </button>
            <span className="font-bold text-emerald-700">
              {discountAmount > 0 ? `-${formatMoney(discountAmount)}` : 'Rs. 0'}
            </span>
          </div>

          {/* Rounding Adjustment */}
          {roundingAmount !== 0 && (
            <div className="flex justify-between text-[11px] text-slate-500 font-medium">
              <span>Rounding:</span>
              <span>{roundingAmount > 0 ? `+${formatMoney(roundingAmount)}` : formatMoney(roundingAmount)}</span>
            </div>
          )}

          {/* Net Grand Total */}
          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
            <span className="text-sm font-extrabold text-slate-900">GRAND TOTAL:</span>
            <span className="text-2xl font-black text-emerald-700">{formatMoney(grandTotal)}</span>
          </div>
        </div>

        {/* Action Buttons: Quick Cash Checkout & Modal Payment */}
        <div className="space-y-2">
          {/* GREEN BUTTON: Fast Cash Checkout & Auto-Print */}
          <button
            onClick={() => {
              if (cart.length > 0) setCheckoutConfirmOpen(true);
            }}
            disabled={checkoutLoading || cart.length === 0}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:pointer-events-none text-white font-black text-sm rounded-xl shadow flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-current text-white" />
            <span>
              {checkoutLoading ? 'Processing & Printing...' : `Complete Bill & Print [Ctrl+Enter / F6]`}
            </span>
          </button>

          {/* Secondary Action Buttons (Green) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (cart.length > 0) setOpenPaymentModal(true);
              }}
              disabled={cart.length === 0}
              className="py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payment Section [F4]</span>
            </button>

            <button
              onClick={handleHoldOrder}
              disabled={cart.length === 0}
              className="py-2.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              <span>Hold Cart</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL: Delete Item (Subject to Confirmation) */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-slate-900">Confirm Remove Item</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed font-medium">
              Are you sure you want to remove{' '}
              <strong className="text-slate-900 font-extrabold">{deleteConfirmItem.item.product_name}</strong>{' '}
              ({deleteConfirmItem.item.pricing_method}, Qty: {deleteConfirmItem.item.quantity}) from the bill?
            </p>
            <div className="flex gap-2">
              {/* RED CANCEL BUTTON */}
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel [Esc]
              </button>
              {/* RED DELETE BUTTON */}
              <button
                type="button"
                autoFocus
                onClick={() => {
                  removeFromCart(deleteConfirmItem.index);
                  setDeleteConfirmItem(null);
                  showFeedback('Item removed from bill.', 'success');
                }}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition shadow"
              >
                Delete [Enter]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: Complete Bill (Ctrl + Enter, Subject to Confirmation) */}
      {checkoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-emerald-600 mb-3">
              <Zap className="w-6 h-6 shrink-0 fill-current text-emerald-600" />
              <h3 className="font-extrabold text-base text-slate-900">Complete & Print Bill</h3>
            </div>
            <div className="text-xs text-slate-700 space-y-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex justify-between">
                <span>Total Items:</span>
                <span className="font-bold text-slate-900">{cart.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Guest / Customer:</span>
                <span className="font-bold text-slate-900">{customerName || 'Walk-in Guest'}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 text-sm">
                <span className="font-extrabold text-slate-900">Grand Total:</span>
                <span className="font-black text-emerald-700">{formatMoney(grandTotal)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {/* RED BUTTON: Cancel */}
              <button
                type="button"
                onClick={() => setCheckoutConfirmOpen(false)}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition shadow-sm"
              >
                Cancel [Esc]
              </button>
              {/* GREEN BUTTON: Confirm & Print */}
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setCheckoutConfirmOpen(false);
                  triggerQuickCheckout();
                }}
                className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition shadow flex items-center justify-center gap-1.5"
              >
                Confirm & Print [Enter]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL: Edit Cart Item Quantity / Price / Note */}
      {editingCartItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Edit Bill Item</h3>
                <span className="text-[10px] text-emerald-700 font-bold">
                  {editingCartItem.item.product_name} ({editingCartItem.item.pricing_method})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingCartItem(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">Quantity (پلیٹیں):</label>
                  <span className="text-[10px] text-slate-500 font-medium">Rate: {formatMoney(editingCartItem.unit_price)}</span>
                </div>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={editingCartItem.quantity}
                  onChange={(e) => handleEditQuantityChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">Total Amount (رقم - PKR):</label>
                  <span className="text-[10px] text-emerald-700 font-bold">Auto-calculates quantity</span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={editingCartItem.amount}
                  onChange={(e) => handleEditAmountChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-emerald-700 font-black focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Note:</label>
                <input
                  type="text"
                  value={editingCartItem.note}
                  onChange={(e) => setEditingCartItem({ ...editingCartItem, note: e.target.value })}
                  placeholder="Optional note..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {/* RED BUTTON: Cancel */}
              <button
                type="button"
                onClick={() => setEditingCartItem(null)}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-sm"
              >
                Cancel [Esc]
              </button>
              {/* GREEN BUTTON: Save Changes */}
              <button
                type="button"
                onClick={handleSaveCartEdit}
                className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow"
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
