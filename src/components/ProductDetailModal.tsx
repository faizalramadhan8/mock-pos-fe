import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { ProductImage } from "./ProductImage";
import {
  useProductStore, useBatchStore, useInventoryStore,
  useCategoryStore, useSupplierStore, useAuthStore, useLangStore,
} from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatDate, formatDateDMY, printBarcodeLabel } from "@/utils";
import { ArrowDownCircle, ArrowUpCircle, Printer } from "lucide-react";
import { productApi, type ProductPriceHistoryRes } from "@/api/products";

interface ProductDetailModalProps {
  productId: string | null;
  onClose: () => void;
}

// REASON_BADGE — visual mapping per reason value supaya Recent Movements
// gampang scanned. lightClass = light mode, darkClass = dark mode.
const REASON_BADGE: Record<string, { label: string; lightClass: string; darkClass: string }> = {
  restock:  { label: "Stok Masuk",  lightClass: "bg-[#FFE4E9] text-[#E11D48]", darkClass: "bg-[#E11D48]/15 text-[#E11D48]" },
  initial:  { label: "Stok Awal",   lightClass: "bg-[#FFE4E9] text-[#E11D48]", darkClass: "bg-[#E11D48]/15 text-[#E11D48]" },
  sale:     { label: "Penjualan",   lightClass: "bg-[#FCE4EC] text-[#BE123C]", darkClass: "bg-[#FB7185]/15 text-[#FB7185]" },
  repack:   { label: "Repack",      lightClass: "bg-[#FFD1DB] text-[#BE123C]", darkClass: "bg-[#FFB5C0]/15 text-[#FFB5C0]" },
  lost:     { label: "Hilang",      lightClass: "bg-[#FCE4EC] text-[#BE123C]", darkClass: "bg-[#BE123C]/20 text-[#FB7185]" },
  damaged:  { label: "Rusak",       lightClass: "bg-[#FCE4EC] text-[#BE123C]", darkClass: "bg-[#BE123C]/20 text-[#FB7185]" },
  opname:   { label: "Opname",      lightClass: "bg-[#FFE4E9] text-[#E11D48]", darkClass: "bg-[#E11D48]/15 text-[#E11D48]" },
  sample:   { label: "Sample",      lightClass: "bg-[#FFD1DB] text-[#BE123C]", darkClass: "bg-[#FFB5C0]/15 text-[#FFB5C0]" },
  cancel:   { label: "Batal",       lightClass: "bg-[#FCE4EC] text-[#BE123C]", darkClass: "bg-[#FB7185]/15 text-[#FB7185]" },
  refund:   { label: "Refund",      lightClass: "bg-[#FCE4EC] text-[#BE123C]", darkClass: "bg-[#FB7185]/15 text-[#FB7185]" },
  other:    { label: "Lainnya",     lightClass: "bg-[#F5E1E6] text-[#6E4E57]", darkClass: "bg-[#3D2230] text-[#9F7686]" },
  default:  { label: "—",           lightClass: "bg-[#F5E1E6] text-[#6E4E57]", darkClass: "bg-[#3D2230] text-[#9F7686]" },
};

