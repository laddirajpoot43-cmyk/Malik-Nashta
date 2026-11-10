import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { localStore } from '@/lib/db';
import { addMoney, subtractMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const sheetType = searchParams.get('type') || 'all'; // 'all' | 'sales' | 'purchases' | 'register'

    const targetDate = dateParam || new Date().toISOString().split('T')[0];

    const store = localStore.get();
    const settings = store.pos_settings?.[0] || {
      business_name: 'MALIK TASTY NASHTA POINT',
      address: 'Vehari Road, Hasilpur, Punjab, Pakistan',
      phone: '0300-1234567',
    };

    // Filter data for target date (fallback to all if matching none for demo/reporting)
    let orders = (store.orders || []).filter((o: any) => {
      const d = (o.created_at || '').split('T')[0];
      return d === targetDate;
    });

    if (orders.length === 0 && !dateParam) {
      orders = store.orders || [];
    }

    let invoices = (store.purchase_invoices || []).filter((p: any) => {
      const d = (p.invoice_date || p.created_at || '').split('T')[0];
      return d === targetDate;
    });

    if (invoices.length === 0 && !dateParam) {
      invoices = store.purchase_invoices || [];
    }

    let sessions = (store.register_sessions || []).filter((s: any) => {
      const d = (s.opened_at || '').split('T')[0];
      return d === targetDate;
    });

    if (sessions.length === 0 && !dateParam) {
      sessions = store.register_sessions || [];
    }

    const orderItems = store.order_items || [];
    const orderPayments = store.order_payments || [];
    const vendors = store.vendors || [];
    const purchaseItems = store.purchase_items || [];
    const rawMaterials = store.raw_materials || [];

    const wb = XLSX.utils.book_new();

    // 1. DAILY SUMMARY & P&L SHEET
    if (sheetType === 'all' || sheetType === 'summary') {
      let totalGrossSales = 0;
      let totalNetSales = 0;
      let totalDiscounts = 0;
      let cashSales = 0;
      let digitalSales = 0;

      orders.forEach((o: any) => {
        if (o.status !== 'voided') {
          const netAmt = Number(o.grand_total ?? o.total_amount ?? 0);
          const subAmt = Number(o.subtotal ?? netAmt);
          totalGrossSales = addMoney(totalGrossSales, subAmt);
          totalNetSales = addMoney(totalNetSales, netAmt);
          totalDiscounts = addMoney(totalDiscounts, Number(o.discount_amount || 0));

          const pList = (o.payments && o.payments.length > 0)
            ? o.payments
            : orderPayments.filter((p: any) => p.order_id === o.id);

          pList.forEach((pay: any) => {
            if (pay.method_id === 'cash') {
              cashSales = addMoney(cashSales, Number(pay.amount || 0));
            } else {
              digitalSales = addMoney(digitalSales, Number(pay.amount || 0));
            }
          });
        }
      });

      let totalPurchases = 0;
      let purchasesPaid = 0;
      let purchasesCredit = 0;

      invoices.forEach((inv: any) => {
        totalPurchases = addMoney(totalPurchases, Number(inv.total_amount || 0));
        purchasesPaid = addMoney(purchasesPaid, Number(inv.paid_amount || 0));
        purchasesCredit = addMoney(purchasesCredit, Number(inv.balance_amount ?? inv.remaining_balance ?? 0));
      });

      const netProfit = subtractMoney(totalNetSales, totalPurchases);

      const summaryData = [
        ['MALIK TASTY NASHTA POINT - DAILY HISAB & P&L REPORT'],
        ['Address:', settings.address],
        ['Phone:', settings.phone],
        ['Report Date:', targetDate],
        ['Generated At:', new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })],
        [],
        ['FINANCIAL METRIC', 'AMOUNT (PKR)', 'NOTES'],
        ['Total Gross Sales (Before Discount)', totalGrossSales, `Total Orders: ${orders.length}`],
        ['Total Discounts Given', totalDiscounts, 'Promotions / Customer concession'],
        ['Total Net Sales Revenue (Kul Farokht)', totalNetSales, `Active Orders: ${orders.filter((o: any) => o.status !== 'voided').length}`],
        ['Cash Collected (Naqad)', cashSales, 'Direct cash in counter drawer'],
        ['Digital Payments (Online)', digitalSales, 'JazzCash, EasyPaisa, Bank Transfer'],
        [],
        ['PURCHASES & EXPENSES (Maal Kharidari)', 'AMOUNT (PKR)', 'NOTES'],
        ['Total Raw Material Purchases', totalPurchases, `Invoices: ${invoices.length}`],
        ['Cash Paid to Mandi Vendors', purchasesPaid, 'Immediate payment from counter/cash'],
        ['Payable Credit Added (Udhar)', purchasesCredit, 'Mandi ledger balance payable'],
        [],
        ['NET CASH SUMMARY', 'AMOUNT (PKR)', 'ANALYSIS'],
        ['Net Daily Margin (Net Sales - Purchases)', netProfit, netProfit >= 0 ? 'Profitable Day' : 'Expense Exceeded Sales'],
        ['Active Register Sessions', sessions.length, 'Counter shift count'],
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Daily Summary & P&L');
    }

    // 2. SALES SHEET
    if (sheetType === 'all' || sheetType === 'sales') {
      const salesHeader = [
        'S.No',
        'Receipt #',
        'Order #',
        'Time',
        'Customer Name',
        'Customer Phone',
        'Items Detail',
        'Subtotal (PKR)',
        'Discount (PKR)',
        'Grand Total (PKR)',
        'Payment Method',
        'Cashier',
        'Status',
      ];

      const salesRows = orders.map((o: any, idx: number) => {
        const items = (o.items && o.items.length > 0)
          ? o.items
          : orderItems.filter((i: any) => i.order_id === o.id);

        const itemDesc = items.map((i: any) => {
          let s = `${i.product_name_snapshot} (${i.quantity}x)`;
          if (i.addons && i.addons.length > 0) {
            s += ` [+${i.addons.map((a: any) => a.name).join(', ')}]`;
          }
          return s;
        }).join('; ');

        const pList = (o.payments && o.payments.length > 0)
          ? o.payments
          : orderPayments.filter((p: any) => p.order_id === o.id);
        const method = pList.length > 0
          ? pList.map((p: any) => p.method_id?.toUpperCase() || 'CASH').join(' + ')
          : 'CASH';

        return [
          idx + 1,
          o.receipt_number || '-',
          o.order_number || '-',
          o.created_at ? new Date(o.created_at).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi' }) : '-',
          o.customer_name || 'Walk-in',
          o.customer_phone || '-',
          itemDesc || '-',
          Number(o.subtotal || 0),
          Number(o.discount_amount || 0),
          Number(o.grand_total ?? o.total_amount ?? 0),
          method,
          o.cashier_name_snapshot || 'Cashier',
          o.status ? o.status.toUpperCase() : 'COMPLETED',
        ];
      });

      const wsSales = XLSX.utils.aoa_to_sheet([salesHeader, ...salesRows]);
      XLSX.utils.book_append_sheet(wb, wsSales, 'Sales Sheet');
    }

    // 3. PURCHASES SHEET (MAAL KHARIDARI)
    if (sheetType === 'all' || sheetType === 'purchases') {
      const purchaseHeader = [
        'S.No',
        'Date',
        'Invoice #',
        'Vendor / Mandi Supplier',
        'Category',
        'Items & Raw Materials',
        'Total Invoice (PKR)',
        'Cash Paid (PKR)',
        'Remaining Balance (PKR)',
        'Payment Status',
      ];

      const purchaseRows = invoices.map((inv: any, idx: number) => {
        const vendor = vendors.find((v: any) => v.id === inv.vendor_id);
        const pItems = (inv.items && inv.items.length > 0)
          ? inv.items
          : purchaseItems.filter((pi: any) => pi.purchase_invoice_id === inv.id);

        const itemsDesc = pItems.map((pi: any) => {
          const mat = rawMaterials.find((m: any) => m.id === pi.raw_material_id);
          const matName = mat ? mat.name : (pi.item_name || pi.raw_material_name || pi.name || 'Raw Item');
          return `${matName}: ${pi.quantity} ${pi.unit} @ Rs.${pi.unit_price}`;
        }).join('; ');

        return [
          idx + 1,
          inv.invoice_date || inv.created_at?.split('T')[0] || '-',
          inv.invoice_number || `INV-${idx + 1}`,
          inv.vendor_name_snapshot || vendor?.name || 'Mandi Supplier',
          vendor?.category || 'General',
          itemsDesc || 'Raw Materials',
          Number(inv.total_amount || 0),
          Number(inv.paid_amount || 0),
          Number(inv.balance_amount ?? inv.remaining_balance ?? 0),
          (inv.payment_status || 'paid').toUpperCase(),
        ];
      });

      const wsPurchases = XLSX.utils.aoa_to_sheet([purchaseHeader, ...purchaseRows]);
      XLSX.utils.book_append_sheet(wb, wsPurchases, 'Purchases (Maal Kharidari)');
    }

    // 4. CASH DRAWER RECONCILIATION SHEET
    if (sheetType === 'all' || sheetType === 'register') {
      const registerHeader = [
        'Session ID',
        'Cashier Name',
        'Opened At',
        'Closed At',
        'Opening Float (PKR)',
        'Expected Cash (PKR)',
        'Actual Counted (PKR)',
        'Difference / Shortage (PKR)',
        'Shift Status',
        'Closing Note',
      ];

      const registerRows = sessions.map((s: any) => [
        s.id ? s.id.substring(0, 8) : '-',
        s.user_name_snapshot || 'Cashier',
        s.opened_at ? new Date(s.opened_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : '-',
        s.closed_at ? new Date(s.closed_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : 'STILL OPEN',
        Number(s.opening_amount || 0),
        s.expected_amount !== null && s.expected_amount !== undefined ? Number(s.expected_amount) : '-',
        s.actual_amount !== null && s.actual_amount !== undefined ? Number(s.actual_amount) : '-',
        s.difference !== null && s.difference !== undefined ? Number(s.difference) : 0,
        s.status ? s.status.toUpperCase() : 'CLOSED',
        s.closing_note || '-',
      ]);

      const wsRegister = XLSX.utils.aoa_to_sheet([registerHeader, ...registerRows]);
      XLSX.utils.book_append_sheet(wb, wsRegister, 'Cash Drawer Shifts');
    }

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `Malik_Nashta_${sheetType.toUpperCase()}_${targetDate}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
