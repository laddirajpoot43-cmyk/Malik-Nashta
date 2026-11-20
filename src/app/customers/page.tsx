'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/money';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  current_balance: number;
  credit_limit: number;
  created_at: string;
  updated_at?: string;
}

interface CustomerTransaction {
  id: string;
  customer_id: string;
  voucher_number: string;
  type: 'OPENING' | 'UDHAAR' | 'PAYMENT';
  amount: number;
  payment_method?: string;
  order_receipt_number?: string;
  note?: string;
  cashier_name?: string;
  created_at: string;
}

export default function CustomersPage() {
  return (
    <AdminGuard fallbackTitle="Customer Udhaar Khata Protected">
      <CustomersContent />
    </AdminGuard>
  );
}

function CustomersContent() {
  const { currentUser } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [summary, setSummary] = useState({
    total_customers: 0,
    total_udhaar_receivable: 0,
    total_collected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add/Edit Modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [creditLimit, setCreditLimit] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  // Payment / Add Udhaar Modal
  const [txModalCustomer, setTxModalCustomer] = useState<Customer | null>(null);
  const [txAction, setTxAction] = useState<'payment' | 'add_udhaar'>('payment');
  const [txAmount, setTxAmount] = useState('');
  const [txMethod, setTxMethod] = useState('Cash');
  const [txAddToRegister, setTxAddToRegister] = useState(true);
  const [txNote, setTxNote] = useState('');

  // Ledger Statement Modal
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers || []);
        setTransactions(data.transactions || []);
        setSummary(
          data.summary || {
            total_customers: 0,
            total_udhaar_receivable: 0,
            total_collected: 0,
          }
        );
      }
    } catch {
      setErrorMsg('Failed to load customer khata data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setAddress('');
    setOpeningBalance('0');
    setCreditLimit('0');
    setErrorMsg('');
    setShowFormModal(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name || '');
    setPhone(c.phone || '');
    setAddress(c.address || '');
    setCreditLimit(String(c.credit_limit || 0));
    setErrorMsg('');
    setShowFormModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Customer name is required.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const method = editingCustomer ? 'PUT' : 'POST';
      const payload = editingCustomer
        ? {
            id: editingCustomer.id,
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
            credit_limit: Number(creditLimit || 0),
          }
        : {
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
            opening_balance: Number(openingBalance || 0),
            credit_limit: Number(creditLimit || 0),
          };

      const res = await fetch('/api/customers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error || 'Failed to save customer.');
      } else {
        setShowFormModal(false);
        setSuccessMsg(editingCustomer ? 'Customer updated successfully.' : 'New customer khata created.');
        await loadData();
      }
    } catch {
      setErrorMsg('Network error saving customer.');
    } finally {
      setSubmitting(false);
    }
  };

  const openTxModal = (c: Customer, action: 'payment' | 'add_udhaar') => {
    setTxModalCustomer(c);
    setTxAction(action);
    setTxAmount('');
    setTxMethod('Cash');
    setTxAddToRegister(true);
    setTxNote('');
    setErrorMsg('');
  };

  const handleSubmitTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txModalCustomer) return;
    const amt = Number(txAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid positive amount.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: txAction,
          customer_id: txModalCustomer.id,
          amount: amt,
          payment_method: txMethod,
          add_to_register: txAddToRegister && txMethod === 'Cash',
          note: txNote.trim(),
          cashier_name: currentUser?.display_name || currentUser?.full_name || 'Admin',
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error || 'Transaction failed.');
      } else {
        setTxModalCustomer(null);
        setSuccessMsg(
          txAction === 'payment'
            ? `Payment of ${formatMoney(amt)} received successfully.`
            : `Udhaar of ${formatMoney(amt)} added to ledger.`
        );
        await loadData();
      }
    } catch {
      setErrorMsg('Network error processing transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/customers?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error || 'Cannot delete customer.');
        setDeleteTarget(null);
      } else {
        setDeleteTarget(null);
        setSuccessMsg('Customer deleted from khata.');
        await loadData();
      }
    } catch {
      setErrorMsg('Failed to delete customer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintStatement = () => {
    if (typeof window === 'undefined') return;
    document.body.classList.add('print-page-mode');
    const cleanup = () => {
      document.body.classList.remove('print-page-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 80);
  };

  const filteredCustomers = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q)
    );
  });

  const ledgerTransactions = ledgerCustomer
    ? transactions.filter((t) => t.customer_id === ledgerCustomer.id)
    : [];

  return (
    <div className="p-4 lg:p-6 space-y-5 bg-[#F4F6FB] min-h-full">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">Customer Udhaar Khata (کسٹمر ادھار کھاتہ)</h1>
            <p className="text-xs text-slate-500 font-medium">
              Track regular credit customers, POS udhaar bills, and payment recoveries
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer (نیا کسٹمر)</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-teal-600 hover:text-teal-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Udhaar Receivable (کل واجب الادا)
          </span>
          <div className="text-2xl font-black text-rose-600 mt-1">
            {formatMoney(summary.total_udhaar_receivable)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Recovered Payments (کل وصولی)
          </span>
          <div className="text-2xl font-black text-teal-600 mt-1">
            {formatMoney(summary.total_collected)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Registered Khata Customers
          </span>
          <div className="text-2xl font-black text-indigo-700 mt-1">
            {summary.total_customers} Customers
          </div>
        </div>
      </div>

      {/* Search & Customer Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden no-print">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer by name, phone, or address..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <span className="text-xs font-bold text-slate-500">
            Showing {filteredCustomers.length} of {customers.length} customers
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs font-bold text-slate-400">
            Loading customer accounts...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">No customers found</p>
            <p className="text-xs text-slate-400 mt-1">
              Click &quot;Add New Customer&quot; to open a regular udhaar khata account.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact & Address</th>
                  <th className="py-3 px-4 text-right">Current Udhaar</th>
                  <th className="py-3 px-4 text-right">Credit Limit</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCustomers.map((c) => {
                  const bal = Number(c.current_balance || 0);
                  const limit = Number(c.credit_limit || 0);
                  const overLimit = limit > 0 && bal > limit;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900 text-sm">{c.name}</div>
                        <div className="text-[11px] text-slate-400">
                          Since {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-4 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.phone || '—'}</span>
                        </div>
                        {c.address && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{c.address}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg font-black text-sm ${
                            bal > 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-teal-50 text-teal-700 border border-teal-200'
                          }`}
                        >
                          {formatMoney(bal)}
                        </span>
                        {overLimit && (
                          <div className="text-[10px] font-bold text-rose-600 mt-0.5">
                            Over credit limit
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-600">
                        {limit > 0 ? formatMoney(limit) : 'No Limit'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openTxModal(c, 'payment')}
                            className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                            title="Receive Payment"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>Receive</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openTxModal(c, 'add_udhaar')}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                            title="Add Manual Udhaar"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>+ Udhaar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setLedgerCustomer(c)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                            title="View Khata Statement"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Khata</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg cursor-pointer"
                            title="Edit Customer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Delete Customer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-[#0F172A] text-white flex items-center justify-between">
              <h2 className="text-sm font-black">
                {editingCustomer ? 'Edit Customer Details' : 'Add New Khata Customer'}
              </h2>
              <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Haji Akram / Chaudhry Sahib"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="03XX-XXXXXXX"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Address / Shop</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Optional address or business name"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {!editingCustomer && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Opening Udhaar (Rs.)</label>
                    <input
                      type="number"
                      min="0"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                )}
                <div className={editingCustomer ? 'col-span-2' : ''}>
                  <label className="block font-bold text-slate-700 mb-1">Credit Limit (0 = Unlimited)</label>
                  <input
                    type="number"
                    min="0"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Payment / Add Udhaar Modal */}
      {txModalCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-[#0F172A] text-white flex items-center justify-between">
              <h2 className="text-sm font-black">
                {txAction === 'payment' ? 'Receive Udhaar Payment' : 'Add Manual Udhaar'} — {txModalCustomer.name}
              </h2>
              <button onClick={() => setTxModalCustomer(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitTx} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="font-bold text-slate-600">Current Balance:</span>
                <span className="text-base font-black text-rose-600">
                  {formatMoney(txModalCustomer.current_balance)}
                </span>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount (Rs.) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-black text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              {txAction === 'payment' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                    <select
                      value={txMethod}
                      onChange={(e) => setTxMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="Cash">Cash (نقد)</option>
                      <option value="JazzCash">JazzCash</option>
                      <option value="EasyPaisa">EasyPaisa</option>
                      <option value="Bank">Bank Transfer</option>
                    </select>
                  </div>
                  {txMethod === 'Cash' && (
                    <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={txAddToRegister}
                        onChange={(e) => setTxAddToRegister(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      <span>Add cash recovery to active Cash Register drawer</span>
                    </label>
                  )}
                </>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Note / Reference</label>
                <input
                  type="text"
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  placeholder="Optional remark"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTxModalCustomer(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-2 text-white font-black rounded-xl disabled:opacity-50 ${
                    txAction === 'payment'
                      ? 'bg-teal-600 hover:bg-teal-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {submitting
                    ? 'Processing...'
                    : txAction === 'payment'
                    ? 'Confirm Payment'
                    : 'Record Udhaar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Ledger Statement Modal (Printable) */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-[#0F172A] text-white flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-black">Khata Statement — {ledgerCustomer.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintStatement}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Statement</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerCustomer(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">{ledgerCustomer.name}</h3>
                  <p className="text-xs text-slate-500">
                    Phone: {ledgerCustomer.phone || 'N/A'} • {ledgerCustomer.address || 'No address'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold uppercase text-slate-500">Outstanding Balance</div>
                  <div className="text-xl font-black text-rose-600">
                    {formatMoney(ledgerCustomer.current_balance)}
                  </div>
                </div>
              </div>

              {ledgerTransactions.length === 0 ? (
                <p className="text-center text-xs font-bold text-slate-400 py-8">
                  No transactions recorded yet for this customer.
                </p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                      <th className="py-2 px-3">Date / Ref</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Details</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800">{tx.voucher_number}</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(tx.created_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded font-black text-[10px] ${
                              tx.type === 'PAYMENT'
                                ? 'bg-teal-50 text-teal-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {tx.note || tx.order_receipt_number || tx.payment_method || '—'}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-black ${
                            tx.type === 'PAYMENT' ? 'text-teal-600' : 'text-rose-600'
                          }`}
                        >
                          {tx.type === 'PAYMENT' ? '-' : '+'} {formatMoney(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-black text-slate-900">Delete Customer Khata?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? Customers with
              an unpaid balance cannot be deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteCustomer}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
