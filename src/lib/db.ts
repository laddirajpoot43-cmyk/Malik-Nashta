import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { insforgeAdmin, INSFORGE_BASE_URL } from './insforge';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

// Fallback in-memory and disk-persisted data store for zero-downtime reliability
const DATA_DIR = path.join(process.cwd(), '.data');
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
    },
    profiles: [
      {
        id: '11111111-1111-1111-1111-111111111101',
        email: 'admin@maliknashta.pk',
        full_name: 'Malik Ammar',
        display_name: 'Malik Ammar (Admin)',
        role: 'admin',
        status: 'active',
        pin_code: '1234',
        created_at: new Date().toISOString(),
      },
      {
        id: '11111111-1111-1111-1111-111111111102',
        email: 'cashier@maliknashta.pk',
        full_name: 'Muhammad Bilal',
        display_name: 'Bilal Cashier',
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
        phone: '0300-1234567',
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
          footer_message_english: 'Thank you for visiting Malik Tasty Nashta Point!',
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
    audit_logs: [
      {
        id: 'log-001',
        user_name: 'Malik Ammar',
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
  'product_addons',
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
                if (existingProd?.pricing_config) {
                  normalized.pricing_config = existingProd.pricing_config;
                } else if (!normalized.pricing_config) {
                  if (normalized.id === '44444444-4444-4444-4444-444444444401' || normalized.name?.includes('Channay') || normalized.name?.includes('Chana')) {
                    normalized.pricing_config = {
                      enable_by_plate: true,
                      full_plate_price: 180.00,
                      half_plate_price: 100.00,
                      enable_by_price: true,
                      min_price: 20.00,
                      enable_custom_price: true,
                      custom_price_label: 'Half Rate',
                      custom_price: 100.00,
                    };
                  } else {
                    const halfPrice = Math.round((Number(normalized.selling_price || 0) * 0.55) / 10) * 10;
                    normalized.pricing_config = {
                      enable_by_plate: true,
                      full_plate_price: Number(normalized.selling_price || 0),
                      half_plate_price: halfPrice,
                      enable_by_price: true,
                      min_price: 10.00,
                      enable_custom_price: true,
                      custom_price_label: 'Half Rate',
                      custom_price: halfPrice,
                    };
                  }
                }
              }

              if (t === 'order_items') {
                const existingItem = (this.data.order_items || []).find((oi: any) => oi.id === normalized.id);
                if (existingItem?.pricing_method && !normalized.pricing_method) {
                  normalized.pricing_method = existingItem.pricing_method;
                }
                if (existingItem?.pricing_type && !normalized.pricing_type) {
                  normalized.pricing_type = existingItem.pricing_type;
                }
              }

              return normalized;
            });
          } else {
            // Cloud has 0 rows for this table (e.g. all rows were deleted by admin)
            (this.data as any)[t] = [];
          }
        }
      }

      if (loaded > 0) {
        this.cloudConnected = true;
        this.lastCloudSyncAt = new Date().toISOString();
        this.recordSnapshotIds();
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
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
      for (const t of CLOUD_TABLES) {
        try {
          const currentRows = ((this.data as any)[t] as any[]) || [];
          const currentIds = new Set(currentRows.map((r: any) => String(r.id)));
          const prevIds = this.prevSnapshotIds[t] || new Set<string>();

          // Find deleted IDs
          const deletedIds: string[] = [];
          for (const oldId of prevIds) {
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
              // Strip client-side joined relationships that don't exist as SQL table columns in cloud Postgres
              if (t === 'orders') {
                delete clean.items;
                delete clean.payments;
                delete clean.refunds;
              } else if (t === 'purchase_invoices') {
                delete clean.items;
              } else if (t === 'refunds') {
                delete clean.items;
              } else if (t === 'products') {
                delete clean.category_name;
                delete clean.pricing_config;
              } else if (t === 'vendor_payments') {
                delete clean.vendor_name;
              }
              return clean;
            });
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
    try {
      if (data) this.data = data;
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
      if (syncCloud) {
        this.syncToCloud().catch(() => {});
      }
    } catch (e) {
      console.error('Failed to save store file:', e);
    }
  }

  public getData(): SchemaStore {
    return this.data;
  }

  public getCloudStatus() {
    return {
      connected: this.cloudConnected,
      baseUrl: INSFORGE_BASE_URL,
      lastSyncAt: this.lastCloudSyncAt,
    };
  }

  public getNextSequence(type: 'receipt_seq' | 'order_seq' | 'refund_seq' | 'hold_seq' | 'purchase_seq' | 'vendor_pay_seq'): string {
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
      default:
        return `${curr}`;
    }
  }
}

const storeManager = new StoreManager();

export const localStore = {
  get: () => storeManager.getData(),
  save: () => storeManager.saveData(),
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

  // Atomic local transaction with snapshot & rollback
  const snapshot = JSON.parse(JSON.stringify(storeManager.getData()));
  try {
    const result = await callback({ isLocal: true, store: storeManager.getData() });
    storeManager.saveData();
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

