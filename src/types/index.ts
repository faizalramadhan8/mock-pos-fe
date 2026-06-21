export type Lang = "en" | "id";
export type Theme = "light" | "dark";
export type Role = "superadmin" | "admin" | "cashier" | "staff" | "user";
export type PaymentMethod = "cash" | "card" | "transfer" | "qris";
export type OrderStatus = "completed" | "pending" | "cancelled" | "refunded";
export type DiscountType = "percent" | "fixed";
export type AuditAction = "order_created" | "order_voided" | "order_refunded" | "stock_adjusted" | "product_added" | "product_edited" | "settings_changed" | "user_registered" | "user_toggled" | "user_deleted" | "password_reset" | "register_opened" | "register_closed";
export type UnitType = "individual" | "box";
export type StockType = "in" | "out";
export type PageId = "dashboard" | "pos" | "inventory" | "orders" | "reports" | "expenses" | "settings";
// PaymentTerms — "COD" kept as legacy alias for Cash (data lama masih ada).
// Label Indonesia dipusatkan di PAYMENT_TERMS_LABELS.
export type PaymentTerms = "COD" | "NET7" | "NET14" | "NET21" | "NET30" | "NET60" | "NET90";
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
  /** Eligible untuk tebus pakai member.points. Admin tandai via Katalog Tebus. */
  isRedeemable?: boolean;
  /**
   * Tiered pricing untuk member. Walk-in non-member SELALU pakai sellingPrice
   * (tier tidak berlaku). Member yang qty match tier dapat tier.price; member
   * yang tidak match tier pakai memberPrice (kalau ada) atau sellingPrice.
   */
  priceTiers?: ProductPriceTier[];
  createdAt: string;
}

export type PriceTierTarget = "all_customers" | "member_specific";

export interface ProductPriceTier {
  id: string;
  productId: string;
  /** Minimum qty SATUAN (bukan dus). FE/BE convert dulu kalau unit_type=box. */
  minQty: number;
  /** Harga per satuan (sama dengan sellingPrice/memberPrice baseline). */
  price: number;
  target: PriceTierTarget;
  /** Whitelist member kalau target='member_specific'. Kosong utk 'all_customers'. */
  members?: { id: string; name: string; phone: string }[];
  note?: string;
  /** ISO datetime kapan tier expire. null/undefined = tidak terbatas.
   *  Tier dengan expiresAt < now di-skip di POS compute. */
  expiresAt?: string | null;
  createdAt: string;
}

/** Tag asal harga saat sale time untuk audit. Lihat migration 000037. */
export type PriceSource = "regular" | "member_price" | "tier_all" | "tier_member";

/** Barang khusus tebus poin yang admin set manual (terpisah dari katalog
 *  produk POS). Lihat migration 000040. */
export interface RedeemableItem {
  id: string;
  name: string;
  description?: string;
  image?: string;
  pointsCost: number;
  stock: number;
  redeemed: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  /** Empty string kalau row ini redeem dari redeemable_items. */
  productId: string;
  /** Set kalau row ini redeem dari redeemable_items table. */
  redeemableItemId?: string;
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
  /**
   * Tebus barang: kalau true, item ini dibayar dari member.points
   * (1 poin = Rp 1). Harga item × qty dipotong dari saldo poin, dan
   * tidak masuk hitungan cash actual untuk earn poin baru.
   */
  redeemWithPoints?: boolean;
  /** Audit: tag sumber harga (regular / member_price / tier_all / tier_member). */
  priceSource?: PriceSource;
  /** Audit: ID tier yang dipakai kalau priceSource ∈ {tier_all, tier_member}. */
  tierId?: string;
  /** Paket snapshot: floor(qtySatuan / tier.minQty). 0 kalau bukan paket. */
  paketCount?: number;
  /** Sisa unit yang tidak masuk paket — pakai harga normal/member. */
  extraCount?: number;
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
  /** Loyalty points: nilai yang ditebus & yang didapat dari order ini. */
  pointsUsed?: number;
  pointsEarned?: number;
  /** Idempotency key — UUID per checkout attempt. Hanya ada saat Create.
   *  BE Redis cache 5 menit; submit ulang dengan key sama → return existing. */
  clientRequestId?: string;
  createdAt: string;
  createdBy: string;
  paymentProof?: string;
  orderDiscountType?: DiscountType;
  orderDiscountValue?: number;
  orderDiscount?: number;
}

export interface OrderItem {
  productId: string;
  /** Set kalau row ini redeem dari redeemable_items table. */
  redeemableItemId?: string;
  name: string;
  quantity: number;
  unitType: UnitType;
  unitPrice: number;
  purchasePrice?: number;
  regularPrice?: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
  redeemedWithPoints?: boolean;
  /** Audit: tag sumber harga saat sale time. */
  priceSource?: PriceSource;
  /** Audit: ID tier yang dipakai (nullable kalau bukan dari tier). */
  tierId?: string;
  /** Paket snapshot: berapa "paket" yang dipakai dari tier ini. */
  paketCount?: number;
  /** Sisa unit yang tidak masuk paket — pakai harga normal/member baseline. */
  extraCount?: number;
}

export interface ProductPriceTierHistoryEntry {
  id: string;
  tierId: string;
  productId: string;
  minQty: number;
  price: number;
  targetType: PriceTierTarget;
  memberIds?: string[];
  note?: string;
  status: "active" | "inactive";
  action: "create" | "update" | "delete";
  startDate: string;
  endDate?: string | null;
  changedBy?: string | null;
  createdAt: string;
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

/** Reason kategori untuk movement — kombinasi `type` (in/out) + `reason`
 * kasih konteks penuh: "kenapa stok berubah". Empty string = legacy data. */
export type MovementReason = "restock" | "sale" | "repack" | "lost" | "damaged" | "opname" | "sample" | "cancel" | "refund" | "other" | "";

export interface StockMovement {
  id: string;
  productId: string;
  type: StockType;
  quantity: number;
  unitType: UnitType;
  unitPrice: number;
  reason?: MovementReason;
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

/** Faktur Pembelian — header faktur dari supplier (multi-line items). */
export interface PurchaseInvoiceItem {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  quantity: number;        // individual units count
  unitType: "box" | "individual";
  unitPrice: number;       // per individual unit
  expiryDate?: string;     // YYYY-MM-DD
  batchId?: string;
  movementId?: string;
  note?: string;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber?: string;
  supplierId: string;
  supplierName?: string;
  invoiceDate: string;
  dueDate?: string;
  paymentTerms: PaymentTerms;
  paymentStatus: PaymentStatus;
  paidAt?: string;
  subtotalAmount: number;
  ppnAmount: number;
  totalAmount: number;
  reminderSentAt?: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  items: PurchaseInvoiceItem[];
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
  /**
   * Loyalty point balance (1 point = Rp 1). Earned per kelipatan tepat
   * Rp 100.000 cash actual (= 1.000 poin per kelipatan). Bisa ditebus
   * per-item di cart. Reset 0 setiap 1 Januari.
   */
  points: number;
  createdAt: string;
}

export type MemberPointMovementType = "earn" | "redeem-item" | "expire-reset" | "adjust";

export interface MemberPointMovement {
  id: string;
  orderId?: string;
  type: MemberPointMovementType;
  /** signed: + earn, - redeem/expire */
  points: number;
  balanceAfter: number;
  note?: string;
  createdBy?: string;
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
