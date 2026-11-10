export type UserRole = 'admin' | 'cashier';
export type AccountStatus = 'active' | 'inactive';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  display_name?: string | null;
  role: UserRole;
  status: AccountStatus;
  pin_code?: string | null;
  created_at: string;
}

export type ShiftStatus = 'open' | 'closed';

export interface RegisterSession {
  id: string;
  user_id?: string | null;
  user_name_snapshot: string;
  opened_at: string;
  opening_amount: number;
  closed_at?: string | null;
  expected_amount?: number | null;
  actual_amount?: number | null;
  difference?: number | null;
  closing_note?: string | null;
  status: ShiftStatus;
}

export type RegisterTxType = 'OPENING' | 'SALE' | 'REFUND' | 'CASH_IN' | 'CASH_OUT' | 'ADJUSTMENT';

export interface RegisterTransaction {
  id: string;
  register_session_id: string;
  type: RegisterTxType;
  amount: number;
  order_id?: string | null;
  refund_id?: string | null;
  reason?: string | null;
  note?: string | null;
  user_name_snapshot: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

export type ProductAvailability = 'available' | 'sold_out' | 'hidden' | 'inactive';

export interface Product {
  id: string;
  category_id: string;
  name: string;
  short_name?: string | null;
  selling_price: number;
  cost_price: number;
  availability: ProductAvailability;
  is_active: boolean;
  sort_order: number;
  category_name?: string;
}

export interface ProductAddon {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
}

export type OrderStatus = 'completed' | 'held' | 'refunded' | 'partially_refunded' | 'voided';
export type DiscountType = 'percentage' | 'fixed';

export interface OrderItemAddon {
  addon_id: string;
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string | null;
  product_name_snapshot: string;
  unit_price: number;
  quantity: number; // e.g. 0.5, 0.25, 1, 2
  item_subtotal: number;
  addons_total: number;
  item_discount: number;
  line_total: number;
  note?: string | null;
  refunded_quantity: number;
  created_at?: string;
  addons?: OrderItemAddon[];
}

export interface OrderPayment {
  id: string;
  order_id: string;
  method_id: string; // 'cash' | 'jazzcash' | 'easypaisa' | 'bank'
  amount: number;
  amount_tendered: number;
  change_returned: number;
  created_at?: string;
}

export interface Order {
  id: string;
  order_number: string;
  receipt_number: string;
  register_session_id?: string | null;
  status: OrderStatus;
  subtotal: number;
  discount_type?: DiscountType | null;
  discount_value: number;
  discount_amount: number;
  rounding_amount: number;
  grand_total: number;
  total_paid: number;
  change_returned: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  void_reason?: string | null;
  reprint_count: number;
  idempotency_key?: string | null;
  cashier_name_snapshot: string;
  created_at: string;
  items?: OrderItem[];
  payments?: OrderPayment[];
}

export interface HeldOrder {
  id: string;
  hold_number: string;
  customer_name: string;
  cart_data: any; // Serialized cart items and details
  cashier_name: string;
  status: 'held' | 'resumed' | 'cancelled';
  created_at: string;
}

export interface RefundItem {
  id: string;
  refund_id: string;
  order_item_id: string;
  quantity: number;
  amount: number;
  product_name?: string;
}

export interface Refund {
  id: string;
  refund_number: string;
  order_id: string;
  register_session_id?: string | null;
  amount: number;
  reason: string;
  admin_pin_used?: boolean;
  cashier_name: string;
  created_at: string;
  items?: RefundItem[];
}

export interface Vendor {
  id: string;
  name: string;
  phone?: string | null;
  category: string;
  address?: string | null;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at?: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  default_price: number;
  category: string;
  is_active: boolean;
  created_at?: string;
}

export type PurchasePaymentStatus = 'paid' | 'partial' | 'credit';

export interface PurchaseItem {
  id: string;
  purchase_invoice_id: string;
  raw_material_id?: string | null;
  raw_material_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

export interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  vendor_id?: string | null;
  vendor_name_snapshot: string;
  invoice_date: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_method: string;
  payment_status: PurchasePaymentStatus;
  deduct_from_register?: boolean;
  created_at: string;
  items?: PurchaseItem[];
}

export interface VendorPayment {
  id: string;
  payment_number: string;
  vendor_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string | null;
  deduct_from_register?: boolean;
  note?: string | null;
  created_at: string;
  vendor_name?: string;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  description: string;
  old_values?: any;
  new_values?: any;
  created_at: string;
}

export interface ReceiptTemplateConfig {
  paper_size: '80mm' | '58mm';
  tagline: string;
  ntn_strn: string;
  header_message: string;
  footer_message_urdu: string;
  footer_message_english: string;
  show_cashier_name: boolean;
  show_customer_info: boolean;
  show_order_number: boolean;
  show_kitchen_notes: boolean;
  show_addons: boolean;
  show_duplicate_watermark: boolean;
  font_size: 'small' | 'medium' | 'large';
}

export interface PosSettings {
  id: string;
  business_name: string;
  address: string;
  phone: string;
  greeting_message: string;
  admin_pin: string;
  cash_rounding_enabled: boolean;
  require_admin_pin_refunds: boolean;
  default_tax_rate: number;
  max_cashier_discount_percent: number;
  receipt_template?: ReceiptTemplateConfig;
  created_at?: string;
}

export interface CartItem {
  uid: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number; // e.g. 0.5, 1, 2
  custom_unit_price?: number;
  note?: string;
  addons: ProductAddon[];
  item_subtotal: number;
  line_total: number;
}

