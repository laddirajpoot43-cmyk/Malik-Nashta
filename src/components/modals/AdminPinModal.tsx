'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, X } from 'lucide-react';

interface AdminPinModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onSuccess: (pin: string) => void;
  onCancel: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  title = 'Supervisor Authentication Required',
  description = 'Please enter Master Admin / Supervisor PIN to continue.',
  onSuccess,
  onCancel,
}) => {
  const { verifyAdminPin } = useAuth();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setErrorMsg('Please enter PIN');
      return;
    }

    setLoading(true);
    const valid = await verifyAdminPin(pin);
    setLoading(false);

    if (valid) {
      onSuccess(pin.trim());
      setPin('');
      setErrorMsg('');
    } else {
      setErrorMsg('Invalid Supervisor PIN. Access Denied.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span>{title}</span>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300">{description}</p>

        {errorMsg && (
          <div className="p-2 bg-rose-500/20 border border-rose-500/40 rounded-lg text-rose-300 text-xs text-center font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            autoFocus
            maxLength={6}
            value={pin}
            onChange={(e) => { setPin(e.target.value); setErrorMsg(''); }}
            placeholder="••••"
            className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-center text-2xl font-black text-white tracking-[0.5em] focus:outline-none focus:border-amber-400"
          />

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            >
              Cancel (Esc)
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-md transition"
            >
              {loading ? 'Verifying...' : 'Authorize'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

