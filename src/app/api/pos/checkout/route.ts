import { NextResponse } from 'next/server';
import { localStore, withTransaction, logAuditEvent, generateUUID } from '@/lib/db';
import { addMoney, subtractMoney, multiplyMoney, calculateRounding } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      cart,
      discount_type,
      discount_value = 0,
      admin_pin,
      customer_name,
      customer_phone,
      payments = [],
      idempotency_key,
      cashier_name = 'Counter Cashier',
    } = body;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ success: false, error: 'Cart cannot be empty' }, { status: 400 });
    }

    const store = localStore.get();

    // 1. Idempotency Key check: prevent double-spend or duplicate billing
    if (idempotency_key) {
      const existing = (store.orders || []).find((o: any) => o.idempotency_key === idempotency_key);
      if (existing) {
        return NextResponse.json({
          success: true,
          order: existing,
          is_idempotent_replay: true,
        });
      }
    }

    // 2. Check active register session
    const activeRegister = (store.register_sessions || []).find((s: any) => s.status === 'open');
    if (!activeRegister) {
      return NextResponse.json(
        { success: false, error: 'Cannot checkout without an active open cash register session. Please open cash drawer.' },
        { status: 400 }
      );
    }

    const settings = store.pos_settings?.[0] || {
      admin_pin: '1234',
      max_cashier_discount_percent: 15,
      cash_rounding_enabled: true,
    };

    // 3. Discount Validation & Supervisor PIN Check
    const discountVal = Number(discount_value) || 0;
    if (discountVal > 0) {
      const maxCashierDisc = settings.max_cashier_discount_percent || 15;
      const isPercent = discount_type === 'percentage';
      const requiresPin = isPercent ? discountVal > maxCashierDisc : false;

      if (requiresPin) {
        if (!admin_pin || String(admin_pin).trim() !== String(settings.admin_pin).trim()) {
          return NextResponse.json(
            { success: false, error: `Discounts exceeding ${maxCashierDisc}% require valid Supervisor / Admin PIN.` },
            { status: 403 }
          );
        }
      }
    }

    // Execute atomic checkout transaction
    const orderResult = await withTransaction(async () => {
      // 4. Server-Authoritative Price Calculation
      let calculatedSubtotal = 0;
      const orderItemsToInsert: any[] = [];
      const orderId = generateUUID();

      for (const item of cart) {
        const product = (store.products || []).find((p: any) => p.id === item.product_id);
        const productName = item.product_name || product?.name || 'Breakfast Item';
        const unitPrice = item.custom_unit_price !== undefined ? Number(item.custom_unit_price) : Number(product?.selling_price || 0);
        const qty = Number(item.quantity) || 1;

        const itemSubtotal = multiplyMoney(unitPrice, qty);

        // Addons
        let addonsTotal = 0;
        const attachedAddons: any[] = [];
        if (Array.isArray(item.addons)) {
          for (const ad of item.addons) {
            const adPrice = Number(ad.price || 0);
            addonsTotal = addMoney(addonsTotal, adPrice);
            attachedAddons.push({
              addon_id: ad.id || ad.addon_id || generateUUID(),
              name: ad.name,
              price: adPrice,
            });
          }
        }

        const itemDiscount = Number(item.item_discount) || 0;
        const lineTotal = subtractMoney(addMoney(itemSubtotal, addonsTotal), itemDiscount);

        calculatedSubtotal = addMoney(calculatedSubtotal, lineTotal);

        orderItemsToInsert.push({
          id: generateUUID(),
          order_id: orderId,
          product_id: item.product_id || null,
          product_name_snapshot: productName,
          unit_price: unitPrice,
          quantity: qty,
          item_subtotal: itemSubtotal,
          addons_total: addonsTotal,
          item_discount: itemDiscount,
          line_total: lineTotal,
          note: item.note || null,
          refunded_quantity: 0,
          addons: attachedAddons,
          created_at: new Date().toISOString(),
        });
      }

      // 5. Calculate Discount Amount
      let discountAmount = 0;
      if (discountVal > 0) {
        if (discount_type === 'percentage') {
          discountAmount = multiplyMoney(calculatedSubtotal, discountVal / 100);
        } else {
          discountAmount = Math.min(discountVal, calculatedSubtotal);
        }
      }

      const preRoundingTotal = subtractMoney(calculatedSubtotal, discountAmount);

      // 6. Penny Rounding (Pakistani Cash Rounding)
      const rounding = calculateRounding(preRoundingTotal, settings.cash_rounding_enabled);
      const grandTotal = rounding.roundedAmount;
      const roundingAmount = rounding.roundingDifference;

      // 7. Payment Verification
      let totalPaid = 0;
      let totalCashTendered = 0;
      let totalCashPaidPortion = 0;
      const paymentsToInsert: any[] = [];

      for (const p of payments) {
        const payAmt = Number(p.amount) || 0;
        const tendered = Number(p.amount_tendered !== undefined ? p.amount_tendered : p.amount) || 0;
        totalPaid = addMoney(totalPaid, payAmt);

        if (p.method_id === 'cash') {
          totalCashTendered = addMoney(totalCashTendered, tendered);
          totalCashPaidPortion = addMoney(totalCashPaidPortion, payAmt);
        }

        paymentsToInsert.push({
          id: generateUUID(),
          order_id: orderId,
          method_id: p.method_id || 'cash',
          amount: payAmt,
          amount_tendered: tendered,
          change_returned: p.method_id === 'cash' ? Math.max(0, subtractMoney(tendered, payAmt)) : 0,
          created_at: new Date().toISOString(),
        });
      }

      // If no payments explicitly passed or partial, assume exact cash if totalPaid == 0
      if (payments.length === 0) {
        totalPaid = grandTotal;
        totalCashPaidPortion = grandTotal;
        totalCashTendered = grandTotal;
        paymentsToInsert.push({
          id: generateUUID(),
          order_id: orderId,
          method_id: 'cash',
          amount: grandTotal,
          amount_tendered: grandTotal,
          change_returned: 0,
          created_at: new Date().toISOString(),
        });
      }

      const changeReturned = Math.max(0, subtractMoney(totalCashTendered > 0 ? totalCashTendered : totalPaid, grandTotal));

      // 8. Generate sequential receipt & order numbers
      const receiptNumber = localStore.nextSeq('receipt_seq');
      const orderNumber = localStore.nextSeq('order_seq');

      const newOrder = {
        id: orderId,
        order_number: orderNumber,
        receipt_number: receiptNumber,
        register_session_id: activeRegister.id,
        status: 'completed',
        subtotal: calculatedSubtotal,
        discount_type: discount_type || null,
        discount_value: discountVal,
        discount_amount: discountAmount,
        rounding_amount: roundingAmount,
        grand_total: grandTotal,
        total_paid: totalPaid,
        change_returned: changeReturned,
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
        void_reason: null,
        reprint_count: 0,
        idempotency_key: idempotency_key || null,
        cashier_name_snapshot: cashier_name,
        created_at: new Date().toISOString(),
        items: orderItemsToInsert,
        payments: paymentsToInsert,
      };

      // Push to store
      store.orders.unshift(newOrder);
      for (const it of orderItemsToInsert) store.order_items.push(it);
      for (const py of paymentsToInsert) store.order_payments.push(py);

      // 9. If paid via Cash, create atomic drawer SALE transaction
      if (totalCashPaidPortion > 0) {
        const registerTx = {
          id: generateUUID(),
          register_session_id: activeRegister.id,
          type: 'SALE',
          amount: totalCashPaidPortion,
          order_id: orderId,
          refund_id: null,
          reason: `Cash Sale #${receiptNumber}`,
          note: `Customer: ${customer_name || 'Walk-in'}`,
          user_name_snapshot: cashier_name,
          created_at: new Date().toISOString(),
        };
        store.register_transactions.unshift(registerTx);
      }

      // 10. Audit Log
      await logAuditEvent({
        user_name: cashier_name,
        action: 'SALE',
        entity_type: 'order',
        entity_id: orderId,
        description: `Order ${receiptNumber} finalized for ${grandTotal} PKR (${cashier_name})`,
        new_values: { receipt_number: receiptNumber, grand_total: grandTotal, items_count: orderItemsToInsert.length },
      });

      return newOrder;
    });

    return NextResponse.json({
      success: true,
      order: orderResult,
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

