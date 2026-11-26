export type Lang = "en" | "id";
export type Theme = "light" | "dark";
export type Role = "superadmin" | "admin" | "cashier" | "staff" | "user" | "ecom_admin" | "ecom_superadmin";
export type PaymentMethod = "cash" | "card" | "transfer" | "qris";
export type OrderStatus = "completed" | "pending" | "cancelled" | "refunded";
export type DiscountType = "percent" | "fixed";
export type AuditAction = "order_created" | "order_voided" | "order_refunded" | "stock_adjusted" | "product_added" | "product_edited" | "settings_changed" | "user_registered" | "user_toggled" | "user_deleted" | "password_reset" | "register_opened" | "register_closed" | "device_approved_manual" | "device_revoked" | "payment_method_edited";
export type UnitType = "individual" | "box";
export type StockType = "in" | "out";
export type PageId = "dashboard" | "pos" | "inventory" | "orders" | "reports" | "expenses" | "finance" | "settings";
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
  /**
   * Katalog pemilik produk: "store" (Bekasi) atau "home" (toko rumah).
   * Tiap tempat punya katalognya sendiri dan tidak melihat katalog yang
   * lain — backend sudah menyaringnya, jadi POS tidak akan pernah menerima
   * produk "home". Field ini ada untuk kejelasan, bukan untuk disaring lagi
   * di sisi depan.
   */
  location?: "store" | "home";
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

/**
 * Kelas member, ditandai MANUAL oleh Bu Santi dari layar Poin Member.
 *
 * Bu Santi 26 Nov 2026 memberi patokan berdasarkan poin (Silver 5–9, Gold
 * 10–19, Platinum 20 ke atas), tapi yang menentukan tetap dia sendiri.
 * Patokannya ditampilkan sebagai bantuan, kelasnya TIDAK berubah sendiri
 * saat poin naik atau direset. Jangan menghitungnya otomatis tanpa memintanya
 * dulu: dia menilai juga siapa yang berpotensi jadi reseller, bukan cuma poin.
 */
export type MemberClass = "platinum" | "gold" | "silver";

/**
 * Warna permintaan Bu Santi: Platinum merah, Gold kuning, Silver biru.
 * `teks` dipisah karena tulisan putih di atas kuning tidak terbaca.
 * `minPoin` hanya untuk patokan yang ditampilkan, tidak menentukan apa pun.
 */
export const MEMBER_CLASSES: {
  v: MemberClass; label: string; warna: string; teks: string; patokan: string; minPoin: number;
}[] = [
  { v: "platinum", label: "Platinum", warna: "#DC2626", teks: "#FFFFFF", patokan: "20+ poin", minPoin: 20 },
  { v: "gold", label: "Gold", warna: "#FACC15", teks: "#422006", patokan: "10–19 poin", minPoin: 10 },
  { v: "silver", label: "Silver", warna: "#2563EB", teks: "#FFFFFF", patokan: "5–9 poin", minPoin: 5 },
];

/** Kelas yang SESUAI patokan Bu Santi untuk sejumlah poin. Hanya saran. */
export function kelasPatokan(poin: number): MemberClass | null {
  for (const k of MEMBER_CLASSES) if (poin >= k.minPoin) return k.v;
  return null;
}

/**
 * Siapa yang berhak atas harga tier.
 *
 *  all_customers   — siapa saja, termasuk walk-in tanpa kartu member.
 *  all_members     — semua member terdaftar, tapi bukan walk-in.
 *  class_*         — member berkelas itu saja (Platinum/Gold/Silver).
 *  member_specific — hanya member yang di-whitelist.
 *
 * "all_members" sempat dihapus 20 Jun 2026 (di-rename jadi all_customers) lalu
 * diminta kembali Bu Santi 30 Okt 2026 sebagai pilihan KETIGA, bukan pengganti.
 *
 * Target kelas (4 Nov 2026) cocok PERSIS, tanpa urutan bertingkat: member
 * Platinum tidak otomatis kebagian tier Gold. Kalau satu harga dimaksudkan
 * untuk dua kelas, buat tiernya dua kali.
 */
export type PriceTierTarget =
  | "all_customers"
  | "all_members"
  | "class_platinum"
  | "class_gold"
  | "class_silver"
  | "member_specific";

