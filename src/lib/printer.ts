'use client';

import { Order, ThermalPrinterDevice } from '@/types/pos';
import { formatMoney } from './money';

const PRINTERS_STORAGE_KEY = 'malik_pos_thermal_printers';
const ACTIVE_PRINTER_KEY = 'malik_pos_active_printer_id';

const DEFAULT_PRINTERS: ThermalPrinterDevice[] = [
  {
    id: 'printer-usb-pos80',
    name: 'POS-80 USB Thermal Printer',
    type: 'usb',
    status: 'available',
    paperWidth: '80mm',
    isDefault: true,
  },
  {
    id: 'printer-sys-default',
    name: 'Default Windows Thermal Driver (POS-80/58)',
    type: 'system',
    status: 'connected',
    paperWidth: '80mm',
    isDefault: false,
  },
  {
    id: 'printer-xprinter-xp80',
    name: 'Xprinter XP-80C / XP-N160I Series',
    type: 'usb',
    status: 'available',
    paperWidth: '80mm',
    isDefault: false,
  },
  {
    id: 'printer-pos58-compact',
    name: 'POS-58 Compact Receipt Printer',
    type: 'usb',
    status: 'available',
    paperWidth: '58mm',
    isDefault: false,
  },
];

export function getKnownPrinters(): ThermalPrinterDevice[] {
  if (typeof window === 'undefined') return DEFAULT_PRINTERS;
  try {
    const raw = localStorage.getItem(PRINTERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const activeId = localStorage.getItem(ACTIVE_PRINTER_KEY);
        return parsed.map((p) => ({
          ...p,
          isDefault: activeId ? p.id === activeId : Boolean(p.isDefault),
        }));
      }
    }
  } catch (e) {
    console.warn('Failed to load known printers:', e);
  }
  return DEFAULT_PRINTERS;
}

export function saveKnownPrinters(printers: ThermalPrinterDevice[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PRINTERS_STORAGE_KEY, JSON.stringify(printers));
    const active = printers.find((p) => p.isDefault) || printers[0];
    if (active) {
      localStorage.setItem(ACTIVE_PRINTER_KEY, active.id);
    }
  } catch (e) {
    console.error('Failed to save printers:', e);
  }
}

export function getActivePrinter(): ThermalPrinterDevice | null {
  const printers = getKnownPrinters();
  return printers.find((p) => p.isDefault) || printers[0] || null;
}

export function setActivePrinter(id: string): ThermalPrinterDevice[] {
  const printers = getKnownPrinters();
  const updated = printers.map((p) => ({
    ...p,
    isDefault: p.id === id,
    status: p.id === id ? ('connected' as const) : p.status,
  }));
  saveKnownPrinters(updated);
  return updated;
}

export function removePrinter(id: string): ThermalPrinterDevice[] {
  const printers = getKnownPrinters();
  const updated = printers.filter((p) => p.id !== id);
  if (updated.length > 0 && !updated.some((p) => p.isDefault)) {
    updated[0].isDefault = true;
  }
  saveKnownPrinters(updated);
  return updated;
}

export function addSystemPrinter(name: string, paperWidth: '80mm' | '58mm' = '80mm'): ThermalPrinterDevice[] {
  const printers = getKnownPrinters();
  const newPrinter: ThermalPrinterDevice = {
    id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: name.trim() || 'Windows Thermal Printer',
    type: 'system',
    status: 'connected',
    paperWidth,
    isDefault: printers.length === 0,
    lastUsedAt: new Date().toISOString(),
  };
  const updated = [newPrinter, ...printers];
  saveKnownPrinters(updated);
  return updated;
}

/**
 * Scan for WebUSB Thermal Printers
 */
