import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { insforgeAdmin, INSFORGE_BASE_URL } from './insforge';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

// Fallback in-memory and disk-persisted data store for zero-downtime reliability
// On serverless (e.g. Vercel), process.cwd() is read-only, so fall back to os.tmpdir()
const DATA_DIR = process.env.VERCEL ? path.join(os.tmpdir(), '.malik_pos_data') : path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'pos_store.json');

interface SchemaStore {
  sequences: Record<string, number>;
  profiles: any[];
  register_sessions: any[];
  register_transactions: any[];
  categories: any[];
  products: any[];
  product_addons: any[];
  orders: any[];
  order_items: any[];
  order_payments: any[];
  held_orders: any[];
  refunds: any[];
  refund_items: any[];
  vendors: any[];
  raw_materials: any[];
  purchase_invoices: any[];
  purchase_items: any[];
  vendor_payments: any[];
  audit_logs: any[];
  pos_settings: any[];
  customers?: any[];
  customer_transactions?: any[];
  expenses?: any[];
  product_pricing_map?: Record<string, any>;
}

function getDefaultData(): SchemaStore {
  return {
    sequences: {
      receipt_seq: 1000,
      order_seq: 0,
      refund_seq: 100,
      hold_seq: 0,
      purchase_seq: 1000,
      vendor_pay_seq: 1000,
      customer_pay_seq: 1000,
      expense_seq: 1000,
    },
    profiles: [
      {
        id: '11111111-1111-1111-1111-111111111101',
        email: 'admin@maliknashta.pk',
        full_name: 'Malik Mavia Sultan',
        display_name: 'Malik Mavia Sultan',
        role: 'admin',
        status: 'active',
        pin_code: '1234',
        created_at: new Date().toISOString(),
      },
      {
        id: '11111111-1111-1111-1111-111111111102',
        email: 'cashier@maliknashta.pk',
        full_name: 'Malik Mavia Sultan',
        display_name: 'Malik Mavia Sultan',
        role: 'cashier',
        status: 'active',
        pin_code: '0000',
        created_at: new Date().toISOString(),
      },
    ],
    pos_settings: [
      {
        id: '33333333-3333-3333-3333-333333333301',
        business_name: 'MALIK TASTY NASHTA POINT',
        address: 'Vehari Road, Hasilpur, Punjab, Pakistan',
        phone: '0306-8068058',
        greeting_message: 'Fresh & Crispy Nashta Everyday',
        admin_pin: '1234',
        cash_rounding_enabled: true,
        require_admin_pin_refunds: true,
        default_tax_rate: 0,
        max_cashier_discount_percent: 15,
        receipt_template: {
          paper_size: '80mm',
          tagline: 'Fresh & Crispy Nashta Everyday',
          ntn_strn: 'NTN: 829104-5',
          header_message: 'Special Lahori Channay & Crispy Parathay',
          footer_message_urdu: 'شکریہ! دوبارہ تشریف لائیں',
          footer_message_english: 'Thank you for choosing Malik Tasty Nashta Point!',
          footer_credit_name: 'Buid by Ammar',
          footer_credit_phone: '03260603565',
          show_cashier_name: true,
          show_admin_name: false,
          show_customer_info: true,
          show_order_number: true,
          show_kitchen_notes: true,
          show_addons: true,
          show_duplicate_watermark: true,
          font_size: 'medium',
        },
        created_at: new Date().toISOString(),
      },
    ],
    categories: [],
    products: [],
    product_addons: [],
    register_sessions: [],
    register_transactions: [],
    orders: [],
    order_items: [],
    order_payments: [],
    held_orders: [],
    refunds: [],
    refund_items: [],
    vendors: [],
    raw_materials: [],
    purchase_invoices: [],
    purchase_items: [],
    vendor_payments: [],
    customers: [],
    customer_transactions: [],
    expenses: [],
    product_pricing_map: {},
    audit_logs: [
      {
        id: 'log-001',
        user_name: 'Malik Mavia Sultan',
        action: 'SYSTEM_INIT',
        entity_type: 'system',
        entity_id: 'sys',
        description: 'Malik Tasty Nashta Point POS Clean Store Initialized',
        created_at: new Date().toISOString(),
      },
    ],
  };
}

