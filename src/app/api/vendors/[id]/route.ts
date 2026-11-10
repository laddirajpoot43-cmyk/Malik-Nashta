import { NextResponse } from 'next/server';
import { localStore } from '@/lib/db';
import { addMoney, subtractMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const store = localStore.get();
    const vendor = (store.vendors || []).find((v: any) => v.id === id);

    if (!vendor) {
      return NextResponse.json({ success: false, error: 'Vendor not found.' }, { status: 404 });
    }

    // Collect all purchase invoices
    const invoices = (store.purchase_invoices || []).filter((inv: any) => inv.vendor_id === vendor.id);

    // Collect all vendor payments
    const payments = (store.vendor_payments || []).filter((vp: any) => vp.vendor_id === vendor.id);

    // Build unified chronological ledger entries
    interface LedgerEntry {
      id: string;
      date: string;
      type: 'OPENING_BALANCE' | 'PURCHASE_BILL' | 'BILL_PAYMENT' | 'PAYMENT_VOUCHER';
      voucher_no: string;
      description: string;
      debit: number; // Payments made to vendor (reduces debt)
      credit: number; // Supplies bought from vendor (increases debt)
      running_balance: number;
    }

    const ledger: LedgerEntry[] = [];
    let runningBalance = Number(vendor.opening_balance || 0);

    // Initial Opening Balance
    ledger.push({
      id: 'open-bal',
      date: vendor.created_at?.slice(0, 10) || '2026-10-01',
      type: 'OPENING_BALANCE',
      voucher_no: 'BAL-START',
      description: 'Opening Khata Balance on Onboarding',
      debit: 0,
      credit: Number(vendor.opening_balance || 0),
      running_balance: runningBalance,
    });

    // Merge invoices and payments
    const events: { date: string; type: string; payload: any }[] = [];

    for (const inv of invoices) {
      events.push({
        date: inv.invoice_date || inv.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        type: 'invoice',
        payload: inv,
      });
    }

    for (const pay of payments) {
      events.push({
        date: pay.payment_date || pay.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        type: 'payment',
        payload: pay,
      });
    }

    // Sort chronologically
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const ev of events) {
      if (ev.type === 'invoice') {
        const inv = ev.payload;
        // Purchase increases payable
        runningBalance = addMoney(runningBalance, Number(inv.total_amount || 0));
        ledger.push({
          id: inv.id,
          date: ev.date,
          type: 'PURCHASE_BILL',
          voucher_no: inv.invoice_number,
          description: `Purchase Bill (${inv.items?.length || 0} items)`,
          debit: 0,
          credit: Number(inv.total_amount || 0),
          running_balance: runningBalance,
        });

        // If paid any portion at delivery time
        if (Number(inv.paid_amount || 0) > 0) {
          runningBalance = subtractMoney(runningBalance, Number(inv.paid_amount || 0));
          ledger.push({
            id: `${inv.id}-paid`,
            date: ev.date,
            type: 'BILL_PAYMENT',
            voucher_no: `PAID-${inv.invoice_number}`,
            description: `Cash paid on delivery for ${inv.invoice_number}`,
            debit: Number(inv.paid_amount || 0),
            credit: 0,
            running_balance: runningBalance,
          });
        }
      } else {
        const pay = ev.payload;
        // Payment voucher reduces payable
        runningBalance = subtractMoney(runningBalance, Number(pay.amount || 0));
        ledger.push({
          id: pay.id,
          date: ev.date,
          type: 'PAYMENT_VOUCHER',
          voucher_no: pay.payment_number,
          description: `Khata Payment: ${pay.payment_method?.toUpperCase()} (${pay.note || 'Account settlement'})`,
          debit: Number(pay.amount || 0),
          credit: 0,
          running_balance: runningBalance,
        });
      }
    }

    return NextResponse.json({
      success: true,
      vendor,
      running_balance: runningBalance,
      statement: ledger,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