export async function scanUsbPrinter(): Promise<{ success: boolean; printer?: ThermalPrinterDevice; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'Window not available' };

  if (!(navigator as any).usb) {
    return {
      success: false,
      error: 'WebUSB API is not supported in this browser. Please use Google Chrome, Microsoft Edge, or configure via Windows System Printer Driver.',
    };
  }

  try {
    const device = await (navigator as any).usb.requestDevice({ filters: [] });
    if (!device) {
      return { success: false, error: 'No printer device was selected.' };
    }

    const deviceName =
      device.productName ||
      device.manufacturerName ||
      `USB Thermal Printer (VID:${device.vendorId.toString(16).toUpperCase()} PID:${device.productId.toString(16).toUpperCase()})`;

    const newPrinter: ThermalPrinterDevice = {
      id: `usb-${device.vendorId}-${device.productId}-${Date.now()}`,
      name: deviceName,
      type: 'usb',
      vendorId: device.vendorId,
      productId: device.productId,
      manufacturerName: device.manufacturerName,
      productName: device.productName,
      serialNumber: device.serialNumber,
      status: 'connected',
      paperWidth: '80mm',
      isDefault: true,
      lastUsedAt: new Date().toISOString(),
    };

    const current = getKnownPrinters().map((p) => ({ ...p, isDefault: false }));
    const updated = [newPrinter, ...current];
    saveKnownPrinters(updated);

    return { success: true, printer: newPrinter };
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('No device selected')) {
      return { success: false, error: 'Device selection was cancelled.' };
    }
    return { success: false, error: err.message || 'Failed to connect USB device' };
  }
}

/**
 * Scan for WebSerial COM Thermal Printers
 */
export async function scanSerialPrinter(): Promise<{ success: boolean; printer?: ThermalPrinterDevice; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'Window not available' };

  if (!(navigator as any).serial) {
    return {
      success: false,
      error: 'WebSerial API is not supported in this browser. Please use Chrome or Edge.',
    };
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    if (!port) return { success: false, error: 'No serial port selected.' };

    const info = port.getInfo ? port.getInfo() : {};
    const name = `Serial/COM Thermal Printer ${info.usbVendorId ? `(VID: 0x${info.usbVendorId.toString(16)})` : ''}`;

    const newPrinter: ThermalPrinterDevice = {
      id: `serial-${Date.now()}`,
      name,
      type: 'serial',
      vendorId: info.usbVendorId,
      productId: info.usbProductId,
      status: 'connected',
      paperWidth: '80mm',
      isDefault: true,
      lastUsedAt: new Date().toISOString(),
    };

    const current = getKnownPrinters().map((p) => ({ ...p, isDefault: false }));
    const updated = [newPrinter, ...current];
    saveKnownPrinters(updated);

    return { success: true, printer: newPrinter };
  } catch (err: any) {
    return { success: false, error: err.message || 'Serial connection cancelled' };
  }
}

/**
 * Generate standard ESC/POS bytes for thermal printer hardware
 */