const CLOUD_TABLES: (keyof Omit<SchemaStore, 'sequences'>)[] = [
  'profiles',
  'pos_settings',
  'categories',
  'products',
  'vendors',
  'raw_materials',
  'register_sessions',
  'register_transactions',
  'orders',
  'order_items',
  'order_payments',
  'held_orders',
  'refunds',
  'refund_items',
  'purchase_invoices',
  'purchase_items',
  'vendor_payments',
  'audit_logs',
];

class StoreManager {
  private data: SchemaStore;
  private prevSnapshotIds: Record<string, Set<string>> = {};
  private cloudConnected: boolean = false;
  private lastCloudSyncAt: string | null = null;
  private syncInProgress: boolean = false;
  private lastFileLoadTime: number = 0;

  constructor() {
    this.data = this.loadData();
    this.recordSnapshotIds();
    // Automatically fetch latest rows from InsForge Cloud PostgreSQL on startup
    this.hydrateFromCloud().catch(() => {});
  }

  private recordSnapshotIds() {
    for (const t of CLOUD_TABLES) {
      const list = (this.data[t] as any[]) || [];
      this.prevSnapshotIds[t] = new Set(list.map((r: any) => String(r.id)));
    }
  }

  private loadData(): SchemaStore {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const stat = fs.statSync(DB_FILE);
        this.lastFileLoadTime = stat.mtimeMs;
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed;
      }
    } catch (e) {
      console.warn('Could not read store file, using default data:', e);
    }
    const def = getDefaultData();
    this.saveData(def, false);
    return def;
  }

  public async hydrateFromCloud(): Promise<{ connected: boolean; tablesLoaded: number; baseUrl: string }> {
    try {
      let loaded = 0;
      for (const t of CLOUD_TABLES) {
        if (t === 'product_addons' && fs.existsSync(DB_FILE)) {
          // Addons tab is removed/disabled as requested
          continue;
        }
        const { data: rows, error } = await insforgeAdmin.database.from(t).select('*');
        if (!error && Array.isArray(rows)) {
          loaded++;
          if (rows.length > 0) {
            if (t === 'pos_settings') {
              const extRow = rows.find((r: any) => r.id === '44444444-4444-4444-4444-444444444402');
              if (extRow && extRow.receipt_template) {
                const ext = extRow.receipt_template;
                if (Array.isArray(ext.customers)) this.data.customers = ext.customers;
                if (Array.isArray(ext.customer_transactions)) this.data.customer_transactions = ext.customer_transactions;
                if (Array.isArray(ext.expenses)) this.data.expenses = ext.expenses;
                if (ext.product_pricing_map && typeof ext.product_pricing_map === 'object') {
                  this.data.product_pricing_map = ext.product_pricing_map;
                }
              }
              const mainRows = rows.filter((r: any) => r.id !== '44444444-4444-4444-4444-444444444402');
              (this.data as any).pos_settings = mainRows.map((r: any) => ({
                ...r,
                default_tax_rate: r.default_tax_rate !== undefined && r.default_tax_rate !== null ? Number(r.default_tax_rate) : r.default_tax_rate,
                max_cashier_discount_percent: r.max_cashier_discount_percent !== undefined && r.max_cashier_discount_percent !== null ? Number(r.max_cashier_discount_percent) : r.max_cashier_discount_percent,
                printer_config: r.receipt_template?.printer_config || r.printer_config,
              }));
              continue;
            }
            // Merge numeric fields back to numbers where appropriate (PostgREST returns NUMERIC as number or string)
            (this.data as any)[t] = rows.map((r: any) => {
              const normalized = { ...r };
              for (const k of Object.keys(normalized)) {
                if (
                  (k.endsWith('_price') ||
                    k.endsWith('_amount') ||
                    k.endsWith('_total') ||
                    k.endsWith('_balance') ||
                    k === 'price' ||
                    k === 'subtotal' ||
                    k === 'amount' ||
                    k === 'quantity' ||
                    k === 'difference' ||
                    k === 'change_returned' ||
                    k === 'discount_value' ||
                    k === 'tax_rate' ||
                    k === 'default_tax_rate' ||
                    k === 'max_cashier_discount_percent') &&
                  normalized[k] !== null &&
                  normalized[k] !== undefined
                ) {
                  normalized[k] = Number(normalized[k]);
                }
              }

              if (t === 'products') {
                const existingProd = (this.data.products || []).find((p: any) => p.id === normalized.id);
                const savedPricing = (this.data.product_pricing_map || {})[normalized.id];
                const srcPricing = savedPricing || existingProd?.pricing_config;
                const fullPrice = Number(normalized.selling_price || 0);
                const defaultHalfPrice = Math.round((fullPrice * 0.55) / 5) * 5;

                normalized.pricing_config = {
                  enable_by_plate: srcPricing?.enable_by_plate ?? true,
                  full_plate_price:
                    srcPricing?.full_plate_price &&
                    srcPricing.full_plate_price > 0 &&
                    srcPricing.full_plate_price === fullPrice
                      ? srcPricing.full_plate_price
                      : fullPrice,
                  half_plate_price:
                    srcPricing?.half_plate_price && srcPricing.half_plate_price > 0
                      ? srcPricing.half_plate_price
                      : defaultHalfPrice,
                  enable_by_price: srcPricing?.enable_by_price ?? true,
                  min_price: srcPricing?.min_price ?? 10.0,
                  enable_custom_price: srcPricing?.enable_custom_price ?? true,
                  custom_price_label: srcPricing?.custom_price_label ?? 'Half Rate',
                  custom_price:
                    srcPricing?.custom_price && srcPricing.custom_price > 0
                      ? srcPricing.custom_price
                      : defaultHalfPrice,
                };
              }

              if (t === 'orders') {
                const existingOrder = (this.data.orders || []).find((o: any) => o.id === normalized.id);
                if (existingOrder?.admin_name_snapshot && !normalized.admin_name_snapshot) {
                  normalized.admin_name_snapshot = existingOrder.admin_name_snapshot;
                }
                if (normalized.order_note && normalized.order_note.includes('[DAILY_CLOSED]')) {
                  normalized.daily_closed = true;
                } else if (existingOrder?.daily_closed) {
                  normalized.daily_closed = true;
                  normalized.daily_closed_at = existingOrder.daily_closed_at;
                }
                if (typeof normalized.items === 'string') {
                  try { normalized.items = JSON.parse(normalized.items); } catch {}
                }
                if (typeof normalized.payments === 'string') {
                  try { normalized.payments = JSON.parse(normalized.payments); } catch {}
                }
              }

              if (t === 'order_items') {
                const existingItem = (this.data.order_items || []).find((oi: any) => oi.id === normalized.id);
                if (existingItem?.pricing_method && !normalized.pricing_method) {
                  normalized.pricing_method = existingItem.pricing_method;
                } else if (!normalized.pricing_method && normalized.kitchen_note) {
                  normalized.pricing_method = normalized.kitchen_note;
                }
                if (existingItem?.pricing_type && !normalized.pricing_type) {
                  normalized.pricing_type = existingItem.pricing_type;
                }
              }

              return normalized;
            });
          } else {
            // Cloud has 0 rows for this table
            if (t === 'orders' || t === 'order_items' || t === 'order_payments' || t === 'register_transactions') {
              if (Array.isArray((this.data as any)[t]) && (this.data as any)[t].length > 0) {
                // Keep local transactional records so newly created orders are never wiped
                continue;
              }
            }
            (this.data as any)[t] = [];
          }
        }
      }

      if (loaded > 0) {
        // Hydrate joined items/payments onto orders and sort newest-first
        const allItems = this.data.order_items || [];
        const allPayments = this.data.order_payments || [];
        if (Array.isArray(this.data.orders)) {
          this.data.orders = this.data.orders
            .map((o: any) => ({
              ...o,
              items: Array.isArray(o.items) && o.items.length > 0 ? o.items : allItems.filter((i: any) => i.order_id === o.id),
              payments: Array.isArray(o.payments) && o.payments.length > 0 ? o.payments : allPayments.filter((p: any) => p.order_id === o.id),
            }))
            .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

          // Keep receipt & order sequences ahead of highest existing cloud records
          if (!this.data.sequences) this.data.sequences = getDefaultData().sequences;
          for (const o of this.data.orders) {
            const recMatch = String(o.receipt_number || '').match(/(\d+)$/);
            if (recMatch) {
              const num = parseInt(recMatch[1], 10);
              if (num > (this.data.sequences.receipt_seq || 0)) this.data.sequences.receipt_seq = num;
            }
            const ordMatch = String(o.order_number || '').match(/(\d+)$/);
            if (ordMatch) {
              const num = parseInt(ordMatch[1], 10);
              if (num > (this.data.sequences.order_seq || 0)) this.data.sequences.order_seq = num;
            }
          }
        }

        this.cloudConnected = true;
        this.lastCloudSyncAt = new Date().toISOString();
        this.recordSnapshotIds();
        try {
          if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
          }
          fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
        } catch {
          // Ignore disk write failure on read-only serverless filesystems
        }
      }

      return { connected: loaded > 0, tablesLoaded: loaded, baseUrl: INSFORGE_BASE_URL };
    } catch (err) {
      return { connected: false, tablesLoaded: 0, baseUrl: INSFORGE_BASE_URL };
    }
  }

  public async syncToCloud(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;
    try {
      // Ensure product_pricing_map stays synced with products.pricing_config before pos_settings upserts
      if (Array.isArray(this.data.products)) {
        const nextMap: Record<string, any> = { ...(this.data.product_pricing_map || {}) };
        for (const p of this.data.products) {
          if (p && p.id && p.pricing_config !== undefined) {
            nextMap[String(p.id)] = p.pricing_config;
          }
        }
        this.data.product_pricing_map = nextMap;
      }

      for (const t of CLOUD_TABLES) {
        try {
          const currentRows = ((this.data as any)[t] as any[]) || [];
          const currentIds = new Set(currentRows.map((r: any) => String(r.id)));
          const prevIds = this.prevSnapshotIds[t] || new Set<string>();

          // Find deleted IDs
          const deletedIds: string[] = [];
          for (const oldId of prevIds) {
            if (t === 'pos_settings' && oldId === '44444444-4444-4444-4444-444444444402') {
              continue;
            }
            if (!currentIds.has(oldId)) {
              deletedIds.push(oldId);
            }
          }

          if (deletedIds.length > 0) {
            await insforgeAdmin.database.from(t).delete().in('id', deletedIds);
          }

          if (currentRows.length > 0) {
            // For audit_logs, only upsert the newest 10 rows to keep sync ultra-fast
            const rawSlice = t === 'audit_logs' ? currentRows.slice(0, 10) : currentRows;
            const rowsToUpsert = rawSlice.map((r: any) => {
              const clean = { ...r };
              // Strip client-side joined relationships and non-existent SQL table columns in cloud Postgres
              if (t === 'orders') {
                delete clean.admin_name_snapshot;
                if (clean.daily_closed && !clean.order_note?.includes('[DAILY_CLOSED]')) {
                  clean.order_note = clean.order_note ? `${clean.order_note} [DAILY_CLOSED]` : '[DAILY_CLOSED]';
                }
                delete clean.daily_closed;
                delete clean.daily_closed_at;
                delete clean.refunds;
              } else if (t === 'order_items') {
                if (clean.pricing_method && !clean.kitchen_note) {
                  clean.kitchen_note = clean.pricing_method;
                }
                delete clean.pricing_method;
                delete clean.pricing_type;
              } else if (t === 'purchase_invoices') {
                delete clean.items;
              } else if (t === 'refunds') {
                delete clean.items;
              } else if (t === 'products') {
                if (clean.pricing_config) {
                  if (!this.data.product_pricing_map) this.data.product_pricing_map = {};
                  this.data.product_pricing_map[clean.id] = clean.pricing_config;
                }
                delete clean.category_name;
                delete clean.pricing_config;
              } else if (t === 'pos_settings') {
                delete clean.printer_config;
              } else if (t === 'vendor_payments') {
                delete clean.vendor_name;
              }
              return clean;
            });

            if (t === 'pos_settings') {
              rowsToUpsert.push({
                id: '44444444-4444-4444-4444-444444444402',
                business_name: '__EXTENDED_STORE__',
                receipt_template: {
                  customers: this.data.customers || [],
                  customer_transactions: this.data.customer_transactions || [],
                  expenses: this.data.expenses || [],
                  product_pricing_map: this.data.product_pricing_map || {},
                },
              });
            }
            await insforgeAdmin.database.from(t).upsert(rowsToUpsert, { onConflict: 'id' });
          }

          this.prevSnapshotIds[t] = currentIds;
        } catch (tableErr) {
          console.warn(`Cloud sync warning for table ${t}:`, tableErr);
        }
      }
      this.cloudConnected = true;
      this.lastCloudSyncAt = new Date().toISOString();
    } catch (err) {
      // Silent fallback if offline
    } finally {
      this.syncInProgress = false;
    }
  }

  public saveData(data?: SchemaStore, syncCloud: boolean = true) {
    if (data) this.data = data;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
      if (fs.existsSync(DB_FILE)) {
        this.lastFileLoadTime = fs.statSync(DB_FILE).mtimeMs;
      }
    } catch (e) {
      // Do not block cloud sync if local disk is read-only
    }
    if (syncCloud) {
      this.syncToCloud().catch(() => {});
    }
  }

  public async saveAndSync(data?: SchemaStore): Promise<void> {
    this.saveData(data, false);
    await this.syncToCloud();
  }

  public getData(): SchemaStore {
    try {
      if (fs.existsSync(DB_FILE)) {
        const stat = fs.statSync(DB_FILE);
        if (stat.mtimeMs > this.lastFileLoadTime) {
          this.lastFileLoadTime = stat.mtimeMs;
          const raw = fs.readFileSync(DB_FILE, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            this.data = parsed;
          }
        }
      }
    } catch (e) {
      // Fallback to current memory data
    }
    return this.data;
  }

  public async ensureFresh(maxAgeMs: number = 4000): Promise<SchemaStore> {
    const store = this.getData();
    const hasProducts = Array.isArray(store.products) && store.products.length > 0;
    const hasCategories = Array.isArray(store.categories) && store.categories.length > 0;
    const now = Date.now();
    const isStale = !this.lastCloudSyncAt || (now - new Date(this.lastCloudSyncAt).getTime() > maxAgeMs);

    if (!hasProducts || !hasCategories || isStale || !this.cloudConnected) {
      try {
        await this.hydrateFromCloud();
      } catch (err) {
        // Fallback gracefully
      }
    }
    return this.getData();
  }

  public getCloudStatus() {
    return {
      connected: this.cloudConnected,
      baseUrl: INSFORGE_BASE_URL,
      lastSyncAt: this.lastCloudSyncAt,
    };
  }

  public getNextSequence(
    type:
      | 'receipt_seq'
      | 'order_seq'
      | 'refund_seq'
      | 'hold_seq'
      | 'purchase_seq'
      | 'vendor_pay_seq'
      | 'customer_pay_seq'
      | 'expense_seq'
  ): string {
    if (!this.data.sequences) {
      this.data.sequences = getDefaultData().sequences;
    }
    const curr = (this.data.sequences[type] || 0) + 1;
    this.data.sequences[type] = curr;
    this.saveData(undefined, false);

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    switch (type) {
      case 'receipt_seq':
        return `MTN-${String(curr).padStart(7, '0')}`;
      case 'order_seq':
        return `ORD-${today}-${String(curr).padStart(4, '0')}`;
      case 'refund_seq':
        return `REF-${String(curr).padStart(6, '0')}`;
      case 'hold_seq':
        return `HOLD-${String(curr).padStart(3, '0')}`;
      case 'purchase_seq':
        return `PUR-${String(curr).padStart(5, '0')}`;
      case 'vendor_pay_seq':
        return `VPAY-${String(curr).padStart(5, '0')}`;
      case 'customer_pay_seq':
        return `CPAY-${String(curr).padStart(5, '0')}`;
      case 'expense_seq':
        return `EXP-${String(curr).padStart(5, '0')}`;
      default:
        return `${curr}`;
    }
  }
}

