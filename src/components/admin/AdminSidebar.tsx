'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Utensils,
  Layers,
  Truck,
  BookOpen,
  FileText,
  Receipt,
  BarChart3,
  Printer,
  Usb,
  Users,
  ShieldAlert,
  Settings,
  ArrowLeft,
  Lock,
  ShieldCheck,
  Store,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  exact?: boolean;
  tab?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const AdminSidebar: React.FC = () => {
  return (
    <React.Suspense
      fallback={
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 shrink-0 shadow-sm">
          <div className="p-4 border-b border-slate-200 bg-white">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg">
              M
            </div>
          </div>
        </aside>
      }
    >
      <AdminSidebarInner />
    </React.Suspense>
  );
};

function AdminSidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const router = useRouter();
  const { currentUser, exitAdminMode } = useAuth();

  const handleLock = () => {
    exitAdminMode();
    router.push('/pos');
  };

  const navSections: NavSection[] = [
    {
      title: 'Main Operations',
      items: [
        { href: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard, exact: true },
        { href: '/orders', label: 'All Orders & Invoices', icon: Receipt },
        { href: '/daily-summary', label: 'Roozana Hisaab (Daily)', icon: FileText },
      ],
    },
    {
      title: 'Menu & Food Pricing',
      items: [
        { href: '/settings?tab=products', label: 'Menu Items & Pricing', icon: Utensils, tab: 'products' },
        { href: '/settings?tab=categories', label: 'Menu Categories', icon: Layers, tab: 'categories' },
      ],
    },
    {
      title: 'Inventory & Vendor Khata',
      items: [
        { href: '/purchases', label: 'Maal Ka Khareedar (Purchases)', icon: Truck },
        { href: '/vendors', label: 'Vendor Khata (Mandi Ledger)', icon: BookOpen },
      ],
    },
    {
      title: 'Reports & Audit',
      items: [
        { href: '/reports', label: 'Financial & Sales Reports', icon: BarChart3 },
        { href: '/audit-logs', label: 'Security & Audit Trail', icon: ShieldAlert },
      ],
    },
    {
      title: 'System & Print Setup',
      items: [
        { href: '/settings?tab=printer', label: 'Thermal Printer Devices', icon: Usb, tab: 'printer' },
        { href: '/settings?tab=receipt', label: 'Thermal Receipt Customizer', icon: Printer, tab: 'receipt' },
        { href: '/settings?tab=staff', label: 'Staff Accounts & PINs', icon: Users, tab: 'staff' },
        { href: '/settings?tab=hotel', label: 'General Hotel Settings', icon: Settings, tab: 'hotel' },
      ],
    },
  ];

  return (
    <aside className="w-72 bg-[#0F172A] border-r border-slate-800 flex flex-col h-screen sticky top-0 shrink-0 shadow-lg select-none z-30 text-slate-200">
      {/* Sidebar Header Brand */}
      <div className="p-3.5 border-b border-slate-800 bg-[#0F172A] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm font-black text-base shrink-0">
            <i className="fa-solid fa-utensils text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-extrabold text-sm text-white truncate tracking-tight">
              Malik Tasty Nashta Point
            </h2>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                <i className="fa-solid fa-shield-halved text-indigo-300 text-[10px]" />
                <span>Admin Unlocked</span>
              </span>
            </div>
          </div>
        </div>

        {currentUser && (
          <div className="mt-2.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center justify-between">
            <span className="font-medium text-slate-400">Supervisor:</span>
            <span className="font-extrabold text-white truncate">{currentUser.display_name || currentUser.full_name}</span>
          </div>
        )}
      </div>

      {/* Navigation Links Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-3">
        {navSections.map((sec, idx) => (
          <div key={idx}>
            <div className="px-2 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
              {sec.title}
            </div>
            <div className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon = item.icon;
                let isActive = false;
                if (item.tab) {
                  isActive = pathname === '/settings' && currentTab === item.tab;
                } else if (item.exact) {
                  isActive = pathname === item.href;
                } else {
                  isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white font-extrabold shadow-sm border-l-4 border-indigo-300'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar Footer Action Buttons */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/90 space-y-2 shrink-0">
        {/* TEAL BUTTON: Back to Cashier POS */}
        <Link
          href="/pos"
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow transition"
        >
          <i className="fa-solid fa-cash-register" />
          <span>Back to Cashier POS</span>
        </Link>

        {/* ROSE BUTTON: Lock & Exit Admin */}
        <button
          type="button"
          onClick={handleLock}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
        >
          <i className="fa-solid fa-lock" />
          <span>Lock Admin Panel</span>
        </button>
      </div>
    </aside>
  );
};
