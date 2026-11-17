'use client';

import React, { useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { usePOS } from '@/context/POSContext';
import { ReceiptTemplateConfig } from '@/types/pos';
import { ThermalReceipt } from '@/components/ThermalReceipt';
import {
  Printer,
  Save,
  CheckCircle2,
  Sliders,
  Type,
  FileCheck,
  Eye,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

export const ReceiptTemplateEditor: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { setCurrentOrderToPrint } = usePOS();

  const defaultTemplate: ReceiptTemplateConfig = {
    paper_size: '80mm',
    tagline: 'Fresh & Crispy Nashta Everyday',
    ntn_strn: 'NTN: 829104-5',
    header_message: 'Special Lahori Channay & Crispy Parathay',
    footer_message_urdu: 'شکریہ! دوبارہ تشریف لائیں',
    footer_message_english: 'Thank you for visiting Malik Tasty Nashta Point!',
    show_cashier_name: true,
    show_customer_info: true,
    show_order_number: true,
    show_kitchen_notes: false,
    show_addons: false,
    show_duplicate_watermark: true,
    font_size: 'medium',
  };

  const [businessName, setBusinessName] = useState(settings.business_name || 'MALIK TASTY NASHTA POINT');
  const [address, setAddress] = useState(settings.address || 'Vehari Road, Hasilpur, Punjab, Pakistan');
  const [phone, setPhone] = useState(settings.phone || '0300-1234567');

  const [template, setTemplate] = useState<ReceiptTemplateConfig>({
    ...defaultTemplate,
    ...(settings.receipt_template || {}),
  });

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sample realistic order for instant live preview
  const previewOrder: any = {
    id: 'preview-order-sample',
    order_number: 'ORD-108',
    receipt_number: 'REC-20261110-0108',
    customer_name: 'Chaudhry Tariq',
    customer_phone: '0302-7654321',
    cashier_name_snapshot: 'Malik Ammar',
    subtotal: 380.0,
    discount_type: 'none',
    discount_value: 0,
    discount_amount: 0,
    rounding_amount: 0,
    grand_total: 380.0,
    reprint_count: 0,
    created_at: new Date().toISOString(),
    payments: [{ method_id: 'cash', amount: 380.0 }],
    total_paid: 500.0,
    change_returned: 120.0,
    items: [
      {
        id: 'item-1',
        product_name_snapshot: 'Special Channay',
        pricing_method: 'Full Plate',
        unit_price: 180.0,
        quantity: 1,
        line_total: 180.0,
        refunded_quantity: 0,
      },
      {
        id: 'item-2',
        product_name_snapshot: 'Desi Ghee Paratha',
        pricing_method: 'Per Plate',
        unit_price: 100.0,
        quantity: 2,
        line_total: 200.0,
        refunded_quantity: 0,
      },
    ],
  };

  const handleTextChange = (field: keyof ReceiptTemplateConfig, value: any) => {
    setTemplate((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleToggle = (field: keyof ReceiptTemplateConfig) => {
    setTemplate((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleResetDefaults = () => {
    setTemplate(defaultTemplate);
    setBusinessName('MALIK TASTY NASHTA POINT');
    setAddress('Vehari Road, Hasilpur, Punjab, Pakistan');
    setPhone('0300-1234567');
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await updateSettings({
        business_name: businessName,
        address,
        phone,
        receipt_template: template,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Thermal receipt slip template saved successfully! Active for all future prints.',
        });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to save template.' });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Error saving template' });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handlePrintTest = () => {
    setCurrentOrderToPrint(previewOrder);
    setTimeout(() => {
      window.print();
    }, 80);
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              Thermal Receipt Slip Template Customizer (رسید ڈیزائن)
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                Live Preview
              </span>
            </h2>
            <p className="text-xs text-slate-600">
              Customize shop branding, Urdu & English greetings, paper roll width (80mm / 58mm), font sizing, and visible print sections.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* RED BUTTON: Reset Defaults */}
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            title="Reset template to default values"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          {/* GREEN BUTTON: Test Print Dialog */}
          <button
            type="button"
            onClick={handlePrintTest}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Test Print (1 Page)</span>
          </button>

          {/* GREEN BUTTON: Save Template */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-extrabold text-xs shadow transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save Template'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : 'bg-rose-50 text-rose-800 border border-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <Sliders className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Grid: Form Controls Left, Live Thermal Slip Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Business Header Branding */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <Type className="w-4 h-4 text-emerald-600" />
              <span>Header Branding & Business Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Hotel / Shop Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Slogan / Tagline</label>
                <input
                  type="text"
                  value={template.tagline || ''}
                  onChange={(e) => handleTextChange('tagline', e.target.value)}
                  placeholder="e.g. Fresh & Crispy Nashta Everyday"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone Number(s)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">NTN / STRN # (Optional)</label>
                <input
                  type="text"
                  value={template.ntn_strn || ''}
                  onChange={(e) => handleTextChange('ntn_strn', e.target.value)}
                  placeholder="e.g. NTN: 829104-5"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Physical Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Top Announcement Message (e.g. Bismillah or Special Notice)
                </label>
                <input
                  type="text"
                  value={template.header_message || ''}
                  onChange={(e) => handleTextChange('header_message', e.target.value)}
                  placeholder="e.g. Special Lahori Channay & Crispy Parathay"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Footers & Urdu Greeting */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Bottom Greetings & Urdu Messages</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Urdu Greeting Message (اردو شکریہ پیغام)
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={template.footer_message_urdu || ''}
                  onChange={(e) => handleTextChange('footer_message_urdu', e.target.value)}
                  placeholder="شکریہ! دوبارہ تشریف لائیں"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">English Greeting Message</label>
                <input
                  type="text"
                  value={template.footer_message_english || ''}
                  onChange={(e) => handleTextChange('footer_message_english', e.target.value)}
                  placeholder="Thank you for visiting Malik Tasty Nashta Point!"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Paper Size, Font Size & Toggle Switches */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>Printer Geometry & Visibility Toggles</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Paper Roll Width</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTextChange('paper_size', '80mm')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      template.paper_size === '80mm'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>80mm</span>
                    <span className="text-[10px] font-normal opacity-90">(Standard 72mm)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTextChange('paper_size', '58mm')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      template.paper_size === '58mm'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>58mm</span>
                    <span className="text-[10px] font-normal opacity-90">(Compact 48mm)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Base Font Size</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleTextChange('font_size', size)}
                      className={`py-2 px-2 rounded-xl border text-xs font-bold capitalize transition cursor-pointer ${
                        template.font_size === size
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                Show / Hide Receipt Sections
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { key: 'show_cashier_name', label: 'Show Cashier Name' },
                  { key: 'show_customer_info', label: 'Show Customer Info (Name/Phone)' },
                  { key: 'show_order_number', label: 'Show Order / Token #' },
                  { key: 'show_duplicate_watermark', label: 'Show Duplicate Watermark on Reprints' },
                ].map(({ key, label }) => {
                  const isChecked = template[key as keyof ReceiptTemplateConfig] !== false;
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 cursor-pointer select-none transition"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggle(key as keyof ReceiptTemplateConfig)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                      />
                      <span className="text-xs text-slate-800 font-semibold">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Live Thermal Slip Preview (5 cols) */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
                <Eye className="w-4 h-4 text-emerald-600" />
                <span>Live Thermal Slip Preview</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                {template.paper_size || '80mm'}
              </span>
            </div>

            {/* Receipt Wrapper Card styled like realistic thermal paper */}
            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 flex justify-center overflow-x-auto min-h-[460px]">
              <div className="bg-white p-3 text-black shadow-md rounded border border-slate-300 transition-all duration-200">
                <ThermalReceipt
                  order={previewOrder}
                  customTemplate={{
                    ...template,
                    business_name: businessName,
                    address,
                    phone,
                  }}
                />
              </div>
            </div>

            <div className="text-center">
              <p className="text-[11px] text-slate-500 font-medium">
                Live changes update instantly above. Click <strong>&quot;Save Template&quot;</strong> to apply.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
