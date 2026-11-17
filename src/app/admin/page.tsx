'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { formatMoney } from '@/lib/money';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import {
  Utensils,
  Truck,
  BookOpen,
  FileText,
  Receipt,
  BarChart3,
  Printer,
  Users,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Layers,
  Settings,
  AlertCircle,
} from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <AdminGuard
      fallbackTitle="Admin Control Center Locked"
      fallbackDescription="Please enter Supervisor / Admin PIN to access the main management dashboard."
    >
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

  const quickActionCards = [
    {
      title: 'Menu Items & Pricing',
      desc: 'Set plate prices, custom rates, By Price options, and availability.',
      href: '/settings?tab=products',
      icon: Utensils,
      btnLabel: 'Manage Menu',
    },
    {
      title: 'Maal Ka Khareedar (Purchases)',
      desc: 'Record Mandi invoices, raw material purchases, and cash deductions.',
      href: '/purchases',
      icon: Truck,
      btnLabel: 'Open Purchases',
    },
    {
      title: 'Vendor Khata (Ledger)',
      desc: 'Track vendor balances, payments, purchase history, and udhaar.',
      href: '/vendors',
      icon: BookOpen,
      btnLabel: 'View Khatas',
    },
    {
      title: 'Roozana Hisaab (Daily)',
      desc: 'Daily sales closing, net income, cash drawer vs expected, and audits.',
      href: '/daily-summary',
      icon: FileText,
      btnLabel: 'Daily Summary',
    },
    {
      title: 'Thermal Receipt Customizer',
      desc: 'Edit hotel branding, Urdu greetings, 80mm/58mm widths, and slip details.',
      href: '/settings?tab=receipt',
      icon: Printer,
      btnLabel: 'Edit Receipt',
    },
    {
      title: 'All Orders & Invoices',
      desc: 'Lookup customer bills, reprint thermal slips, process refunds or void.',
      href: '/orders',
      icon: Receipt,
      btnLabel: 'View Orders',
    },
    {
      title: 'Financial Reports',
      desc: 'Detailed item-wise sales analysis, hourly trends, and Excel exports.',
      href: '/reports',
      icon: BarChart3,
      btnLabel: 'Open Reports',
    },
    {
      title: 'Staff Accounts & PINs',
      desc: 'Configure cashier profiles, supervisor master PIN, and role permissions.',
      href: '/settings?tab=staff',
      icon: Users,
      btnLabel: 'Manage Staff',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Admin & Management Portal (انتظامی کنٹرول پینل)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Active Supervisor
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Welcome, <strong>{currentUser?.display_name || currentUser?.full_name || 'Admin'}</strong>. Complete control over hotel menu, vendor khata, mandi purchases, receipts, and accounts.
          </p>
        </div>

        {/* GREEN BUTTON: Jump to POS */}
        <Link
          href="/pos"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow transition shrink-0"
        >
          <span>Open Cashier Counter (POS)</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Net Sales */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
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
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
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
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
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

        {/* System Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Security & Access</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-extrabold text-slate-900">
            PIN Protected
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            Cashiers locked out of admin tabs
          </p>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div>
        <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3">
          Administrative Modules & Controls
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActionCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-900 mb-1">{card.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{card.desc}</p>
                </div>

                {/* GREEN BUTTON: Quick action button */}
                <Link
                  href={card.href}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  <span>{card.btnLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
