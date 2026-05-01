import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { ProductImage } from "./ProductImage";
import {
  useProductStore, useBatchStore, useInventoryStore,
  useCategoryStore, useSupplierStore, useAuthStore, useLangStore,
} from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatDate, formatTime, printBarcodeLabel } from "@/utils";
import { ArrowDownCircle, ArrowUpCircle, Printer } from "lucide-react";
import { productApi, type ProductPriceHistoryRes } from "@/api/products";

interface ProductDetailModalProps {
  productId: string | null;
  onClose: () => void;
}

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

  const recentMovements = useMemo(() =>
    product
      ? movements.filter(m => m.productId === product.id).slice(0, 5)
      : [],
    [product, movements]
  );

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
    <Modal open={!!productId} onClose={onClose} title={t.productDetail as string}>
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
      </div>

      {/* Batches */}
      <div className={`rounded-2xl border p-4 mb-3 ${th.bdr} ${th.card2}`}>
        <p className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${th.txf}`}>{t.batchInfo}</p>
        {productBatches.length === 0 ? (
          <p className={`text-xs ${th.txf}`}>{t.noBatches}</p>
        ) : (
          <div className="space-y-2">
            {productBatches.slice(0, 5).map(batch => {
              const days = Math.ceil((new Date(batch.expiryDate).getTime() - now) / (1000 * 60 * 60 * 24));
              const isExpired = days <= 0;
              const isUrgent = days > 0 && days <= 14;
              return (
                <div key={batch.id} className={`flex items-center justify-between py-1.5 border-b last:border-0 ${th.bdrSoft}`}>
                  <div>
                    <p className={`text-xs font-mono ${th.txm}`}>{batch.batchNumber}</p>
                    <p className={`text-xs ${th.txf}`}>{batch.quantity} {product.unit} · {t.expires} {formatDate(batch.expiryDate)}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    isExpired
                      ? (th.dark ? "bg-[#BE123C]/15 text-[#BE123C]" : "bg-[#FCE4EC] text-[#BE123C]")
                      : isUrgent
                        ? (th.dark ? "bg-[#FB7185]/15 text-[#FB7185]" : "bg-[#FFE4E9] text-[#E11D48]")
                        : (th.dark ? "bg-[#E11D48]/15 text-[#E11D48]" : "bg-[#F0F8EC] text-[#E11D48]")
                  }`}>
                    {isExpired ? (t.expired as string) : `${days} ${t.days}`}
                  </span>
                </div>
              );
            })}
            {productBatches.length > 5 && (
              <p className={`text-xs text-center ${th.txf}`}>+{productBatches.length - 5} {t.moreBatches}</p>
            )}
          </div>
        )}
      </div>

      {/* Recent Movements */}
      <div className={`rounded-2xl border p-4 mb-3 ${th.bdr} ${th.card2}`}>
        <p className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${th.txf}`}>{t.recentMovements}</p>
        {recentMovements.length === 0 ? (
          <p className={`text-xs ${th.txf}`}>{t.noRecentMovements}</p>
        ) : (
          <div className="space-y-2">
            {recentMovements.map(m => {
              const sup = m.supplierId ? suppliers.find(s => s.id === m.supplierId) : null;
              return (
                <div key={m.id} className={`flex items-center justify-between py-1.5 border-b last:border-0 ${th.bdrSoft}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {m.type === "in"
                      ? <ArrowDownCircle size={14} className="shrink-0 text-[#E11D48]" />
                      : <ArrowUpCircle size={14} className="shrink-0 text-[#BE123C]" />
                    }
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${th.tx}`}>
                        {m.type === "in" ? "+" : "-"}{m.quantity} · {$(m.unitPrice * m.quantity)}
                      </p>
                      <p className={`text-xs truncate ${th.txf}`}>
                        {m.note}{sup ? ` · ${sup.name}` : ""} · {formatDate(m.createdAt)} {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
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
