'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Vendor } from '@/types/pos';
import { formatMoney } from '@/lib/money';
import { useAuth } from '@/context/AuthContext';
import { AdminGuard } from '@/components/auth/AdminGuard';
import {
  BookOpen,
  Plus,
  Phone,
  MapPin,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  DollarSign,
  TrendingUp,
  Edit2,
  Trash2,
} from 'lucide-react';

export default function VendorsPage() {
  return (
    <AdminGuard
      fallbackTitle="Vendor Khata Ledgers Protected"
      fallbackDescription="Please enter Admin PIN to view Mandi vendor accounts, payables, and transaction ledgers."
    >
      <VendorsContent />
    </AdminGuard>
  );
}

function VendorsContent() {
  const { currentUser } = useAuth();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [totalPayables, setTotalPayables] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // New / Edit Vendor Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [category, setCategory] = useState<string>('Flour');
  const [address, setAddress] = useState<string>('');
  const [openingBalance, setOpeningBalance] = useState<string>('0');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/vendors');
      const data = await res.json();
      if (data.success) {
        setVendors(data.vendors || []);
        setTotalPayables(data.totalPayables || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Vendor / Supplier name is required.');
      return;
    }

    try {
      setErrorMsg('');
      const isEdit = Boolean(editingVendor);
      const res = await fetch('/api/vendors', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEdit ? { id: editingVendor!.id } : {}),
          name: name.trim(),
          phone: phone.trim() || undefined,
          category,
          address: address.trim() || undefined,
          ...(isEdit ? {} : { opening_balance: parseFloat(openingBalance) || 0 }),
          cashier_name: currentUser?.display_name || 'Admin',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(
          isEdit
            ? `Supplier "${data.vendor.name}" updated successfully!`
            : `Supplier "${data.vendor.name}" registered successfully!`
        );
        setShowAddModal(false);
        setEditingVendor(null);
        setName('');
        setPhone('');
        setAddress('');
        setOpeningBalance('0');
        fetchVendors();
      } else {
        setErrorMsg(data.error || 'Failed to save vendor.');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const handleOpenEditVendor = (v: Vendor) => {
    setEditingVendor(v);
    setName(v.name);
    setPhone(v.phone || '');
    setCategory(v.category || 'Flour');
    setAddress(v.address || '');
    setErrorMsg('');
    setShowAddModal(true);
  };

  const handleDeleteVendor = async (v: Vendor) => {
    if (!confirm(`Are you sure you want to remove supplier "${v.name}"?`)) return;
    try {
      const res = await fetch(`/api/vendors?id=${v.id}&cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || `Vendor "${v.name}" deleted.`);
        fetchVendors();
      } else {
        alert(data.error || 'Failed to delete vendor');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">Mandi Suppliers & Udhaar Khata Ledgers</h1>
            <p className="text-xs text-slate-600 font-medium">
              Manage flour mills, oil traders, dairy farms, credit balances, and running payment ledgers
            </p>
          </div>
        </div>

        {/* GREEN BUTTON: Add Supplier */}
        <button
          type="button"
          onClick={() => {
            setEditingVendor(null);
            setName('');
            setPhone('');
            setCategory('Flour');
            setAddress('');
            setOpeningBalance('0');
            setShowAddModal(true);
            setErrorMsg('');
            setSuccessMsg('');
          }}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Supplier (نیا کھاتہ)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Outstanding Market Debt (کل ادھار)</span>
          <div className="text-2xl font-black text-rose-600 mt-1">
            {formatMoney(totalPayables)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">Payable to Mandi suppliers & vendors</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Active Suppliers</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {vendors.length} Vendors
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">Atta Chakkis, Oil & Ghee, Doodh, Groceries</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Payment Vouchers Generated</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            VPAY System
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">Linked with counter cash drawer deduction</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {/* Vendors Directory Cards / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500 font-medium">
            Loading supplier ledgers...
          </div>
        ) : vendors.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 font-semibold">
            No suppliers found. Click &quot;Add New Supplier&quot; to onboard.
          </div>
        ) : (
          vendors.map((v) => (
            <div
              key={v.id}
              className="bg-white border border-slate-200 hover:border-emerald-500 rounded-2xl p-4 shadow-sm flex flex-col justify-between transition group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-extrabold text-slate-900 text-base group-hover:text-emerald-700 transition">
                    {v.name}
                  </h3>
                  <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                    {v.category}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-600 mb-4 font-medium">
                  {v.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{v.phone}</span>
                    </div>
                  )}
                  {v.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{v.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-slate-500 font-medium">Payable Balance:</span>
                  <span
                    className={`font-black text-base ${
                      v.current_balance > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatMoney(v.current_balance)}
                  </span>
                </div>

                <div className="flex gap-2">
                  {/* GREEN BUTTON: Open Khata */}
                  <Link
                    href={`/vendors/${v.id}`}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Open Khata (کھاتہ)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  {/* GREEN BUTTON: Edit */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditVendor(v)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-emerald-700 rounded-xl transition border border-slate-200 cursor-pointer"
                    title="Edit supplier details"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {/* RED BUTTON: Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteVendor(v)}
                    className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-xl transition border border-rose-200 cursor-pointer"
                    title="Remove supplier"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ADD / EDIT SUPPLIER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                {editingVendor ? <Edit2 className="w-4 h-4 text-emerald-600" /> : <Plus className="w-5 h-5 text-emerald-600" />}
                <span>{editingVendor ? `Edit Supplier: ${editingVendor.name}` : 'Onboard New Mandi Supplier'}</span>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveVendor} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supplier / Chakki Name:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Madina Atta Chakki / Haji Ghee"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="Flour">Flour / Atta</option>
                    <option value="Oil & Ghee">Oil & Ghee</option>
                    <option value="Dairy">Dairy (Doodh / Dahi)</option>
                    <option value="Pulses">Pulses / Channay</option>
                    <option value="Poultry">Poultry / Eggs</option>
                    <option value="Groceries">Groceries / Kiryana</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number:</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mandi / Shop Location:</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Ghalla Mandi, Hasilpur"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {!editingVendor && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Opening Credit Balance (PKR):</label>
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-black focus:outline-none focus:border-emerald-600"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {/* RED BUTTON: Cancel */}
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl"
                >
                  Cancel
                </button>
                {/* GREEN BUTTON: Save */}
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow"
                >
                  {editingVendor ? 'Update Supplier' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

