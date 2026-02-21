import { useState, useMemo } from "react";
import { useLangStore, useOrderStore, useProductStore } from "@/stores";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { OrderDetailModal } from "@/components/OrderDetailModal";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency as $, formatTime, printReport } from "@/utils";
import { exportOrders } from "@/utils/export";
import { Printer, FileText, Download, Search } from "lucide-react";
import toast from "react-hot-toast";

type DateRange = "today" | "yesterday" | "week" | "month" | "all";

function getDateRange(range: DateRange): { start: Date; end: Date } | null {
  if (range === "all") return null;
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (range) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "week": {
      const s = new Date(now);
      s.setDate(s.getDate() - s.getDay());
      return { start: startOfDay(s), end: endOfDay(now) };
    }
    case "month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
  }
}

export function OrdersPage() {
  const th = useThemeClasses();
  const { t } = useLangStore();
  const orders = useOrderStore(s => s.orders);
  const products = useProductStore(s => s.products);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 150);
  const ORDERS_PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(ORDERS_PAGE_SIZE);
  const [prevFilterKey, setPrevFilterKey] = useState("");

  // Filter by date range
  const dateFiltered = useMemo(() => {
    const range = getDateRange(dateRange);
    if (!range) return orders;
    return orders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= range.start && d <= range.end;
    });
  }, [orders, dateRange]);

  // Filter by search query
  const searchFiltered = useMemo(() => {
    if (!debouncedSearch.trim()) return dateFiltered;
    const q = debouncedSearch.toLowerCase();
    return dateFiltered.filter(o =>
      o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q)
    );
  }, [dateFiltered, debouncedSearch]);

  // Filter by status
  const filtered = useMemo(() =>
    statusFilter === "all" ? searchFiltered : searchFiltered.filter(o => o.status === statusFilter),
    [searchFiltered, statusFilter]
  );

  // Reset pagination when filters change
  const filterKey = `${dateRange}-${statusFilter}-${debouncedSearch}`;
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(ORDERS_PAGE_SIZE);
  }
  const visibleOrders = filtered.slice(0, visibleCount);

  // Summary stats (from date-filtered, all statuses)
  const stats = useMemo(() => {
    const completed = dateFiltered.filter(o => o.status === "completed");
    const cancelled = dateFiltered.filter(o => o.status === "cancelled");
    const refunded = dateFiltered.filter(o => o.status === "refunded");
    const revenue = completed.reduce((s, o) => s + o.total, 0);
    const avg = completed.length > 0 ? Math.round(revenue / completed.length) : 0;
    return { revenue, completedCount: completed.length, avg, cancelledCount: cancelled.length, refundedCount: refunded.length };
  }, [dateFiltered]);

  const dateRangeLabel = (r: DateRange) => {
    switch (r) {
      case "today": return t.today;
      case "yesterday": return t.yesterday;
      case "week": return t.thisWeek;
      case "month": return t.thisMonth;
      case "all": return t.allOrders;
    }
  };

  const statusLabel = (f: string) => {
    switch (f) {
      case "all": return t.allOrders;
      case "completed": return t.completed;
      case "pending": return t.pending;
      case "cancelled": return t.cancelled;
      case "refunded": return t.refunded;
      default: return f;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className={`text-[22px] font-black tracking-tight shrink-0 ${th.tx}`}>{t.orders}</h1>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => { exportOrders(dateFiltered, "csv"); toast.success(t.exportSuccess as string); }}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold ${th.elev} ${th.txm}`}>
            <Download size={11} /> CSV
          </button>
          <button onClick={() => { exportOrders(dateFiltered, "xlsx"); toast.success(t.exportSuccess as string); }}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold ${th.elev} ${th.txm}`}>
            <Download size={11} /> Excel
          </button>
          <button onClick={() => printReport(dateFiltered, dateRangeLabel(dateRange) as string)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold ${th.accBg} ${th.acc}`}>
            <Printer size={12} /> {t.printReport}
          </button>
        </div>
      </div>

      {/* Date range pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {(["today", "yesterday", "week", "month", "all"] as DateRange[]).map(r => (
          <button key={r} onClick={() => setDateRange(r)}
            className={`shrink-0 px-3.5 py-2 rounded-[14px] text-xs font-bold transition-all ${
              dateRange === r
                ? "text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]"
                : `${th.elev} ${th.txm}`
            }`}>{dateRangeLabel(r)}</button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${th.txf}`} />
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder={t.searchOrders as string}
          className={`w-full pl-10 pr-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#A0673C]/20 font-medium ${th.inp}`} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: t.totalRevenue, value: $(stats.revenue), color: th.acc },
          { label: t.ordersCount, value: String(stats.completedCount), color: th.dark ? "text-[#4A8B3F]" : "text-[#4A8B3F]" },
          { label: t.avgOrder, value: $(stats.avg), color: th.dark ? "text-[#5B8DEF]" : "text-[#5B8DEF]" },
          { label: t.cancelledCount, value: String(stats.cancelledCount), color: "text-[#C4504A]" },
        ].map((card, i) => (
          <div key={i} className={`rounded-[18px] border p-3.5 ${th.card} ${th.bdr}`}>
            <p className={`text-[10px] font-semibold ${th.txm}`}>{card.label}</p>
            <p className={`text-lg font-black tracking-tight mt-0.5 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {["all", "completed", "pending", "cancelled", "refunded"].map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`shrink-0 px-3.5 py-2 rounded-[14px] text-xs font-bold ${
              statusFilter === f ? "text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]" : `border ${th.card} ${th.bdr} ${th.txm}`
            }`}>{statusLabel(f)}</button>
        ))}
      </div>

      {/* Order list */}
      <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
        {filtered.length === 0 ? (
          <div className={`py-10 text-center ${th.txm}`}>
            {debouncedSearch.trim() ? (
              <><Search size={32} className="mx-auto opacity-20 mb-2" /><p className="text-sm font-semibold">{t.noOrdersFound}</p></>
            ) : (
              <><FileText size={32} className="mx-auto opacity-20 mb-2" /><p className="text-sm font-semibold">{t.noOrdersInRange}</p></>
            )}
          </div>
        ) : visibleOrders.map(o => (
          <div key={o.id} onClick={() => setDetailOrderId(o.id)}
            className={`px-5 py-4 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdr}/50`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${o.status === "completed" ? "bg-[#4A8B3F]" : o.status === "pending" ? "bg-[#E8B088]" : o.status === "refunded" ? "bg-[#E89B48]" : "bg-[#C4504A]"}`} />
                <div>
                  <p className={`text-sm font-bold ${th.tx}`}>{o.id}</p>
                  <p className={`text-[11px] ${th.txm}`}>{o.customer} · {formatTime(o.createdAt)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-black ${o.status === "cancelled" || o.status === "refunded" ? "line-through opacity-50" : ""} ${th.tx}`}>{$(o.total)}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  o.status === "cancelled"
                    ? (th.dark ? "bg-[#C4504A]/15 text-[#C4504A]" : "bg-red-50 text-[#C4504A]")
                    : o.status === "refunded"
                    ? (th.dark ? "bg-[#E89B48]/15 text-[#E89B48]" : "bg-amber-50 text-[#E89B48]")
                    : o.payment === "cash" ? (th.dark ? "bg-[#4A8B3F]/15 text-[#4A8B3F]" : "bg-green-50 text-[#4A8B3F]")
                    : o.payment === "card" ? (th.dark ? "bg-[#5B8DEF]/15 text-[#5B8DEF]" : "bg-blue-50 text-[#5B8DEF]")
                    : (th.dark ? "bg-[#8B6FC0]/15 text-[#8B6FC0]" : "bg-purple-50 text-[#8B6FC0]")
                }`}>{o.status === "cancelled" ? t.cancelled : o.status === "refunded" ? t.refunded : t[o.payment]}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 ml-5">
              {o.items.map((item, i) => (
                <span key={i}
                  onClick={(e) => { e.stopPropagation(); if (products.find(p => p.id === item.productId)) setDetailProductId(item.productId); }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium cursor-pointer active:opacity-70 ${th.elev} ${th.txm}`}>
                  {item.name} ×{item.quantity}
                </span>
              ))}
            </div>
          </div>
        ))}
        {visibleCount < filtered.length && (
          <button onClick={() => setVisibleCount(v => v + ORDERS_PAGE_SIZE)}
            className={`w-full py-3 text-sm font-bold ${th.acc} hover:opacity-70`}>
            {t.loadMore} ({filtered.length - visibleCount})
          </button>
        )}
      </div>
      <ProductDetailModal productId={detailProductId} onClose={() => setDetailProductId(null)} />
      <OrderDetailModal orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
    </div>
  );
}