export function generateEscPosReceipt(
  order: Order,
  paperWidth: '80mm' | '58mm' = '80mm',
  options: { autoCut?: boolean; openDrawer?: boolean; businessName?: string; phone?: string; address?: string } = {}
): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: number[] = [];

  const write = (str: string) => {
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) chunks.push(bytes[i]);
  };

  const writeBytes = (...b: number[]) => {
    for (const byte of b) chunks.push(byte);
  };

  // 1. Initialize Printer (ESC @)
  writeBytes(0x1b, 0x40);

  // 2. Open Cash Drawer if requested (ESC p 0 25 250)
  if (options.openDrawer) {
    writeBytes(0x1b, 0x70, 0x00, 0x19, 0xfa);
  }

  // 3. Center Align (ESC a 1)
  writeBytes(0x1b, 0x61, 0x01);

  // Double height & bold for business name
  writeBytes(0x1b, 0x21, 0x20); // Double height
  write(`${options.businessName || 'MALIK TASTY NASHTA POINT'}\n`);
  writeBytes(0x1b, 0x21, 0x00); // Normal text

  write(`${options.address || 'Vehari Road, Hasilpur, Punjab'}\n`);
  write(`Phone: ${options.phone || '0306-8068058'}\n`);
  write('Fresh & Crispy Nashta Everyday\n');
  write('------------------------------------------------\n');

  // Left Align for Metadata (ESC a 0)
  writeBytes(0x1b, 0x61, 0x00);
  write(`Receipt #: ${order.receipt_number || 'N/A'}\n`);
  write(`Order #:   ${order.order_number || 'N/A'}\n`);
  write(`Date/Time: ${new Date(order.created_at || Date.now()).toLocaleString('en-PK')}\n`);
  write(`Cashier:   ${order.cashier_name_snapshot || 'Counter'}\n`);
  if (order.customer_name) {
    write(`Customer:  ${order.customer_name}\n`);
  }
  write('------------------------------------------------\n');

  // Column Headers
  write('Item                     Qty     Rate     Total\n');
  write('------------------------------------------------\n');

  // Line Items - Note: Redundant 'full plate' is completely omitted per user request!
  if (order.items && Array.isArray(order.items)) {
    for (const item of order.items) {
      const name = item.product_name_snapshot || 'Item';
      const qty = `${item.quantity}x`.padEnd(6);
      const rate = `${item.unit_price}`.padEnd(8);
      const total = formatMoney(item.line_total).padStart(10);

      // Clean item name without redundant full plate text
      write(`${name.padEnd(20).slice(0, 20)} ${qty} ${rate} ${total}\n`);

      // Only show portion if it is Half Plate or custom note, never duplicate full plate
      if (item.pricing_method && item.pricing_method.toLowerCase().includes('half')) {
        write(`   [${item.pricing_method}]\n`);
      }
    }
  }

  write('------------------------------------------------\n');

  // Right Align for Financials (ESC a 2)
  writeBytes(0x1b, 0x61, 0x02);
  write(`Subtotal: ${formatMoney(order.subtotal)}\n`);
  if (Number(order.discount_amount || 0) > 0) {
    write(`Discount: -${formatMoney(order.discount_amount)}\n`);
  }
  if (Number(order.rounding_amount || 0) !== 0) {
    write(`Rounding: ${formatMoney(order.rounding_amount)}\n`);
  }

  // Bold Grand Total
  writeBytes(0x1b, 0x21, 0x30); // Double height & width
  write(`TOTAL: ${formatMoney(order.grand_total)}\n`);
  writeBytes(0x1b, 0x21, 0x00); // Normal text

  write('------------------------------------------------\n');

  // Center Align for Footers (ESC a 1)
  writeBytes(0x1b, 0x61, 0x01);
  write('شکریہ! دوبارہ تشریف لائیں\n');

  // Single line English message per user request
  write('Thank you for choosing Malik Tasty Nashta Point!\n');
  write('------------------------------------------------\n');

  // Single line Credit & Phone Number per user request
  write('Buid by Ammar - 03260603565\n');

  // Feed lines (ESC d 4)
  writeBytes(0x1b, 0x64, 0x04);

  // Full Paper Cut (GS V 0) if enabled
  if (options.autoCut !== false) {
    writeBytes(0x1d, 0x56, 0x00);
  }

  return new Uint8Array(chunks);
}

/**
 * Generate a Test Slip for Hardware Verification
 */
