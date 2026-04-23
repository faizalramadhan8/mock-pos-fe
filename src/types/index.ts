export type Lang = "en" | "id";
export type Theme = "light" | "dark";
export type Role = "superadmin" | "admin" | "cashier" | "staff" | "user";
export type PaymentMethod = "cash" | "card" | "transfer" | "qris";
export type OrderStatus = "completed" | "pending" | "cancelled" | "refunded";
export type DiscountType = "percent" | "fixed";
export type AuditAction = "order_created" | "order_voided" | "order_refunded" | "stock_adjusted" | "product_added" | "product_edited" | "settings_changed" | "user_registered" | "user_toggled" | "user_deleted" | "password_reset" | "register_opened" | "register_closed";
export type UnitType = "individual" | "box";
export type StockType = "in" | "out";
export type PageId = "dashboard" | "pos" | "inventory" | "orders" | "settings";
export type PaymentTerms = "COD" | "NET30" | "NET60" | "NET90";
export type PaymentStatus = "paid" | "unpaid";
export type UnitOfMeasure = "kg" | "gr" | "ltr" | "ml" | "pcs" | "pack" | "btl" | "can" | "bar" | "blk" | "tray" | "sachet";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  initials: string;
  nik?: string;
  phone?: string;
  dateOfBirth?: string;
  isActive?: boolean;
}

export interface Category {
  id: string;
  name: string;
  nameId: string;
  icon: string;
  color: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  nameId: string;
  category: string;
  supplierId?: string;
  purchasePrice: number;
  sellingPrice: number;
  memberPrice?: number;
  qtyPerBox: number;
  stock: number;
  unit: UnitOfMeasure;
  image: string;
  minStock: number;
  isActive: boolean;
  createdAt: string;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  category: string;
  image: string;
  quantity: number;
  unitType: UnitType;
  unitPrice: number;
  regularPrice?: number;
  qtyPerBox: number;
  unit: string;
  discountType?: DiscountType;
  discountValue?: number;
}

export interface OrderPaymentSplit {
  id?: string;
  method: PaymentMethod;
  amount: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  payments?: OrderPaymentSplit[];
  subtotal: number;
  ppnRate: number;
  ppn: number;
  total: number;
  payment: PaymentMethod;
  status: OrderStatus;
  customer: string;
  customerPhone?: string;
  memberId?: string;
  member?: { id: string; name: string; phone: string };
  memberSavings?: number;
  createdAt: string;
  createdBy: string;
  paymentProof?: string;
  orderDiscountType?: DiscountType;
  orderDiscountValue?: number;
  orderDiscount?: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitType: UnitType;
  unitPrice: number;
  purchasePrice?: number;
  regularPrice?: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
}

export interface MemberStats {
  memberId: string;
  from: string;
  to: string;
  totalSpend: number;
  orderCount: number;
  avgBasket: number;
  totalSavings: number;
  lastVisit?: string;
  lifetimeSpend: number;
  lifetimeOrders: number;
  monthlyBreakdown: { month: string; spend: number; orders: number; savings: number }[];
  topProducts: { productId: string; name: string; quantity: number; spend: number }[];
}

export interface StockMovement {
  id: string;
  productId: string;
  type: StockType;
  quantity: number;
  unitType: UnitType;
  unitPrice: number;
  note: string;
  createdAt: string;
  createdBy: string;
  expiryDate?: string;
  supplierId?: string;
  paymentTerms?: PaymentTerms;
  dueDate?: string;
  paymentStatus?: PaymentStatus;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface StockBatch {
  id: string;
  productId: string;
  quantity: number;
  expiryDate: string;
  receivedAt: string;
  note: string;
  batchNumber: string;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  address?: string;
  memberNumber?: string;
  createdAt: string;
}

export interface Refund {
  id: string;
  orderId: string;
  items: RefundItem[];
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export interface RefundItem {
  productId: string;
  name: string;
  quantity: number;
  unitType: UnitType;
  unitPrice: number;
  refundAmount: number;
}

export interface CashSession {
  id: string;
  date: string;
  openingCash: number;
  openedBy: string;
  openedAt: string;
  expectedCash: number;
  actualCash: number;
  difference: number;
  notes: string;
  closedBy: string;
  closedAt: string;
}

export interface AuditEntry {
  id: string;
  action: AuditAction;
  userId: string;
  userName: string;
  details: string;
  createdAt: string;
}

export type NotifType = "stock_low" | "stock_out" | "expiry_soon" | "expired" | "invoice_due" | "register_open";
export type NotifPriority = "critical" | "high" | "medium" | "low";

export interface AppNotification {
  id: string;
  type: NotifType;
  priority: NotifPriority;
  title: string;
  message: string;
  productId?: string;
  createdAt: string;
}
