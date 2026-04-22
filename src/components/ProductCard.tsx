import { memo } from "react";
import { Info } from "lucide-react";
import { ProductImage } from "./ProductImage";
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

export const ProductCard = memo(function ProductCard({ product: p, inCart, lang, t, onAdd, onDetail }: ProductCardProps) {
  const th = useThemeClasses();

  return (
    <div className={`rounded-[20px] border overflow-hidden transition-all ${
      inCart ? "border-[#1E40AF] ring-1 ring-[#1E40AF]/20" : th.bdr
    } ${th.card} ${p.stock === 0 ? "opacity-40" : ""}`}>
      <div className="p-3.5 relative">
        {onDetail && (
          <button
            onClick={(e) => { e.stopPropagation(); onDetail(p.id); }}
            className={`absolute top-2 right-2 z-10 p-1.5 rounded-lg ${th.elev} ${th.txm} hover:opacity-70`}
          >
            <Info size={14} />
          </button>
        )}
        <div className={`flex justify-center py-3 rounded-2xl mb-3 ${th.ring}`}>
          <ProductImage product={p} size={72} />
        </div>
        <p className={`text-xs font-mono ${th.txf}`}>{p.sku}</p>
        <p className={`text-sm font-bold leading-tight mt-0.5 truncate tracking-tight ${th.tx}`}>
          {lang === "id" ? p.nameId : p.name}
        </p>
        <div className="flex items-baseline gap-1 mt-1.5">
          <span className={`text-sm font-black tracking-tight ${th.acc}`}>{$(p.sellingPrice)}</span>
          <span className={`text-xs ${th.txf}`}>/{p.unit}</span>
        </div>
        <div className="mt-1.5">
          {p.stock === 0 && (
            <span className={`text-base font-black px-2.5 py-1 rounded-lg ${th.dark ? "bg-[#D4627A]/20 text-[#D4627A]" : "bg-red-100 text-[#D4627A]"}`}>
              {t.soldOut}
            </span>
          )}
          {p.stock > 0 && p.stock <= p.minStock && (
            <span className={`text-base font-black px-2.5 py-1 rounded-lg ${th.dark ? "bg-[#D4627A]/20 text-[#D4627A]" : "bg-red-100 text-[#D4627A]"}`}>
              {p.stock} {t.left}
            </span>
          )}
          {p.stock > p.minStock && (
            <span className={`text-base font-black px-2.5 py-1 rounded-lg ${th.dark ? "bg-[#4A8B3F]/20 text-[#4A8B3F]" : "bg-green-100 text-[#4A8B3F]"}`}>
              {p.stock} {t.inStock}
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 px-3.5 pb-3.5">
        <button onClick={() => onAdd(p, "individual")} disabled={p.stock === 0}
          className={`py-2 rounded-xl text-xs font-bold disabled:opacity-30 border ${th.bdr} ${th.card2} ${th.acc}`}>
          {t.addPcs}
        </button>
        <button onClick={() => onAdd(p, "box")} disabled={p.stock < p.qtyPerBox}
          className={`py-2 rounded-xl text-xs font-bold disabled:opacity-30 ${th.accBg} ${th.acc}`}>
          {t.addBox}({p.qtyPerBox})
        </button>
      </div>
    </div>
  );
});
