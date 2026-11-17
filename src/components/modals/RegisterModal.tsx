'use client';

import React, { useState, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/money';
import { DollarSign, ArrowDownRight, ArrowUpRight, Lock, CheckCircle2, AlertTriangle, X } from 'lucide-react';

export const RegisterModal: React.FC = () => {
  const { openRegisterModal, setOpenRegisterModal, activeRegister, refreshPOSData } = usePOS();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'status' | 'open' | 'cash_in' | 'cash_out' | 'close'>('status');
  const [openingAmount, setOpeningAmount] = useState<string>('5000');
  const [inOutAmount, setInOutAmount] = useState<string>('');
  const [inOutReason, setInOutReason] = useState<string>('');
  const [actualAmount, setActualAmount] = useState<string>('');
  const [closingNote, setClosingNote] = useState<string>('');
  const [registerSummary, setRegisterSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const fetchRegisterDetails = async () => {
    try {
      const res = await fetch('/api/register');
      const data = await res.json();
      if (data.success) {
        setRegisterSummary(data.summary || null);
        if (!data.hasOpenShift) {
          setActiveTab('open');
        } else {
          setActiveTab('status');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (openRegisterModal) {
      setErrorMsg('');
      setSuccessMsg('');
      fetchRegisterDetails();
    }
  }, [openRegisterModal]);

  if (!openRegisterModal) return null;

  const handleOpenShift = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open',
          opening_amount: parseFloat(openingAmount) || 5000,
          cashier_name: currentUser?.display_name || currentUser?.full_name || 'Admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Register shift opened successfully!');
        await refreshPOSData();
        await fetchRegisterDetails();
      } else {
        setErrorMsg(data.error || 'Failed to open shift');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCashMovement = async (type: 'cash_in' | 'cash_out') => {
    const amt = parseFloat(inOutAmount);
    if (!amt || amt <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }
    if (!inOutReason.trim()) {
      setErrorMsg('Please enter a reason for this cash movement.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: type,
          amount: amt,
          reason: inOutReason.trim(),
          cashier_name: currentUser?.display_name || currentUser?.full_name || 'Cashier',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Cash ${type === 'cash_in' ? 'In' : 'Out'} recorded successfully!`);
        setInOutAmount('');
        setInOutReason('');
        await refreshPOSData();
        await fetchRegisterDetails();
        setActiveTab('status');
      } else {
        setErrorMsg(data.error || 'Transaction failed');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    const actual = parseFloat(actualAmount);
    if (isNaN(actual) || actual < 0) {
      setErrorMsg('Please enter the physically counted cash amount.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          actual_amount: actual,
          closing_note: closingNote.trim(),
          cashier_name: currentUser?.display_name || currentUser?.full_name || 'Cashier',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Shift closed and reconciled successfully!');
        await refreshPOSData();
        await fetchRegisterDetails();
      } else {
        setErrorMsg(data.error || 'Failed to close shift');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${activeRegister ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Cash Register & Drawer Shift</h2>
              <p className="text-xs text-slate-500">
                Status:{' '}
                <span className={`font-semibold ${activeRegister ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {activeRegister ? `OPEN (Opened by ${activeRegister.user_name_snapshot})` : 'CLOSED'}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpenRegisterModal(false)}
            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 text-xs font-semibold px-4 pt-2">
          {activeRegister ? (
            <>
              <button
                onClick={() => { setActiveTab('status'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`px-4 py-2 border-b-2 transition ${activeTab === 'status' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                Drawer Status
              </button>
              <button
                onClick={() => { setActiveTab('cash_in'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`px-4 py-2 border-b-2 transition flex items-center gap-1 ${activeTab === 'cash_in' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" /> Cash In
              </button>
              <button
                onClick={() => { setActiveTab('cash_out'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`px-4 py-2 border-b-2 transition flex items-center gap-1 ${activeTab === 'cash_out' ? 'border-rose-600 text-rose-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" /> Cash Out
              </button>
              <button
                onClick={() => { setActiveTab('close'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`px-4 py-2 border-b-2 transition flex items-center gap-1 ${activeTab === 'close' ? 'border-rose-600 text-rose-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                <Lock className="w-3.5 h-3.5 text-rose-600" /> Close Shift
              </button>
            </>
          ) : (
            <button
              onClick={() => setActiveTab('open')}
              className="px-4 py-2 border-b-2 border-emerald-600 text-emerald-700 font-bold"
            >
              Open Register Shift
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB: STATUS */}
          {activeTab === 'status' && registerSummary && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Expected Cash in Drawer</span>
                <div className="text-3xl font-black text-emerald-600 mt-1">
                  {formatMoney(registerSummary.expected_cash)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Opening + Cash Sales + Cash In - Cash Out - Refunds
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-slate-500">Opening Float:</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{formatMoney(registerSummary.opening_float)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-slate-500">Cash Sales:</span>
                  <p className="font-bold text-emerald-600 text-sm mt-0.5">{formatMoney(registerSummary.cash_sales)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-slate-500">Cash In (Added):</span>
                  <p className="font-bold text-emerald-600 text-sm mt-0.5">{formatMoney(registerSummary.cash_in)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-slate-500">Cash Out (Petty Expenses):</span>
                  <p className="font-bold text-rose-600 text-sm mt-0.5">-{formatMoney(registerSummary.cash_out)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-slate-500">Refunds Paid:</span>
                  <p className="font-bold text-rose-600 text-sm mt-0.5">-{formatMoney(registerSummary.refunds)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-slate-500">Digital Sales (JazzCash/Bank):</span>
                  <p className="font-bold text-blue-600 text-sm mt-0.5">{formatMoney(registerSummary.digital_sales)}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: OPEN SHIFT */}
          {activeTab === 'open' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                To start billing at the counter, please count and record the starting cash float in the drawer.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Starting Float Cash (PKR):
                </label>
                <input
                  type="number"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  placeholder="5000"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2">
                {[2000, 3000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOpeningAmount(String(amt))}
                    className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700 border border-slate-200 font-semibold transition"
                  >
                    Rs. {amt}
                  </button>
                ))}
              </div>

              <button
                onClick={handleOpenShift}
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md transition mt-2"
              >
                {loading ? 'Opening...' : 'Confirm & Open Register Shift'}
              </button>
            </div>
          )}

          {/* TAB: CASH IN */}
          {activeTab === 'cash_in' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Record float addition or change cash added to the counter drawer.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount to Add (PKR):</label>
                <input
                  type="number"
                  value={inOutAmount}
                  onChange={(e) => setInOutAmount(e.target.value)}
                  placeholder="e.g. 2000"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-emerald-600 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / تفصیل:</label>
                <input
                  type="text"
                  value={inOutReason}
                  onChange={(e) => setInOutReason(e.target.value)}
                  placeholder="e.g. Change float from Malik Sahib / bank"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={() => handleCashMovement('cash_in')}
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md transition"
              >
                {loading ? 'Processing...' : 'Confirm Cash In'}
              </button>
            </div>
          )}

          {/* TAB: CASH OUT */}
          {activeTab === 'cash_out' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Record petty cash expenses paid directly from the counter drawer (e.g. Ice, Tea leaves, Emergency milk).
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount to Deduct (PKR):</label>
                <input
                  type="number"
                  value={inOutAmount}
                  onChange={(e) => setInOutAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-rose-600 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / تفصیل:</label>
                <input
                  type="text"
                  value={inOutReason}
                  onChange={(e) => setInOutReason(e.target.value)}
                  placeholder="e.g. Baraf (Ice) khareedi, Chai Patti, Safai"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <button
                onClick={() => handleCashMovement('cash_out')}
                disabled={loading}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-md transition"
              >
                {loading ? 'Processing...' : 'Confirm Cash Out Expense'}
              </button>
            </div>
          )}

          {/* TAB: CLOSE SHIFT */}
          {activeTab === 'close' && registerSummary && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">System Expected Cash:</span>
                  <span className="font-bold text-emerald-600">{formatMoney(registerSummary.expected_cash)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Physically Counted Drawer Cash (گنی ہوئی رقم):
                </label>
                <input
                  type="number"
                  value={actualAmount}
                  onChange={(e) => setActualAmount(e.target.value)}
                  placeholder="Enter physical cash in drawer"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-black text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {actualAmount !== '' && !isNaN(parseFloat(actualAmount)) && (
                <div className="p-3 rounded-lg border text-xs flex justify-between items-center bg-slate-50 border-slate-200">
                  <span className="text-slate-600 font-medium">Reconciliation Discrepancy:</span>
                  <span
                    className={`font-black text-sm ${
                      parseFloat(actualAmount) - registerSummary.expected_cash === 0
                        ? 'text-emerald-600'
                        : parseFloat(actualAmount) - registerSummary.expected_cash < 0
                        ? 'text-rose-600'
                        : 'text-blue-600'
                    }`}
                  >
                    {formatMoney(parseFloat(actualAmount) - registerSummary.expected_cash)}
                    {parseFloat(actualAmount) - registerSummary.expected_cash === 0 && ' (Perfect Match)'}
                    {parseFloat(actualAmount) - registerSummary.expected_cash < 0 && ' (Cash Shortage)'}
                    {parseFloat(actualAmount) - registerSummary.expected_cash > 0 && ' (Cash Surplus)'}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Shift Handover Remarks:</label>
                <input
                  type="text"
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  placeholder="e.g. Shift balanced, all receipts verified"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                onClick={handleCloseShift}
                disabled={loading}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-md transition"
              >
                {loading ? 'Closing...' : 'Confirm Physical Count & Close Register Shift'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

