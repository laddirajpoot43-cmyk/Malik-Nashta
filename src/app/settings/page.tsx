'use client';

import React, { useState, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { usePOS } from '@/context/POSContext';
import { Product, ProductAddon, Category, Profile } from '@/types/pos';
import { formatMoney } from '@/lib/money';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { ReceiptTemplateEditor } from '@/components/settings/ReceiptTemplateEditor';
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
  Plus,
  Trash2,
  Edit2,
  Boxes,
  Layers,
  Sparkles,
  X,
  Lock,
} from 'lucide-react';

export default function SettingsPage() {
  return (
    <AdminGuard
      fallbackTitle="System Settings & Admin Control Center"
      fallbackDescription="Please enter Admin PIN to configure receipt templates, products, categories, addons, raw materials, and staff accounts."
    >
      <SettingsContent />
    </AdminGuard>
  );
}

function SettingsContent() {
  const { settings, updateSettings } = useSettings();
  const { currentUser, users, refreshUsers } = useAuth();
  const { refreshPOSData } = usePOS();

  const [activeTab, setActiveTab] = useState<
    'slip' | 'menu' | 'categories' | 'addons' | 'raw' | 'users' | 'business' | 'security'
  >('slip');

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
  const [addons, setAddons] = useState<ProductAddon[]>([]);
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
  });

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryOrder, setCategoryOrder] = useState('1');

  const [showAddonModal, setShowAddonModal] = useState(false);
  const [editingAddon, setEditingAddon] = useState<ProductAddon | null>(null);
  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState('');

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
      const [pRes, cRes, aRes, rRes] = await Promise.all([
        fetch('/api/products').then((r) => r.json()),
        fetch('/api/categories').then((r) => r.json()),
        fetch('/api/addons').then((r) => r.json()),
        fetch('/api/raw-materials?include_inactive=true').then((r) => r.json()),
      ]);

      if (pRes.success) setProducts(pRes.products || []);
      if (cRes.success) setCategories(cRes.categories || []);
      if (aRes.success) setAddons(aRes.addons || []);
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
      const body: any = {
        name: productForm.name,
        short_name: productForm.short_name || productForm.name,
        category_id: productForm.category_id || categories[0]?.id,
        selling_price: parseFloat(productForm.selling_price) || 0,
        cost_price: parseFloat(productForm.cost_price) || 0,
        availability: productForm.availability,
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

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete product "${name}"?`)) return;
    try {
      const res = await fetch(`/api/products?id=${id}&cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showNotice(`Product "${name}" deleted.`);
        loadAllData();
      } else {
        showNotice(data.error || 'Failed to delete', 'error');
      }
    } catch (e: any) {
      showNotice(e.message, 'error');
    }
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

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"?`)) return;
    try {
      const res = await fetch(`/api/categories?id=${id}&cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showNotice(`Category "${name}" deleted.`);
        loadAllData();
      } else {
        showNotice(data.error || 'Failed to delete category', 'error');
      }
    } catch (e: any) {
      showNotice(e.message, 'error');
    }
  };

  // --- ADDON CRUD ---
  const handleSaveAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingAddon ? 'PUT' : 'POST';
      const body: any = {
        name: addonName,
        price: parseFloat(addonPrice) || 0,
        cashier_name: currentUser?.display_name || 'Admin',
      };
      if (editingAddon) body.id = editingAddon.id;

      const res = await fetch('/api/addons', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        showNotice(editingAddon ? 'Addon updated!' : 'Addon created!');
        setShowAddonModal(false);
        loadAllData();
      } else {
        showNotice(data.error || 'Failed to save addon', 'error');
      }
    } catch (e: any) {
      showNotice(e.message, 'error');
    }
  };

  const handleDeleteAddon = async (id: string, name: string) => {
    if (!confirm(`Delete addon "${name}"?`)) return;
    try {
      const res = await fetch(`/api/addons?id=${id}&cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showNotice(`Addon "${name}" deleted.`);
        loadAllData();
      } else {
        showNotice(data.error || 'Failed to delete addon', 'error');
      }
    } catch (e: any) {
      showNotice(e.message, 'error');
    }
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

  const handleDeleteRaw = async (id: string, name: string) => {
    if (!confirm(`Delete raw ingredient "${name}"?`)) return;
    try {
      const res = await fetch(`/api/raw-materials?id=${id}&cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showNotice(`Raw material "${name}" deleted.`);
        loadAllData();
      } else {
        showNotice(data.error || 'Failed to delete raw material', 'error');
      }
    } catch (e: any) {
      showNotice(e.message, 'error');
    }
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

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete staff account "${name}"?`)) return;
    try {
      const res = await fetch(`/api/users?id=${id}&cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showNotice(`Staff user "${name}" deleted.`);
        refreshUsers();
      } else {
        showNotice(data.error || 'Failed to delete user', 'error');
      }
    } catch (e: any) {
      showNotice(e.message, 'error');
    }
  };

  const navTabs = [
    { id: 'slip', label: 'Slip Template Customizer', icon: Printer },
    { id: 'menu', label: 'Menu Products', icon: Utensils },
    { id: 'categories', label: 'Categories', icon: Layers },
    { id: 'addons', label: 'Addons (Makhan/Tari)', icon: Sparkles },
    { id: 'raw', label: 'Raw Materials (Mandi)', icon: Boxes },
    { id: 'users', label: 'Staff Accounts', icon: Users },
    { id: 'business', label: 'Business Profile', icon: Store },
    { id: 'security', label: 'Security & PINs', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 font-black rounded-xl shadow-lg">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              Admin Control Center & CRUD Management
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                Admin Full Access
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Complete administrative authority: customize thermal receipt slips, manage menu items, categories, addons, raw materials, staff profiles, and security PINs
            </p>
          </div>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto text-xs font-semibold">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-amber-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
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
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-200'
              : 'bg-rose-500/20 border border-rose-500 text-rose-200'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* TAB 1: SLIP TEMPLATE CUSTOMIZER */}
      {activeTab === 'slip' && <ReceiptTemplateEditor />}

      {/* TAB 2: MENU PRODUCTS CRUD */}
      {activeTab === 'menu' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Utensils className="w-4 h-4 text-amber-400" />
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
                });
                setShowProductModal(true);
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Menu Product</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Selling Price (PKR)</th>
                    <th className="px-4 py-3">Cost Price (PKR)</th>
                    <th className="px-4 py-3">Availability</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 font-bold text-slate-200">
                        <div>{p.name}</div>
                        {p.short_name && <div className="text-[10px] text-slate-500 font-normal">Button: {p.short_name}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{p.category_name}</td>
                      <td className="px-4 py-3 font-bold text-emerald-400">{formatMoney(p.selling_price)}</td>
                      <td className="px-4 py-3 text-slate-400">{formatMoney(p.cost_price || 0)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.availability === 'available'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : p.availability === 'sold_out'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
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
                            });
                            setShowProductModal(true);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-amber-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3 text-rose-400" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
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
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Menu Categories ({categories.length})</span>
            </h3>

            <button
              onClick={() => {
                setEditingCategory(null);
                setCategoryName('');
                setCategoryOrder(String(categories.length + 1));
                setShowCategoryModal(true);
              }}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Category</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Display Order</th>
                  <th className="px-4 py-3">Category Name</th>
                  <th className="px-4 py-3">Products in Category</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {categories.map((c) => {
                  const count = products.filter((p) => p.category_id === c.id).length;
                  return (
                    <tr key={c.id} className="hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-400">{c.display_order}</td>
                      <td className="px-4 py-3 font-bold text-white">{c.name}</td>
                      <td className="px-4 py-3 text-slate-400">{count} items</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingCategory(c);
                            setCategoryName(c.name);
                            setCategoryOrder(String(c.display_order));
                            setShowCategoryModal(true);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-amber-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(c.id, c.name)}
                          className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3 text-rose-400" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ADDONS CRUD */}
      {activeTab === 'addons' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Addons & Extra Servings (Makhan, Desi Ghee, Tari) ({addons.length})</span>
            </h3>

            <button
              onClick={() => {
                setEditingAddon(null);
                setAddonName('');
                setAddonPrice('');
                setShowAddonModal(true);
              }}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Addon</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Addon Item</th>
                  <th className="px-4 py-3">Price (PKR)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {addons.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-bold text-white">{a.name}</td>
                    <td className="px-4 py-3 font-black text-amber-400">+{formatMoney(a.price)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {a.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingAddon(a);
                          setAddonName(a.name);
                          setAddonPrice(String(a.price));
                          setShowAddonModal(true);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3 text-amber-400" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteAddon(a.id, a.name)}
                        className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3 text-rose-400" />
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

      {/* TAB 5: RAW MATERIALS CRUD */}
      {activeTab === 'raw' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Boxes className="w-4 h-4 text-cyan-400" />
              <span>Raw Materials & Mandi Inventory Ingredients ({rawMaterials.length})</span>
            </h3>

            <button
              onClick={() => {
                setEditingRaw(null);
                setRawForm({ name: '', unit: 'kg', default_price: '', category: 'General' });
                setShowRawModal(true);
              }}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Raw Ingredient</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Ingredient Name</th>
                  <th className="px-4 py-3">Standard Unit</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Default Rate (PKR)</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rawMaterials.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-bold text-white">{m.name}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono">{m.unit}</td>
                    <td className="px-4 py-3 text-slate-400">{m.category}</td>
                    <td className="px-4 py-3 font-black text-cyan-400">{formatMoney(m.default_price)}</td>
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
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3 text-amber-400" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteRaw(m.id, m.name)}
                        className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3 text-rose-400" />
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

      {/* TAB 6: STAFF ACCOUNTS CRUD */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
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

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Staff Name</th>
                  <th className="px-4 py-3">Email Address</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">PIN Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-bold text-white">
                      <div>{u.full_name}</div>
                      {u.display_name && <div className="text-[10px] text-slate-400 font-normal">Display: {u.display_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-300">
                      {u.pin_code ? `${u.pin_code}` : '••••'}
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-bold uppercase text-[10px]">Active</td>
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
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3 text-amber-400" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.full_name)}
                        className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3 text-rose-400" />
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
        <form onSubmit={handleSaveBusiness} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white">Hotel Business Metadata (Printed on Receipts)</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Business Name:</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Phone:</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Hotel Location / Address:</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Receipt Greeting Message:</label>
              <input
                type="text"
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Save Business Profile
          </button>
        </form>
      )}

      {/* TAB 8: SECURITY & PINS */}
      {activeTab === 'security' && (
        <form onSubmit={handleSaveSecurity} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white">Supervisor Master PIN & Cashier Permission Boundaries</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">System Master Admin PIN:</label>
                <input
                  type="text"
                  maxLength={6}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-amber-400 font-black text-xl tracking-widest text-center focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Master PIN to unlock Admin panel, modify prices, templates, and view ledgers
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Max Cashier Discount without PIN (%):</label>
                <input
                  type="number"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <label className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cashRounding}
                  onChange={(e) => setCashRounding(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="text-xs font-bold text-white block">Pakistani Cash Penny Rounding</span>
                  <span className="text-[10px] text-slate-400">Rounds final rupee total to nearest whole rupee</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requirePinRefunds}
                  onChange={(e) => setRequirePinRefunds(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <div>
                  <span className="text-xs font-bold text-white block">Require Admin PIN for All Refunds</span>
                  <span className="text-[10px] text-slate-400">Protects cash drawer against unauthorized refund payouts</span>
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Save Security Policies
          </button>
        </form>
      )}

      {/* PRODUCT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveProduct} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">
                {editingProduct ? 'Edit Menu Product' : 'Add New Menu Product'}
              </h3>
              <button type="button" onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Product Full Name:</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. Special Lahori Channay"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">POS Short Name (For Buttons):</label>
                <input
                  type="text"
                  value={productForm.short_name}
                  onChange={(e) => setProductForm({ ...productForm, short_name: e.target.value })}
                  placeholder="e.g. Channay"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Category:</label>
                  <select
                    value={productForm.category_id}
                    onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Availability:</label>
                  <select
                    value={productForm.availability}
                    onChange={(e) => setProductForm({ ...productForm, availability: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                  >
                    <option value="available">Available</option>
                    <option value="sold_out">Sold Out</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Selling Price (PKR):</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={productForm.selling_price}
                    onChange={(e) => setProductForm({ ...productForm, selling_price: e.target.value })}
                    placeholder="260"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-emerald-400 font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Cost Price (PKR):</label>
                  <input
                    type="number"
                    step="any"
                    value={productForm.cost_price}
                    onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
                    placeholder="130"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow"
              >
                {editingProduct ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveCategory} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button type="button" onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Category Name:</label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Paratha & Naan"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Display Order #:</label>
                <input
                  type="number"
                  value={categoryOrder}
                  onChange={(e) => setCategoryOrder(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow"
              >
                Save Category
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADDON MODAL */}
      {showAddonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveAddon} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">
                {editingAddon ? 'Edit Addon' : 'Add New Addon'}
              </h3>
              <button type="button" onClick={() => setShowAddonModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Addon Name:</label>
                <input
                  type="text"
                  required
                  value={addonName}
                  onChange={(e) => setAddonName(e.target.value)}
                  placeholder="e.g. Makhan / Fresh Butter"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Addon Price (PKR):</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={addonPrice}
                  onChange={(e) => setAddonPrice(e.target.value)}
                  placeholder="50"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-amber-400 font-bold focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddonModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow"
              >
                Save Addon
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RAW MATERIAL MODAL */}
      {showRawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveRaw} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">
                {editingRaw ? 'Edit Raw Material' : 'Add Raw Material'}
              </h3>
              <button type="button" onClick={() => setShowRawModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Ingredient Name:</label>
                <input
                  type="text"
                  required
                  value={rawForm.name}
                  onChange={(e) => setRawForm({ ...rawForm, name: e.target.value })}
                  placeholder="e.g. Chakki Atta"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Standard Unit:</label>
                  <input
                    type="text"
                    required
                    value={rawForm.unit}
                    onChange={(e) => setRawForm({ ...rawForm, unit: e.target.value })}
                    placeholder="e.g. bori (50kg)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Category:</label>
                  <input
                    type="text"
                    value={rawForm.category}
                    onChange={(e) => setRawForm({ ...rawForm, category: e.target.value })}
                    placeholder="e.g. Flour"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Default Rate (PKR):</label>
                <input
                  type="number"
                  step="any"
                  value={rawForm.default_price}
                  onChange={(e) => setRawForm({ ...rawForm, default_price: e.target.value })}
                  placeholder="4800"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-cyan-400 font-bold focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRawModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow"
              >
                Save Material
              </button>
            </div>
          </form>
        </div>
      )}

      {/* USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveUser} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">
                {editingUser ? 'Edit Staff Account' : 'Register New Staff'}
              </h3>
              <button type="button" onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Full Name:</label>
                <input
                  type="text"
                  required
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  placeholder="e.g. Muhammad Bilal"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Display Nickname:</label>
                <input
                  type="text"
                  value={userForm.display_name}
                  onChange={(e) => setUserForm({ ...userForm, display_name: e.target.value })}
                  placeholder="e.g. Bilal Cashier"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Email:</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="bilal@maliknashta.pk"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Role:</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none font-bold"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">4-Digit PIN Code:</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={userForm.pin_code}
                    onChange={(e) => setUserForm({ ...userForm, pin_code: e.target.value })}
                    placeholder="0000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-emerald-400 font-black text-center focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow"
              >
                Save Staff
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
