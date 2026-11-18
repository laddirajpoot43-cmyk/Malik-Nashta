'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { formatMoney } from '@/lib/money';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { AdminCharts } from '@/components/admin/AdminCharts';
import {
  TrendingUp,
  DollarSign,
  Truck,
  ArrowRight,
} from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <AdminGuard fallbackTitle="Admin Panel Locked">
      <AdminDashboardContent />
    </AdminGuard>
  );
}

function AdminDashboardContent() {
  const { activeRegister } = usePOS();
  const { currentUser } = useAuth();

  const [metrics, setMetrics] = useState<{
    todaySales: number;
    todayOrdersCount: number;
    drawerBalance: number;
    unpaidVendorBalance: number;
    loading: boolean;
  }>({
    todaySales: 0,
    todayOrdersCount: 0,
    drawerBalance: 0,
    unpaidVendorBalance: 0,
    loading: true,
  });

  useEffect(() => {
    async function loadMetrics() {
      try {
        const [sumRes, vendRes] = await Promise.all([
          fetch('/api/daily-summary'),
          fetch('/api/vendors'),
        ]);

        const sumData = await sumRes.json();
        const vendData = await vendRes.json();

        const todaySales = Number(sumData?.sales?.net_sales ?? sumData?.summary?.net_sales ?? 0);
        const todayOrdersCount = Number(sumData?.sales?.total_orders ?? sumData?.summary?.total_orders ?? 0);
        const drawerBalance = Number(activeRegister?.expected_amount || activeRegister?.opening_amount || 0);

        let unpaidVend = 0;
        if (vendData.success && Array.isArray(vendData.vendors)) {
          unpaidVend = vendData.vendors.reduce(
            (acc: number, v: any) => acc + Number(v.current_balance || 0),
            0
          );
        }

        setMetrics({
          todaySales,
          todayOrdersCount,
          drawerBalance,
          unpaidVendorBalance: unpaidVend,
          loading: false,
        });
      } catch (e) {
        console.error('Failed to load admin metrics', e);
        setMetrics((prev) => ({ ...prev, loading: false }));
      }
    }

    loadMetrics();
  }, [activeRegister]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Admin Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Active Supervisor
            </span>
          </div>
        </div>

        {/* GREEN BUTTON: Jump to POS */}
        <Link
          href="/pos"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow transition shrink-0 cursor-pointer"
        >
          <span>Open Cashier Counter (POS)</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* KPI Overview Cards (3 Cards cleanly formatted) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Today's Net Sales */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today&apos;s Sales</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatMoney(metrics.todaySales)}
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            Across <strong>{metrics.todayOrdersCount}</strong> completed orders today
          </p>
        </div>

        {/* Cash Drawer Shift Balance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Drawer Cash</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatMoney(metrics.drawerBalance)}
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            Status: {activeRegister ? <span className="text-emerald-700 font-bold">Shift Open</span> : <span className="text-slate-500 font-semibold">Shift Closed</span>}
          </p>
        </div>

        {/* Unpaid Vendor Udhaar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor Udhaar (Payable)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600">
            {formatMoney(metrics.unpaidVendorBalance)}
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            Pending Mandi & Supplier balances
          </p>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <AdminCharts />
    </div>
  );
}