const storeManager = new StoreManager();

export const localStore = {
  get: () => storeManager.getData(),
  save: () => storeManager.saveData(),
  saveAndSync: () => storeManager.saveAndSync(),
  ensureFresh: (maxAgeMs?: number) => storeManager.ensureFresh(maxAgeMs),
  nextSeq: (type: any) => storeManager.getNextSequence(type),
  syncFromCloud: () => storeManager.hydrateFromCloud(),
  syncToCloud: () => storeManager.syncToCloud(),
  getCloudStatus: () => storeManager.getCloudStatus(),
};

// PostgreSQL pool instance (only used if a direct TCP postgres:// URI is configured)
let pgPool: Pool | null = null;
let pgAvailable = false;

export async function initDbPool(): Promise<Pool | null> {
  if (pgPool) return pgPool;
  const connString = process.env.INSFORGE_DATABASE_URL || process.env.DATABASE_URL;
  // When using InsForge BaaS (https://...insforge.app), queries go through @insforge/sdk (insforgeAdmin), not raw TCP pg.Pool
  if (!connString || connString.startsWith('http://') || connString.startsWith('https://')) {
    return null;
  }

  try {
    const pool = new Pool({
      connectionString: connString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000,
      max: 10,
    });
    const client = await pool.connect();
    client.release();
    pgPool = pool;
    pgAvailable = true;
    console.log('Connected successfully to PostgreSQL database pool.');
    return pool;
  } catch (err: any) {
    pgPool = null;
    pgAvailable = false;
    return null;
  }
}