export function ProductDetailModal({ productId, onClose }: ProductDetailModalProps) {
  const th = useThemeClasses();
  const { t, lang } = useLangStore();
  const products = useProductStore(s => s.products);
  const batches = useBatchStore(s => s.batches);
  const movements = useInventoryStore(s => s.movements);
  const categories = useCategoryStore(s => s.categories);
  const suppliers = useSupplierStore(s => s.suppliers);
  const user = useAuthStore(s => s.user);

  const product = productId ? products.find(p => p.id === productId) : null;
  const canSeeCost = user?.role === "superadmin" || user?.role === "admin";

  const category = product ? categories.find(c => c.id === product.category) : null;

  const productBatches = useMemo(() =>
    product
      ? batches
          .filter(b => b.productId === product.id && b.quantity > 0)
          .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
      : [],
    [product, batches]
  );

  // Per request Bu Santi 29 Jun 2026: hapus filter tanggal di Pergerakan
  // Terakhir + aggregate per (tanggal + alasan) supaya tidak tampil "-1 -1
  // -1 -1" untuk tiap penjualan. Group format: "29/06/2026 · Terjual ke
  // kasir · -10 (10 transaksi)" — 1 row agregat.

  // Semua movement untuk produk, sorted newest first.
  const allProductMovements = useMemo(() => {
    if (!product) return [];
    return [...movements.filter(m => m.productId === product.id)]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [product, movements]);

  // Aggregate per (tanggal YMD + type + reason). Setiap group jadi 1 row.
  // Sorting: tanggal terbaru duluan, in sebelum out di hari yang sama.
  interface MovementGroup {
    key: string;
    dateYMD: string;
    type: "in" | "out";
    reason: string;
    qty: number;        // total qty (signed implicit via type)
    count: number;      // jumlah transaksi yang ke-aggregate
    totalValue: number; // sum unit_price × qty (untuk display rupiah)
    lastNote: string;   // note dari movement terakhir (untuk display kalau cuma 1 trx)
    supplierId?: string; // dipakai display supplier kalau ada
    lastCreatedAt: string; // timestamp paling baru di group (untuk ordering)
  }
  const groupedMovements = useMemo(() => {
    const groups = new Map<string, MovementGroup>();
    for (const m of allProductMovements) {
      const dateYMD = m.createdAt.slice(0, 10);
      const reasonKey = m.reason || (m.type === "in" ? "in_default" : "out_default");
      const key = `${dateYMD}|${m.type}|${reasonKey}|${m.supplierId || ""}`;
      const g = groups.get(key) || {
        key, dateYMD, type: m.type, reason: m.reason || "",
        qty: 0, count: 0, totalValue: 0, lastNote: "",
        supplierId: m.supplierId,
        lastCreatedAt: m.createdAt,
      };
      g.qty += m.quantity;
      g.count += 1;
      g.totalValue += (m.unitPrice || 0) * m.quantity;
      if (m.createdAt > g.lastCreatedAt) {
        g.lastCreatedAt = m.createdAt;
        g.lastNote = m.note || "";
      } else if (!g.lastNote) {
        g.lastNote = m.note || "";
      }
      groups.set(key, g);
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (a.dateYMD !== b.dateYMD) return b.dateYMD.localeCompare(a.dateYMD);
      if (a.type !== b.type) return a.type === "in" ? -1 : 1;
      return b.lastCreatedAt.localeCompare(a.lastCreatedAt);
    });
  }, [allProductMovements]);

  // Toggle "Lihat semua" — default false, tampilkan 5 group terbaru. Reset
  // saat produk berganti supaya tidak carry-over state ke produk lain.
  const [showAllMovements, setShowAllMovements] = useState(false);
  useEffect(() => { setShowAllMovements(false); }, [product?.id]);

  const recentMovementGroups = useMemo(() =>
    showAllMovements ? groupedMovements : groupedMovements.slice(0, 5),
    [groupedMovements, showAllMovements]
  );

  // Summary qty in vs out — tetap dipakai untuk header summary line.
  const movementSummary = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    for (const m of allProductMovements) {
      if (m.type === "in") totalIn += m.quantity;
      else totalOut += m.quantity;
    }
    return { totalIn, totalOut, count: allProductMovements.length };
  }, [allProductMovements]);

  // Cari movement IN terakhir di SELURUH history produk (bukan filtered) —
  // dipakai untuk display "Terakhir masuk: <tanggal>" di card Stok.
  // Bu Santi non-teknis: bingung kalau lihat "Masuk +0" tanpa konteks
  // kapan stok terakhir di-restock.
  const lastInMovement = useMemo(() => {
    if (!product) return null;
    const ins = movements
      .filter(m => m.productId === product.id && m.type === "in")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return ins[0] || null;
  }, [product, movements]);

  // Price history — load when modal opens for a product. Fail silent: empty
  // history just hides the section, the rest of the modal still renders.
  const [priceFilter, setPriceFilter] = useState<"all" | "regular" | "member" | "purchase">("all");
  const [priceHistory, setPriceHistory] = useState<ProductPriceHistoryRes[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  useEffect(() => {
    if (!productId) { setPriceHistory([]); return; }
    let alive = true;
    setHistoryLoading(true);
    productApi.getPriceHistory(productId)
      .then(res => { if (alive) setPriceHistory(res.body || []); })
      .catch(() => { if (alive) setPriceHistory([]); })
      .finally(() => { if (alive) setHistoryLoading(false); });
    return () => { alive = false; };
  }, [productId]);

  const filteredHistory = useMemo(() => {
    const rows = priceFilter === "all" ? priceHistory : priceHistory.filter(r => r.price_type === priceFilter);
    if (!canSeeCost) return rows.filter(r => r.price_type !== "purchase");
    return rows;
  }, [priceHistory, priceFilter, canSeeCost]);

  if (!product) return null;

  const name = lang === "id" ? product.nameId : product.name;
  const boxPrice = product.sellingPrice * product.qtyPerBox;
  const margin = product.purchasePrice > 0
    ? Math.round(((product.sellingPrice - product.purchasePrice) / product.purchasePrice) * 100)
    : 0;
  const now = Date.now();

  return (
    <Modal open={!!productId} onClose={onClose} title={t.productDetail as string} size="lg">
      {/* Header */}
      <div className="flex flex-col items-center mb-5">
        <div className={`flex justify-center py-4 px-6 rounded-2xl mb-3 ${th.ring}`}>
          <ProductImage product={product} size={100} />
        </div>
        <p className={`text-base font-extrabold tracking-tight ${th.tx}`}>{name}</p>
        <p className={`text-xs font-mono mt-0.5 ${th.txf}`}>{product.sku}</p>
        {category && (
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full mt-2"
            style={{ backgroundColor: category.color + "1A", color: category.color }}
          >
            {lang === "id" ? category.nameId : category.name}
          </span>
        )}
      </div>

      {/* Pricing */}
      <div className={`rounded-2xl border p-4 mb-3 ${th.bdr} ${th.card2}`}>
        <p className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${th.txf}`}>{t.pricingInfo}</p>
        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline">
            <span className={`text-xs ${th.txm}`}>{t.sellingPrice}</span>
            <span className={`text-sm font-bold ${th.acc}`}>{$(product.sellingPrice)} <span className={`text-xs font-normal ${th.txf}`}>/{product.unit}</span></span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className={`text-xs ${th.txm}`}>{t.boxPrice} ({product.qtyPerBox}/{t.perBox as string})</span>
            <span className={`text-sm font-bold ${th.tx}`}>{$(boxPrice)}</span>
          </div>
          {canSeeCost && (
            <>
              <div className={`border-t pt-1.5 mt-1.5 ${th.bdr}`} />
              <div className="flex justify-between items-baseline">
                <span className={`text-xs ${th.txm}`}>{t.purchasePrice}</span>
                <span className={`text-sm font-bold ${th.tx}`}>{$(product.purchasePrice)} <span className={`text-xs font-normal ${th.txf}`}>/{product.unit}</span></span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className={`text-xs ${th.txm}`}>{t.profitMargin}</span>
                <span className={`text-sm font-bold ${margin > 0 ? "text-[#E11D48]" : "text-[#BE123C]"}`}>{margin}%</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Riwayat Harga — chronological price changes (regular/member/purchase).
          Hidden if no history rows exist. Purchase rows are admin-only.
          Filter chips meet 44px touch target (kasir uses tablet). Prices use
          font-display so columns align across rows (tnum). */}
      {(historyLoading || priceHistory.length > 0) && (
        <div className={`rounded-2xl border p-4 mb-3 ${th.bdr} ${th.card2}`}>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <p className={`text-xs font-bold uppercase tracking-wider ${th.txf}`}>
              {lang === "id" ? "Riwayat Harga" : "Price History"}
            </p>
            <div role="tablist" aria-label={lang === "id" ? "Filter tipe harga" : "Price type filter"} className="flex gap-1">
              {(["all", "regular", "member", ...(canSeeCost ? (["purchase"] as const) : [])] as const).map(f => {
                const labelText = f === "all" ? (lang === "id" ? "Semua" : "All")
                  : f === "regular" ? (lang === "id" ? "Jual" : "Sell")
                  : f === "member" ? "Member"
                  : (lang === "id" ? "Modal" : "Cost");
                const active = priceFilter === f;
                return (
                  <button key={f} role="tab" aria-selected={active}
                    onClick={() => setPriceFilter(f)}
                    className={`text-xs font-bold min-h-[36px] px-3 py-1.5 rounded-lg transition-colors ${active ? `${th.accBg} ${th.acc}` : `${th.txf} hover:${th.accBg}`}`}>
                    {labelText}
                  </button>
                );
              })}
            </div>
          </div>
          {historyLoading ? (
            <div className="space-y-2" aria-live="polite" aria-busy="true">
              {[0, 1, 2].map(i => (
                <div key={i} className={`flex items-center justify-between py-1.5 border-b last:border-0 ${th.bdrSoft}`}>
                  <div className="flex items-center gap-2 w-full">
                    <span className={`h-5 w-12 rounded-md ${th.elev} animate-pulse`} />
                    <div className="flex-1 space-y-1.5">
                      <span className={`block h-4 w-24 rounded ${th.elev} animate-pulse`} />
                      <span className={`block h-3 w-40 rounded ${th.elev} animate-pulse`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredHistory.length === 0 ? (
            <p className={`text-xs ${th.txf}`}>
              {priceFilter === "member"
                ? (lang === "id" ? "Produk ini belum punya harga member." : "No member price set for this product.")
                : priceFilter === "purchase"
                  ? (lang === "id" ? "Belum ada riwayat harga modal." : "No purchase price history.")
                  : priceFilter === "regular"
                    ? (lang === "id" ? "Belum ada riwayat harga jual." : "No selling price history.")
                    : (lang === "id" ? "Belum ada perubahan." : "No changes yet.")}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto" role="list">
              {filteredHistory.map(h => {
                const tagBg = h.price_type === "purchase"
                  ? (th.dark ? "bg-[#FB7185]/15 text-[#FB7185]" : "bg-[#FFE4E9] text-[#BE123C]")
                  : h.price_type === "member"
                    ? (th.dark ? "bg-[#FFB5C0]/15 text-[#FFB5C0]" : "bg-[#FFD1DB] text-[#E11D48]")
                    : (th.accBg + " " + th.acc);
                const label = h.price_type === "regular" ? (lang === "id" ? "Jual" : "Sell")
                  : h.price_type === "member" ? "Member"
                  : (lang === "id" ? "Modal" : "Cost");
                return (
                  <div key={h.id} role="listitem" className={`flex items-center justify-between gap-2 py-2 border-b last:border-0 ${th.bdrSoft}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md ${tagBg}`}>{label}</span>
                      <div className="min-w-0">
                        <p className={`font-display text-sm font-bold ${th.tx}`}>{$(h.price)}</p>
                        <p className={`text-xs ${th.txf}`}>
                          {formatDate(h.start_date)}
                          {h.end_date ? ` – ${formatDate(h.end_date)}` : ` – ${lang === "id" ? "sekarang" : "now"}`}
                        </p>
                      </div>
                    </div>
                    {h.status === "active" && (
                      <span aria-label={lang === "id" ? "Harga aktif saat ini" : "Currently active price"}
                        className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md ${th.accBg} ${th.acc}`}>
                        {lang === "id" ? "Aktif" : "Active"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stock */}
      <div className={`rounded-2xl border p-4 mb-3 ${th.bdr} ${th.card2}`}>
        <p className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${th.txf}`}>{t.stockInfo}</p>
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-xl font-black ${th.tx}`}>{product.stock}</span>
            <span className={`text-xs ml-1 ${th.txf}`}>{product.unit}</span>
          </div>
          <div className="flex items-center gap-2">
            {product.stock === 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${th.dark ? "bg-[#BE123C]/15 text-[#BE123C]" : "bg-[#FCE4EC] text-[#BE123C]"}`}>{t.outOfStock}</span>
            )}
            {product.stock > 0 && product.stock <= product.minStock && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${th.dark ? "bg-[#FB7185]/15 text-[#FB7185]" : "bg-[#FFE4E9] text-[#E11D48]"}`}>{t.lowStock}</span>
            )}
            {product.stock > product.minStock && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${th.dark ? "bg-[#E11D48]/15 text-[#E11D48]" : "bg-[#F0F8EC] text-[#E11D48]"}`}>{t.normalStock}</span>
            )}
            {!product.isActive && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${th.elev} ${th.txf}`}>{t.inactive}</span>
            )}
          </div>
        </div>
        <p className={`text-xs mt-1.5 ${th.txf}`}>{t.minStockLabel}: {product.minStock} {product.unit}</p>
        {/* Tanggal terakhir masuk — explicit untuk Bu Santi yg sering tanya
            "kapan barang ini masuk". Kalau belum ada catatan IN, kasih hint
            cara mencatat supaya history mulai terisi. */}
        <div className={`mt-2 pt-2 border-t ${th.bdrSoft} flex items-center justify-between gap-2 flex-wrap`}>
          {lastInMovement ? (
            <>
              <p className={`text-xs ${th.txm}`}>
                <span className={th.txf}>Terakhir masuk:</span>{" "}
                <span className={`font-bold ${th.tx}`}>{formatDate(lastInMovement.createdAt)}</span>
                {" "}<span className={th.txf}>· +{lastInMovement.quantity} {product.unit}</span>
              </p>
            </>
          ) : (
            <p className={`text-xs ${th.txf} italic`}>
              Belum ada catatan barang masuk untuk produk ini.
            </p>
          )}
        </div>
      </div>

      {/* Batches */}
      <div className={`rounded-2xl border p-4 mb-3 ${th.bdr} ${th.card2}`}>
        <p className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${th.txf}`}>{t.batchInfo}</p>
        {productBatches.length === 0 ? (
          <p className={`text-xs ${th.txf}`}>{t.noBatches}</p>
        ) : (
          <div className="space-y-2">
            {productBatches.slice(0, 5).map(batch => {
              // Guard: expiryDate bisa empty/invalid untuk produk non-perishable
              // atau historical data tanpa ED. Tampilkan fallback "Tanpa ED"
              // bukan "NaN hari" + "Invalid Date" (yang bikin Bu Santi bingung).
              const expDate = batch.expiryDate ? new Date(batch.expiryDate) : null;
              const hasValidED = expDate && !isNaN(expDate.getTime());
              const days = hasValidED
                ? Math.ceil((expDate!.getTime() - now) / (1000 * 60 * 60 * 24))
                : null;
              const isExpired = days !== null && days <= 0;
              const isUrgent = days !== null && days > 0 && days <= 14;
              return (
                <div key={batch.id} className={`flex items-center justify-between py-1.5 border-b last:border-0 ${th.bdrSoft}`}>
                  <div>
                    <p className={`text-xs font-mono ${th.txm}`}>{batch.batchNumber}</p>
                    <p className={`text-xs ${th.txf}`}>
                      {batch.quantity} {product.unit}
                      {hasValidED
                        ? <> · {t.expires} {formatDate(batch.expiryDate)}</>
                        : <> · Tanpa ED</>}
                    </p>
                  </div>
                  {hasValidED ? (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      isExpired
                        ? (th.dark ? "bg-[#BE123C]/15 text-[#BE123C]" : "bg-[#FCE4EC] text-[#BE123C]")
                        : isUrgent
                          ? (th.dark ? "bg-[#FB7185]/15 text-[#FB7185]" : "bg-[#FFE4E9] text-[#E11D48]")
                          : (th.dark ? "bg-[#E11D48]/15 text-[#E11D48]" : "bg-[#F0F8EC] text-[#E11D48]")
                    }`}>
                      {isExpired ? (t.expired as string) : `${days} ${t.days}`}
                    </span>
                  ) : (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${th.elev} ${th.txf}`}>
                      —
                    </span>
                  )}
                </div>
              );
            })}
            {productBatches.length > 5 && (
              <p className={`text-xs text-center ${th.txf}`}>+{productBatches.length - 5} {t.moreBatches}</p>
            )}
          </div>
        )}
      </div>

      {/* Recent Movements — aggregated per (tanggal + alasan) supaya tidak
          tampil "-1 -1 -1 -1" per individual sale. Plus toggle "Lihat semua". */}
      <div className={`rounded-2xl border p-4 mb-3 ${th.bdr} ${th.card2}`}>
        <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
          <p className={`text-xs font-bold uppercase tracking-wider ${th.txf}`}>
            {t.recentMovements}
            {movementSummary.count > 0 && (
              <span className={`ml-1.5 ${th.txm}`}>({movementSummary.count})</span>
            )}
          </p>
          {movementSummary.count > 0 && (
            <span className={`text-xs ${th.txm}`}>
              <span className={`font-bold ${th.acc}`}>+{movementSummary.totalIn} masuk</span>
              <span className={`mx-1.5 ${th.txf}`}>·</span>
              <span className={`font-bold text-[#BE123C] dark:text-[#FB7185]`}>−{movementSummary.totalOut} keluar</span>
            </span>
          )}
        </div>

        {/* Filter periode DIHAPUS per request Bu Santi 29 Jun 2026 — list
            jadi feed agregat per (tanggal + alasan). Bu Santi: "ga mau lihat
            -1 -1 -1, mau nya count". */}
        {recentMovementGroups.length === 0 ? (
          <p className={`text-xs ${th.txf}`}>{t.noRecentMovements as string}</p>
        ) : (
          <div className="space-y-2">
            {recentMovementGroups.map(g => {
              const sup = g.supplierId ? suppliers.find(s => s.id === g.supplierId) : null;
              const reasonInfo = REASON_BADGE[g.reason] ?? REASON_BADGE.default;
              const isIn = g.type === "in";
              return (
                <div key={g.key} className={`flex items-start gap-2 py-2 border-b last:border-0 ${th.bdrSoft}`}>
                  {isIn
                    ? <ArrowDownCircle size={14} className="shrink-0 mt-0.5 text-[#E11D48]" />
                    : <ArrowUpCircle size={14} className="shrink-0 mt-0.5 text-[#BE123C]" />
                  }
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-sm font-bold ${th.tx}`}>
                        {isIn ? "+" : "−"}{g.qty}
                      </p>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${th.dark ? reasonInfo.darkClass : reasonInfo.lightClass}`}>
                        {reasonInfo.label}
                      </span>
                      {g.count > 1 && (
                        <span className={`text-xs font-semibold ${th.txm}`}>
                          ({g.count} transaksi)
                        </span>
                      )}
                      {g.totalValue > 0 && (
                        <span className={`text-xs ${th.txm}`}>· {$(g.totalValue)}</span>
                      )}
                    </div>
                    <p className={`text-xs ${th.txf} mt-0.5`}>
                      {formatDateDMY(g.dateYMD)}
                      {sup ? ` · ${sup.name}` : ""}
                      {g.count === 1 && g.lastNote ? ` · ${g.lastNote}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
            {groupedMovements.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllMovements(v => !v)}
                className={`w-full min-h-[44px] mt-2 text-sm font-bold rounded-xl ${th.accBg} ${th.acc}`}
              >
                {showAllMovements
                  ? `Sembunyikan (tampil ${groupedMovements.length})`
                  : `Lihat semua (${groupedMovements.length - 5} lagi)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className={`text-xs ${th.txf}`}>{t.createdAt as string}: {formatDate(product.createdAt)}</p>
        <button
          onClick={() => printBarcodeLabel(product, lang)}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl ${th.accBg} ${th.acc}`}
        >
          <Printer size={12} />
          {t.printLabel}
        </button>
      </div>
    </Modal>
  );
}
