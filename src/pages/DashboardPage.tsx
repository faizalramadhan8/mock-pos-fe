import { useAuthStore, useLangStore, useOrderStore, useProductStore } from "@/stores";
import { ProductImage } from "@/components/ProductImage";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatTime } from "@/utils";

export function DashboardPage() {
  const th = useThemeClasses();
  const { t, lang } = useLangStore();
  const user = useAuthStore(s => s.user)!;
  const orders = useOrderStore(s => s.orders);
  const revenue = useOrderStore(s => s.todayRevenue)();
  const lowStock = useProductStore(s => s.getLowStock)();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className={`text-[22px] font-black tracking-tight ${th.tx}`}>{t.welcome}, {user.name.split(" ")[0]}</h1>
        <p className={`text-sm mt-0.5 ${th.txm}`}>{t.todayOverview}</p>
      </div>

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

      <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
        <div className={`px-5 py-3.5 border-b ${th.bdr}`}>
          <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.recentOrders}</p>
        </div>
        {orders.slice(0, 4).map(o => (
          <div key={o.id} className={`flex items-center justify-between px-5 py-3 border-b last:border-0 ${th.bdr}/50`}>
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

      {lowStock.length > 0 && (
        <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
          <div className={`px-5 py-3.5 border-b ${th.bdr} flex items-center gap-2`}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4627A]" />
            <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.lowStockItems}</p>
          </div>
          {lowStock.slice(0, 5).map(p => (
            <div key={p.id} className={`flex items-center justify-between px-5 py-2.5 border-b last:border-0 ${th.bdr}/50`}>
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
    </div>
  );
}
