import { memo } from "react";
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
}

export const ProductCard = memo(function ProductCard({ product: p, inCart, lang, t, onAdd }: ProductCardProps) {
  const th = useThemeClasses();

  return (
    <div className={`rounded-[20px] border overflow-hidden transition-all ${
      inCart ? "border-[#A0673C] ring-1 ring-[#A0673C]/20" : th.bdr
    } ${th.card} ${p.stock === 0 ? "opacity-40" : ""}`}>
      <div className="p-3.5 relative">
        <div className={`flex justify-center py-3 rounded-2xl mb-3 ${th.ring}`}>
          <ProductImage product={p} size={72} />
        </div>
        <p className={`text-[10px] font-mono ${th.txf}`}>{p.sku}</p>
        <p className={`text-[13px] font-bold leading-tight mt-0.5 truncate tracking-tight ${th.tx}`}>
          {lang === "id" ? p.nameId : p.name}
        </p>
        <div className="flex items-baseline gap-1 mt-1.5">
          <span className={`text-[15px] font-black tracking-tight ${th.acc}`}>{$(p.priceIndividual)}</span>
          <span className={`text-[10px] ${th.txf}`}>/{p.unit}</span>
        </div>
        <div className="mt-1.5">
          {p.stock === 0 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${th.dark ? "bg-[#D4627A]/15 text-[#D4627A]" : "bg-red-50 text-[#D4627A]"}`}>{t.soldOut}</span>}
          {p.stock > 0 && p.stock <= p.minStock && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${th.dark ? "bg-[#D4956B]/15 text-[#E8B088]" : "bg-[#FFF5EC] text-[#A0673C]"}`}>{p.stock} {t.left}</span>}
          {p.stock > p.minStock && <span className={`text-[10px] ${th.txf}`}>{p.stock} {t.inStock}</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 px-3.5 pb-3.5">
        <button onClick={() => onAdd(p, "individual")} disabled={p.stock === 0}
          className={`py-2 rounded-xl text-[11px] font-bold disabled:opacity-30 border ${th.bdr} ${th.card2} ${th.acc}`}>
          {t.addPcs}
        </button>
        <button onClick={() => onAdd(p, "box")} disabled={p.stock < p.qtyPerBox}
          className={`py-2 rounded-xl text-[11px] font-bold disabled:opacity-30 ${th.accBg} ${th.acc}`}>
          {t.addBox}({p.qtyPerBox})
        </button>
      </div>
    </div>
  );
});
