'use client';

import React, { useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
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
} from 'lucide-react';

export const ReceiptTemplateEditor: React.FC = () => {
  const { settings, updateSettings } = useSettings();

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
    show_kitchen_notes: true,
    show_addons: true,
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
    cashier_name_snapshot: 'Malik Ammar (Admin)',
    subtotal: 590.0,
    discount_type: 'percentage',
    discount_value: 10,
    discount_amount: 59.0,
    rounding_amount: -1.0,
    grand_total: 530.0,
    reprint_count: 0,
    created_at: new Date().toISOString(),
    payments: [
      { method_id: 'cash', amount: 530.0 }
    ],
    total_paid: 1000.0,
    change_returned: 470.0,
    items: [
      {
        id: 'item-1',
        product_name_snapshot: 'Special Lahori Channay (Poora)',
        unit_price: 260.0,
        quantity: 1,
        line_total: 310.0,
        addons: [
          { name: 'Makhan / Fresh Butter', price: 50.0 }
        ],
        note: 'Garam garam tari tez',
        refunded_quantity: 0,
      },
      {
        id: 'item-2',
        product_name_snapshot: 'Crispy Roghani Naan',
        unit_price: 40.0,
        quantity: 4,
        line_total: 160.0,
        note: null,
        refunded_quantity: 0,
      },
      {
        id: 'item-3',
        product_name_snapshot: 'Special Doodh Patti Chai',
        unit_price: 90.0,
        quantity: 2,
        line_total: 180.0,
        note: 'Patti kadak, meetha normal',
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
        setFeedback({ type: 'success', message: 'Receipt slip template saved successfully! Active for all future prints.' });
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
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-700 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Thermal Receipt Slip Template Customizer
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                Live Preview
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Customize header branding, Urdu/English greetings, paper widths (80mm/58mm), font sizing, and visible print sections.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintTest}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Test Print Dialog</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save Template'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Sliders className="w-4 h-4 text-rose-400" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Grid: Form Controls Left, Live Thermal Slip Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Business Header Branding */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <Type className="w-4 h-4 text-amber-400" />
              <span>Header Branding & Business Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Hotel / Shop Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Slogan / Tagline</label>
                <input
                  type="text"
                  value={template.tagline || ''}
                  onChange={(e) => handleTextChange('tagline', e.target.value)}
                  placeholder="e.g. Fresh & Crispy Nashta Everyday"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Phone Number(s)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">NTN / STRN # (Optional)</label>
                <input
                  type="text"
                  value={template.ntn_strn || ''}
                  onChange={(e) => handleTextChange('ntn_strn', e.target.value)}
                  placeholder="e.g. NTN: 829104-5"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Physical Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Top Announcement Message</label>
                <input
                  type="text"
                  value={template.header_message || ''}
                  onChange={(e) => handleTextChange('header_message', e.target.value)}
                  placeholder="e.g. Special Lahori Channay & Crispy Parathay"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Footers & Urdu Greeting */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Bottom Greetings & Urdu Messages</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Urdu Greeting Message (اردو شکریہ پیغام)
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={template.footer_message_urdu || ''}
                  onChange={(e) => handleTextChange('footer_message_urdu', e.target.value)}
                  placeholder="شکریہ! دوبارہ تشریف لائیں"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-amber-300 focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">English Greeting Message</label>
                <input
                  type="text"
                  value={template.footer_message_english || ''}
                  onChange={(e) => handleTextChange('footer_message_english', e.target.value)}
                  placeholder="Thank you for visiting Malik Tasty Nashta Point!"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Paper Size, Font Size & Toggle Switches */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>Printer Geometry & Visibility Toggles</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Paper Roll Width</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTextChange('paper_size', '80mm')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      template.paper_size === '80mm'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                        : 'bg-slate-950 text-slate-400 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <span>80mm</span>
                    <span className="text-[10px] font-normal opacity-80">(Standard)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTextChange('paper_size', '58mm')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      template.paper_size === '58mm'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                        : 'bg-slate-950 text-slate-400 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <span>58mm</span>
                    <span className="text-[10px] font-normal opacity-80">(Compact)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Base Font Size</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleTextChange('font_size', size)}
                      className={`py-2 px-2 rounded-xl border text-xs font-bold capitalize transition ${
                        template.font_size === size
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                          : 'bg-slate-950 text-slate-400 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Show / Hide Receipt Sections
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { key: 'show_cashier_name', label: 'Show Cashier Name' },
                  { key: 'show_customer_info', label: 'Show Customer Info (Name/Phone)' },
                  { key: 'show_order_number', label: 'Show Order # (Kitchen Queue)' },
                  { key: 'show_kitchen_notes', label: 'Show Kitchen Preparation Notes' },
                  { key: 'show_addons', label: 'Show Addons Breakdown (Makhan, Tari)' },
                  { key: 'show_duplicate_watermark', label: 'Show Watermark on Reprint Copies' },
                ].map(({ key, label }) => {
                  const isChecked = template[key as keyof ReceiptTemplateConfig] !== false;
                  return (
                    <label
                      key={key}
                      onClick={() => handleToggle(key as keyof ReceiptTemplateConfig)}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 cursor-pointer select-none transition"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent onClick
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <span className="text-xs text-slate-300 font-medium">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Live Thermal Slip Preview (5 cols) */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>Live Thermal Slip Preview</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {template.paper_size || '80mm'}
              </span>
            </div>

            {/* Receipt Wrapper Card styled like realistic thermal paper */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-center overflow-x-auto min-h-[500px]">
              <div className="bg-white p-4 text-black shadow-2xl rounded-sm transition-all duration-200">
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
              <p className="text-[11px] text-slate-500">
                Changes appear instantaneously in the preview above. Click "Save Template" to persist.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

