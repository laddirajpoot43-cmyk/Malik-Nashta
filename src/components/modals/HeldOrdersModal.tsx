'use client';

import React, { useState, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { HeldOrder } from '@/types/pos';
import { formatMoney } from '@/lib/money';
import { Clock, Play, Trash2, X, Utensils } from 'lucide-react';

export const HeldOrdersModal: React.FC = () => {
  const { openHeldOrdersModal, setOpenHeldOrdersModal, resumeHeldOrder } = usePOS();
  const [heldList, setHeldList] = useState<HeldOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHeld = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/held-orders');
      const data = await res.json();
      if (data.success) {
        setHeldList(data.heldOrders || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (openHeldOrdersModal) {
      fetchHeld();
    }
  }, [openHeldOrdersModal]);

  if (!openHeldOrdersModal) return null;

  const handleResume = async (id: string) => {
    await resumeHeldOrder(id);
  };

  const handleCancelHold = async (id: string) => {
    try {
      await fetch(`/api/held-orders?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      fetchHeld();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Held Dining Orders</h2>
              <p className="text-xs text-slate-400">
                {heldList.length} order(s) temporarily paused
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpenHeldOrdersModal(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs">Loading held orders...</div>
          ) : heldList.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Utensils className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-60" />
              <p className="text-sm font-semibold">No active held orders</p>
              <p className="text-xs text-slate-500 mt-1">Press F4 during counter billing to hold a table cart</p>
            </div>
          ) : (
            heldList.map((hold) => {
              const cartItems = hold.cart_data?.cart || [];
              const totalEstimate = cartItems.reduce((acc: number, it: any) => acc + (it.line_total || 0), 0);

              return (
                <div
                  key={hold.id}
                  className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex items-center justify-between transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                        {hold.hold_number}
                      </span>
                      <h4 className="font-bold text-slate-100 text-sm">{hold.customer_name}</h4>
                    </div>
                    <p className="text-xs text-slate-400">
                      {cartItems.length} item(s) • Est: <strong className="text-emerald-400">{formatMoney(totalEstimate)}</strong>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Held by {hold.cashier_name} at {new Date(hold.created_at).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCancelHold(hold.id)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                      title="Discard Held Order"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleResume(hold.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Resume
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