/**
 * Universal Atomic Transaction Runner:
 * Executes the callback within an atomic transaction.
 * In PostgreSQL, uses BEGIN/COMMIT/ROLLBACK.
 * In local store, performs atomic copy and rollback on error.
 */
export async function withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const pool = await initDbPool();
  if (pool && pgAvailable) {
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Atomic local transaction with snapshot & rollback + synchronous cloud sync
  const snapshot = JSON.parse(JSON.stringify(storeManager.getData()));
  try {
    const result = await callback({ isLocal: true, store: storeManager.getData() });
    await storeManager.saveAndSync();
    return result;
  } catch (err) {
    storeManager.saveData(snapshot);
    throw err;
  }
}

/**
 * Universal Query function.
 */
export async function query<T = any>(sqlText: string, params: any[] = []): Promise<QueryResult<T>> {
  const pool = await initDbPool();
  if (pool && pgAvailable) {
    try {
      const res = await pool.query(sqlText, params);
      return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
    } catch (err) {
      console.error('Postgres query error, attempting local fallback:', err);
    }
  }

  // Handle common queries locally
  return executeLocalQuery<T>(sqlText, params);
}

function executeLocalQuery<T = any>(sql: string, params: any[] = []): QueryResult<T> {
  const data = storeManager.getData();
  const lower = sql.toLowerCase().trim();

  // Simple query routing for standard operations
  if (lower.startsWith('select * from pos_settings') || lower.includes('from pos_settings')) {
    return { rows: (data.pos_settings || []) as T[], rowCount: data.pos_settings.length };
  }

  if (lower.includes('from categories')) {
    return { rows: (data.categories || []) as T[], rowCount: data.categories.length };
  }

  if (lower.includes('from products')) {
    return { rows: (data.products || []) as T[], rowCount: data.products.length };
  }

  if (lower.includes('from product_addons')) {
    return { rows: (data.product_addons || []) as T[], rowCount: data.product_addons.length };
  }

  if (lower.includes('from register_sessions')) {
    if (lower.includes("status = 'open'")) {
      const open = data.register_sessions.filter((s: any) => s.status === 'open');
      return { rows: open as T[], rowCount: open.length };
    }
    return { rows: data.register_sessions as T[], rowCount: data.register_sessions.length };
  }

  if (lower.includes('from vendors')) {
    return { rows: data.vendors as T[], rowCount: data.vendors.length };
  }

  if (lower.includes('from raw_materials')) {
    return { rows: data.raw_materials as T[], rowCount: data.raw_materials.length };
  }

  if (lower.includes('from orders')) {
    return { rows: data.orders as T[], rowCount: data.orders.length };
  }

  return { rows: [] as T[], rowCount: 0 };
}

/**
 * Helper to log immutable audit events
 */
export async function logAuditEvent(entry: {
  user_id?: string | null;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  description: string;
  old_values?: any;
  new_values?: any;
}) {
  const store = storeManager.getData();
  const newLog = {
    id: crypto.randomUUID(),
    user_id: entry.user_id || null,
    user_name: entry.user_name || 'System',
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id || null,
    description: entry.description,
    old_values: entry.old_values || null,
    new_values: entry.new_values || null,
    created_at: new Date().toISOString(),
  };

  store.audit_logs.unshift(newLog);
  storeManager.saveData();
  return newLog;
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

