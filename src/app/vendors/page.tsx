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
    <AdminGuard fallbackTitle="Vendor Khata Ledgers Protected">
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
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null);
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

  const handleDeleteVendor = (v: Vendor) => {
    setVendorToDelete(v);
  };

  const confirmDeleteVendor = async () => {
    if (!vendorToDelete) return;
    const v = vendorToDelete;
    setVendorToDelete(null);
    try {
      const res = await fetch(`/api/vendors?id=${v.id}&cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || `Supplier "${v.name}" deleted.`);
        fetchVendors();
      } else {
        setErrorMsg(data.error || 'Failed to delete vendor');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-3 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900">Mandi Suppliers & Udhaar Khata Ledgers</h1>
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
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Supplier (نیا کھاتہ)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Total Outstanding Market Debt (کل ادھار)</span>
          <div className="text-xl font-black text-rose-600 mt-0.5">
            {formatMoney(totalPayables)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Active Suppliers</span>
          <div className="text-xl font-black text-slate-900 mt-0.5">
            {vendors.length} Vendors
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Payment Vouchers Generated</span>
          <div className="text-xl font-black text-emerald-700 mt-0.5">
            VPAY System
          </div>
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

      {/* IN-APP DELETE VENDOR CONFIRMATION MODAL */}
      {vendorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Remove Supplier</h3>
                <p className="text-xs text-slate-500 font-medium">Khata history will be preserved.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium bg-slate-50 p-3 rounded-xl border border-slate-200">
              Are you sure you want to remove supplier{' '}
              <strong className="text-slate-900 font-bold">&quot;{vendorToDelete.name}&quot;</strong>?
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setVendorToDelete(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteVendor}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow transition cursor-pointer"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

