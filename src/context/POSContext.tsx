'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Category, Product, ProductAddon, CartItem, Order, RegisterSession } from '@/types/pos';
import { addMoney, subtractMoney, multiplyMoney, calculateRounding } from '@/lib/money';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';

interface POSContextType {
  categories: Category[];
  products: Product[];
  addons: ProductAddon[];
  quickNotes: string[];
  activeRegister: RegisterSession | null;
  heldOrdersCount: number;
  loading: boolean;

  // Cart
  cart: CartItem[];
  selectedCartIndex: number;
  setSelectedCartIndex: (idx: number) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  adminPinForDiscount: string;
  setAdminPinForDiscount: (pin: string) => void;

  // Computations
  subtotal: number;
  discountAmount: number;
  roundingAmount: number;
  grandTotal: number;

  // Cart Operations
  addToCart: (product: Product, quantity?: number, customUnitPrice?: number, note?: string, addons?: ProductAddon[]) => void;
  updateCartItem: (index: number, updates: Partial<CartItem>) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  setDiscount: (type: 'percentage' | 'fixed', value: number, pin?: string) => void;

  // Billing Actions
  quickCashCheckout: () => Promise<{ success: boolean; order?: Order; error?: string }>;
  customCheckout: (payments: { method_id: string; amount: number; amount_tendered?: number }[], pin?: string) => Promise<{ success: boolean; order?: Order; error?: string }>;
  holdCurrentOrder: (name?: string) => Promise<{ success: boolean; error?: string }>;
  resumeHeldOrder: (heldId: string) => Promise<{ success: boolean; error?: string }>;

  // Thermal Print State
  currentOrderToPrint: Order | null;
  setCurrentOrderToPrint: (order: Order | null) => void;
  printReceipt: (order?: Order) => void;

  // Register Operations
  refreshPOSData: () => Promise<void>;
  openRegisterModal: boolean;
  setOpenRegisterModal: (open: boolean) => void;
  openHeldOrdersModal: boolean;
  setOpenHeldOrdersModal: (open: boolean) => void;
  openDiscountModal: boolean;
  setOpenDiscountModal: (open: boolean) => void;
  openPaymentModal: boolean;
  setOpenPaymentModal: (open: boolean) => void;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export function POSProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const { settings } = useSettings();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [addons, setAddons] = useState<ProductAddon[]>([]);
  const [quickNotes, setQuickNotes] = useState<string[]>([]);
  const [activeRegister, setActiveRegister] = useState<RegisterSession | null>(null);
  const [heldOrdersCount, setHeldOrdersCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCartIndex, setSelectedCartIndex] = useState<number>(-1);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [adminPinForDiscount, setAdminPinForDiscount] = useState<string>('');

  // Print state
  const [currentOrderToPrint, setCurrentOrderToPrint] = useState<Order | null>(null);

  // Modals state
  const [openRegisterModal, setOpenRegisterModal] = useState<boolean>(false);
  const [openHeldOrdersModal, setOpenHeldOrdersModal] = useState<boolean>(false);
  const [openDiscountModal, setOpenDiscountModal] = useState<boolean>(false);
  const [openPaymentModal, setOpenPaymentModal] = useState<boolean>(false);

