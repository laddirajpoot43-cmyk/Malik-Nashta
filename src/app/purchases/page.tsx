'use client';

import React, { useState, useEffect } from 'react';
import { Vendor, RawMaterial, PurchaseInvoice } from '@/types/pos';
import { formatMoney, multiplyMoney, addMoney, subtractMoney } from '@/lib/money';
import { useAuth } from '@/context/AuthContext';
import { usePOS } from '@/context/POSContext';
import { AdminGuard } from '@/components/auth/AdminGuard';
import {
  Truck,
  Plus,
  Trash2,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Layers,
  ArrowRight,
} from 'lucide-react';

export default function PurchasesPage() {
  return (
    <AdminGuard fallbackTitle="Maal Kharidari Protected">
      <PurchasesContent />
    </AdminGuard>
  );
}

function PurchasesContent() {
  const { currentUser } = useAuth();
  const { activeRegister, refreshPOSData } = usePOS();

  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  // New Purchase Form state
  const [showForm, setShowForm] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<
    { raw_material_id: string; name: string; quantity: number; unit: string; unit_price: number; line_total: number }[]
  >([]);
  const [paidAmount, setPaidAmount] = useState<string>('0');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'jazzcash'>('cash');
  const [deductFromRegister, setDeductFromRegister] = useState<boolean>(true);

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [purRes, venRes, rawRes] = await Promise.all([
        fetch('/api/purchases'),
        fetch('/api/vendors'),
        fetch('/api/raw-materials'),
      ]);
      const [purData, venData, rawData] = await Promise.all([
        purRes.json(),
        venRes.json(),
        rawRes.json(),
      ]);

      if (purData.success) setPurchases(purData.purchases || []);
      if (venData.success) {
        setVendors(venData.vendors || []);
        if (venData.vendors?.length > 0 && !selectedVendorId) {
          setSelectedVendorId(venData.vendors[0].id);
        }
      }
      if (rawData.success) setRawMaterials(rawData.rawMaterials || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Line items math
  const subtotal = items.reduce((acc, item) => addMoney(acc, item.line_total), 0);
  const totalBill = Math.max(0, subtractMoney(subtotal, parseFloat(discountAmount) || 0));
  const paidNum = parseFloat(paidAmount) || 0;
  const balanceRemaining = Math.max(0, subtractMoney(totalBill, paidNum));

  const handleAddItem = (materialId: string) => {
    const mat = rawMaterials.find((m) => m.id === materialId);
    if (!mat) return;

    const qty = 1;
    const rate = mat.default_price || 0;
    const lineTotal = multiplyMoney(rate, qty);

    setItems((prev) => [
      ...prev,
      {
        raw_material_id: mat.id,
        name: mat.name,
        quantity: qty,
        unit: mat.unit || 'kg',
        unit_price: rate,
        line_total: lineTotal,
      },
    ]);
  };

  const handleUpdateItem = (index: number, qty: number, rate: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index].quantity = qty;
      copy[index].unit_price = rate;
      copy[index].line_total = multiplyMoney(rate, qty);
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) {
      setFormError('Please select a Mandi vendor.');
      return;
    }
    if (items.length === 0) {
      setFormError('Please add at least one raw material item.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: selectedVendorId,
          invoice_date: invoiceDate,
          items,
          discount_amount: parseFloat(discountAmount) || 0,
          paid_amount: paidNum,
          payment_method: paymentMethod,
          deduct_from_register: deductFromRegister,
          cashier_name: currentUser?.display_name || 'Admin',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFormSuccess(`Purchase Invoice #${data.invoice.invoice_number} recorded successfully!`);
        setShowForm(false);
        setItems([]);
        setPaidAmount('0');
        setDiscountAmount('0');
        loadData();
        refreshPOSData();
      } else {
        setFormError(data.error || 'Failed to save purchase');
      }
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInvoice = (inv: PurchaseInvoice) => {
    setInvoiceToDelete(inv);
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    const inv = invoiceToDelete;
    setInvoiceToDelete(null);
    try {
      const res = await fetch(`/api/purchases?id=${inv.id}&cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setFormSuccess(`Invoice ${inv.invoice_number} deleted.`);
        loadData();
        refreshPOSData();
      } else {
        setFormError(data.error || 'Failed to delete invoice');
      }
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  return (
    <div className="space-y-3 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl font-bold">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900">Maal Kharidari (Raw Material Purchases)</h1>
          </div>
        </div>

        {/* GREEN BUTTON: Toggle New Form */}
        <button
          type="button"
          onClick={() => {
            setShowForm(!showForm);
            setFormError('');
            setFormSuccess('');
          }}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showForm ? 'Close Entry Form' : 'New Purchase Bill (مال انٹری)'}</span>
        </button>
      </div>

      {formSuccess && (
        <div className="p-3 bg-indigo-50 border border-indigo-300 rounded-xl text-indigo-800 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600" />
            <span>{formSuccess}</span>
          </div>
          <button onClick={() => setFormSuccess('')} className="text-indigo-700 font-bold">✕</button>
        </div>
      )}

      {/* NEW PURCHASE BILL FORM */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-base">Record Raw Material Delivery (Maal Inward)</h3>
            <span className="text-xs text-slate-500 font-medium">Sequential PUR Sequence</span>
          </div>

          {formError && (
            <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Vendor Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mandi Supplier / Vendor:</label>
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.category}) - Balance: {formatMoney(v.current_balance)}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Delivery / Bill Date:</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>

            {/* Add ingredient dropdown button */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Add Raw Ingredient:</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddItem(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-indigo-700 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
              >
                <option value="">+ Choose Ingredient to Add...</option>
                {rawMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit}) - Default Rs. {m.default_price}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Line items table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold text-[10px] uppercase">
                <tr>
                  <th className="px-3 py-2.5">Item Name</th>
                  <th className="px-3 py-2.5 w-24">Quantity</th>
                  <th className="px-3 py-2.5 w-20">Unit</th>
                  <th className="px-3 py-2.5 w-28">Rate (PKR)</th>
                  <th className="px-3 py-2.5 text-right w-28">Line Total</th>
                  <th className="px-3 py-2.5 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500 font-medium">
                      No ingredients added yet. Select from the dropdown above.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-bold text-slate-900">{it.name}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          value={it.quantity}
                          onChange={(e) => handleUpdateItem(idx, parseFloat(e.target.value) || 0, it.unit_price)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-center text-slate-900 font-bold"
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-600 font-medium">{it.unit}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          value={it.unit_price}
                          onChange={(e) => handleUpdateItem(idx, it.quantity, parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-center text-slate-900 font-bold"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-black text-indigo-700">
                        {formatMoney(it.line_total)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-rose-600 hover:text-rose-700 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Payment & Settlement Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="font-extrabold text-xs text-slate-900">Payment & Register Deduction</h4>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Cash / Payment Paid Now (PKR):</label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-indigo-700 font-black text-lg focus:outline-none"
                />
              </div>

              {/* Deduct from drawer option */}
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deductFromRegister}
                  onChange={(e) => setDeductFromRegister(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                />
                <span className="text-xs text-slate-800 font-medium">
                  Deduct this paid cash directly from the <strong>active counter cash drawer</strong> (CASH_OUT)
                </span>
              </label>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Discount Given by Vendor:</label>
                <input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none"
                />
              </div>
            </div>

            {/* Calculations Summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Subtotal:</span>
                  <span className="font-bold text-slate-900">{formatMoney(subtotal)}</span>
                </div>
                {parseFloat(discountAmount) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount:</span>
                    <span className="text-indigo-700 font-bold">-{formatMoney(parseFloat(discountAmount))}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Bill Amount:</span>
                  <span className="text-indigo-700">{formatMoney(totalBill)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-700">
                  <span>Cash Paid Now:</span>
                  <span className="font-bold text-slate-900">{formatMoney(paidNum)}</span>
                </div>
                <div className="flex justify-between text-xs text-rose-700 font-bold pt-1 border-t border-slate-200">
                  <span>Unpaid Balance (Added to Khata):</span>
                  <span>{formatMoney(balanceRemaining)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                {/* RED BUTTON: Cancel */}
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                {/* GREEN BUTTON: Save */}
                <button
                  type="submit"
                  disabled={submitting || items.length === 0}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow transition cursor-pointer"
                >
                  {submitting ? 'Recording...' : 'Save Purchase Bill & Update Khata'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Purchases List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-sm text-slate-900">Purchase Invoices History ({purchases.length})</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-extrabold text-[10px]">
              <tr>
                <th className="px-4 py-3">Invoice # / Date</th>
                <th className="px-4 py-3">Supplier Name</th>
                <th className="px-4 py-3">Items Delivered</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total Bill</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Udhaar Balance</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                    Loading purchase bills...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-semibold">
                    No purchase invoices recorded yet. Click &quot;New Purchase Bill&quot; to record delivery.
                  </td>
                </tr>
              ) : (
                purchases.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono">
                      <div className="font-extrabold text-slate-900">{inv.invoice_number}</div>
                      <div className="text-[10px] text-slate-500">{inv.invoice_date}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{inv.vendor_name_snapshot}</td>
                    <td className="px-4 py-3 text-slate-600 font-medium">
                      {inv.items?.length || 0} item(s)
                      {inv.items && inv.items.length > 0 && (
                        <span className="text-[10px] block text-slate-500 truncate max-w-xs">
                          {inv.items.map((i) => `${i.raw_material_name} (${i.quantity}${i.unit})`).join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          inv.payment_status === 'paid'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : inv.payment_status === 'partial'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {inv.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">{formatMoney(inv.total_amount)}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700">{formatMoney(inv.paid_amount)}</td>
                    <td className="px-4 py-3 text-right font-black text-rose-600">{formatMoney(inv.balance_amount)}</td>
                    <td className="px-4 py-3 text-right">
                      {/* RED BUTTON: Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteInvoice(inv)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition inline-flex items-center justify-center cursor-pointer"
                        title="Delete Purchase Invoice"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* IN-APP DELETE INVOICE CONFIRMATION MODAL */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Delete Purchase Bill</h3>
                <p className="text-xs text-slate-500 font-medium">Reverses unpaid vendor credit balance.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium bg-slate-50 p-3 rounded-xl border border-slate-200">
              Are you sure you want to delete Purchase Invoice{' '}
              <strong className="text-slate-900 font-bold">#{invoiceToDelete.invoice_number}</strong> ({formatMoney(invoiceToDelete.total_amount)})?
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteInvoice}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow transition cursor-pointer"
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

