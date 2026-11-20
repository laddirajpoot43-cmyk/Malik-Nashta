'use client';

import React, { useState, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { ThermalPrinterDevice, PrinterConfig } from '@/types/pos';
import {
  getKnownPrinters,
  setActivePrinter as persistActivePrinter,
  removePrinter,
  scanUsbPrinter,
  scanSerialPrinter,
  addSystemPrinter,
  getActivePrinter,
  generateEscPosTestSlip,
  sendRawToUsbPrinter,
} from '@/lib/printer';
import {
  Printer,
  Usb,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Sliders,
  Check,
  Zap,
  HelpCircle,
  Scissors,
  DollarSign,
  Monitor,
} from 'lucide-react';

export const PrinterDeviceManager: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { currentUser } = useAuth();

  const [printers, setPrinters] = useState<ThermalPrinterDevice[]>([]);
  const [activePrinterId, setActivePrinterId] = useState<string>('');
  const [loadingScan, setLoadingScan] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newDriverName, setNewDriverName] = useState<string>('Black Copper BC-95AC');
  const [newDriverWidth, setNewDriverWidth] = useState<'80mm' | '58mm'>('80mm');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Direct print preferences
  const [directPrint, setDirectPrint] = useState<boolean>(settings.printer_config?.direct_print_enabled ?? true);
  const [autoCut, setAutoCut] = useState<boolean>(settings.printer_config?.auto_cut ?? true);
  const [openDrawer, setOpenDrawer] = useState<boolean>(settings.printer_config?.open_cash_drawer ?? true);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  useEffect(() => {
    const list = getKnownPrinters();
    setPrinters(list);
    const active = getActivePrinter();
    if (active) {
      setActivePrinterId(active.id);
    }
  }, []);

  const handleSelectActive = async (printer: ThermalPrinterDevice) => {
    const updated = persistActivePrinter(printer.id);
    setPrinters(updated);
    setActivePrinterId(printer.id);

    // Save preference to server pos_settings
    try {
      const config: PrinterConfig = {
        printer_id: printer.id,
        printer_name: printer.name,
        connection_type: printer.type,
        paper_width: printer.paperWidth,
        direct_print_enabled: directPrint,
        auto_cut: autoCut,
        open_cash_drawer: openDrawer,
      };

      await updateSettings({ printer_config: config });
      showMsg(`"${printer.name}" selected as the active thermal printer!`);
    } catch (e: any) {
      showMsg(e.message, 'error');
    }
  };

  const handleScanUsb = async () => {
    setLoadingScan(true);
    const res = await scanUsbPrinter();
    setLoadingScan(false);

    if (res.success && res.printer) {
      const list = getKnownPrinters();
      setPrinters(list);
      setActivePrinterId(res.printer.id);
      showMsg(`Connected USB Thermal Printer: ${res.printer.name}`);
    } else {
      showMsg(res.error || 'Could not connect USB device.', 'error');
    }
  };

  const handleScanSerial = async () => {
    setLoadingScan(true);
    const res = await scanSerialPrinter();
    setLoadingScan(false);

    if (res.success && res.printer) {
      const list = getKnownPrinters();
      setPrinters(list);
      setActivePrinterId(res.printer.id);
      showMsg(`Connected Serial/COM Printer: ${res.printer.name}`);
    } else {
      showMsg(res.error || 'Could not connect Serial device.', 'error');
    }
  };

  const handleAddSystemPrinter = () => {
    if (!newDriverName.trim()) {
      showMsg('Please enter a printer driver name.', 'error');
      return;
    }
    const updated = addSystemPrinter(newDriverName.trim(), newDriverWidth);
    setPrinters(updated);
    setShowAddModal(false);
    showMsg(`Printer driver "${newDriverName}" added successfully.`);
  };

  const handleRemove = (id: string, name: string) => {
    const updated = removePrinter(id);
    setPrinters(updated);
    const active = getActivePrinter();
    if (active) setActivePrinterId(active.id);
    showMsg(`Printer "${name}" removed.`);
  };

  const handleTestPrint = async (printer: ThermalPrinterDevice) => {
    showMsg(`Sending test slip to ${printer.name}...`);
    try {
      if (printer.type === 'usb' && printer.vendorId) {
        const testData = generateEscPosTestSlip(printer, settings.business_name || 'MALIK TASTY NASHTA POINT');
        const res = await sendRawToUsbPrinter(printer, testData);
        if (res.success) {
          showMsg(`✓ Test slip printed successfully on ${printer.name}!`);
          return;
        }
      }

      // System printer print fallback
      window.print();
      showMsg(`✓ Test print command issued to ${printer.name}!`);
    } catch (err: any) {
      showMsg(`Print error: ${err.message}`, 'error');
    }
  };

  const handleSavePreferences = async () => {
    setSavingConfig(true);
    try {
      const active = printers.find((p) => p.id === activePrinterId) || printers[0];
      const config: PrinterConfig = {
        printer_id: active?.id,
        printer_name: active?.name || 'Default Thermal Printer',
        connection_type: active?.type || 'system',
        paper_width: active?.paperWidth || '80mm',
        direct_print_enabled: directPrint,
        auto_cut: autoCut,
        open_cash_drawer: openDrawer,
      };

      await updateSettings({ printer_config: config });
      showMsg('Thermal printer preferences saved successfully!');
    } catch (e: any) {
      showMsg(e.message, 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const activeDevice = printers.find((p) => p.id === activePrinterId) || printers[0];

  return (
    <div className="space-y-4">
      {/* Top Banner / Active Status */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-900">Thermal Printer Device Management</h2>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-full border border-indigo-300">
                Direct Print Engine
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              Currently Active Printer:{' '}
              <strong className="text-indigo-700 font-black">{activeDevice ? activeDevice.name : 'None Selected'}</strong>{' '}
              ({activeDevice?.paperWidth || '80mm'}) •{' '}
              <span className={directPrint ? 'text-indigo-700 font-bold' : 'text-slate-500'}>
                {directPrint ? 'Direct Print: ACTIVE' : 'Standard Dialog Print'}
              </span>
            </p>
          </div>
        </div>

        {/* Scan & Connect Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleScanUsb}
            disabled={loadingScan}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Plug in your USB thermal printer and click to connect"
          >
            <Usb className="w-4 h-4" />
            <span>{loadingScan ? 'Scanning...' : 'Connect USB Printer'}</span>
          </button>

          <button
            type="button"
            onClick={handleScanSerial}
            disabled={loadingScan}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Connect Serial or Virtual COM port thermal printer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Connect Serial / COM</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Driver Name</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-indigo-50 border border-indigo-300 text-indigo-800'
              : 'bg-rose-50 border border-rose-300 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Connected Devices Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Available & Connected Thermal Printers ({printers.length})
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Select the thermal printer you want to use for customer receipts. Direct print will automatically send bills to the selected device.
            </p>
          </div>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
            Auto-Detected
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {printers.map((p) => {
            const isSelected = p.id === activePrinterId;
            return (
              <div
                key={p.id}
                className={`p-3.5 rounded-xl border transition flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded-lg border ${
                          isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        <Printer className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900">{p.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9.5px] font-bold text-slate-500 uppercase">
                            {p.type === 'usb' ? 'USB Port' : p.type === 'serial' ? 'Serial/COM' : 'Windows Driver'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[9.5px] font-black text-slate-700 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                            {p.paperWidth}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[9.5px] font-bold text-indigo-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            Ready
                          </span>
                        </div>
                      </div>
                    </div>

                    {isSelected ? (
                      <span className="text-[10px] bg-indigo-600 text-white font-black px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" />
                        <span>ACTIVE</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectActive(p)}
                        className="text-[11px] bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-700 text-slate-700 font-bold px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer shrink-0"
                      >
                        Select Printer
                      </button>
                    )}
                  </div>

                  {p.vendorId && (
                    <div className="text-[9.5px] text-slate-500 mt-2 font-mono">
                      Hardware ID: VID 0x{p.vendorId.toString(16).toUpperCase()} • PID 0x{(p.productId || 0).toString(16).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Card Action Controls */}
                <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-200/80 text-xs">
                  <button
                    type="button"
                    onClick={() => handleTestPrint(p)}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-800 bg-white border border-indigo-300 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3 text-indigo-600" />
                    <span>Test Print Slip (ٹیسٹ پرنٹ)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemove(p.id, p.name)}
                    className="text-[10px] text-slate-400 hover:text-rose-600 transition flex items-center gap-0.5 p-1"
                    title="Remove from list"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Direct Print & Hardware Settings */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-600" />
              <span>Direct Print & Hardware Preferences (بلا ڈائیلاگ فوری پرنٹ)</span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Configure how the POS interacts with the thermal receipt printer when generating bills.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={savingConfig}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
          >
            {savingConfig ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Direct Print Switch */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Direct Auto-Print</span>
              <input
                type="checkbox"
                checked={directPrint}
                onChange={(e) => setDirectPrint(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
              Prints immediately without showing manual print dialog when cashier completes order.
            </p>
          </div>

          {/* Auto Paper Cut */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Scissors className="w-3 h-3 text-slate-600" />
                <span>Auto Paper Cut</span>
              </span>
              <input
                type="checkbox"
                checked={autoCut}
                onChange={(e) => setAutoCut(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
              Sends automatic paper cut pulse (GS V 0) at the end of each printed customer receipt.
            </p>
          </div>

          {/* Auto Open Drawer */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-indigo-600" />
                <span>Kick Cash Drawer</span>
              </span>
              <input
                type="checkbox"
                checked={openDrawer}
                onChange={(e) => setOpenDrawer(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
              Sends cash drawer trigger pulse (ESC p) to automatically pop open the cash drawer.
            </p>
          </div>
        </div>

        {/* Windows Silent Printing Setup Guide */}
        <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs space-y-1.5 mt-2">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900">
            <Monitor className="w-4 h-4 text-indigo-700" />
            <span>Windows 1-Click Silent Printing Setup (No Dialog Box Prompt)</span>
          </div>
          <p className="text-[11px] text-indigo-800 font-medium">
            To achieve zero-click instant printing on Windows with any thermal printer, create a desktop shortcut for Chrome or Edge with the{' '}
            <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-300 font-bold text-indigo-900">
              --kiosk-printing
            </code>{' '}
            flag:
          </p>
          <div className="bg-white p-2 rounded-lg border border-indigo-200 text-[10px] font-mono text-slate-800 select-all">
            chrome.exe --kiosk-printing --app=http://localhost:3000/pos
          </div>
        </div>
      </div>

      {/* MODAL: Add Custom Windows Thermal Printer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>Add Thermal Printer Driver</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Printer Driver / Model Name:</label>
                <input
                  type="text"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  placeholder="e.g. POS-80, XP-N160I, POS-58"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Paper Roll Width:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewDriverWidth('80mm')}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      newDriverWidth === '80mm'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    80mm (Standard 3-inch)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDriverWidth('58mm')}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      newDriverWidth === '58mm'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    58mm (Compact 2-inch)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddSystemPrinter}
                className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
              >
                Save & Add Printer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
