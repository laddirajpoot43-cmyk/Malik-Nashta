'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Lock, ArrowLeft, KeyRound } from 'lucide-react';
import Link from 'next/link';

interface AdminGuardProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({
  children,
  fallbackTitle = 'Admin Access Locked',
  fallbackDescription = '',
}) => {
  const { isAdminMode, enterAdminMode } = useAuth();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAdminMode) {
    return <>{children}</>;
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setErrorMsg('Please enter Admin PIN.');
      return;
    }

    setLoading(true);
    const res = await enterAdminMode(pin.trim());
    setLoading(false);

    if (res.success) {
      setPin('');
      setErrorMsg('');
    } else {
      setErrorMsg(res.error || 'Invalid Admin PIN');
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 text-center animate-in fade-in">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold text-slate-900">{fallbackTitle}</h2>
          {fallbackDescription && <p className="text-xs text-slate-600 font-medium">{fallbackDescription}</p>}
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              autoFocus
              maxLength={6}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setErrorMsg('');
              }}
              placeholder="••••"
              className="w-full py-3 px-4 bg-slate-50 border border-slate-300 rounded-2xl text-center text-3xl font-black text-slate-900 tracking-[0.5em] focus:outline-none focus:border-emerald-600 placeholder:text-slate-400 shadow-inner"
            />
          </div>

          <div className="flex gap-2">
            {/* RED BUTTON: Back to POS */}
            <Link
              href="/pos"
              className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to POS</span>
            </Link>

            {/* GREEN BUTTON: Unlock Panel */}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs shadow transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{loading ? 'Verifying...' : 'Unlock Panel'}</span>
            </button>
          </div>
        </form>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-[11px] text-slate-500 font-medium">
            Default Admin PIN: <span className="font-mono text-slate-700 font-bold">1234</span>
          </p>
        </div>
      </div>
    </div>
  );
};
