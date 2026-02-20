import { useState, memo } from "react";
import { useCategoryStore } from "@/stores";
import { CategoryIconMap } from "@/components/icons";
import type { Product } from "@/types";

interface ProductImageProps {
  product: Product;
  size?: number;
}

export const ProductImage = memo(function ProductImage({ product, size = 80 }: ProductImageProps) {
  const [err, setErr] = useState(false);
  const categories = useCategoryStore(s => s.categories);
  const cat = categories.find(c => c.id === product.category);
  const Icon = cat ? CategoryIconMap[cat.icon] : null;

  if (err || !product.image) {
    return (
      <div className="flex items-center justify-center rounded-2xl" style={{
        width: size, height: size,
        background: `${cat?.color || "#999"}10`,
      }}>
        {Icon ? <Icon color={cat?.color} size={size * 0.45} /> : (
          <span className="text-2xl opacity-30">📦</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={product.image}
      alt={product.name}
      width={size} height={size}
      className="rounded-2xl object-cover"
      loading="lazy"
      onError={() => setErr(true)}
    />
  );
});
