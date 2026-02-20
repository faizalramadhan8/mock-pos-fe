import { useState } from "react";
import { useLangStore, useOrderStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatTime } from "@/utils";

export function OrdersPage() {
  const th = useThemeClasses();
  const { t } = useLangStore();
  const orders = useOrderStore(s => s.orders);
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  return (
    <div className="flex flex-col gap-4">
      <h1 className={`text-[22px] font-black tracking-tight ${th.tx}`}>{t.orders}</h1>
      <div className="flex gap-2">
        {["all", "completed", "pending"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-[14px] text-xs font-bold ${
              filter === f ? "text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]" : `border ${th.card} ${th.bdr} ${th.txm}`
            }`}>{f === "all" ? t.allOrders : f === "completed" ? t.completed : t.pending}</button>
        ))}
      </div>
      <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
        {filtered.length === 0 ? (
          <div className={`py-10 text-center ${th.txm}`}>
            <p className="text-sm font-semibold">{t.noResults}</p>
          </div>
        ) : filtered.map(o => (
          <div key={o.id} className={`px-5 py-4 border-b last:border-0 ${th.bdr}/50`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${o.status === "completed" ? "bg-[#4A8B3F]" : o.status === "pending" ? "bg-[#E8B088]" : "bg-[#C4504A]"}`} />
                <div>
                  <p className={`text-sm font-bold ${th.tx}`}>{o.id}</p>
                  <p className={`text-[11px] ${th.txm}`}>{o.customer} · {formatTime(o.createdAt)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-black ${th.tx}`}>{$(o.total)}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  o.payment === "cash" ? (th.dark ? "bg-[#4A8B3F]/15 text-[#4A8B3F]" : "bg-green-50 text-[#4A8B3F]")
                    : o.payment === "card" ? (th.dark ? "bg-[#5B8DEF]/15 text-[#5B8DEF]" : "bg-blue-50 text-[#5B8DEF]")
                    : (th.dark ? "bg-[#8B6FC0]/15 text-[#8B6FC0]" : "bg-purple-50 text-[#8B6FC0]")
                }`}>{t[o.payment]}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 ml-5">
              {o.items.map((item, i) => (
                <span key={i} className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${th.elev} ${th.txm}`}>
                  {item.name} ×{item.quantity}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
