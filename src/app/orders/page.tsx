'use client';

import React, { useState, useEffect } from 'react';
import { Order } from '@/types/pos';
import { formatMoney } from '@/lib/money';
import { useAuth } from '@/context/AuthContext';
import { usePOS } from '@/context/POSContext';
import { ThermalReceipt } from '@/components/ThermalReceipt';
import {
  Search,
  Receipt,
  Printer,
  RotateCcw,
  Ban,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Trash2,
  Edit,
  Eye,
  X,
  Clock,
  History,
  Archive,
  Calendar,
  Sparkles,
  CheckCheck,
  Moon,
  Layers,
  Filter,
} from 'lucide-react';

export default function OrdersPage() {
  const { currentUser } = useAuth();
  const { printReceipt } = usePOS();

  const [activeTab, setActiveTab] = useState<'recent' | 'history' | 'all'>('recent');
  const [counts, setCounts] = useState<{ recent: number; history: number; total: number }>({
    recent: 0,
    history: 0,
    total: 0,
  });
  const [historyDateFilter, setHistoryDateFilter] = useState<'all' | 'today' | 'yesterday' | 'last7' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [showDailyCloseModal, setShowDailyCloseModal] = useState<boolean>(false);
  const [dailyClosingInProgress, setDailyClosingInProgress] = useState<boolean>(false);

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

  // Receipt Customize & Edit Modal state
  const [showReceiptEditModal, setShowReceiptEditModal] = useState<boolean>(false);
  const [receiptEditForm, setReceiptEditForm] = useState({
    customer_name: '',
    customer_phone: '',
    custom_receipt_note: '',
    tagline: '',
    paper_size: '80mm',
    show_duplicate_watermark: true,
  });

  const [actionError, setActionError] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string>('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      let url = `/api/orders?limit=150&tab=${activeTab}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;

      if (activeTab === 'history') {
        if (historyDateFilter === 'today') {
          url += `&date=${new Date().toISOString().slice(0, 10)}`;
        } else if (historyDateFilter === 'yesterday') {
          const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          url += `&date=${y}`;
        } else if (historyDateFilter === 'last7') {
          const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
          url += `&date_from=${sevenDaysAgo}`;
        } else if (historyDateFilter === 'custom' && customDate) {
          url += `&date=${customDate}`;
        }
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
        if (data.counts) {
          setCounts(data.counts);
        }
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeTab, search, statusFilter, historyDateFilter, customDate]);

  const handleExecuteDailyClose = async () => {
    setDailyClosingInProgress(true);
    setActionError('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'daily_close',
          cashier_name: currentUser?.display_name || 'Admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(data.message || 'All active orders moved to Order History!');
        setShowDailyCloseModal(false);
        fetchOrders();
      } else {
        setActionError(data.error || 'Failed to execute daily closing.');
      }
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setDailyClosingInProgress(false);
    }
  };

  const handleReprint = async (order: Order, customOverrides?: any) => {
    try {
      const res = await fetch(`/api/orders/${order.id}/reprint`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.order) {
        setActionSuccess(`Thermal receipt sent to printer for order #${order.receipt_number}`);
        const finalOrder = customOverrides ? { ...data.order, ...customOverrides } : data.order;
        printReceipt(finalOrder);
        fetchOrders();
        if (selectedOrder?.id === order.id) {
          setSelectedOrder(finalOrder);
        }
      } else {
        setActionError(data.error || 'Failed to reprint.');
      }
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const openReceiptEditModal = (order: Order) => {
    setReceiptEditForm({
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      custom_receipt_note: (order as any).custom_receipt_note || '',
      tagline: 'Fresh & Crispy Nashta Everyday',
      paper_size: '80mm',
      show_duplicate_watermark: (order.reprint_count || 0) > 0,
    });
    setShowReceiptEditModal(true);
  };

  const handlePrintCustomReceipt = () => {
    if (!selectedOrder) return;
    const overrides = {
      customer_name: receiptEditForm.customer_name,
      customer_phone: receiptEditForm.customer_phone,
      custom_receipt_note: receiptEditForm.custom_receipt_note,
    };
    handleReprint(selectedOrder, overrides);
    setShowReceiptEditModal(false);
  };

  const handleDeleteOrder = async (order: Order) => {
    if (!confirm(`Are you sure you want to permanently delete order #${order.receipt_number}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/orders/${order.id}?cashier_name=${encodeURIComponent(currentUser?.display_name || 'Admin')}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Order #${order.receipt_number} permanently deleted.`);
        setSelectedOrder(null);
        fetchOrders();
      } else {
        setActionError(data.error || 'Failed to delete order.');
      }
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const handleExecuteVoid = async () => {
    if (!selectedOrder) return;
    if (!voidReason.trim()) {
      setActionError('Please enter a void reason.');
      return;
    }
    if (!voidPin.trim()) {
      setActionError('Please enter Supervisor Admin PIN.');
      return;
    }

    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          void_reason: voidReason.trim(),
          admin_pin: voidPin.trim(),
          cashier_name: currentUser?.display_name || 'Admin',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Order #${selectedOrder.receipt_number} successfully voided.`);
        setShowVoidModal(false);
        fetchOrders();
        const orderRes = await fetch(`/api/orders/${selectedOrder.id}`);
        const orderData = await orderRes.json();
        if (orderData.success) {
          setSelectedOrder(orderData.order);
        }
      } else {
        setActionError(data.error || 'Failed to void order.');
      }
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const openRefundDialog = (order: Order) => {
    setSelectedOrder(order);
    const initialSelection: Record<string, number> = {};
    order.items?.forEach((it) => {
      initialSelection[it.id] = 0;
    });
    setRefundItemSelection(initialSelection);
    setRefundReason('');
    setRefundPin('');
    setActionError('');
    setShowRefundModal(true);
  };

  const handleExecuteRefund = async () => {
    if (!selectedOrder) return;
    if (!refundReason.trim()) {
      setActionError('Please enter a refund reason.');
      return;
    }
    if (!refundPin.trim()) {
      setActionError('Please enter Supervisor Admin PIN.');
      return;
    }

    const itemsToRefund = Object.entries(refundItemSelection)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        order_item_id: itemId,
        quantity: qty,
      }));

    if (itemsToRefund.length === 0) {
      setActionError('Please specify at least one item quantity to refund.');
      return;
    }

    try {
      const res = await fetch(`/api/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          items: itemsToRefund,
          reason: refundReason.trim(),
          admin_pin: refundPin.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Refund voucher ${data.refund?.refund_number} generated successfully!`);
        setShowRefundModal(false);
        fetchOrders();
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
    <div className="space-y-3 select-none">
      {/* Page Header & Primary Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl font-bold">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>Orders & Billing Records</span>
            </h1>
          </div>
        </div>

        {/* Primary Tabs: Recent Orders vs Order History */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('recent');
              setSelectedOrder(null);
            }}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'recent'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Recent Orders (آج کے بل)</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'recent' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {counts.recent}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              setSelectedOrder(null);
            }}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Order History (آرکائیو)</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'history' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {counts.history}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setSelectedOrder(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="View all orders combined"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All ({counts.total})</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white border border-slate-200 p-2.5 rounded-2xl shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Receipt # / Customer / Phone"
              className="pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 w-56"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="partially_refunded">Partially Refunded</option>
            <option value="refunded">Fully Refunded</option>
            <option value="voided">Voided</option>
          </select>

          {/* Date Filter (Shown only in History or All mode) */}
          {activeTab !== 'recent' && (
            <div className="flex items-center gap-1.5 bg-slate-50 p-0.5 rounded-lg border border-slate-300 font-bold">
              <Calendar className="w-3.5 h-3.5 ml-2 text-slate-500" />
              <select
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value as any)}
                className="bg-transparent text-xs text-slate-900 font-bold py-1 px-1 focus:outline-none cursor-pointer"
              >
                <option value="all">All Past Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7">Last 7 Days</option>
                <option value="custom">Specific Date...</option>
              </select>
              {historyDateFilter === 'custom' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="px-2 py-0.5 border border-slate-300 rounded text-xs bg-white text-slate-900 font-semibold focus:outline-none"
                />
              )}
            </div>
          )}
        </div>

        {/* Right Action: Daily Closing Button in Recent Orders */}
        {activeTab === 'recent' && (
          <button
            type="button"
            onClick={() => setShowDailyCloseModal(true)}
            disabled={orders.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black rounded-xl transition shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Move today's orders into Order History archive and start clean for tomorrow"
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Execute Daily Closing (روزانہ کلوزنگ)</span>
          </button>
        )}
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-3 bg-indigo-50 border border-indigo-300 rounded-xl text-indigo-800 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-indigo-700 hover:text-indigo-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Orders Table & Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Orders Table (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-2">
              {activeTab === 'recent' ? (
                <>
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Recent Active Orders ({orders.length})</span>
                </>
              ) : activeTab === 'history' ? (
                <>
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>Archived Order History ({orders.length})</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>All Orders & Invoices ({orders.length})</span>
                </>
              )}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Click any order to view slip & billing details
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-extrabold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Receipt / Time</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Cashier</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500 font-medium">
                      Loading orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 px-4 text-center">
                      {activeTab === 'recent' ? (
                        <div className="max-w-sm mx-auto space-y-2 text-center">
                          <div className="w-10 h-10 mx-auto rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center font-bold">
                            <CheckCheck className="w-5 h-5" />
                          </div>
                          <h4 className="text-sm font-black text-slate-900">Recent Orders is Clean!</h4>
                          <p className="text-[11px] text-slate-500 font-medium">
                            No active orders in current list. All previous orders have moved into Order History.
                          </p>
                          {counts.history > 0 && (
                            <button
                              type="button"
                              onClick={() => setActiveTab('history')}
                              className="text-xs text-indigo-700 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer pt-1"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>View Past Order History ({counts.history})</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="max-w-sm mx-auto space-y-1.5 text-center text-slate-500">
                          <Archive className="w-8 h-8 mx-auto text-slate-300" />
                          <h4 className="text-xs font-bold text-slate-700">No Archived Orders Found</h4>
                          <p className="text-[11px]">No order records match the selected date or search filter.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const isSelected = selectedOrder?.id === o.id;
                    return (
                      <tr
                        key={o.id}
                        onClick={() => setSelectedOrder(o)}
                        className={`transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/70 border-l-4 border-indigo-600'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-900">{o.receipt_number}</span>
                            {o.daily_closed && (
                              <span className="text-[9px] px-1 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold border border-slate-200">
                                Archived
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800">
                          {o.customer_name || 'Walk-in'}
                        </td>
                        <td className="px-3 py-3 text-slate-600 font-medium">
                          {o.cashier_name_snapshot}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                              o.status === 'completed'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : o.status === 'voided'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {o.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-indigo-700">
                          {formatMoney(o.grand_total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* GREEN BUTTON: Quick Print */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReprint(o);
                              }}
                              className="p-1.5 rounded-lg text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition cursor-pointer"
                              title="Print Thermal Receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {/* GREEN BUTTON: Edit & Customize Slip */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(o);
                                openReceiptEditModal(o);
                              }}
                              className="p-1.5 rounded-lg text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition cursor-pointer"
                              title="Edit Receipt Details & Print"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
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
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col">
          {selectedOrder ? (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">{selectedOrder.receipt_number}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                      selectedOrder.status === 'completed'
                        ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        : selectedOrder.status === 'voided'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {selectedOrder.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Items */}
                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedOrder.items?.map((it, idx) => (
                    <div key={it.id || idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div className="flex justify-between font-bold">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-900">{it.product_name_snapshot}</span>
                          {it.pricing_method && (
                            <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                              {it.pricing_method}
                            </span>
                          )}
                        </div>
                        <span className="text-indigo-700 font-black">{formatMoney(it.line_total)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 mt-0.5">
                        <span>{it.quantity} portion(s) @ {formatMoney(it.unit_price)}</span>
                        {it.refunded_quantity > 0 && (
                          <span className="text-rose-600 font-bold">
                            Refunded: {it.refunded_quantity}x
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculations */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs mt-3">
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>Subtotal:</span>
                    <span>{formatMoney(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Discount:</span>
                      <span className="text-indigo-700 font-bold">-{formatMoney(selectedOrder.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t border-slate-200">
                    <span>Grand Total:</span>
                    <span className="text-indigo-700">{formatMoney(selectedOrder.grand_total)}</span>
                  </div>
                </div>

                {selectedOrder.void_reason && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs mt-2 font-medium">
                    <strong>Void Reason:</strong> {selectedOrder.void_reason}
                  </div>
                )}
              </div>

              {/* Action Buttons strictly GREEN (action) and RED (destructive) */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                {/* GREEN BUTTON: Quick Print */}
                <button
                  type="button"
                  onClick={() => handleReprint(selectedOrder)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-black rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print Thermal Slip (1 Page)
                </button>

                {/* GREEN BUTTON: Edit Receipt Details */}
                <button
                  type="button"
                  onClick={() => openReceiptEditModal(selectedOrder)}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 active:bg-emerald-200 text-indigo-800 border border-indigo-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit className="w-4 h-4" /> Edit & Customize Slip Details
                </button>

                {selectedOrder.status !== 'voided' && (
                  <div className="grid grid-cols-2 gap-2">
                    {/* RED BUTTON: Refund */}
                    <button
                      type="button"
                      onClick={() => openRefundDialog(selectedOrder)}
                      className="py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" /> Refund
                    </button>
                    {/* RED BUTTON: Void */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowVoidModal(true);
                        setVoidPin('');
                        setVoidReason('');
                        setActionError('');
                      }}
                      className="py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Ban className="w-4 h-4" /> Void Order
                    </button>
                  </div>
                )}

                {/* RED BUTTON: Delete Order */}
                <button
                  type="button"
                  onClick={() => handleDeleteOrder(selectedOrder)}
                  className="w-full py-2 bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  title="Permanent removal with audit log"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Order (Admin)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16 text-center">
              <FileText className="w-10 h-10 mb-2 opacity-30 text-indigo-600" />
              <p className="text-xs font-bold text-slate-600">Select an order from the list to view breakdown & print</p>
            </div>
          )}
        </div>
      </div>

      {/* RECEIPT EDIT & CUSTOMIZE MODAL */}
      {showReceiptEditModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                <Edit className="w-5 h-5 text-indigo-600" />
                <span>Customize Receipt Slip - #{selectedOrder.receipt_number}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptEditModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer / Guest Name:</label>
                  <input
                    type="text"
                    value={receiptEditForm.customer_name}
                    onChange={(e) =>
                      setReceiptEditForm({ ...receiptEditForm, customer_name: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer Phone:</label>
                  <input
                    type="text"
                    value={receiptEditForm.customer_phone}
                    onChange={(e) =>
                      setReceiptEditForm({ ...receiptEditForm, customer_phone: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Custom Receipt Note (printed on slip):
                </label>
                <input
                  type="text"
                  value={receiptEditForm.custom_receipt_note}
                  onChange={(e) =>
                    setReceiptEditForm({ ...receiptEditForm, custom_receipt_note: e.target.value })
                  }
                  placeholder="e.g. VIP Guest / Special order / Paid via JazzCash"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Paper Roll Width:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReceiptEditForm({ ...receiptEditForm, paper_size: '80mm' })}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition cursor-pointer ${
                        receiptEditForm.paper_size === '80mm'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-700 border-slate-300'
                      }`}
                    >
                      80mm
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptEditForm({ ...receiptEditForm, paper_size: '58mm' })}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition cursor-pointer ${
                        receiptEditForm.paper_size === '58mm'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-700 border-slate-300'
                      }`}
                    >
                      58mm
                    </button>
                  </div>
                </div>

                <div className="flex items-center pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 font-semibold">
                    <input
                      type="checkbox"
                      checked={receiptEditForm.show_duplicate_watermark}
                      onChange={(e) =>
                        setReceiptEditForm({
                          ...receiptEditForm,
                          show_duplicate_watermark: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                    />
                    <span>Show Duplicate Banner</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {/* RED BUTTON: Cancel */}
              <button
                type="button"
                onClick={() => setShowReceiptEditModal(false)}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition"
              >
                Cancel
              </button>
              {/* GREEN BUTTON: Print Receipt */}
              <button
                type="button"
                onClick={handlePrintCustomReceipt}
                className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Thermal Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID MODAL */}
      {showVoidModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600 font-extrabold text-sm">
                <Ban className="w-5 h-5" />
                <span>Void Order #{selectedOrder.receipt_number}</span>
              </div>
              <button onClick={() => setShowVoidModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Voiding cancels this order and automatically reverses drawer cash.
            </p>

            {actionError && (
              <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Mandatory Void Reason:</label>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Customer cancelled / cashier error"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-rose-600 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Supervisor Admin PIN:</label>
              <input
                type="password"
                maxLength={6}
                value={voidPin}
                onChange={(e) => setVoidPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-center font-black text-lg text-slate-900 tracking-widest focus:outline-none focus:border-rose-600"
              />
            </div>

            <div className="flex gap-2 pt-2">
              {/* RED BUTTON: Cancel */}
              <button
                type="button"
                onClick={() => setShowVoidModal(false)}
                className="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              {/* RED BUTTON: Confirm Void */}
              <button
                type="button"
                onClick={handleExecuteVoid}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow"
              >
                Confirm Order Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ITEMIZED PARTIAL REFUND MODAL */}
      {showRefundModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                <span>Issue Itemized Refund - #{selectedOrder.receipt_number}</span>
              </div>
              <button onClick={() => setShowRefundModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Specify the exact portion quantity to refund for each item below:
            </p>

            {actionError && (
              <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold">
                {actionError}
              </div>
            )}

            {/* Line items list with quantity controls */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {selectedOrder.items?.map((it) => {
                const maxAllowed = Math.max(0, it.quantity - (it.refunded_quantity || 0));
                const currentRefundQty = refundItemSelection[it.id] || 0;

                return (
                  <div key={it.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{it.product_name_snapshot}</span>
                      <div className="text-[10px] text-slate-500 font-medium">
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
                        className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center text-xs text-slate-900 font-black"
                      />
                      <span className="text-xs text-indigo-700 font-black w-16 text-right">
                        {formatMoney(currentRefundQty * it.unit_price)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Mandatory Refund Reason:</label>
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Returned food / Not satisfied / Order mistake"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-rose-600 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Supervisor Admin PIN:</label>
              <input
                type="password"
                maxLength={6}
                value={refundPin}
                onChange={(e) => setRefundPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-center font-black text-lg text-slate-900 tracking-widest focus:outline-none focus:border-rose-600"
              />
            </div>

            <div className="flex gap-2 pt-2">
              {/* RED BUTTON: Cancel */}
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              {/* RED BUTTON: Execute Refund */}
              <button
                type="button"
                onClick={handleExecuteRefund}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow"
              >
                Execute Refund & Deduct Cash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DAILY CLOSING CONFIRMATION MODAL */}
      {showDailyCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                <Moon className="w-5 h-5 text-indigo-600" />
                <span>Execute Daily Closing (روزانہ کلوزنگ)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDailyCloseModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Closing the day will move all <strong>{orders.length} active order(s)</strong> into the <strong>Order History</strong> archive.
              </p>
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1.5 text-emerald-950 font-medium">
                <div className="flex justify-between">
                  <span>Active Orders to Archive:</span>
                  <span className="font-extrabold">{orders.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Sales Amount:</span>
                  <span className="font-extrabold text-indigo-800">
                    {formatMoney(orders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0))}
                  </span>
                </div>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                The <strong>Recent Orders</strong> list will start completely clean for tomorrow&apos;s new shift. You can review, search, and reprint these bills anytime in the <strong>Order History</strong> tab.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDailyCloseModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDailyClose}
                disabled={dailyClosingInProgress}
                className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {dailyClosingInProgress ? (
                  <span>Closing...</span>
                ) : (
                  <>
                    <CheckCheck className="w-4 h-4" />
                    <span>Confirm Daily Closing</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
