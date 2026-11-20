'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/money';
import {
  Receipt,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Calendar,
  Filter,
} from 'lucide-react';

interface ExpenseItem {
  id: string;
  voucher_number: string;
  title: string;
  category: string;
  amount: number;
  expense_date: string;
  payment_method: string;
  note?: string;
  cashier_name?: string;
  created_at: string;
}

const EXPENSE_CATEGORIES = [
  'Utilities & Bills',
  'Staff Salaries',
  'Rent',
  'Kitchen & Gas',
  'Maintenance & Misc',
];

export default function ExpensesPage() {
  return (
    <AdminGuard fallbackTitle="Hotel Expenses Protected">
      <ExpensesContent />
    </AdminGuard>
  );
}

function ExpensesContent() {
  const { currentUser } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [summary, setSummary] = useState({
    today_total: 0,
    month_total: 0,
    all_time_total: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add Expense Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [deductFromRegister, setDeductFromRegister] = useState(true);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<ExpenseItem | null>(null);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (dateFilter) params.set('date', dateFilter);

      const res = await fetch(`/api/expenses?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setExpenses(data.expenses || []);
        setSummary(
          data.summary || {
            today_total: 0,
            month_total: 0,
            all_time_total: 0,
            count: 0,
          }
        );
      }
    } catch {
      setErrorMsg('Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, dateFilter]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const openAddModal = () => {
    setTitle('');
    setCategory(EXPENSE_CATEGORIES[0]);
    setAmount('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('Cash');
    setDeductFromRegister(true);
    setNote('');
    setErrorMsg('');
    setShowAddModal(true);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!title.trim() || !Number.isFinite(amt) || amt <= 0) {
      setErrorMsg('Please enter an expense title and positive amount.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          amount: amt,
          expense_date: expenseDate,
          payment_method: paymentMethod,
          deduct_from_register: deductFromRegister && paymentMethod === 'Cash',
          note: note.trim(),
          cashier_name: currentUser?.display_name || currentUser?.full_name || 'Admin',
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error || 'Failed to add expense.');
      } else {
        setShowAddModal(false);
        setSuccessMsg(`Expense voucher ${data.expense?.voucher_number || ''} recorded.`);
        await loadExpenses();
      }
    } catch {
      setErrorMsg('Network error adding expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/expenses?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error || 'Failed to delete expense.');
      } else {
        setDeleteTarget(null);
        setSuccessMsg('Expense removed.');
        await loadExpenses();
      }
    } catch {
      setErrorMsg('Network error deleting expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (typeof window === 'undefined') return;
    document.body.classList.add('print-page-mode');
    const cleanup = () => {
      document.body.classList.remove('print-page-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 80);
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 bg-[#F4F6FB] min-h-full">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">General Hotel Expenses (ہوٹل اخراجات)</h1>
            <p className="text-xs text-slate-500 font-medium">
              Track electricity/gas bills, staff salaries, rent, and daily maintenance costs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense (نیا خرچہ)</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-teal-600 hover:text-teal-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Today&apos;s Expenses (آج کا خرچہ)
          </span>
          <div className="text-2xl font-black text-rose-600 mt-1">
            {formatMoney(summary.today_total)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            This Month&apos;s Expenses (ماہانہ خرچہ)
          </span>
          <div className="text-2xl font-black text-indigo-700 mt-1">
            {formatMoney(summary.month_total)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Recorded ({summary.count} Vouchers)
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatMoney(summary.all_time_total)}
          </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Category:</span>
            </div>
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                categoryFilter === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {EXPENSE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs font-bold text-slate-400">
            Loading expenses...
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">No expenses found</p>
            <p className="text-xs text-slate-400 mt-1">
              Click &quot;Add Expense&quot; to record bills, salaries, rent, or daily expenses.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Voucher & Date</th>
                  <th className="py-3 px-4">Title / Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="font-black text-indigo-700">{exp.voucher_number}</div>
                      <div className="text-[11px] text-slate-400">{exp.expense_date}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-sm">{exp.title}</div>
                      {exp.note && <div className="text-[11px] text-slate-500">{exp.note}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-[11px]">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-600">
                      {exp.payment_method}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-rose-600 text-sm">
                      {formatMoney(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-right no-print">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(exp)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Delete Expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-[#0F172A] text-white flex items-center justify-between">
              <h2 className="text-sm font-black">Add General Hotel Expense</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Expense Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. MEPCO Electricity Bill / Chef Salary"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount (Rs.) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-black text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Cash">Cash (نقد)</option>
                    <option value="JazzCash">JazzCash</option>
                    <option value="EasyPaisa">EasyPaisa</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {paymentMethod === 'Cash' && (
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={deductFromRegister}
                    onChange={(e) => setDeductFromRegister(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span>Deduct from active Cash Register drawer (CASH_OUT)</span>
                </label>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Note / Details</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional receipt or remark"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-black text-slate-900">Delete Expense Voucher?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Delete <strong>{deleteTarget.title}</strong> ({formatMoney(deleteTarget.amount)})?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteExpense}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
