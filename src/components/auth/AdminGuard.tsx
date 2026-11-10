'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, KeyRound, Lock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface AdminGuardProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({
  children,
  fallbackTitle = 'Admin Access Locked',
  fallbackDescription = 'This management section requires Master Admin PIN code.',
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
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in fade-in">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-white">{fallbackTitle}</h2>
          <p className="text-xs text-slate-400">{fallbackDescription}</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-semibold">
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
              className="w-full py-3 px-4 bg-slate-950 border border-slate-700 rounded-2xl text-center text-3xl font-black text-white tracking-[0.5em] focus:outline-none focus:border-amber-400 placeholder:text-slate-600 shadow-inner"
            />
          </div>

          <div className="flex gap-2">
            <Link
              href="/pos"
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to POS</span>
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-950/40 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>{loading ? 'Verifying...' : 'Unlock Panel'}</span>
            </button>
          </div>
        </form>

        <div className="pt-2 border-t border-slate-800/80">
          <p className="text-[11px] text-slate-500">
            Default Admin PIN: <span className="font-mono text-slate-400 font-bold">1234</span> (configurable in Settings)
          </p>
        </div>
      </div>
    </div>
  );
};

