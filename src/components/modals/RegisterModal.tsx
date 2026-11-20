'use client';

import React, { useState, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/money';
import { DollarSign, ArrowDownRight, ArrowUpRight, Lock, CheckCircle2, AlertTriangle, X } from 'lucide-react';

export const RegisterModal: React.FC = () => {
  const {
    openRegisterModal,
    setOpenRegisterModal,
    activeRegister,
    refreshPOSData,
    registerModalTab,
  } = usePOS();
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

  const fetchRegisterDetails = async (preferredTab?: 'status' | 'open' | 'cash_in' | 'cash_out' | 'close') => {
    try {
      const res = await fetch('/api/register', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setRegisterSummary(data.summary || null);
        if (preferredTab) {
          setActiveTab(preferredTab);
        } else if (!data.hasOpenShift) {
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
      if (registerModalTab) {
        setActiveTab(registerModalTab);
      }
      fetchRegisterDetails(registerModalTab);
    }
  }, [openRegisterModal, registerModalTab]);

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
            <div className={`p-2 rounded-lg ${activeRegister ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Cash Register & Drawer Shift</h2>
              <p className="text-xs text-slate-500">
                Status:{' '}
                <span className={`font-semibold ${activeRegister ? 'text-indigo-600' : 'text-rose-600'}`}>
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

        {/* Drawer Status Update Section */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">دراز کی حالت منتخب کریں (Update Drawer Status):</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1.5 ${
              activeRegister ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${activeRegister ? 'bg-indigo-600 animate-pulse' : 'bg-rose-600'}`} />
              <span>{activeRegister ? 'CURRENT: OPEN' : 'CURRENT: CLOSED'}</span>
            </span>
          </div>

          {/* TWO PRIMARY OPTIONS: OPEN and CLOSE */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setActiveTab('open'); setErrorMsg(''); setSuccessMsg(''); }}
              className={`p-2.5 rounded-xl border text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'open'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-500/30'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${activeTab === 'open' ? 'text-white' : 'text-indigo-600'}`} />
              <span>Option: OPEN (کھولیں)</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('close'); setErrorMsg(''); setSuccessMsg(''); }}
              className={`p-2.5 rounded-xl border text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'close'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-500/30'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Lock className={`w-4 h-4 ${activeTab === 'close' ? 'text-white' : 'text-rose-600'}`} />
              <span>Option: CLOSE (بند کریں)</span>
            </button>
          </div>

          {/* Sub Navigation Bar for Details / Petty cash */}
          <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-200 text-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Other:</span>
            <button
              type="button"
              onClick={() => { setActiveTab('status'); setErrorMsg(''); setSuccessMsg(''); }}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                activeTab === 'status' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Summary & History
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('cash_in'); setErrorMsg(''); setSuccessMsg(''); }}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'cash_in' ? 'bg-indigo-700 text-white' : 'text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              <ArrowDownRight className="w-3 h-3" /> Cash In
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('cash_out'); setErrorMsg(''); setSuccessMsg(''); }}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'cash_out' ? 'bg-rose-700 text-white' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <ArrowUpRight className="w-3 h-3" /> Cash Out
            </button>
          </div>
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
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB: STATUS */}
          {activeTab === 'status' && registerSummary && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Expected Cash in Drawer</span>
                <div className="text-3xl font-black text-indigo-600 mt-1">
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
                  <p className="font-bold text-indigo-600 text-sm mt-0.5">{formatMoney(registerSummary.cash_sales)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-slate-500">Cash In (Added):</span>
                  <p className="font-bold text-indigo-600 text-sm mt-0.5">{formatMoney(registerSummary.cash_in)}</p>
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
              {activeRegister ? (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-indigo-800 font-black text-sm">
                    <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
                    <span>Drawer Status is Currently OPEN & Active</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 bg-white p-3 rounded-lg border border-indigo-200">
                    <div>Cashier: <strong className="text-slate-900">{activeRegister.user_name_snapshot}</strong></div>
                    <div>Opening Float: <strong className="text-indigo-700">{formatMoney(activeRegister.opening_amount)}</strong></div>
                    <div>Opened At: <strong className="text-slate-900">{new Date(activeRegister.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
                    <div>Live Cash in Hand: <strong className="text-indigo-700">{registerSummary ? formatMoney(registerSummary.expected_cash) : formatMoney(activeRegister.opening_amount)}</strong></div>
                  </div>
                  <p className="text-xs text-indigo-800 font-medium">
                    The counter cash drawer is currently active. If you want to close this shift, select <strong>Option: CLOSE</strong> above.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-semibold">
                    Count and record the starting cash float in the drawer to change status to OPEN.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Starting Float Cash / ابتدائی رقم (PKR):
                    </label>
                    <input
                      type="number"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      placeholder="5000"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-black text-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    {[2000, 3000, 5000, 10000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setOpeningAmount(String(amt))}
                        className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700 border border-slate-300 font-bold transition cursor-pointer"
                      >
                        Rs. {amt}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleOpenShift}
                    disabled={loading}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black rounded-xl shadow-md transition mt-2 cursor-pointer text-xs flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{loading ? 'Opening...' : 'Confirm Status: OPEN DRAWER (دراز کھولیں)'}</span>
                  </button>
                </div>
              )}
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
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-indigo-600 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / تفصیل:</label>
                <input
                  type="text"
                  value={inOutReason}
                  onChange={(e) => setInOutReason(e.target.value)}
                  placeholder="e.g. Change float from Malik Sahib / bank"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={() => handleCashMovement('cash_in')}
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition"
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
          {activeTab === 'close' && (
            <div className="space-y-4">
              {!activeRegister ? (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-center">
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Drawer Status is Currently CLOSED</h4>
                  <p className="text-xs text-slate-500">
                    No active shift is currently open. To start billing and accept customer orders, select <strong>Option: OPEN</strong> above.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">System Expected Cash in Drawer:</span>
                      <span className="font-black text-indigo-700 text-sm">
                        {registerSummary ? formatMoney(registerSummary.expected_cash) : formatMoney(activeRegister.opening_amount)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Physically Counted Drawer Cash / گنی ہوئی رقم (PKR):
                      </label>
                      {registerSummary && (
                        <button
                          type="button"
                          onClick={() => setActualAmount(String(registerSummary.expected_cash || 0))}
                          className="text-[10px] text-indigo-700 hover:text-indigo-800 font-bold underline cursor-pointer"
                        >
                          Match Expected ({formatMoney(registerSummary.expected_cash)})
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      value={actualAmount}
                      onChange={(e) => setActualAmount(e.target.value)}
                      placeholder="Enter physical cash in drawer"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-black text-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  {actualAmount !== '' && !isNaN(parseFloat(actualAmount)) && registerSummary && (
                    <div className="p-3 rounded-lg border text-xs flex justify-between items-center bg-slate-50 border-slate-200">
                      <span className="text-slate-600 font-bold">Discrepancy (فرق):</span>
                      <span
                        className={`font-black text-sm ${
                          parseFloat(actualAmount) - registerSummary.expected_cash === 0
                            ? 'text-indigo-600'
                            : parseFloat(actualAmount) - registerSummary.expected_cash < 0
                            ? 'text-rose-600'
                            : 'text-blue-600'
                        }`}
                      >
                        {formatMoney(parseFloat(actualAmount) - registerSummary.expected_cash)}
                        {parseFloat(actualAmount) - registerSummary.expected_cash === 0 && ' (Exact Match)'}
                        {parseFloat(actualAmount) - registerSummary.expected_cash < 0 && ' (Cash Shortage)'}
                        {parseFloat(actualAmount) - registerSummary.expected_cash > 0 && ' (Cash Surplus)'}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Shift Handover Remarks:</label>
                    <input
                      type="text"
                      value={closingNote}
                      onChange={(e) => setClosingNote(e.target.value)}
                      placeholder="e.g. Shift balanced, all receipts verified"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                    />
                  </div>

                  <button
                    onClick={handleCloseShift}
                    disabled={loading}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black rounded-xl shadow-md transition cursor-pointer text-xs flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{loading ? 'Closing...' : 'Confirm Status: CLOSE DRAWER (دراز بند کریں)'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

