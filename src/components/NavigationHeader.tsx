'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { formatMoney } from '@/lib/money';
import { AdminPinModal } from '@/components/modals/AdminPinModal';
import {
  UtensilsCrossed,
  Receipt,
  DollarSign,
  Truck,
  BookOpen,
  BarChart3,
  Settings,
  ShieldAlert,
  UserCheck,
  Clock,
  KeyRound,
  FileText,
  ChevronDown,
  Lock,
  Unlock,
  ShieldCheck,
} from 'lucide-react';

export const NavigationHeader: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { activeRegister, heldOrdersCount, setOpenRegisterModal, setOpenHeldOrdersModal } = usePOS();
  const { currentUser, users, switchUser, loginWithPin, isAdminMode, enterAdminMode, exitAdminMode } = useAuth();
  const { settings } = useSettings();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPinSwitchModal, setShowPinSwitchModal] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [pendingAdminUrl, setPendingAdminUrl] = useState<string | null>(null);

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Cashier counter links
  const cashierLinks = [
    { href: '/pos', label: 'POS Counter', icon: UtensilsCrossed },
    { href: '/orders', label: 'Orders & Refunds', icon: Receipt },
    { href: '/register', label: 'Cash Drawer', icon: DollarSign },
  ];

  // Admin exclusive links
  const adminLinks = [
    { href: '/purchases', label: 'Maal Kharidari', icon: Truck },
    { href: '/vendors', label: 'Vendor Khata', icon: BookOpen },
    { href: '/daily-summary', label: 'Roozana Hisaab', icon: FileText },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/audit-logs', label: 'Audit Trail', icon: ShieldAlert },
  ];

  const handleAdminLinkClick = (e: React.MouseEvent, href: string) => {
    if (!isAdminMode) {
      e.preventDefault();
      setPendingAdminUrl(href);
      setShowAdminPinModal(true);
    }
  };

  const handleAdminPinSuccess = async (pin: string) => {
    const res = await enterAdminMode(pin);
    if (res.success) {
      setShowAdminPinModal(false);
      if (pendingAdminUrl) {
        router.push(pendingAdminUrl);
        setPendingAdminUrl(null);
      }
    }
  };

  const handlePinSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;
    const res = await loginWithPin(pinInput);
    if (res.success) {
      setShowPinSwitchModal(false);
      setPinInput('');
      setPinError('');
    } else {
      setPinError(res.error || 'Invalid PIN code');
    }
  };

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
        {/* Top Operational Bar */}
        <div className="max-w-[1700px] mx-auto px-4 py-2 flex items-center justify-between gap-4 border-b border-slate-800/60">
          {/* Logo & Hotel Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-900/30">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-wide text-white uppercase">
                  {settings.business_name || 'MALIK TASTY NASHTA POINT'}
                </span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Hasilpur Edition
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Vehari Road, Hasilpur • Morning Rush Edition (5:30 AM - 12:30 PM)
              </p>
            </div>
          </div>

          {/* Center Badges: Drawer Shift & Held Carts */}
          <div className="flex items-center gap-3">
            {/* Cash Drawer Status Pill */}
            {activeRegister ? (
              <button
                onClick={() => setOpenRegisterModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 hover:bg-emerald-900/40 transition group cursor-pointer"
                title="Click to view Cash Drawer details"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <div className="text-left">
                  <div className="text-[11px] font-bold text-emerald-300 leading-none">Drawer OPEN</div>
                  <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                    Float: {formatMoney(activeRegister.opening_amount)}
                  </div>
                </div>
              </button>
            ) : (
              <button
                onClick={() => setOpenRegisterModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-500 hover:bg-rose-900/70 transition cursor-pointer animate-pulse"
                title="Click to open Cash Register Shift"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-xs font-black text-rose-200">DRAWER CLOSED (Click to Open)</span>
              </button>
            )}

            {/* Held Orders Badge */}
            {heldOrdersCount > 0 && (
              <button
                onClick={() => setOpenHeldOrdersModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500/50 hover:bg-amber-900/40 text-amber-300 text-xs font-bold transition cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>Held Dining Orders ({heldOrdersCount})</span>
              </button>
            )}
          </div>

          {/* Right Controls: Admin Lock/Unlock Status & User Switcher */}
          <div className="flex items-center gap-2.5 relative">
            {/* Admin Mode Status Toggle Button */}
            {isAdminMode ? (
              <button
                type="button"
                onClick={exitAdminMode}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold shadow-md shadow-amber-950/50 border border-amber-500/40 transition cursor-pointer"
                title="Admin Mode is ACTIVE. Click to lock back to Cashier Mode."
              >
                <ShieldCheck className="w-4 h-4 text-amber-200 animate-pulse" />
                <span>Admin Unlocked (Lock)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPendingAdminUrl(null);
                  setShowAdminPinModal(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer"
                title="Enter PIN to unlock Admin Panel"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Unlock Admin</span>
              </button>
            )}

            <button
              onClick={() => setShowPinSwitchModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition"
              title="Quick PIN Login / Cashier Switch"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-medium hidden sm:inline">Switch Staff</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition"
              >
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <div className="text-left hidden md:block">
                  <div className="font-bold text-white leading-none">
                    {currentUser?.display_name || currentUser?.full_name || 'Staff'}
                  </div>
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold">
                    {currentUser?.role || 'Cashier'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in">
                  <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Switch Active Staff
                  </div>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        switchUser(u.id);
                        setShowUserDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                        currentUser?.id === u.id ? 'bg-emerald-950/40 text-emerald-400 font-bold' : 'text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{u.display_name || u.full_name}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{u.email}</div>
                      </div>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold">
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar with Cashier vs Admin separation */}
        <nav className="max-w-[1700px] mx-auto px-4 flex items-center justify-between gap-1 overflow-x-auto text-xs font-semibold py-1.5">
          {/* Cashier Group */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 py-1 bg-slate-950 rounded border border-slate-800 hidden sm:inline">
              Cashier POS
            </span>
            {cashierLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-slate-800 mx-2 hidden md:block" />

          {/* Admin Group */}
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950 border border-slate-800">
              {isAdminMode ? (
                <Unlock className="w-3 h-3 text-emerald-400" />
              ) : (
                <Lock className="w-3 h-3 text-amber-400" />
              )}
              <span className="text-[10px] font-black uppercase text-amber-400/90 tracking-wider">
                Admin Panel
              </span>
            </div>

            {adminLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleAdminLinkClick(e, item.href)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-sm font-bold'
                      : isAdminMode
                      ? 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/50'
                  }`}
                  title={!isAdminMode ? 'Requires Admin PIN' : undefined}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : isAdminMode ? 'text-slate-400' : 'text-amber-500/70'}`} />
                  <span>{item.label}</span>
                  {!isAdminMode && <Lock className="w-2.5 h-2.5 text-amber-400/70 ml-0.5" />}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Admin PIN Unlock Modal */}
      <AdminPinModal
        isOpen={showAdminPinModal}
        title="Admin Panel PIN Verification"
        description="Enter the Master Admin PIN (default: 1234) to unlock management functions, reports, raw materials, vendor khata, and template settings."
        onSuccess={handleAdminPinSuccess}
        onCancel={() => {
          setShowAdminPinModal(false);
          setPendingAdminUrl(null);
        }}
      />

      {/* Quick Staff Switch PIN Modal */}
      {showPinSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <KeyRound className="w-5 h-5 text-emerald-400" />
                <span>Quick Staff PIN Login</span>
              </div>
              <button onClick={() => setShowPinSwitchModal(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Enter your assigned 4-digit staff PIN code to switch counter operator.
            </p>

            {pinError && (
              <div className="p-2 bg-rose-500/20 border border-rose-500/40 rounded-lg text-rose-300 text-xs text-center font-semibold">
                {pinError}
              </div>
            )}

            <form onSubmit={handlePinSwitch} className="space-y-3">
              <input
                type="password"
                autoFocus
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError('');
                }}
                placeholder="••••"
                className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-center text-2xl font-black text-white tracking-[0.5em] focus:outline-none focus:border-emerald-500"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinSwitchModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition"
                >
                  Login Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