/**
 * Label target tier untuk ditampilkan.
 *
 * SATU tempat, dipakai daftar tier, katalog, dan riwayat. Sebelumnya tiap
 * layar menulis rantai if-nya sendiri yang berakhir di "N member" — jadi
 * target baru (kelas Platinum/Gold/Silver) muncul sebagai "0 member", salah
 * tanpa ada yang gagal.
 */
export function labelTargetTier(t: PriceTierTarget, jumlahMember = 0): string {
  switch (t) {
    case "all_customers": return "Semua customer";
    case "all_members": return "Semua member";
    case "class_platinum": return "Platinum";
    case "class_gold": return "Gold";
    case "class_silver": return "Silver";
    case "member_specific": return `${jumlahMember} member`;
    default: return "Semua customer";
  }
}

/** Target tier → kelas member yang dituntutnya. null kalau bukan target kelas. */
export function kelasDariTarget(t: PriceTierTarget): MemberClass | null {
  switch (t) {
    case "class_platinum": return "platinum";
    case "class_gold": return "gold";
    case "class_silver": return "silver";
    default: return null;
  }
}

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
  /** Jendela jadwal berlaku. Keduanya null/undefined = berlaku terus.
   *  Tier di luar jendela ini di-skip SEMUA penghitung harga dan tidak
   *  ditampilkan sebagai aktif. Pakai `tierBerlaku()` di utils — jangan
   *  membandingkan tanggalnya sendiri-sendiri. */
  startsAt?: string | null;
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
  /** Payment edit audit (Bu Santi 12 Jul 2026). NULL = never edited. */
  /**
   * SALURAN penjualan — bukan tempatnya.
   *   "pos"  — kasir toko Bekasi
   *   "ecom" — storefront Bekasi (disiapkan, menyusul habis Lebaran)
   *   "home" — storefront toko rumah
   *
   * Order lama sebelum kolom ini ada bernilai undefined, perlakukan
   * sebagai POS. Jangan membandingkan nilai ini langsung; pakai helper di
   * utils, dan pilih sumbunya dengan sadar:
   *
   *   SALURAN — `orderChannel()` / `filterByChannel()`. Lewat mana pesanan
   *     masuk. Dipakai seluruh POS sejak 24 Nov 2026: Keuangan kasir harus
   *     cocok dengan laci, dan penjualan online tidak pernah lewat laci.
   *
   *   TEMPAT  — `orderPlace()` / `filterByPlace()`. Barangnya dari rak mana.
   *     `ecom` bertempat di Bekasi, bukan di rumah.
   *
   * Keduanya terlihat mirip dan memberi hasil berbeda tepat pada pesanan
   * `ecom`: masuk di penyaring tempat Bekasi, tidak masuk di penyaring
   * saluran kasir.
   */
  orderSource?: "pos" | "ecom" | "home";
  /** Ongkos kirim yang ditagihkan ke customer (pesanan online saja; 0 untuk
   *  POS). CATATAN: `total` pesanan online SUDAH termasuk ongkir —
   *  `total = subtotal − voucher + ongkir`. Ongkir bukan pendapatan toko,
   *  cuma uang titipan untuk kurir, jadi JANGAN pakai `total` mentah untuk
   *  menghitung omzet. Pakai `salesTotal()` di utils. */
  shippingCost?: number;
  paymentsEditedAt?: string;
  paymentsEditedBy?: string;
  paymentsEditedReason?: string;
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
  startsAt?: string | null;
  expiresAt?: string | null;
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
  /**
   * Tempat pemilik rekening: 'store' (Bekasi) atau 'home' (toko rumah).
   * Storefront rumah HANYA menampilkan rekening 'home' — kalau rekening
   * Bekasi ikut tampil, sebagian customer transfer ke sana dan pembukuan
   * yang sengaja dipisah tercampur lagi di langkah pertama.
   */
  location?: "store" | "home";
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
   * per-item di cart. Reset 0 setiap 1 Januari dan 1 Juli.
   */
  points: number;
  /** Kelas yang ditandai Bu Santi. Kosong = belum dikelompokkan, dan itu
   *  keadaan wajar untuk sebagian besar member. */
  memberClass?: MemberClass | null;
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