  const refreshPOSData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/pos/init');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
        setProducts(data.products || []);
        setAddons(data.addons || []);
        setQuickNotes(data.quickNotes || []);
        setActiveRegister(data.activeRegister || null);
        setHeldOrdersCount(data.heldOrdersCount || 0);
      }
    } catch (e) {
      console.error('Failed to init POS:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPOSData();
  }, [refreshPOSData]);

  // Financial Calculations using Money Engine
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => addMoney(acc, item.line_total), 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (!discountValue || discountValue <= 0) return 0;
    if (discountType === 'percentage') {
      return multiplyMoney(subtotal, discountValue / 100);
    }
    return Math.min(discountValue, subtotal);
  }, [subtotal, discountType, discountValue]);

  const { grandTotal, roundingAmount } = useMemo(() => {
    const afterDiscount = Math.max(0, subtractMoney(subtotal, discountAmount));
    const rounding = calculateRounding(afterDiscount, settings.cash_rounding_enabled);
    return {
      grandTotal: rounding.roundedAmount,
      roundingAmount: rounding.roundingDifference,
    };
  }, [subtotal, discountAmount, settings.cash_rounding_enabled]);

  // Cart operations
  const addToCart = (
    product: Product,
    quantity: number = 1,
    customUnitPrice?: number,
    note?: string,
    itemAddons: ProductAddon[] = []
  ) => {
    const unitPrice = customUnitPrice !== undefined ? customUnitPrice : product.selling_price;
    const itemSubtotal = multiplyMoney(unitPrice, quantity);
    const addonsTotal = itemAddons.reduce((acc, ad) => addMoney(acc, ad.price), 0);
    const lineTotal = addMoney(itemSubtotal, addonsTotal);

    const newItem: CartItem = {
      uid: `${product.id}-${Date.now()}-${Math.random()}`,
      product_id: product.id,
      product_name: product.name,
      unit_price: unitPrice,
      quantity,
      custom_unit_price: customUnitPrice,
      note,
      addons: itemAddons,
      item_subtotal: itemSubtotal,
      line_total: lineTotal,
    };

    setCart((prev) => {
      const next = [...prev, newItem];
      setSelectedCartIndex(next.length - 1);
      return next;
    });
  };

  const updateCartItem = (index: number, updates: Partial<CartItem>) => {
    setCart((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const copy = [...prev];
      const cur = { ...copy[index], ...updates };

      // Recalculate
      const itemSubtotal = multiplyMoney(cur.unit_price, cur.quantity);
      const addonsTotal = (cur.addons || []).reduce((acc, ad) => addMoney(acc, ad.price), 0);
      cur.item_subtotal = itemSubtotal;
      cur.line_total = addMoney(itemSubtotal, addonsTotal);

      copy[index] = cur;
      return copy;
    });
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      if (selectedCartIndex >= filtered.length) {
        setSelectedCartIndex(filtered.length - 1);
      }
      return filtered;
    });
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCartIndex(-1);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountValue(0);
    setAdminPinForDiscount('');
  };

  const setDiscount = (type: 'percentage' | 'fixed', value: number, pin?: string) => {
    setDiscountType(type);
    setDiscountValue(value);
    if (pin) setAdminPinForDiscount(pin);
  };

  const printReceipt = (order?: Order) => {
    const targetOrder = order || currentOrderToPrint;
    if (targetOrder) {
      setCurrentOrderToPrint(targetOrder);
      setTimeout(() => {
        window.print();
      }, 80);
    }
  };

  // Instant Quick Cash Checkout (< 3.5s Flow: F6 or Shift+Enter)
  const quickCashCheckout = async (): Promise<{ success: boolean; order?: Order; error?: string }> => {
    if (cart.length === 0) {
      return { success: false, error: 'Cart is empty. Please add items to checkout.' };
    }
    if (!activeRegister) {
      setOpenRegisterModal(true);
      return { success: false, error: 'Cash register is closed. Please open shift first.' };
    }

    try {
      const idempotencyKey = `sale-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const payload = {
        cart,
        discount_type: discountType,
        discount_value: discountValue,
        admin_pin: adminPinForDiscount || undefined,
        customer_name: customerName || 'Walk-in Guest',
        customer_phone: customerPhone || undefined,
        payments: [
          {
            method_id: 'cash',
            amount: grandTotal,
            amount_tendered: grandTotal,
          },
        ],
        idempotency_key: idempotencyKey,
        cashier_name: currentUser?.display_name || currentUser?.full_name || 'Counter Cashier',
      };

      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.order) {
        setCurrentOrderToPrint(data.order);
        // Instant thermal print trigger with 80ms delay
        setTimeout(() => {
          window.print();
        }, 80);

        clearCart();
        refreshPOSData();
        return { success: true, order: data.order };
      } else {
        return { success: false, error: data.error || 'Checkout failed' };
      }
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  // Custom checkout with payment breakdown & tender
  const customCheckout = async (
    payments: { method_id: string; amount: number; amount_tendered?: number }[],
    pin?: string
  ): Promise<{ success: boolean; order?: Order; error?: string }> => {
    if (cart.length === 0) return { success: false, error: 'Cart is empty.' };
    if (!activeRegister) {
      setOpenRegisterModal(true);
      return { success: false, error: 'Cash register is closed.' };
    }

    try {
      const idempotencyKey = `sale-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payload = {
        cart,
        discount_type: discountType,
        discount_value: discountValue,
        admin_pin: pin || adminPinForDiscount || undefined,
        customer_name: customerName || 'Walk-in Guest',
        customer_phone: customerPhone || undefined,
        payments,
        idempotency_key: idempotencyKey,
        cashier_name: currentUser?.display_name || currentUser?.full_name || 'Counter Cashier',
      };

      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.order) {
        setCurrentOrderToPrint(data.order);
        setTimeout(() => {
          window.print();
        }, 80);

        clearCart();
        setOpenPaymentModal(false);
        refreshPOSData();
        return { success: true, order: data.order };
      } else {
        return { success: false, error: data.error || 'Checkout failed' };
      }
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  // Hold current order
  const holdCurrentOrder = async (name?: string): Promise<{ success: boolean; error?: string }> => {
    if (cart.length === 0) return { success: false, error: 'Cannot hold an empty cart.' };

    try {
      const holdCustomerName = name || customerName || `Dine-in Table ${heldOrdersCount + 1}`;
      const res = await fetch('/api/held-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: holdCustomerName,
          cart_data: {
            cart,
            customerName: holdCustomerName,
            customerPhone,
            discountType,
            discountValue,
          },
          cashier_name: currentUser?.display_name || currentUser?.full_name || 'Cashier',
        }),
      });

      const data = await res.json();
      if (data.success) {
        clearCart();
        refreshPOSData();
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to hold order' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  // Resume held order
  const resumeHeldOrder = async (heldId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/held-orders?id=${heldId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });
      const data = await res.json();
      if (data.success && data.heldOrder) {
        const payload = data.heldOrder.cart_data;
        if (payload?.cart) {
          setCart(payload.cart);
          setCustomerName(payload.customerName || data.heldOrder.customer_name);
          setCustomerPhone(payload.customerPhone || '');
          setDiscountType(payload.discountType || 'percentage');
          setDiscountValue(payload.discountValue || 0);
          setSelectedCartIndex(payload.cart.length - 1);
        }
        setOpenHeldOrdersModal(false);
        refreshPOSData();
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to resume order' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  return (
    <POSContext.Provider
      value={{
        categories,
        products,
        addons,
        quickNotes,
        activeRegister,
        heldOrdersCount,
        loading,
        cart,
        selectedCartIndex,
        setSelectedCartIndex,
        customerName,
        setCustomerName,
        customerPhone,
        setCustomerPhone,
        discountType,
        discountValue,
        adminPinForDiscount,
        setAdminPinForDiscount,
        subtotal,
        discountAmount,
        roundingAmount,
        grandTotal,
        addToCart,
        updateCartItem,
        removeFromCart,
        clearCart,
        setDiscount,
        quickCashCheckout,
        customCheckout,
        holdCurrentOrder,
        resumeHeldOrder,
        currentOrderToPrint,
        setCurrentOrderToPrint,
        printReceipt,
        refreshPOSData,
        openRegisterModal,
        setOpenRegisterModal,
        openHeldOrdersModal,
        setOpenHeldOrdersModal,
        openDiscountModal,
        setOpenDiscountModal,
        openPaymentModal,
        setOpenPaymentModal,
      }}
    >
      {children}
    </POSContext.Provider>
  );
}

export function usePOS() {
  const context = useContext(POSContext);
  if (!context) throw new Error('usePOS must be used within a POSProvider');
  return context;
}

