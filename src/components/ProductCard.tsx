import { memo } from "react";
import { Info, Plus, Package } from "lucide-react";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $ } from "@/utils";
import type { Product, UnitType, Lang } from "@/types";

interface ProductCardProps {
  product: Product;
  inCart: boolean;
  lang: Lang;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: Record<string, any>;
  onAdd: (product: Product, unitType: UnitType) => void;
  onDetail?: (productId: string) => void;
}

// Text-only ProductCard. Optimised for ~180-260px column widths on the
// kasir tablet. Vertical-first layout so nothing ever overflows:
//   SKU · info          (header row)
//   Product Name         (2-line clamp, large display)
//   Rp price / unit      (single line, whitespace-nowrap)
//   Stock pill           (one colour per state)
//   Primary CTA          (full-width)
//   Secondary box CTA    (below, compact)
// No product image — owner decision. The decorative blush is subtle
// (20% opacity, smaller) so it supports but never competes with text.
export const ProductCard = memo(function ProductCard({ product: p, inCart, lang, t, onAdd, onDetail }: ProductCardProps) {
  const th = useThemeClasses();
  const outOfStock = p.stock === 0;
  const lowStock = p.stock > 0 && p.stock <= p.minStock;

  const stockChip = outOfStock || lowStock
    ? "bg-[#FCE4EC] text-[#BE123C] dark:bg-[#BE123C]/25 dark:text-[#FB7185]"
    : `${th.accBg} ${th.acc}`;

  return (
    <div
      className={`group relative rounded-2xl border overflow-hidden transition-all duration-200 press-spring ${
        inCart
          ? "border-[#E11D48] ring-2 ring-[#FFB5C0]/50 shadow-[0_6px_18px_-10px_rgba(225,29,72,0.35)]"
          : `${th.bdr} hover:border-[#FFB5C0]`
      } ${th.card} ${outOfStock ? "opacity-55" : ""}`}
    >
      {/* Soft blush — smaller, lower opacity so it never dominates */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl"
        style={{ background: "radial-gradient(circle, #FFB5C0 0%, transparent 70%)" }}
      />

      <div className="relative p-3.5 flex flex-col gap-2.5">
        {/* Header row: SKU + info icon (small, discrete) */}
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[10px] font-mono uppercase tracking-[0.12em] ${th.txf} leading-tight`}>
            {p.sku}
          </p>
          {onDetail && (
            <button
              onClick={(e) => { e.stopPropagation(); onDetail(p.id); }}
              aria-label="Detail produk"
              className={`-m-1.5 p-1.5 rounded-full ${th.txf} hover:${th.acc} transition-colors`}
            >
              <Info size={14} strokeWidth={2.2} />
            </button>
          )}
        </div>

        {/* Product name — hero, up to 2 lines, word-break so long names
            never truncate mid-character. Minimum height reserves 2 lines so
            cards in the same row stay aligned even when one name is short. */}
        <p
          className={`font-display text-[17px] font-black leading-[1.2] tracking-tight ${th.tx}`}
          style={{
            fontVariationSettings: '"wght" 900',
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            overflowWrap: "anywhere",
            minHeight: "calc(17px * 1.2 * 2)",
          }}
        >
          {lang === "id" ? p.nameId : p.name}
        </p>

        {/* Price — single-line wrap-capable; number always intact on its own
            line if needed. No truncate on the number itself — the full
            Rupiah must always be readable. */}
        <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0">
          <span
            className={`font-display text-[22px] font-black tracking-tight leading-none ${th.acc}`}
            style={{ fontVariationSettings: '"wght" 800', whiteSpace: "nowrap" }}
          >
            {$(p.sellingPrice)}
          </span>
          <span className={`text-sm ${th.txm}`}>/ {p.unit}</span>
        </div>

        {/* Member price — inline compact, only if applicable */}
        {typeof p.memberPrice === "number" && p.memberPrice > 0 && p.memberPrice < p.sellingPrice && (
          <p className={`text-xs font-bold truncate ${th.acc}`}>
            Member {$(p.memberPrice)}
          </p>
        )}

        {/* Stock pill — compact, pink family (not black) */}
        <div>
          <span className={`inline-flex items-center gap-1 text-sm font-black px-2.5 py-1 rounded-full ${stockChip}`}>
            <Package size={12} strokeWidth={2.5} />
            {outOfStock ? t.soldOut : lowStock ? `${p.stock} ${t.left}` : `${p.stock} ${t.inStock}`}
          </span>
        </div>
      </div>

      {/* Actions — stacked vertically so narrow cards never clip */}
      <div className="relative px-3.5 pb-3.5 flex flex-col gap-1.5">
        <button
          onClick={() => onAdd(p, "individual")}
          disabled={outOfStock}
          className="press-spring flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-black text-white bg-gradient-to-br from-[#FB7185] to-[#E11D48] shadow-[0_3px_10px_-4px_rgba(225,29,72,0.45)] disabled:opacity-30 disabled:shadow-none"
        >
          <Plus size={14} strokeWidth={3} />
          {t.addPcs}
        </button>
        {p.qtyPerBox > 1 && (
          <button
            onClick={() => onAdd(p, "box")}
            disabled={p.stock < p.qtyPerBox}
            className={`press-spring flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold border-2 disabled:opacity-30 ${
              th.dark
                ? "border-[#E11D48]/40 text-[#FB7185]"
                : "border-[#FFB5C0] text-[#E11D48]"
            }`}
          >
            {t.box} · {p.qtyPerBox}
          </button>
        )}
      </div>
    </div>
  );
});
