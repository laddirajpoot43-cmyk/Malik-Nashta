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
  const { activeRegister, heldOrdersCount, setOpenRegisterModal, setOpenHeldOrdersModal } = usePOS();
  const { currentUser, users, switchUser, loginWithPin, isAdminMode, enterAdminMode } = useAuth();
  const { settings } = useSettings();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPinSwitchModal, setShowPinSwitchModal] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);

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
            {/* Cash Drawer Status Pill */}
            {activeRegister ? (
              <button
                type="button"
                onClick={() => setOpenRegisterModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition group cursor-pointer"
                title="Click to view Cash Drawer details"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="text-left">
                  <div className="text-[11px] font-bold text-emerald-800 leading-none">Drawer OPEN</div>
                  <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                    Float: {formatMoney(activeRegister.opening_amount)}
                  </div>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOpenRegisterModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-300 hover:bg-rose-100 transition cursor-pointer"
                title="Click to open Cash Register Shift"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                <span className="text-xs font-black text-rose-700">DRAWER CLOSED (Click to Open)</span>
              </button>
            )}

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
