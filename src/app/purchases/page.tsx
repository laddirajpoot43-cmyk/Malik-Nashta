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
    <AdminGuard
      fallbackTitle="Maal Kharidari & Mandi Invoices Protected"
      fallbackDescription="Please enter Admin PIN to record Mandi purchases, manage vendor payments, and deduct drawer cash."
    >
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

  const handleDeleteInvoice = async (inv: PurchaseInvoice) => {
    if (!confirm(`Delete Purchase Invoice ${inv.invoice_number} (${formatMoney(inv.total_amount)})? This will also reverse any unpaid Udhaar balance on the vendor.`)) {
      return;
    }
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
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Maal Kharidari (Raw Material Purchases)</h1>
            <p className="text-xs text-slate-400">
              Record mandi deliveries, inventory ingredients, supplier credit (Udhaar), and register cash deductions
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setShowForm(!showForm);
            setFormError('');
            setFormSuccess('');
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>{showForm ? 'Close Entry Form' : 'New Purchase Bill (مال انٹری)'}</span>
        </button>
      </div>

      {formSuccess && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{formSuccess}</span>
          </div>
          <button onClick={() => setFormSuccess('')} className="text-emerald-400">✕</button>
        </div>
      )}

      {/* NEW PURCHASE BILL FORM */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-white text-base">Record Raw Material Delivery (Maal Inward)</h3>
            <span className="text-xs text-slate-400">Sequential PUR Sequence</span>
          </div>

          {formError && (
            <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Vendor Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mandi Supplier / Vendor:</label>
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-emerald-500"
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">Delivery / Bill Date:</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Add ingredient dropdown button */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Add Raw Ingredient:</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddItem(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-emerald-400 font-semibold focus:outline-none focus:border-emerald-500"
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
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold text-[10px] uppercase">
                <tr>
                  <th className="px-3 py-2.5">Item Name</th>
                  <th className="px-3 py-2.5 w-24">Quantity</th>
                  <th className="px-3 py-2.5 w-20">Unit</th>
                  <th className="px-3 py-2.5 w-28">Rate (PKR)</th>
                  <th className="px-3 py-2.5 text-right w-28">Line Total</th>
                  <th className="px-3 py-2.5 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No ingredients added yet. Select from the dropdown above.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50">
                      <td className="px-3 py-2 font-bold text-slate-200">{it.name}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          value={it.quantity}
                          onChange={(e) => handleUpdateItem(idx, parseFloat(e.target.value) || 0, it.unit_price)}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-semibold"
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-400">{it.unit}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          value={it.unit_price}
                          onChange={(e) => handleUpdateItem(idx, it.quantity, parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-semibold"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-black text-emerald-400">
                        {formatMoney(it.line_total)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1"
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
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h4 className="font-bold text-xs text-white">Payment & Register Deduction</h4>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Cash / Payment Paid Now (PKR):</label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 font-black text-lg focus:outline-none"
                />
              </div>

              {/* Deduct from drawer option */}
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deductFromRegister}
                  onChange={(e) => setDeductFromRegister(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded bg-slate-950 border-slate-700"
                />
                <span className="text-xs text-slate-200">
                  Deduct this paid cash directly from the <strong>active counter cash drawer</strong> (CASH_OUT)
                </span>
              </label>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Discount Given by Vendor:</label>
                <input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            {/* Calculations Summary */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-bold text-slate-200">{formatMoney(subtotal)}</span>
                </div>
                {parseFloat(discountAmount) > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Discount:</span>
                    <span className="text-emerald-400">-{formatMoney(parseFloat(discountAmount))}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-white pt-2 border-t border-slate-800">
                  <span>Total Bill Amount:</span>
                  <span className="text-emerald-400">{formatMoney(totalBill)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Cash Paid Now:</span>
                  <span className="font-bold text-white">{formatMoney(paidNum)}</span>
                </div>
                <div className="flex justify-between text-xs text-amber-300 font-bold pt-1 border-t border-slate-800">
                  <span>Unpaid Balance (Added to Khata):</span>
                  <span>{formatMoney(balanceRemaining)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || items.length === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg transition"
                >
                  {submitting ? 'Recording...' : 'Save Purchase Bill & Update Khata'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Purchases List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">Purchase Invoices History ({purchases.length})</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
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
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading purchase bills...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No purchase invoices recorded yet. Click "New Purchase Bill" to record delivery.
                  </td>
                </tr>
              ) : (
                purchases.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono">
                      <div className="font-bold text-slate-200">{inv.invoice_number}</div>
                      <div className="text-[10px] text-slate-500">{inv.invoice_date}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-200">{inv.vendor_name_snapshot}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {inv.items?.length || 0} item(s)
                      {inv.items && inv.items.length > 0 && (
                        <span className="text-[10px] block text-slate-500 truncate max-w-xs">
                          {inv.items.map((i) => `${i.raw_material_name} (${i.quantity}${i.unit})`).join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          inv.payment_status === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : inv.payment_status === 'partial'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {inv.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-100">{formatMoney(inv.total_amount)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">{formatMoney(inv.paid_amount)}</td>
                    <td className="px-4 py-3 text-right font-black text-amber-400">{formatMoney(inv.balance_amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteInvoice(inv)}
                        className="p-1.5 bg-rose-950/50 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30 rounded-lg transition inline-flex items-center justify-center"
                        title="Delete Purchase Invoice"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
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
  );
}

