'use client';

import React, { useState, useEffect } from 'react';
import { AuditLog } from '@/types/pos';
import { AdminGuard } from '@/components/auth/AdminGuard';
import {
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  FileCode,
  Clock,
  User,
  Activity,
} from 'lucide-react';

export default function AuditLogsPage() {
  return (
    <AdminGuard fallbackTitle="System Audit Logs Protected">
      <AuditLogsContent />
    </AdminGuard>
  );
}

function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let url = '/api/audit-logs?limit=150';
      if (actionFilter !== 'all') {
        url += `&action=${actionFilter}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  return (
    <div className="space-y-3 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl font-bold">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900">Immutable Security & Operation Audit Trail</h1>
          </div>
        </div>

        {/* Action Filter */}
        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
          >
            <option value="all">All Actions ({logs.length})</option>
            <option value="SALE">SALE</option>
            <option value="ORDER_VOIDED">ORDER_VOIDED</option>
            <option value="REFUND_CREATED">REFUND_CREATED</option>
            <option value="REGISTER_OPEN">REGISTER_OPEN</option>
            <option value="REGISTER_CLOSE">REGISTER_CLOSE</option>
            <option value="CASH_IN">CASH_IN</option>
            <option value="CASH_OUT">CASH_OUT</option>
            <option value="PURCHASE_CREATED">PURCHASE_CREATED</option>
            <option value="VENDOR_PAYMENT">VENDOR_PAYMENT</option>
            <option value="SETTINGS_UPDATE">SETTINGS_UPDATE</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Logs Table (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-700">
            Recorded System Events ({logs.length})
          </div>

          <div className="overflow-x-auto flex-1 max-h-[70vh]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] sticky top-0">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-3 py-3">Cashier / Staff</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-4 py-3">Event Narrative</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      Loading audit events...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      No audit events matching criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isSelected = selectedLog?.id === log.id;
                    const dateFormatted = new Date(log.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`hover:bg-slate-50 transition cursor-pointer ${
                          isSelected ? 'bg-indigo-50/70 border-l-4 border-l-emerald-600' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {dateFormatted}
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-900 whitespace-nowrap">
                          {log.user_name}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.action === 'SALE'
                                ? 'bg-indigo-100 text-indigo-800'
                                : log.action.includes('VOID') || log.action.includes('REFUND')
                                ? 'bg-rose-100 text-rose-800'
                                : log.action.includes('REGISTER')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">
                          {log.description}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Log State Inspector (1 col) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col">
          {selectedLog ? (
            <div className="space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <div className="pb-3 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400">ID: {selectedLog.id}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded uppercase">
                      {selectedLog.entity_type}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mt-1">{selectedLog.action}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedLog.description}</p>
                </div>

                <div className="space-y-2 mt-3 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Staff Snapshot:</span>
                    <span className="font-bold text-slate-900">{selectedLog.user_name}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Target Record ID:</span>
                    <span className="font-mono text-slate-700">{selectedLog.entity_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Timestamp:</span>
                    <span className="font-mono text-slate-700">{new Date(selectedLog.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* JSON State Diffs */}
                {selectedLog.old_values && (
                  <div className="mt-3">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block mb-1">
                      Previous State (Old Values):
                    </span>
                    <pre className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-800 font-mono overflow-x-auto max-h-36">
                      {JSON.stringify(selectedLog.old_values, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.new_values && (
                  <div className="mt-3">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block mb-1">
                      Mutated State (New Values):
                    </span>
                    <pre className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-200 text-[10px] text-indigo-900 font-mono overflow-x-auto max-h-36">
                      {JSON.stringify(selectedLog.new_values, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 text-center text-[10px] text-slate-400">
                🔒 Cryptographically immutable audit row
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16 text-center">
              <Activity className="w-10 h-10 mb-2 opacity-30 text-indigo-600" />
              <p className="text-xs font-semibold">Select an audit log row to inspect transaction state and diffs</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

