'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { usePOS } from '@/context/POSContext';
import { Product, Category, Profile } from '@/types/pos';
import { formatMoney } from '@/lib/money';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { ReceiptTemplateEditor } from '@/components/settings/ReceiptTemplateEditor';
import { PrinterDeviceManager } from '@/components/settings/PrinterDeviceManager';
import {
  Settings,
  ShieldCheck,
  Users,
  Utensils,
  Save,
  CheckCircle2,
  AlertTriangle,
  Store,
  Printer,
  Usb,
  Plus,
  Trash2,
  Edit2,
  Boxes,
  Layers,
  X,
  Lock,
} from 'lucide-react';

export default function SettingsPage() {
  return (
    <AdminGuard fallbackTitle="System Settings Locked">
      <React.Suspense fallback={<div className="p-6 text-slate-500 text-xs">Loading settings...</div>}>
        <SettingsContent />
      </React.Suspense>
    </AdminGuard>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const { settings, updateSettings } = useSettings();
  const { currentUser, users, refreshUsers } = useAuth();
  const { refreshPOSData } = usePOS();

  const [activeTab, setActiveTab] = useState<
    'printer' | 'slip' | 'menu' | 'categories' | 'raw' | 'users' | 'business' | 'security'
  >('slip');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'printer' || tab === 'printers' || tab === 'devices') setActiveTab('printer');
    else if (tab === 'products' || tab === 'menu') setActiveTab('menu');
    else if (tab === 'receipt' || tab === 'slip') setActiveTab('slip');
    else if (tab === 'categories') setActiveTab('categories');
    else if (tab === 'raw') setActiveTab('raw');
    else if (tab === 'staff' || tab === 'users') setActiveTab('users');
    else if (tab === 'hotel' || tab === 'business') setActiveTab('business');
    else if (tab === 'security') setActiveTab('security');
  }, [searchParams]);

  // Business form
  const [businessName, setBusinessName] = useState(settings.business_name || '');
  const [address, setAddress] = useState(settings.address || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [greeting, setGreeting] = useState(settings.greeting_message || '');

  // Security form
  const [adminPin, setAdminPin] = useState(settings.admin_pin || '1234');
  const [cashRounding, setCashRounding] = useState(settings.cash_rounding_enabled);
  const [requirePinRefunds, setRequirePinRefunds] = useState(settings.require_admin_pin_refunds);
  const [maxDiscount, setMaxDiscount] = useState(String(settings.max_cashier_discount_percent || 15));

  // Entities state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Modals for CRUD
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    short_name: '',
    category_id: '',
    selling_price: '',
    cost_price: '',
    availability: 'available',
    // Pricing Configuration
    enable_by_plate: true,
    full_plate_price: '',
    half_plate_price: '',
    enable_by_price: true,
    min_price: '',
    enable_custom_price: true,
    custom_price_label: 'Half Rate',
    custom_price: '',
  });

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryOrder, setCategoryOrder] = useState('1');

  const [showRawModal, setShowRawModal] = useState(false);
  const [editingRaw, setEditingRaw] = useState<any | null>(null);
  const [rawForm, setRawForm] = useState({
    name: '',
    unit: 'kg',
    default_price: '',
    category: 'General',
  });

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [userForm, setUserForm] = useState({
    email: '',
    full_name: '',
    display_name: '',
    role: 'cashier',
    pin_code: '0000',
  });

  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setNotice({ text, type });
    setTimeout(() => setNotice(null), 4000);
  };

  useEffect(() => {
    setBusinessName(settings.business_name || '');
    setAddress(settings.address || '');
    setPhone(settings.phone || '');
    setGreeting(settings.greeting_message || '');
    setAdminPin(settings.admin_pin || '1234');
    setCashRounding(settings.cash_rounding_enabled);
    setRequirePinRefunds(settings.require_admin_pin_refunds);
    setMaxDiscount(String(settings.max_cashier_discount_percent || 15));
  }, [settings]);

  const loadAllData = async () => {
    setLoadingData(true);
    try {
      const [pRes, cRes, rRes] = await Promise.all([
        fetch('/api/products', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/categories', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/raw-materials?include_inactive=true', { cache: 'no-store' }).then((r) => r.json()),
      ]);

      if (pRes.success) setProducts(pRes.products || []);
      if (cRes.success) setCategories(cRes.categories || []);
      if (rRes.success) setRawMaterials(rRes.rawMaterials || []);
      refreshPOSData();
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Save Business Profile
  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await updateSettings({
      business_name: businessName,
      address,
      phone,
      greeting_message: greeting,
    });
    if (res.success) {
      showNotice('Business profile updated successfully!');
    } else {
      showNotice(res.error || 'Failed to update', 'error');
    }
  };

  // Save Security Policies
  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await updateSettings({
      admin_pin: adminPin.trim(),
      cash_rounding_enabled: cashRounding,
      require_admin_pin_refunds: requirePinRefunds,
      max_cashier_discount_percent: parseFloat(maxDiscount) || 15,
    });
    if (res.success) {
      showNotice('Security settings & Admin PIN saved!');
    } else {
      showNotice(res.error || 'Failed to save', 'error');
    }
  };

  // --- PRODUCT CRUD ---
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingProduct ? 'PUT' : 'POST';
      const sellingPriceNum = parseFloat(productForm.selling_price) || 0;
      const fullPlateNum = parseFloat(productForm.full_plate_price) || sellingPriceNum;
      const halfPlateNum = parseFloat(productForm.half_plate_price) || 0;
      const minPriceNum = parseFloat(productForm.min_price) || 0;
      const customPriceNum = parseFloat(productForm.custom_price) || 0;

      const pricing_config = {
        enable_by_plate: productForm.enable_by_plate,
        full_plate_price: fullPlateNum > 0 ? fullPlateNum : sellingPriceNum,
        half_plate_price: halfPlateNum > 0 ? halfPlateNum : undefined,
        enable_by_price: productForm.enable_by_price,
        min_price: minPriceNum > 0 ? minPriceNum : undefined,
        enable_custom_price: productForm.enable_custom_price,
        custom_price_label: productForm.custom_price_label || 'Half Rate',
        custom_price: customPriceNum > 0 ? customPriceNum : undefined,
      };

      const body: any = {
        name: productForm.name,
        short_name: productForm.short_name || productForm.name,
        category_id: productForm.category_id || categories[0]?.id,
        selling_price: sellingPriceNum,
        cost_price: parseFloat(productForm.cost_price) || 0,
        availability: productForm.availability,
        pricing_config,
        cashier_name: currentUser?.display_name || 'Admin',
      };
      if (editingProduct) body.id = editingProduct.id;

      const res = await fetch('/api/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(editingProduct ? 'Product updated!' : 'New product created!');
        setShowProductModal(false);
        loadAllData();
      } else {
        showNotice(data.error || 'Failed to save product', 'error');
      }
    } catch (e: any) {
      showNotice(e.message, 'error');
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'product' | 'category' | 'raw' | 'user';
    id: string;
    name: string;
  } | null>(null);

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id, name } = deleteConfirm;
    setDeleteConfirm(null);

    try {
      let url = '';
      if (type === 'product') url = `/api/products?id=${id}&cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}`;
      else if (type === 'category') url = `/api/categories?id=${id}&cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}`;
      else if (type === 'raw') url = `/api/raw-materials?id=${id}&cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}`;
      else if (type === 'user') url = `/api/users?id=${id}&cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}`;

      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showNotice(`"${name}" deleted successfully!`);
        if (type === 'user') {
          refreshUsers();
        } else {
          loadAllData();
        }
      } else {
        showNotice(data.error || 'Failed to delete', 'error');
      }
    } catch (e: any) {
      showNotice(e.message, 'error');
    }
  };

  const handleDeleteProduct = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, type: 'product', id, name });
  };

  // --- CATEGORY CRUD ---
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingCategory ? 'PUT' : 'POST';
      const body: any = {
        name: categoryName,
        display_order: parseInt(categoryOrder, 10) || 1,
        cashier_name: currentUser?.display_name || 'Admin',
      };
      if (editingCategory) body.id = editingCategory.id;

      const res = await fetch('/api/categories', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(editingCategory ? 'Category updated!' : 'Category created!');
        setShowCategoryModal(false);
        loadAllData();
      } else {
        showNotice(data.error || 'Failed to save category', 'error');
      }
    } catch (e: any) {
      showNotice(e.message, 'error');
    }
  };

  const handleDeleteCategory = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, type: 'category', id, name });
  };

  // --- RAW MATERIALS CRUD ---
  const handleSaveRaw = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingRaw ? 'PUT' : 'POST';
      const body: any = {
        name: rawForm.name,
        unit: rawForm.unit,
        default_price: parseFloat(rawForm.default_price) || 0,
        category: rawForm.category,
        cashier_name: currentUser?.display_name || 'Admin',
      };
      if (editingRaw) body.id = editingRaw.id;

      const res = await fetch('/api/raw-materials', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(editingRaw ? 'Raw material updated!' : 'Raw material added!');
        setShowRawModal(false);
        loadAllData();
      } else {
        showNotice(data.error || 'Failed to save material', 'error');
      }
    } catch (e: any) {
      showNotice(e.message, 'error');
    }
  };

  const handleDeleteRaw = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, type: 'raw', id, name });
  };

  // --- USERS CRUD ---
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingUser ? 'PUT' : 'POST';
      const body: any = {
        email: userForm.email,
        full_name: userForm.full_name,
        display_name: userForm.display_name || userForm.full_name,
        role: userForm.role,
        pin_code: userForm.pin_code,
        cashier_name: currentUser?.display_name || 'Admin',
      };
      if (editingUser) body.id = editingUser.id;

      const res = await fetch('/api/users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(editingUser ? 'Staff user updated!' : 'Staff user registered!');
        setShowUserModal(false);
        refreshUsers();
      } else {
        showNotice(data.error || 'Failed to save staff user', 'error');
      }
    } catch (e: any) {
      showNotice(e.message, 'error');
    }
  };

  const handleDeleteUser = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, type: 'user', id, name });
  };

  const navTabs = [
    { id: 'printer', label: 'Thermal Printers & Hardware', icon: Usb },
    { id: 'slip', label: 'Slip Template Customizer', icon: Printer },
    { id: 'menu', label: 'Menu Products', icon: Utensils },
    { id: 'categories', label: 'Categories', icon: Layers },
    { id: 'raw', label: 'Raw Materials (Mandi)', icon: Boxes },
    { id: 'users', label: 'Staff Accounts', icon: Users },
    { id: 'business', label: 'Business Profile', icon: Store },
    { id: 'security', label: 'Security & PINs', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-3 select-none">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 font-black rounded-xl">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 flex items-center gap-2">
              System Settings
            </h1>
          </div>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto text-xs font-semibold">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {notice && (
        <div
          className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border border-rose-300 text-rose-800'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* TAB 0: THERMAL PRINTER DEVICES & HARDWARE */}
      {activeTab === 'printer' && <PrinterDeviceManager />}

      {/* TAB 1: SLIP TEMPLATE CUSTOMIZER */}
      {activeTab === 'slip' && <ReceiptTemplateEditor />}

      {/* TAB 2: MENU PRODUCTS CRUD */}
      {activeTab === 'menu' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-emerald-600" />
              <span>Menu Items & Portion Pricing ({products.length} Products)</span>
            </h3>

            <button
              onClick={() => {
                setEditingProduct(null);
                setProductForm({
                  name: '',
                  short_name: '',
                  category_id: categories[0]?.id || '',
                  selling_price: '',
                  cost_price: '',
                  availability: 'available',
                  enable_by_plate: true,
                  full_plate_price: '',
                  half_plate_price: '',
                  enable_by_price: true,
                  min_price: '10',
                  enable_custom_price: true,
                  custom_price_label: 'Half Rate',
                  custom_price: '',
                });
                setShowProductModal(true);
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Menu Product</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Base Price</th>
                    <th className="px-4 py-3">Pricing Methods</th>
                    <th className="px-4 py-3">Availability</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500 text-xs">
                        <Utensils className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-600" />
                        <p className="font-semibold text-slate-800">No menu products configured.</p>
                        <p className="text-[11px] text-slate-500 mt-1">All previous demo products have been removed. Click &quot;Add New Menu Product&quot; to add your real items.</p>
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3 font-bold text-slate-900">
                          <div>{p.name}</div>
                          {p.short_name && <div className="text-[10px] text-slate-500 font-normal">Button: {p.short_name}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{p.category_name}</td>
                        <td className="px-4 py-3 font-bold text-emerald-600">{formatMoney(p.selling_price)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {p.pricing_config?.enable_by_plate !== false && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                                Plate: Full ({formatMoney(p.pricing_config?.full_plate_price || p.selling_price)})
                                {p.pricing_config?.half_plate_price ? ` / Half (${formatMoney(p.pricing_config.half_plate_price)})` : ''}
                              </span>
                            )}
                            {p.pricing_config?.enable_by_price && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-50 text-teal-700 border border-teal-200 font-medium">
                                By Price {p.pricing_config.min_price ? `(min Rs. ${p.pricing_config.min_price})` : ''}
                              </span>
                            )}
                            {p.pricing_config?.enable_custom_price && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                                {p.pricing_config.custom_price_label || 'Half Rate'}
                                {p.pricing_config.custom_price ? ` (${formatMoney(p.pricing_config.custom_price)})` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              p.availability === 'available'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : p.availability === 'sold_out'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {p.availability}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              setProductForm({
                                name: p.name,
                                short_name: p.short_name || p.name,
                                category_id: p.category_id,
                                selling_price: String(p.selling_price),
                                cost_price: String(p.cost_price || 0),
                                availability: p.availability,
                                enable_by_plate: p.pricing_config?.enable_by_plate !== false,
                                full_plate_price: String(p.pricing_config?.full_plate_price || p.selling_price || ''),
                                half_plate_price: String(p.pricing_config?.half_plate_price || ''),
                                enable_by_price: p.pricing_config?.enable_by_price !== false,
                                min_price: String(p.pricing_config?.min_price || ''),
                                enable_custom_price: p.pricing_config?.enable_custom_price !== false,
                                custom_price_label: p.pricing_config?.custom_price_label || 'Half Rate',
                                custom_price: String(p.pricing_config?.custom_price || ''),
                              });
                              setShowProductModal(true);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3 text-amber-600" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>Delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORIES CRUD */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Menu Categories ({categories.length})</span>
            </h3>

            <button
              onClick={() => {
                setEditingCategory(null);
                setCategoryName('');
                setCategoryOrder(String(categories.length + 1));
                setShowCategoryModal(true);
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Category</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Display Order</th>
                  <th className="px-4 py-3">Category Name</th>
                  <th className="px-4 py-3">Products in Category</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-500 text-xs">
                      <Layers className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-600" />
                      <p className="font-semibold text-slate-800">No categories found.</p>
                      <p className="text-[11px] text-slate-500 mt-1">Click &quot;Add New Category&quot; to organize your menu items.</p>
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => {
                    const count = products.filter((p) => p.category_id === c.id).length;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3 font-mono font-bold text-slate-600">{c.display_order}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{c.name}</td>
                        <td className="px-4 py-3 text-slate-600">{count} items</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingCategory(c);
                              setCategoryName(c.name);
                              setCategoryOrder(String(c.display_order));
                              setShowCategoryModal(true);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3 text-amber-600" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(c.id, c.name)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>Delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: RAW MATERIALS CRUD */}
      {activeTab === 'raw' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-600" />
              <span>Raw Materials & Mandi Inventory Ingredients ({rawMaterials.length})</span>
            </h3>

            <button
              onClick={() => {
                setEditingRaw(null);
                setRawForm({ name: '', unit: 'kg', default_price: '', category: 'General' });
                setShowRawModal(true);
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Raw Ingredient</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Ingredient Name</th>
                  <th className="px-4 py-3">Standard Unit</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Default Rate (PKR)</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rawMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500 text-xs">
                      <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-600" />
                      <p className="font-semibold text-slate-800">No raw materials or mandi ingredients configured.</p>
                      <p className="text-[11px] text-slate-500 mt-1">Click &quot;Add Raw Ingredient&quot; to manage vendor purchases and mandi inventory.</p>
                    </td>
                  </tr>
                ) : (
                  rawMaterials.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">{m.name}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono">{m.unit}</td>
                      <td className="px-4 py-3 text-slate-600">{m.category}</td>
                      <td className="px-4 py-3 font-black text-emerald-600">{formatMoney(m.default_price)}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingRaw(m);
                            setRawForm({
                              name: m.name,
                              unit: m.unit,
                              default_price: String(m.default_price || 0),
                              category: m.category || 'General',
                            });
                            setShowRawModal(true);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3 text-amber-600" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRaw(m.id, m.name)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 text-rose-600" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: STAFF ACCOUNTS CRUD */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Staff Accounts & Roles ({users.length})</span>
            </h3>

            <button
              onClick={() => {
                setEditingUser(null);
                setUserForm({
                  email: '',
                  full_name: '',
                  display_name: '',
                  role: 'cashier',
                  pin_code: '0000',
                });
                setShowUserModal(true);
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Staff</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Staff Name</th>
                  <th className="px-4 py-3">Email Address</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">PIN Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <div>{u.full_name}</div>
                      {u.display_name && <div className="text-[10px] text-slate-500 font-normal">Display: {u.display_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === 'admin'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      {u.pin_code ? `${u.pin_code}` : '••••'}
                    </td>
                    <td className="px-4 py-3 text-emerald-700 font-bold uppercase text-[10px]">Active</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setUserForm({
                            email: u.email,
                            full_name: u.full_name,
                            display_name: u.display_name || u.full_name,
                            role: u.role,
                            pin_code: u.pin_code || '0000',
                          });
                          setShowUserModal(true);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-amber-600" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.full_name)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3 text-rose-600" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: BUSINESS PROFILE */}
      {activeTab === 'business' && (
        <form onSubmit={handleSaveBusiness} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Hotel Business Metadata (Printed on Receipts)</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Business Name:</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone:</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hotel Location / Address:</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Greeting Message:</label>
              <input
                type="text"
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save Business Profile
          </button>
        </form>
      )}

      {/* TAB 8: SECURITY & PINS */}
      {activeTab === 'security' && (
        <form onSubmit={handleSaveSecurity} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Supervisor Master PIN & Cashier Permission Boundaries</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">System Master Admin PIN:</label>
                <input
                  type="text"
                  maxLength={6}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-amber-600 font-black text-xl tracking-widest text-center focus:outline-none focus:border-emerald-600"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Master PIN to unlock Admin panel, modify prices, templates, and view ledgers
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Max Cashier Discount without PIN (%):</label>
                <input
                  type="number"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cashRounding}
                  onChange={(e) => setCashRounding(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Pakistani Cash Penny Rounding</span>
                  <span className="text-[10px] text-slate-500">Rounds final rupee total to nearest whole rupee</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requirePinRefunds}
                  onChange={(e) => setRequirePinRefunds(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Require Admin PIN for All Refunds</span>
                  <span className="text-[10px] text-slate-500">Protects cash drawer against unauthorized refund payouts</span>
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save Security Policies
          </button>
        </form>
      )}

      {/* PRODUCT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleSaveProduct} className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900">
                {editingProduct ? `Edit Menu Product: ${editingProduct.name}` : 'Add New Menu Product'}
              </h3>
              <button type="button" onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Product Full Name:</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. Special Lahori Channay"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">POS Short Name (For Buttons):</label>
                <input
                  type="text"
                  value={productForm.short_name}
                  onChange={(e) => setProductForm({ ...productForm, short_name: e.target.value })}
                  placeholder="e.g. Channay"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category:</label>
                  <select
                    value={productForm.category_id}
                    onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    {categories.length === 0 ? (
                      <option value="">No category created (General)</option>
                    ) : (
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Availability:</label>
                  <select
                    value={productForm.availability}
                    onChange={(e) => setProductForm({ ...productForm, availability: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="available">Available</option>
                    <option value="sold_out">Sold Out</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Standard / Base Price (PKR):</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={productForm.selling_price}
                    onChange={(e) => setProductForm({ ...productForm, selling_price: e.target.value })}
                    placeholder="180"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-emerald-700 font-black focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cost Price (PKR):</label>
                  <input
                    type="number"
                    step="any"
                    value={productForm.cost_price}
                    onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
                    placeholder="90"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 font-bold focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Pricing Methods Configuration Section */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <span>Flexible Pricing Methods (POS Counter)</span>
                </h4>

                {/* 1. By Plate Method */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={productForm.enable_by_plate}
                      onChange={(e) => setProductForm({ ...productForm, enable_by_plate: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Enable By Plate (Predefined Plate Rates)</span>
                  </label>

                  {productForm.enable_by_plate && (
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-600">Full Plate Price:</span>
                        <input
                          type="number"
                          step="any"
                          value={productForm.full_plate_price}
                          onChange={(e) => setProductForm({ ...productForm, full_plate_price: e.target.value })}
                          placeholder={productForm.selling_price || '180'}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-600">Half Plate Price:</span>
                        <input
                          type="number"
                          step="any"
                          value={productForm.half_plate_price}
                          onChange={(e) => setProductForm({ ...productForm, half_plate_price: e.target.value })}
                          placeholder="e.g. 100"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. By Price Method (Custom Cashier Amount) */}
                <div className="space-y-2 pt-1 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={productForm.enable_by_price}
                      onChange={(e) => setProductForm({ ...productForm, enable_by_price: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Enable By Price (Cashier Enters Custom Amount)</span>
                  </label>

                  {productForm.enable_by_price && (
                    <div className="pl-6">
                      <span className="block text-[10px] font-bold text-slate-600">Optional Minimum Price (PKR):</span>
                      <input
                        type="number"
                        step="any"
                        value={productForm.min_price}
                        onChange={(e) => setProductForm({ ...productForm, min_price: e.target.value })}
                        placeholder="e.g. 20 (min allowed price)"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Custom / Half Rate Method */}
                <div className="space-y-2 pt-1 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={productForm.enable_custom_price}
                      onChange={(e) => setProductForm({ ...productForm, enable_custom_price: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Enable Custom / Half Rate (Configured Option)</span>
                  </label>

                  {productForm.enable_custom_price && (
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-600">Option Label:</span>
                        <input
                          type="text"
                          value={productForm.custom_price_label}
                          onChange={(e) => setProductForm({ ...productForm, custom_price_label: e.target.value })}
                          placeholder="e.g. Half Rate"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-600">Option Price (PKR):</span>
                        <input
                          type="number"
                          step="any"
                          value={productForm.custom_price}
                          onChange={(e) => setProductForm({ ...productForm, custom_price: e.target.value })}
                          placeholder="e.g. 100"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow transition"
              >
                {editingProduct ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleSaveCategory} className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button type="button" onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category Name:</label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Paratha & Naan"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Display Order #:</label>
                <input
                  type="number"
                  value={categoryOrder}
                  onChange={(e) => setCategoryOrder(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow transition"
              >
                Save Category
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RAW MATERIAL MODAL */}
      {showRawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleSaveRaw} className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900">
                {editingRaw ? 'Edit Raw Material' : 'Add Raw Material'}
              </h3>
              <button type="button" onClick={() => setShowRawModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ingredient Name:</label>
                <input
                  type="text"
                  required
                  value={rawForm.name}
                  onChange={(e) => setRawForm({ ...rawForm, name: e.target.value })}
                  placeholder="e.g. Chakki Atta"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Standard Unit:</label>
                  <input
                    type="text"
                    required
                    value={rawForm.unit}
                    onChange={(e) => setRawForm({ ...rawForm, unit: e.target.value })}
                    placeholder="e.g. bori (50kg)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category:</label>
                  <input
                    type="text"
                    value={rawForm.category}
                    onChange={(e) => setRawForm({ ...rawForm, category: e.target.value })}
                    placeholder="e.g. Flour"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Default Rate (PKR):</label>
                <input
                  type="number"
                  step="any"
                  value={rawForm.default_price}
                  onChange={(e) => setRawForm({ ...rawForm, default_price: e.target.value })}
                  placeholder="4800"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-emerald-700 font-black focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRawModal(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow transition"
              >
                Save Material
              </button>
            </div>
          </form>
        </div>
      )}

      {/* USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleSaveUser} className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900">
                {editingUser ? 'Edit Staff Account' : 'Register New Staff'}
              </h3>
              <button type="button" onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name:</label>
                <input
                  type="text"
                  required
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  placeholder="e.g. Muhammad Bilal"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Display Nickname:</label>
                <input
                  type="text"
                  value={userForm.display_name}
                  onChange={(e) => setUserForm({ ...userForm, display_name: e.target.value })}
                  placeholder="e.g. Bilal Cashier"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email:</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="bilal@maliknashta.pk"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Role:</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">4-Digit PIN Code:</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={userForm.pin_code}
                    onChange={(e) => setUserForm({ ...userForm, pin_code: e.target.value })}
                    placeholder="0000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-emerald-700 font-black text-center focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow transition"
              >
                Save Staff
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GLOBAL IN-APP DELETE CONFIRMATION MODAL */}
      {deleteConfirm && deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Confirm Deletion</h3>
                <p className="text-xs text-slate-500 font-medium">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium bg-slate-50 p-3 rounded-xl border border-slate-200">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900 font-bold">&quot;{deleteConfirm.name}&quot;</strong>?
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow transition"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
