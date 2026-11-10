'use client';

import React from 'react';
import { Order } from '@/types/pos';
import { useSettings } from '@/context/SettingsContext';
import { formatMoney } from '@/lib/money';

interface ThermalReceiptProps {
  order: Order | null;
  customTemplate?: any;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ order, customTemplate }) => {
  const { settings } = useSettings();

  if (!order) return null;

  const tpl = customTemplate || settings.receipt_template || {
    paper_size: '80mm',
    tagline: 'Fresh & Crispy Nashta Everyday',
    ntn_strn: 'NTN: 829104-5',
    header_message: 'Special Lahori Channay & Crispy Parathay',
    footer_message_urdu: 'شکریہ! دوبارہ تشریف لائیں',
    footer_message_english: 'Thank you for visiting Malik Tasty Nashta Point!',
    show_cashier_name: true,
    show_customer_info: true,
    show_order_number: true,
    show_kitchen_notes: true,
    show_addons: true,
    show_duplicate_watermark: true,
    font_size: 'medium',
  };

  const isDuplicate = (order.reprint_count || 0) > 0;
  const is58mm = tpl.paper_size === '58mm';

  const dateFormatted = new Date(order.created_at || Date.now()).toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const fontSizeClass = tpl.font_size === 'small' ? 'text-[10px]' : tpl.font_size === 'large' ? 'text-[12px]' : 'text-[11px]';

  return (
    <div
      id="thermal-receipt"
      className={`font-mono leading-snug text-black bg-white ${fontSizeClass}`}
      style={{
        width: is58mm ? '58mm' : '80mm',
        maxWidth: is58mm ? '58mm' : '80mm',
        margin: '0 auto',
      }}
    >
      {/* Reprint Duplicate Watermark Banner */}
      {isDuplicate && tpl.show_duplicate_watermark !== false && (
        <div className="border-2 border-black p-1 text-center font-bold text-xs mb-2 uppercase tracking-wider">
          *** REPRINT DUPLICATE ***
          <div className="text-[9px] font-normal">Copy #{order.reprint_count}</div>
        </div>
      )}

      {/* Header */}
      <div className="text-center border-b border-black pb-2 mb-2">
        <h1 className="text-base font-black tracking-tight uppercase">{tpl.business_name || settings.business_name || 'MALIK TASTY NASHTA POINT'}</h1>
        <p className="text-[11px] font-medium">{tpl.address || settings.address || 'Vehari Road, Hasilpur, Punjab'}</p>
        <p className="text-[11px]">Phone: {tpl.phone || settings.phone || '0300-1234567'}</p>
        {tpl.ntn_strn && <p className="text-[10px] text-gray-700 font-semibold">{tpl.ntn_strn}</p>}
        {tpl.tagline && <p className="italic text-[10px] mt-0.5">{tpl.tagline}</p>}
        {tpl.header_message && <p className="text-[10px] font-medium mt-0.5 border-t border-dotted border-gray-400 pt-0.5">{tpl.header_message}</p>}
      </div>

      {/* Metadata */}
      <div className="border-b border-dashed border-black pb-1.5 mb-1.5 text-[11px]">
        <div className="flex justify-between">
          <span className="font-bold">Receipt #:</span>
          <span className="font-bold">{order.receipt_number}</span>
        </div>
        {tpl.show_order_number !== false && (
          <div className="flex justify-between">
            <span>Order #:</span>
            <span>{order.order_number}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Date / Time:</span>
          <span>{dateFormatted}</span>
        </div>
        {tpl.show_cashier_name !== false && (
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span>{order.cashier_name_snapshot}</span>
          </div>
        )}
        {tpl.show_customer_info !== false && order.customer_name && (
          <div className="flex justify-between">
            <span>Customer:</span>
            <span className="font-semibold">{order.customer_name}</span>
          </div>
        )}
        {tpl.show_customer_info !== false && order.customer_phone && (
          <div className="flex justify-between">
            <span>Phone:</span>
            <span>{order.customer_phone}</span>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="border-b border-black pb-2 mb-2">
        <div className="flex justify-between font-bold border-b border-dashed border-black pb-1 mb-1 text-[11px]">
          <span className="w-1/2">Item</span>
          <span className="w-1/4 text-center">Qty x Rate</span>
          <span className="w-1/4 text-right">Total</span>
        </div>

        {order.items?.map((item: any, idx: number) => (
          <div key={item.id || idx} className="py-1 border-b border-dotted border-gray-300 last:border-none">
            <div className="flex justify-between font-medium">
              <span className="w-1/2 break-words">{item.product_name_snapshot}</span>
              <span className="w-1/4 text-center">
                {item.quantity}x @ {item.unit_price}
              </span>
              <span className="w-1/4 text-right font-bold">{formatMoney(item.line_total)}</span>
            </div>

            {/* Attached Addons */}
            {tpl.show_addons !== false && item.addons && item.addons.length > 0 && (
              <div className="text-[10px] text-gray-700 pl-2">
                {item.addons.map((ad: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span>+ {ad.name}</span>
                    <span>+{formatMoney(ad.price)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Kitchen Note */}
            {tpl.show_kitchen_notes !== false && item.note && (
              <div className="text-[10px] italic pl-2 text-gray-800">
                Note: {item.note}
              </div>
            )}

            {/* Refund Indicator */}
            {item.refunded_quantity > 0 && (
              <div className="text-[10px] font-bold text-red-600 pl-2">
                Refunded: {item.refunded_quantity} portion(s)
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Financial Calculations */}
      <div className="border-b border-dashed border-black pb-2 mb-2 space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatMoney(order.subtotal)}</span>
        </div>

        {Number(order.discount_amount || 0) > 0 && (
          <div className="flex justify-between text-gray-800">
            <span>Discount ({order.discount_type === 'percentage' ? `${order.discount_value}%` : 'Flat'}):</span>
            <span>-{formatMoney(order.discount_amount)}</span>
          </div>
        )}

        {Number(order.rounding_amount || 0) !== 0 && (
          <div className="flex justify-between text-gray-700">
            <span>Rounding:</span>
            <span>{order.rounding_amount > 0 ? `+${formatMoney(order.rounding_amount)}` : formatMoney(order.rounding_amount)}</span>
          </div>
        )}

        <div className="flex justify-between font-black text-sm pt-1 border-t border-black mt-1">
          <span>GRAND TOTAL:</span>
          <span>{formatMoney(order.grand_total)}</span>
        </div>
      </div>

      {/* Payment Tender Breakdown */}
      <div className="border-b border-black pb-2 mb-2 text-[11px]">
        {order.payments?.map((p: any, idx: number) => (
          <div key={idx} className="flex justify-between">
            <span className="capitalize">{p.method_id} Paid:</span>
            <span>{formatMoney(p.amount)}</span>
          </div>
        ))}

        {Number(order.total_paid || 0) > Number(order.grand_total || 0) && (
          <>
            <div className="flex justify-between font-semibold mt-0.5">
              <span>Cash Tendered:</span>
              <span>{formatMoney(order.total_paid)}</span>
            </div>
            <div className="flex justify-between font-bold text-xs mt-0.5 border-t border-dotted border-gray-400 pt-0.5">
              <span>CHANGE RETURNED:</span>
              <span>{formatMoney(order.change_returned)}</span>
            </div>
          </>
        )}
      </div>

      {/* Custom Footers */}
      <div className="text-center text-[10px] space-y-1">
        {tpl.footer_message_urdu && <p className="font-bold text-xs">{tpl.footer_message_urdu}</p>}
        {tpl.footer_message_english && <p>{tpl.footer_message_english}</p>}
        <p className="text-[9px] text-gray-500">Malik Tasty Nashta Point POS</p>
      </div>
    </div>
  );
};