export function generateEscPosTestSlip(printer: ThermalPrinterDevice, businessName: string = 'MALIK TASTY NASHTA POINT'): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: number[] = [];

  const write = (str: string) => {
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) chunks.push(bytes[i]);
  };

  const writeBytes = (...b: number[]) => {
    for (const byte of b) chunks.push(byte);
  };

  // Initialize
  writeBytes(0x1b, 0x40);

  // Center
  writeBytes(0x1b, 0x61, 0x01);
  writeBytes(0x1b, 0x21, 0x20); // Double height
  write(`${businessName}\n`);
  writeBytes(0x1b, 0x21, 0x00);

  write('THERMAL PRINTER TEST SLIP\n');
  write('------------------------------------------------\n');

  writeBytes(0x1b, 0x61, 0x00); // Left align
  write(`Printer:   ${printer.name}\n`);
  write(`Interface: ${printer.type.toUpperCase()}\n`);
  write(`Paper:     ${printer.paperWidth}\n`);
  write(`Status:    READY & CONNECTED\n`);
  write(`Tested At: ${new Date().toLocaleString('en-PK')}\n`);
  write('------------------------------------------------\n');

  writeBytes(0x1b, 0x61, 0x01); // Center
  write('*** PRINT HARDWARE TEST SUCCESSFUL ***\n');
  write('Thank you for choosing Malik Tasty Nashta Point!\n');
  write('Buid by Ammar - 03260603565\n');

  // Feed & Cut
  writeBytes(0x1b, 0x64, 0x04);
  writeBytes(0x1d, 0x56, 0x00);

  return new Uint8Array(chunks);
}

/**
 * Transmit ESC/POS raw bytes directly to connected USB Printer
 */
export async function sendRawToUsbPrinter(printer: ThermalPrinterDevice, data: Uint8Array): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !(navigator as any).usb) {
    return { success: false, error: 'WebUSB is not supported in this browser.' };
  }

  try {
    const devices = await (navigator as any).usb.getDevices();
    let device = devices.find((d: any) => d.vendorId === printer.vendorId && d.productId === printer.productId);

    if (!device) {
      device = await (navigator as any).usb.requestDevice({
        filters: printer.vendorId ? [{ vendorId: printer.vendorId, productId: printer.productId }] : [],
      });
    }

    if (!device) {
      return { success: false, error: 'USB Printer device not accessible' };
    }

    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // Claim first interface
    const iface = device.configuration?.interfaces?.[0];
    const ifaceNumber = iface ? iface.interfaceNumber : 0;
    await device.claimInterface(ifaceNumber);

    // Find OUT endpoint for printer
    let endpointNumber = 1;
    const alternate = iface?.alternates?.[0];
    if (alternate?.endpoints) {
      const outEndpoint = alternate.endpoints.find((ep: any) => ep.direction === 'out');
      if (outEndpoint) {
        endpointNumber = outEndpoint.endpointNumber;
      }
    }

    await device.transferOut(endpointNumber, data);
    await device.close();

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed USB transfer' };
  }
}

/**
 * Direct Print Orchestrator:
 * Executes direct ESC/POS hardware print if USB/Serial device is connected,
 * otherwise triggers browser print dialog.
 */
export async function printDirect(
  order: Order,
  options: {
    device?: ThermalPrinterDevice | null;
    autoCut?: boolean;
    openDrawer?: boolean;
    businessName?: string;
    phone?: string;
    address?: string;
  } = {}
): Promise<{ success: boolean; method: 'usb' | 'system' | 'fallback'; error?: string }> {
  const activePrinter = options.device || getActivePrinter();

  // If USB printer is configured, attempt direct WebUSB output
  if (activePrinter && activePrinter.type === 'usb' && activePrinter.vendorId) {
    try {
      const escPosData = generateEscPosReceipt(order, activePrinter.paperWidth, {
        autoCut: options.autoCut !== false,
        openDrawer: options.openDrawer ?? true,
        businessName: options.businessName,
        phone: options.phone,
        address: options.address,
      });

      const usbRes = await sendRawToUsbPrinter(activePrinter, escPosData);
      if (usbRes.success) {
        return { success: true, method: 'usb' };
      }
    } catch (usbErr) {
      console.warn('Direct WebUSB printing failed, falling back to browser print:', usbErr);
    }
  }

  // Fallback / Standard System Print
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      window.print();
    }, 60);
    return { success: true, method: 'system' };
  }

  return { success: false, method: 'fallback', error: 'No print engine available' };
}
