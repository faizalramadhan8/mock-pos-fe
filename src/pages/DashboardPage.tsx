import { useState, useMemo } from "react";
import { useAuthStore, useLangStore, useOrderStore, useProductStore, useBatchStore } from "@/stores";
import { ProductImage } from "@/components/ProductImage";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { OrderDetailModal } from "@/components/OrderDetailModal";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatTime } from "@/utils";

export function DashboardPage() {
  const th = useThemeClasses();
  const { t, lang } = useLangStore();
  const user = useAuthStore(s => s.user)!;
  const orders = useOrderStore(s => s.orders);
  const revenue = useOrderStore(s => s.todayRevenue)();
  const products = useProductStore(s => s.products);
  const lowStock = useProductStore(s => s.getLowStock)();

  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const isOwner = user.role === "superadmin" || user.role === "admin";
  const isCashier = user.role === "cashier";
  const isStaff = user.role === "staff";

  // Staff: expiry data
  const getExpiringBatches = useBatchStore(s => s.getExpiringBatches);
  const batches = useBatchStore(s => s.batches);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const expiringBatches = useMemo(() => isStaff ? getExpiringBatches(60) : [], [isStaff, batches, getExpiringBatches]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className={`text-[22px] font-black tracking-tight ${th.tx}`}>{t.welcome}, {user.name.split(" ")[0]}</h1>
        <p className={`text-sm mt-0.5 ${th.txm}`}>{t.todayOverview}</p>
      </div>

      {/* ─── Owner Stats ─── */}
      {isOwner && (
        <div className="grid grid-cols-[1.2fr_1fr] gap-3">
          <div className="row-span-2 rounded-[22px] p-5 text-white bg-gradient-to-br from-[#E8B088] to-[#8B5E3C]">
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{t.revenue}</p>
            <p className="text-[28px] font-black tracking-tight mt-1.5">{$(revenue)}</p>
            <p className="text-[11px] mt-2 opacity-50">+12.5% vs yesterday</p>
          </div>
          {[
            { label: t.ordersCount, value: orders.length, color: "#5B8DEF" },
            { label: t.lowAlerts, value: lowStock.length, color: lowStock.length > 3 ? "#D4627A" : "#4A8B3F" },
          ].map((s, i) => (
            <div key={i} className={`rounded-[18px] border p-4 ${th.card} ${th.bdr}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${th.txm}`}>{s.label}</p>
              <p className={`text-[22px] font-black mt-1 ${th.tx}`}>{s.value}</p>
              <div className="w-7 h-[3px] rounded-full mt-1.5 opacity-50" style={{ background: s.color }} />
            </div>
          ))}
        </div>
      )}

      {/* ─── Cashier Stats ─── */}
      {isCashier && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[22px] p-5 text-white bg-gradient-to-br from-[#E8B088] to-[#8B5E3C]">
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{t.revenue}</p>
            <p className="text-[28px] font-black tracking-tight mt-1.5">{$(revenue)}</p>
          </div>
          <div className={`rounded-[18px] border p-4 flex flex-col justify-center ${th.card} ${th.bdr}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${th.txm}`}>{t.ordersCount}</p>
            <p className={`text-[22px] font-black mt-1 ${th.tx}`}>{orders.length}</p>
            <div className="w-7 h-[3px] rounded-full mt-1.5 opacity-50" style={{ background: "#5B8DEF" }} />
          </div>
        </div>
      )}

      {/* ─── Staff Stats ─── */}
      {isStaff && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t.productsCount, value: products.length, color: "#5B8DEF" },
            { label: t.lowAlerts, value: lowStock.length, color: lowStock.length > 3 ? "#D4627A" : "#E89B48" },
            { label: t.invExpiry, value: expiringBatches.length, color: expiringBatches.length > 0 ? "#E89B48" : "#4A8B3F" },
          ].map((s, i) => (
            <div key={i} className={`rounded-[18px] border p-3.5 ${th.card} ${th.bdr}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${th.txm}`}>{s.label}</p>
              <p className="text-xl font-black mt-1" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── Recent Orders (Owner + Cashier) ─── */}
      {(isOwner || isCashier) && (
        <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
          <div className={`px-5 py-3.5 border-b ${th.bdr}`}>
            <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.recentOrders}</p>
          </div>
          {orders.slice(0, 4).map(o => (
            <div key={o.id} onClick={() => setDetailOrderId(o.id)}
              className={`flex items-center justify-between px-5 py-3 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdr}/50`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${o.status === "completed" ? "bg-[#4A8B3F]" : "bg-[#E8B088]"}`} />
                <div>
                  <p className={`text-sm font-bold ${th.tx}`}>{o.id}</p>
                  <p className={`text-[11px] ${th.txm}`}>{o.customer} · {formatTime(o.createdAt)}</p>
                </div>
              </div>
              <p className={`text-sm font-extrabold ${th.tx}`}>{$(o.total)}</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── Low Stock Items (Owner + Staff) ─── */}
      {(isOwner || isStaff) && lowStock.length > 0 && (
        <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
          <div className={`px-5 py-3.5 border-b ${th.bdr} flex items-center gap-2`}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4627A]" />
            <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.lowStockItems}</p>
          </div>
          {lowStock.slice(0, 5).map(p => (
            <div key={p.id} onClick={() => setDetailProductId(p.id)}
              className={`flex items-center justify-between px-5 py-2.5 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdr}/50`}>
              <div className="flex items-center gap-2.5">
                <ProductImage product={p} size={28} />
                <p className={`text-sm font-semibold ${th.tx}`}>{lang === "id" ? p.nameId : p.name}</p>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                p.stock === 0
                  ? (th.dark ? "bg-[#D4627A]/15 text-[#D4627A]" : "bg-red-50 text-[#D4627A]")
                  : (th.dark ? "bg-[#D4956B]/15 text-[#E8B088]" : "bg-[#FFF5EC] text-[#A0673C]")
              }`}>{p.stock} {t.left}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Expiry Alerts (Staff only) ─── */}
      {isStaff && expiringBatches.length > 0 && (
        <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
          <div className={`px-5 py-3.5 border-b ${th.bdr} flex items-center gap-2`}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#E89B48]" />
            <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.expiryAlerts}</p>
          </div>
          {expiringBatches.slice(0, 5).map(batch => {
            const product = products.find(p => p.id === batch.productId);
            const days = Math.ceil((new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const isExpired = days <= 0;
            const isUrgent = days > 0 && days <= 14;
            return (
              <div key={batch.id} onClick={() => product && setDetailProductId(product.id)}
                className={`flex items-center justify-between px-5 py-2.5 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdr}/50`}>
                <div className="flex items-center gap-2.5">
                  {product && <ProductImage product={product} size={28} />}
                  <div>
                    <p className={`text-sm font-semibold ${th.tx}`}>{product ? (lang === "id" ? product.nameId : product.name) : batch.productId}</p>
                    <p className={`text-[11px] ${th.txf}`}>{batch.quantity} {product?.unit || "pcs"}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  isExpired
                    ? (th.dark ? "bg-[#D4627A]/15 text-[#D4627A]" : "bg-red-50 text-[#D4627A]")
                    : isUrgent
                    ? (th.dark ? "bg-[#D4956B]/15 text-[#E8B088]" : "bg-[#FFF5EC] text-[#A0673C]")
                    : (th.dark ? "bg-[#E89B48]/10 text-[#E89B48]" : "bg-amber-50 text-[#E89B48]")
                }`}>
                  {isExpired ? t.alreadyExpired : `${days} ${t.days}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <ProductDetailModal productId={detailProductId} onClose={() => setDetailProductId(null)} />
      <OrderDetailModal orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
    </div>
  );
}
