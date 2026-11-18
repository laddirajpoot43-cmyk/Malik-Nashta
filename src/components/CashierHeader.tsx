'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { formatMoney } from '@/lib/money';
import { AdminPinModal } from '@/components/modals/AdminPinModal';
import {
  UtensilsCrossed,
  Clock,
  KeyRound,
  UserCheck,
  ChevronDown,
  Lock,
  Unlock,
  Receipt,
  DollarSign,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

export const CashierHeader: React.FC = () => {
  const router = useRouter();
  const { activeRegister, heldOrdersCount, setOpenRegisterModal, openRegisterWithTab, setOpenHeldOrdersModal } = usePOS();
  const { currentUser, users, switchUser, loginWithPin, isAdminMode, enterAdminMode } = useAuth();
  const { settings } = useSettings();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPinSwitchModal, setShowPinSwitchModal] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [drawerHeaderMenuOpen, setDrawerHeaderMenuOpen] = useState(false);
  const drawerHeaderMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (drawerHeaderMenuRef.current && !drawerHeaderMenuRef.current.contains(event.target as Node)) {
        setDrawerHeaderMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const handleAdminClick = () => {
    if (isAdminMode) {
      router.push('/admin');
    } else {
      setShowAdminPinModal(true);
    }
  };

  const handleAdminPinSuccess = async (pin: string) => {
    const res = await enterAdminMode(pin);
    if (res.success) {
      setShowAdminPinModal(false);
      router.push('/admin');
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
      <header className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-40 shadow-sm select-none">
        <div className="max-w-[1700px] mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          {/* Logo & Hotel Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm font-black text-lg">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900 uppercase">
                  {settings.business_name || 'MALIK TASTY NASHTA POINT'}
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  POS Counter
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {settings.address || 'Vehari Road, Hasilpur'}
              </p>
            </div>
          </div>

          {/* Center Badges: Drawer Shift & Held Carts */}
          <div className="flex items-center gap-2.5">
            {/* Cash Drawer Status Pill & Dropdown */}
            <div className="relative" ref={drawerHeaderMenuRef}>
              <button
                type="button"
                onClick={() => setDrawerHeaderMenuOpen(!drawerHeaderMenuOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition cursor-pointer shadow-sm ${
                  activeRegister
                    ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 hover:bg-rose-100 text-rose-900'
                }`}
                title="Click to update Drawer Status (Open / Close)"
              >
                <span className={`w-2.5 h-2.5 rounded-full ${activeRegister ? 'bg-emerald-500 animate-pulse' : 'bg-rose-600'}`} />
                <div className="text-left">
                  <div className="text-[11px] font-black leading-none flex items-center gap-1.5">
                    <span>DRAWER {activeRegister ? 'OPEN' : 'CLOSED'}</span>
                    <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${drawerHeaderMenuOpen ? 'rotate-180' : ''}`} />
                  </div>
                  <div className="text-[10px] font-semibold mt-0.5 text-slate-600">
                    {activeRegister ? `Float: ${formatMoney(activeRegister.opening_amount)}` : 'Update Status ▾'}
                  </div>
                </div>
              </button>

              {drawerHeaderMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95">
                  <div className="px-2.5 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Drawer Status / حالت
                  </div>

                  {/* Option: OPEN */}
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerHeaderMenuOpen(false);
                      openRegisterWithTab('open');
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      activeRegister ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Option: OPEN (کھولیں)</span>
                    </span>
                    {activeRegister && <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-black">Active</span>}
                  </button>

                  {/* Option: CLOSE */}
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerHeaderMenuOpen(false);
                      openRegisterWithTab('close');
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      !activeRegister ? 'bg-rose-50 text-rose-900 border border-rose-200' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>Option: CLOSE (بند کریں)</span>
                    </span>
                    {!activeRegister && <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-black">Active</span>}
                  </button>

                  <div className="border-t border-slate-100 my-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerHeaderMenuOpen(false);
                        openRegisterWithTab('status');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-100 font-semibold transition"
                    >
                      Drawer Summary & Petty Cash
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Held Orders Badge */}
            {heldOrdersCount > 0 && (
              <button
                type="button"
                onClick={() => setOpenHeldOrdersModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-800 text-xs font-bold transition cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                <span>Held Bills ({heldOrdersCount})</span>
              </button>
            )}

            {/* Quick Link to Past Invoices / Bills */}
            <Link
              href="/orders"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold transition"
              title="View completed customer bills & reprint slips"
            >
              <Receipt className="w-3.5 h-3.5 text-slate-600" />
              <span>Bills / History</span>
            </Link>
          </div>

          {/* Right Controls: Prominent Admin Panel Lock Button & User Switcher */}
          <div className="flex items-center gap-2.5">
            {/* GREEN BUTTON: ADMIN PANEL WITH LOCK ICON */}
            <button
              type="button"
              onClick={handleAdminClick}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs shadow transition cursor-pointer"
              title={isAdminMode ? 'Open Admin Dashboard' : 'Unlock Admin Panel with PIN'}
            >
              {isAdminMode ? (
                <>
                  <Unlock className="w-4 h-4 text-white" />
                  <span>Admin Panel (Open)</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-white" />
                  <span>Admin Panel</span>
                </>
              )}
            </button>

            {/* Cashier Switch Button */}
            <button
              type="button"
              onClick={() => setShowPinSwitchModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs text-slate-700 font-semibold transition cursor-pointer"
              title="Quick PIN Login / Cashier Switch"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Switch</span>
            </button>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs text-slate-800 transition cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <div className="text-left hidden md:block">
                  <div className="font-bold text-slate-900 leading-none">
                    {currentUser?.display_name || currentUser?.full_name || 'Cashier'}
                  </div>
                  <span className="text-[10px] text-emerald-700 uppercase font-bold">
                    {currentUser?.role || 'Staff'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 animate-in fade-in">
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Switch Active Staff
                  </div>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        switchUser(u.id);
                        setShowUserDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition cursor-pointer ${
                        currentUser?.id === u.id ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{u.display_name || u.full_name}</div>
                        <div className="text-[10px] text-slate-500">{u.email}</div>
                      </div>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Admin PIN Unlock Modal */}
      <AdminPinModal
        isOpen={showAdminPinModal}
        title="Admin Panel Authorization"
        description="Enter the Master Admin PIN (default: 1234) to access Vendor Khata, Mandi Purchases, Menu Items, Thermal Receipt Editor, and Reports."
        onSuccess={handleAdminPinSuccess}
        onCancel={() => setShowAdminPinModal(false)}
      />

      {/* Quick Staff Switch PIN Modal */}
      {showPinSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <KeyRound className="w-5 h-5 text-emerald-600" />
                <span>Quick Staff PIN Login</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPinSwitchModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Enter your assigned 4-digit staff PIN code to switch counter operator.
            </p>

            {pinError && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs text-center font-semibold">
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
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-center text-2xl font-black text-slate-900 tracking-[0.5em] focus:outline-none focus:border-emerald-600"
              />

              <div className="flex gap-2 pt-2">
                {/* RED BUTTON: Cancel */}
                <button
                  type="button"
                  onClick={() => setShowPinSwitchModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition"
                >
                  Cancel
                </button>
                {/* GREEN BUTTON: Login */}
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow transition"
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
