'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Lock, X } from 'lucide-react';

interface AdminPinModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onSuccess: (pin: string) => void;
  onCancel: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  title = 'Admin Authentication',
  description = 'Please enter Admin PIN to continue.',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
            <Lock className="w-4 h-4 text-indigo-600" />
            <span>{title}</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 font-medium">{description}</p>

        {errorMsg && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs text-center font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
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
            className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-center text-2xl font-black text-slate-900 tracking-[0.5em] focus:outline-none focus:border-indigo-600 shadow-inner"
          />

          <div className="flex gap-2 pt-2">
            {/* RED BUTTON: Cancel */}
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-sm transition cursor-pointer"
            >
              Cancel (Esc)
            </button>
            {/* GREEN BUTTON: Authorize */}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Verifying...' : 'Unlock Panel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
