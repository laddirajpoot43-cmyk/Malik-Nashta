'use client';

import React, { useState, useEffect } from 'react';
import { Order, OrderItem } from '@/types/pos';
import { formatMoney } from '@/lib/money';
import { useAuth } from '@/context/AuthContext';
import { usePOS } from '@/context/POSContext';
import { AdminPinModal } from '@/components/modals/AdminPinModal';
import {
  Search,
  Receipt,
  Printer,
  RotateCcw,
  Ban,
  Clock,
  User,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Trash2,
} from 'lucide-react';

export default function OrdersPage() {
  const { currentUser } = useAuth();
  const { printReceipt } = usePOS();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Void modal state
  const [showVoidModal, setShowVoidModal] = useState<boolean>(false);
  const [voidReason, setVoidReason] = useState<string>('');
  const [voidPin, setVoidPin] = useState<string>('');

  // Refund modal state
  const [showRefundModal, setShowRefundModal] = useState<boolean>(false);
  const [refundItemSelection, setRefundItemSelection] = useState<Record<string, number>>({});
  const [refundReason, setRefundReason] = useState<string>('');
  const [refundPin, setRefundPin] = useState<string>('');

  const [actionError, setActionError] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string>('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      let url = '/api/orders?limit=100';
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [search, statusFilter]);

  const handleDeleteOrder = async (order: Order) => {
    if (!confirm(`Are you sure you want to permanently delete Order ${order.receipt_number}? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/orders/${order.id}?cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}&reason=Admin+Manual+Deletion`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Order ${order.receipt_number} deleted successfully.`);
        setSelectedOrder(null);
        fetchOrders();
      } else {
        setActionError(data.error || 'Failed to delete order.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error deleting order');
    }
  };

  const handleReprint = async (order: Order) => {
    try {
      const res = await fetch(`/api/orders/${order.id}/reprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashier_name: currentUser?.display_name || 'Admin' }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        printReceipt(data.order);
        fetchOrders();
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleExecuteVoid = async () => {
    if (!selectedOrder) return;
    if (!voidReason.trim()) {
      setActionError('Void reason is mandatory.');
      return;
    }
    if (!voidPin.trim()) {
      setActionError('Supervisor Admin PIN is required.');
      return;
    }

    try {
      setActionError('');
      const res = await fetch(`/api/orders/${selectedOrder.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_pin: voidPin.trim(),
          void_reason: voidReason.trim(),
          cashier_name: currentUser?.display_name || 'Admin',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Order #${selectedOrder.receipt_number} has been voided successfully.`);
        setShowVoidModal(false);
        setVoidPin('');
        setVoidReason('');
        setSelectedOrder(data.order);
        fetchOrders();
      } else {
        setActionError(data.error || 'Failed to void order.');
      }
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const openRefundDialog = (order: Order) => {
    setSelectedOrder(order);
    const initialQtyMap: Record<string, number> = {};
    for (const item of order.items || []) {
      const remaining = Math.max(0, item.quantity - (item.refunded_quantity || 0));
      if (remaining > 0) {
        initialQtyMap[item.id] = remaining;
      }
    }
    setRefundItemSelection(initialQtyMap);
    setRefundReason('');
    setRefundPin('');
    setActionError('');
    setShowRefundModal(true);
  };

  const handleExecuteRefund = async () => {
    if (!selectedOrder) return;
    if (!refundReason.trim()) {
      setActionError('Mandatory refund reason is required.');
      return;
    }

    const itemsToRefund = Object.entries(refundItemSelection)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const it = selectedOrder.items?.find((i) => i.id === itemId);
        const rate = it?.unit_price || 0;
        return {
          order_item_id: itemId,
          quantity: qty,
          amount: Math.round(rate * qty * 100) / 100,
        };
      });

    if (itemsToRefund.length === 0) {
      setActionError('Please select at least one item quantity to refund.');
      return;
    }

    try {
      setActionError('');
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          items: itemsToRefund,
          reason: refundReason.trim(),
          admin_pin: refundPin.trim() || undefined,
          cashier_name: currentUser?.display_name || 'Admin',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Refund voucher ${data.refund?.refund_number} generated successfully!`);
        setShowRefundModal(false);
        fetchOrders();
        // Refresh single order details
        const orderRes = await fetch(`/api/orders/${selectedOrder.id}`);
        const orderData = await orderRes.json();
        if (orderData.success) {
          setSelectedOrder(orderData.order);
        }
      } else {
        setActionError(data.error || 'Failed to process refund.');
      }
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Order History & Refund Management</h1>
            <p className="text-xs text-slate-400">
              Audit receipts, issue itemized partial refunds, reprint thermal bills, or void orders
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Receipt / Order # / Name"
              className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 w-52"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="partially_refunded">Partially Refunded</option>
            <option value="refunded">Fully Refunded</option>
            <option value="voided">Voided</option>
          </select>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Orders Table & Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Orders Table (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Recent Orders ({orders.length})</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Receipt / Time</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Cashier</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500">
                      Loading orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      No matching orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const isSelected = selectedOrder?.id === o.id;
                    const dateStr = new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <tr
                        key={o.id}
                        onClick={() => setSelectedOrder(o)}
                        className={`hover:bg-slate-800/60 transition cursor-pointer ${
                          isSelected ? 'bg-slate-800/80 border-l-4 border-l-emerald-500' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono font-bold text-slate-200">{o.receipt_number}</div>
                          <div className="text-[10px] text-slate-500">{dateStr} • {o.order_number}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-300">{o.customer_name || 'Walk-in'}</div>
                          {o.customer_phone && <div className="text-[10px] text-slate-500">{o.customer_phone}</div>}
                        </td>
                        <td className="px-3 py-3 text-slate-400">{o.cashier_name_snapshot}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              o.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : o.status === 'partially_refunded'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : o.status === 'refunded'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {o.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-emerald-400 text-sm">
                          {formatMoney(o.grand_total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReprint(o);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
                              title="Print Receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {o.status !== 'voided' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRefundDialog(o);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-700 transition"
                                title="Partial / Full Refund"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Order Detail Panel (1 col) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-4 flex flex-col">
          {selectedOrder ? (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="font-bold text-white text-base">{selectedOrder.receipt_number}</h3>
                    <p className="text-[11px] text-slate-400">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedOrder.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : selectedOrder.status === 'voided'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {selectedOrder.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Items */}
                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedOrder.items?.map((it, idx) => (
                    <div key={it.id || idx} className="p-2 bg-slate-950/60 rounded-lg border border-slate-800 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-200">{it.product_name_snapshot}</span>
                        <span className="text-emerald-400">{formatMoney(it.line_total)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
                        <span>{it.quantity} portion(s) @ {formatMoney(it.unit_price)}</span>
                        {it.refunded_quantity > 0 && (
                          <span className="text-rose-400 font-bold">
                            Refunded: {it.refunded_quantity}x
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculations */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs mt-3">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal:</span>
                    <span>{formatMoney(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Discount:</span>
                      <span className="text-emerald-400">-{formatMoney(selectedOrder.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-sm text-white pt-1 border-t border-slate-800">
                    <span>Grand Total:</span>
                    <span className="text-emerald-400">{formatMoney(selectedOrder.grand_total)}</span>
                  </div>
                </div>

                {selectedOrder.void_reason && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs mt-2">
                    <strong>Void Reason:</strong> {selectedOrder.void_reason}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <button
                  onClick={() => handleReprint(selectedOrder)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Print Thermal Bill
                </button>

                {selectedOrder.status !== 'voided' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openRefundDialog(selectedOrder)}
                      className="py-2 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" /> Refund
                    </button>
                    <button
                      onClick={() => {
                        setShowVoidModal(true);
                        setVoidPin('');
                        setVoidReason('');
                        setActionError('');
                      }}
                      className="py-2 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      <Ban className="w-4 h-4" /> Void Order
                    </button>
                  </div>
                )}

                <button
                  onClick={() => handleDeleteOrder(selectedOrder)}
                  className="w-full py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Permanent removal with audit log"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Delete Order (Admin)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16 text-center">
              <FileText className="w-10 h-10 mb-2 opacity-30 text-emerald-400" />
              <p className="text-xs font-semibold">Select an order from the list to view breakdown & audit trail</p>
            </div>
          )}
        </div>
      </div>

      {/* VOID MODAL */}
      {showVoidModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <Ban className="w-5 h-5 text-rose-400" />
                <span>Void Order #{selectedOrder.receipt_number}</span>
              </div>
              <button onClick={() => setShowVoidModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Voiding cancels this order and will automatically reverse cash from the active register shift.
            </p>

            {actionError && (
              <div className="p-2 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-200 text-xs">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mandatory Void Reason:</label>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Customer cancelled, mistake by cashier"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Supervisor Admin PIN:</label>
              <input
                type="password"
                maxLength={6}
                value={voidPin}
                onChange={(e) => setVoidPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-center font-bold text-lg text-white tracking-widest focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowVoidModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteVoid}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-md"
              >
                Confirm Order Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ITEMIZED PARTIAL REFUND MODAL */}
      {showRefundModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <span>Issue Itemized Refund - #{selectedOrder.receipt_number}</span>
              </div>
              <button onClick={() => setShowRefundModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Specify the exact portion quantity to refund for each item below:
            </p>

            {actionError && (
              <div className="p-2 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-200 text-xs">
                {actionError}
              </div>
            )}

            {/* Line items list with quantity controls */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {selectedOrder.items?.map((it) => {
                const maxAllowed = Math.max(0, it.quantity - (it.refunded_quantity || 0));
                const currentRefundQty = refundItemSelection[it.id] || 0;

                return (
                  <div key={it.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-200">{it.product_name_snapshot}</span>
                      <div className="text-[10px] text-slate-400">
                        Max refundable: {maxAllowed} portion(s) @ {formatMoney(it.unit_price)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max={maxAllowed}
                        value={currentRefundQty}
                        onChange={(e) => {
                          const val = Math.min(maxAllowed, Math.max(0, parseFloat(e.target.value) || 0));
                          setRefundItemSelection((prev) => ({ ...prev, [it.id]: val }));
                        }}
                        className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-white font-bold"
                      />
                      <span className="text-xs text-emerald-400 font-bold w-16 text-right">
                        {formatMoney(currentRefundQty * it.unit_price)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mandatory Refund Reason:</label>
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Mirch zyada thi / Not satisfied / Order mistake"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Supervisor Admin PIN:</label>
              <input
                type="password"
                maxLength={6}
                value={refundPin}
                onChange={(e) => setRefundPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-center font-bold text-lg text-white tracking-widest focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRefund}
                className="flex-1 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-md"
              >
                Execute Refund & Deduct Cash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

