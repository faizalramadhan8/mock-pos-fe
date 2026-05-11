import { useEffect, useMemo, useState } from "react";
import { useLangStore, useOrderStore, useProductStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { usePageFetch } from "@/hooks/usePageFetch";
import { useCountUp } from "@/hooks/useCountUp";
import { formatCurrency as $ } from "@/utils";
import { exportOrders, exportOrderReport } from "@/utils/export";
import { getDateRange, type DateRange, type CustomRange } from "@/utils/dateRange";
import { orderApi, type OrderAggregateResponse } from "@/api/orders";
import { expenseApi, type ProfitLossRes } from "@/api/expenses";
import { BakeryLogo } from "@/components/icons";
import { Package, Users, Wallet, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Download, Info } from "lucide-react";
import toast from "react-hot-toast";

type ReportTab = "products" | "members" | "profit-loss";

// YYYY-MM-DD in local time (WIB) — BE aggregate expects calendar-date strings.
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// In-app report page — owner: "saya tidak mau ke excel, lihat di dalam
// sistem saja". Dua tab: Top Produk (urut qty terjual) & Member (urut total
// belanja, expandable untuk lihat detail item). Filter date range konsisten
// dengan halaman lain (today/yesterday/week/month/all/custom).
export function ReportsPage() {
  usePageFetch([
    { key: "orders", fetch: () => useOrderStore.getState().fetchOrders() },
  ]);
  const th = useThemeClasses();
  const { lang } = useLangStore();
  const orders = useOrderStore(s => s.orders);
  const products = useProductStore(s => s.products);

  const [tab, setTab] = useState<ReportTab>("products");
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [customRange, setCustomRange] = useState<CustomRange>({ from: "", to: "" });
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // Custom range validation
  const customError = dateRange === "custom" && (
    !customRange.from || !customRange.to ? (lang === "id" ? "Pilih tanggal awal dan akhir." : "Pick start and end date.")
      : new Date(customRange.from) > new Date(customRange.to) ? (lang === "id" ? "Tanggal awal tidak boleh setelah tanggal akhir." : "Start date cannot be after end date.")
      : ""
  );

  const dateRangeLabel = (r: DateRange) => {
    if (lang === "id") {
      switch (r) {
        case "today": return "Hari Ini";
        case "yesterday": return "Kemarin";
        case "week": return "Minggu Ini";
        case "month": return "Bulan Ini";
        case "all": return "Semua";
        case "custom": return "Pilih Tanggal";
      }
    }
    switch (r) {
      case "today": return "Today";
      case "yesterday": return "Yesterday";
      case "week": return "This Week";
      case "month": return "This Month";
      case "all": return "All";
      case "custom": return "Custom";
    }
  };

  // Filter completed orders saja (cancelled/refunded di-skip).
  // Dipakai untuk export CSV/Excel/Print + expand item per member.
  // Untuk ranking + stats besar pakai aggregateData dari BE supaya scalable
  // (FE-side topProducts/memberStats di-fallback kalau aggregate belum sampai).
  const filteredOrders = useMemo(() => {
    const range = getDateRange(dateRange, customRange);
    const completed = orders.filter(o => o.status === "completed");
    if (!range) return completed;
    return completed.filter(o => {
      const d = new Date(o.createdAt);
      return d >= range.start && d <= range.end;
    });
  }, [orders, dateRange, customRange]);

  // BE-side aggregate. Dipanggil setiap dateRange/customRange berubah.
  // Cegah FE compute dari full orders array (yang bisa kena hardcoded fetch
  // limit). Kalau gagal, FE tetap render dari `filteredOrders` di bawah.
  const [aggregateData, setAggregateData] = useState<OrderAggregateResponse | null>(null);
  useEffect(() => {
    if (customError) return;
    const range = getDateRange(dateRange, customRange);
    const from = range ? toYMD(range.start) : "";
    const to = range ? toYMD(range.end) : "";
    let cancelled = false;
    orderApi.aggregate({ from, to })
      .then(res => { if (!cancelled) setAggregateData(res.body ?? null); })
      .catch(err => { if (!cancelled) { console.error("aggregate failed", err); setAggregateData(null); } });
    return () => { cancelled = true; };
  }, [dateRange, customRange, customError]);

  // Profit/Loss — fetch setiap range berubah (tidak gated by tab) supaya
  // selalu siap saat user export ke Excel dari tab manapun. Payload kecil
  // (summary saja), aman dipanggil eager.
  const [profitLoss, setProfitLoss] = useState<ProfitLossRes | null>(null);
  useEffect(() => {
    if (customError) return;
    const range = getDateRange(dateRange, customRange);
    const from = range ? toYMD(range.start) : "";
    const to = range ? toYMD(range.end) : "";
    let cancelled = false;
    expenseApi.profitLoss({ from, to })
      .then(res => { if (!cancelled) setProfitLoss(res.body ?? null); })
      .catch(err => { if (!cancelled) { console.error("profit-loss failed", err); setProfitLoss(null); } });
    return () => { cancelled = true; };
  }, [dateRange, customRange, customError]);

  // Aggregate top produk. Prefer BE-side aggregate (scalable). Fallback ke
  // client-side dari `filteredOrders` kalau BE belum sampai / gagal.
  // avgPrice = harga jual rata-rata di periode (snapshot dari order_items).
  // currentPrice = harga produk saat ini (master data) — dibandingkan supaya
  // owner tahu kalau harga sudah berubah sejak periode.
  const topProducts = useMemo(() => {
    if (aggregateData?.top_products) {
      return aggregateData.top_products.map(p => {
        const current = products.find(prod => prod.id === p.product_id);
        return {
          productId: p.product_id,
          name: p.name,
          qty: p.qty,
          revenue: p.revenue,
          avgPrice: p.avg_price,
          currentPrice: current?.sellingPrice,
          productExists: !!current,
        };
      });
    }
    type Row = { productId: string; name: string; qty: number; revenue: number; avgPrice: number };
    const map = new Map<string, Row>();
    for (const o of filteredOrders) {
      for (const i of o.items) {
        const key = i.productId || i.name;
        const existing = map.get(key);
        const lineRevenue = i.unitPrice * i.quantity;
        if (existing) {
          existing.qty += i.quantity;
          existing.revenue += lineRevenue;
        } else {
          map.set(key, { productId: i.productId, name: i.name, qty: i.quantity, revenue: lineRevenue, avgPrice: i.unitPrice });
        }
      }
    }
    return Array.from(map.values())
      .map(p => {
        const current = products.find(prod => prod.id === p.productId);
        return {
          ...p,
          avgPrice: p.revenue / Math.max(1, p.qty),
          currentPrice: current?.sellingPrice,
          productExists: !!current,
        };
      })
      .sort((a, b) => b.qty - a.qty);
  }, [aggregateData, filteredOrders, products]);

  // Aggregate per member
  type MemberRow = {
    id: string;
    name: string;
    phone: string;
    orders: number;
    spend: number;
    savings: number;
    items: { name: string; qty: number; total: number }[];
  };
  // Member stats: BE-side aggregate kasih ringkasan per member (orders, spend,
  // savings). Item-level detail (untuk expand row) di-merge dari
  // `filteredOrders` — yang client-side, tapi sudah cukup karena orders array
  // di store di-limit ke 2000 (cukup untuk volume owner sekarang).
  const memberStats = useMemo<MemberRow[]>(() => {
    // Build items map per member dari client-side orders (untuk expand panel).
    const itemsByMember = new Map<string, { name: string; qty: number; total: number }[]>();
    for (const o of filteredOrders) {
      if (!o.member?.id) continue;
      const list = itemsByMember.get(o.member.id) || [];
      for (const i of o.items) {
        const idx = list.findIndex(x => x.name === i.name);
        if (idx >= 0) {
          list[idx].qty += i.quantity;
          list[idx].total += i.unitPrice * i.quantity;
        } else {
          list.push({ name: i.name, qty: i.quantity, total: i.unitPrice * i.quantity });
        }
      }
      itemsByMember.set(o.member.id, list);
    }

    if (aggregateData?.members) {
      return aggregateData.members.map(m => ({
        id: m.member_id,
        name: m.name,
        phone: m.phone || "-",
        orders: m.orders,
        spend: m.spend,
        savings: m.savings,
        items: (itemsByMember.get(m.member_id) || []).sort((a, b) => b.qty - a.qty),
      }));
    }

    // Fallback: client-side aggregation.
    const map = new Map<string, MemberRow>();
    for (const o of filteredOrders) {
      if (!o.member?.id) continue;
      const existing = map.get(o.member.id);
      const savings = o.memberSavings || 0;
      if (existing) {
        existing.orders += 1;
        existing.spend += o.total;
        existing.savings += savings;
      } else {
        map.set(o.member.id, {
          id: o.member.id,
          name: o.member.name,
          phone: o.member.phone || "-",
          orders: 1,
          spend: o.total,
          savings,
          items: [],
        });
      }
    }
    return Array.from(map.values())
      .map(m => ({ ...m, items: (itemsByMember.get(m.id) || []).sort((a, b) => b.qty - a.qty) }))
      .sort((a, b) => b.spend - a.spend);
  }, [aggregateData, filteredOrders]);

  const totalQty = aggregateData?.total_qty ?? topProducts.reduce((s, p) => s + p.qty, 0);
  const totalRevenue = aggregateData?.total_revenue ?? topProducts.reduce((s, p) => s + p.revenue, 0);

  // Empty-state: prefer aggregate count kalau ada (truthful source of truth),
  // else fallback ke filteredOrders.length.
  const hasData = aggregateData ? aggregateData.total_orders > 0 : filteredOrders.length > 0;

  // Filename label untuk export — pakai range custom kalau dipilih, else label periode.
  const exportRangeLabel = () => {
    if (dateRange === "custom" && customRange.from && customRange.to) {
      return `${customRange.from}_sd_${customRange.to}`;
    }
    return String(dateRangeLabel(dateRange));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className={`text-[22px] font-black tracking-tight ${th.tx}`}>
          {lang === "id" ? "Laporan" : "Reports"}
        </h1>
        <div className="flex gap-1.5 shrink-0">
          <button
            disabled={!!customError || !hasData}
            onClick={async () => {
              if (customError) { toast.error(customError); return; }
              await exportOrders(filteredOrders, "csv");
              toast.success(lang === "id" ? "CSV diunduh" : "CSV downloaded");
            }}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold ${th.elev} ${th.txm} disabled:opacity-40`}>
            <Download size={11} /> CSV
          </button>
          <button
            disabled={!!customError || !hasData}
            onClick={async () => {
              if (customError) { toast.error(customError); return; }
              await exportOrderReport(filteredOrders, exportRangeLabel(), profitLoss);
              toast.success(lang === "id" ? "Laporan diunduh" : "Report downloaded");
            }}
            title={lang === "id" ? "Excel berisi: Laba Rugi, Transaksi, Top Produk, Member" : "Excel contains: Profit/Loss, Transactions, Top Products, Members"}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold ${th.accBg} ${th.acc} disabled:opacity-40`}>
            <Download size={12} /> Excel
          </button>
        </div>
      </div>

      {/* Date range row */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[160px]">
          <label className={`text-xs font-bold ${th.txm} block mb-1`}>
            {lang === "id" ? "Periode" : "Period"}
          </label>
          <select value={dateRange} onChange={e => setDateRange(e.target.value as DateRange)}
            className={`w-full px-4 py-3 text-sm font-bold rounded-2xl border appearance-none cursor-pointer ${th.inp}`}>
            {(["today", "yesterday", "week", "month", "all", "custom"] as DateRange[]).map(r => (
              <option key={r} value={r}>{dateRangeLabel(r)}</option>
            ))}
          </select>
        </div>
        {dateRange === "custom" && (
          <>
            <div className="flex-1 min-w-[140px]">
              <label className={`text-xs font-bold ${th.txm} block mb-1`}>{lang === "id" ? "Dari" : "From"}</label>
              <input type="date" value={customRange.from} max={customRange.to || undefined}
                onChange={e => setCustomRange(r => ({ ...r, from: e.target.value }))}
                className={`w-full px-3 py-2.5 text-sm font-bold rounded-2xl border ${th.inp}`} />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className={`text-xs font-bold ${th.txm} block mb-1`}>{lang === "id" ? "Sampai" : "To"}</label>
              <input type="date" value={customRange.to} min={customRange.from || undefined}
                onChange={e => setCustomRange(r => ({ ...r, to: e.target.value }))}
                className={`w-full px-3 py-2.5 text-sm font-bold rounded-2xl border ${th.inp}`} />
            </div>
          </>
        )}
      </div>
      {customError && (
        <p role="alert" className={`text-xs font-bold ${th.dark ? "text-[#FB7185]" : "text-[#BE123C]"} -mt-2`}>
          {customError}
        </p>
      )}

      {/* Tab switch — role=tablist + touch target ≥44px */}
      <div role="tablist" aria-label={lang === "id" ? "Pilih laporan" : "Report category"}
        className="flex gap-2 overflow-x-auto scrollbar-hide">
        {([
          { id: "products" as ReportTab, label: lang === "id" ? "Top Produk" : "Top Products", icon: <Package size={16} /> },
          { id: "members" as ReportTab, label: lang === "id" ? "Member" : "Members", icon: <Users size={16} /> },
          { id: "profit-loss" as ReportTab, label: lang === "id" ? "Laba Rugi" : "Profit/Loss", icon: <Wallet size={16} /> },
        ]).map(item => (
          <button key={item.id} role="tab" aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-[14px] text-sm font-bold transition-all ${
              tab === item.id ? "text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48]" : `border ${th.bdr} ${th.card} ${th.txm}`
            }`}>
            {item.icon}{item.label}
          </button>
        ))}
      </div>

      {/* Empty state — pakai BakeryLogo besar supaya warm (toko kue), bukan
          generic icon. */}
      {!hasData && !customError && (
        <div className={`rounded-3xl border bg-bakery-stripe p-10 text-center ${th.bdr} ${th.card2}`}>
          <div className="mx-auto mb-4 opacity-70" style={{ width: 80 }}>
            <BakeryLogo size={80} />
          </div>
          <p className={`text-base font-bold ${th.tx}`}>
            {lang === "id" ? "Belum ada transaksi di periode ini" : "No transactions in this period"}
          </p>
          <p className={`text-sm mt-1 ${th.txm}`}>
            {lang === "id" ? "Coba pilih rentang tanggal lain di atas." : "Try a different date range above."}
          </p>
        </div>
      )}

      {/* Top Produk */}
      {tab === "products" && hasData && !customError && (
        <div className="flex flex-col gap-3">
          {/* Hero+2-up summary: revenue dominan (rounded-3xl + bakery stripe),
              qty + product count smaller di bawah. Break the 3-up monotony. */}
          <div className="grid gap-3 lg:grid-cols-3">
            <RevenueHero amount={totalRevenue} th={th} lang={lang} />
            <StatChip
              label={lang === "id" ? "Total Qty" : "Total Qty"}
              value={totalQty}
              th={th}
            />
            <StatChip
              label={lang === "id" ? "Produk Terjual" : "Products Sold"}
              value={topProducts.length}
              th={th}
            />
          </div>

          {/* Section heading + dotted divider — receipt feel. */}
          <div className="flex items-center gap-3 mt-2 px-1">
            <h2 className={`text-xs font-black uppercase tracking-wider ${th.txf}`}>
              {lang === "id" ? "Peringkat Produk" : "Product Ranking"}
            </h2>
            <div className={`flex-1 divider-dotted ${th.txm}`} />
          </div>

          {/* Product list dengan mini bar (relative ke top 1) */}
          <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card2}`}>
            {topProducts.map((p, idx) => {
              const avgRounded = Math.round(p.avgPrice);
              const current = p.currentPrice;
              const diff = current !== undefined ? Math.round(current - avgRounded) : 0;
              const diffPct = current && avgRounded ? Math.round((diff / avgRounded) * 100) : 0;
              const showDiff = current !== undefined && Math.abs(diff) >= 1;
              const topQty = topProducts[0]?.qty || 1;
              const barPct = Math.max(4, Math.round((p.qty / topQty) * 100));
              return (
                <div key={p.name} className={`flex items-start gap-3 px-4 py-3.5 ${idx > 0 ? `border-t ${th.bdrSoft}` : ""}`}>
                  <span aria-hidden
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                      idx === 0 ? "text-white bg-gradient-to-br from-[#FFB5C0] to-[#E11D48] shadow-sm"
                      : idx < 3 ? `${th.accBg} ${th.acc}`
                      : `${th.elev} ${th.txm}`
                    }`}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`font-bold text-sm truncate ${th.tx}`}>{p.name}</p>
                    <p className={`font-display text-xs mt-0.5 ${th.txm}`}>
                      {p.qty} × {$(avgRounded)} = <span className={`font-bold ${th.tx}`}>{$(p.revenue)}</span>
                    </p>
                    {/* Mini bar — relative ke top 1 product. Visual hint
                        cepat tanpa chart library. */}
                    <div className="mini-bar mt-2" style={{ "--bar-pct": `${barPct}%` } as React.CSSProperties}
                      aria-hidden />
                    {showDiff && (
                      <p className={`text-xs mt-1.5 inline-flex items-center gap-1 ${diff > 0 ? (th.dark ? "text-[#FB7185]" : "text-[#BE123C]") : (th.dark ? "text-[#FFB5C0]" : "text-[#E11D48]")}`}>
                        {diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        <span className="font-bold">
                          {lang === "id" ? "Harga sekarang" : "Now"} {$(current)}
                        </span>
                        <span className={th.txm}>
                          ({diff > 0 ? "+" : ""}{diffPct}% {lang === "id" ? "vs saat jual" : "vs sold"})
                        </span>
                      </p>
                    )}
                    {!p.productExists && (
                      <p className={`text-xs mt-1 inline-flex items-center gap-1 ${th.txf}`}>
                        <Minus size={12} />
                        {lang === "id" ? "Produk sudah dihapus" : "Product deleted"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Member */}
      {tab === "members" && hasData && !customError && (
        <div className="flex flex-col gap-3">
          {memberStats.length === 0 ? (
            <div className={`rounded-3xl border bg-bakery-stripe p-10 text-center ${th.bdr} ${th.card2}`}>
              <div className="mx-auto mb-4 opacity-70" style={{ width: 64 }}>
                <BakeryLogo size={64} />
              </div>
              <p className={`text-base font-bold ${th.tx}`}>
                {lang === "id" ? "Belum ada member yang transaksi" : "No member transactions"}
              </p>
              <p className={`text-sm mt-1 ${th.txm}`}>
                {lang === "id" ? "Periode ini tidak ada pembelian dari member terdaftar." : "No registered member purchases in this period."}
              </p>
            </div>
          ) : (
            <>
              {/* Hero+2-up: Total Belanja dominan, member count + savings di samping */}
              <div className="grid gap-3 lg:grid-cols-3">
                <RevenueHero
                  amount={memberStats.reduce((s, m) => s + m.spend, 0)}
                  th={th}
                  lang={lang}
                  label={lang === "id" ? "Total Belanja Member" : "Total Member Spend"}
                />
                <StatChip
                  label={lang === "id" ? "Total Member" : "Total Members"}
                  value={memberStats.length}
                  th={th}
                />
                <StatChip
                  label={lang === "id" ? "Total Hemat" : "Total Savings"}
                  value={memberStats.reduce((s, m) => s + m.savings, 0)}
                  th={th}
                  isCurrency
                />
              </div>

              <div className="flex items-center gap-3 mt-2 px-1">
                <h2 className={`text-xs font-black uppercase tracking-wider ${th.txf}`}>
                  {lang === "id" ? "Peringkat Member" : "Member Ranking"}
                </h2>
                <div className={`flex-1 divider-dotted ${th.txm}`} />
              </div>

              {/* Per-member list, expandable */}
              <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card2}`}>
                {memberStats.map((m, idx) => {
                  const expanded = expandedMember === m.id;
                  const panelId = `member-panel-${m.id}`;
                  return (
                    <div key={m.id} className={`${idx > 0 ? `border-t ${th.bdrSoft}` : ""}`}>
                      <button onClick={() => setExpandedMember(expanded ? null : m.id)}
                        aria-expanded={expanded} aria-controls={panelId}
                        className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left">
                        <span aria-hidden className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                          idx === 0 ? "text-white bg-gradient-to-br from-[#FFB5C0] to-[#E11D48] shadow-sm"
                          : idx < 3 ? `${th.accBg} ${th.acc}`
                          : `${th.elev} ${th.txm}`
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`font-bold text-sm truncate ${th.tx}`}>{m.name}</p>
                          <p className={`text-xs ${th.txm}`}>
                            {m.phone} · {m.orders} {lang === "id" ? "transaksi" : "orders"}
                            {m.savings > 0 && <> · <span className={th.acc}>{lang === "id" ? "hemat" : "saved"} {$(m.savings)}</span></>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-display font-bold text-sm ${th.acc}`}>{$(m.spend)}</p>
                        </div>
                        {expanded ? <ChevronUp size={18} className={th.txm} /> : <ChevronDown size={18} className={th.txm} />}
                      </button>
                      {expanded && (
                        <div id={panelId} className={`px-4 pb-3 pl-14 ${th.elev}`}>
                          <p className={`text-xs font-bold mb-2 mt-1 ${th.txf} uppercase tracking-wider`}>
                            {lang === "id" ? "Barang yang dibeli" : "Items bought"}
                          </p>
                          <div className="flex flex-col gap-1">
                            {m.items.map((it, i) => (
                              <div key={i} className="flex items-baseline gap-2">
                                <span className={`flex-1 text-sm truncate ${th.tx}`}>{it.name}</span>
                                <span className={`font-display text-xs ${th.txm}`}>×{it.qty}</span>
                                <span className={`font-display text-sm font-bold ${th.tx}`}>{$(it.total)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Laba Rugi — owner format: Pendapatan − Modal Barang = Laba Kotor
          − Pengeluaran = Untung Bersih. Bahasa harian, hindari istilah
          akuntansi yang menakutkan (HPP/COGS/Gross Profit/dll). */}
      {tab === "profit-loss" && !customError && (
        <ProfitLossView pl={profitLoss} th={th} lang={lang} />
      )}
    </div>
  );
}

// ProfitLossView — full Laporan Laba Rugi UI. Diisolasi sebagai komponen
// terpisah supaya ReportsPage tetap manageable.
function ProfitLossView({ pl, th, lang }: { pl: ProfitLossRes | null; th: ThemeClasses; lang: "en" | "id" }) {
  const revenueDisplay = useCountUp(pl?.revenue || 0);
  const cogsDisplay = useCountUp(pl?.cogs || 0);
  const grossDisplay = useCountUp(pl?.gross_profit || 0);
  const expenseDisplay = useCountUp(pl?.expense_total || 0);
  const netDisplay = useCountUp(pl?.net_profit || 0);
  const supplierPaidDisplay = useCountUp(pl?.supplier_paid || 0);
  const cashOutDisplay = useCountUp(pl?.cash_out_total || 0);
  const cashDiffDisplay = useCountUp(pl?.cash_diff || 0);

  if (!pl) {
    return (
      <div className={`rounded-3xl border bg-bakery-stripe p-10 text-center ${th.bdr} ${th.card2}`}>
        <div className="mx-auto mb-4 opacity-70" style={{ width: 64 }}>
          <BakeryLogo size={64} />
        </div>
        <p className={`text-base font-bold ${th.tx}`}>
          {lang === "id" ? "Memuat laporan..." : "Loading report..."}
        </p>
      </div>
    );
  }

  const netPositive = pl.net_profit >= 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Untung Bersih hero — warna mengikuti positif/negatif */}
      <div className={`rounded-3xl border p-5 bg-bakery-stripe ${th.bdr} ${th.card2} relative overflow-hidden`}>
        <p className={`text-xs font-black uppercase tracking-wider mb-1.5 ${th.acc}`}>
          {netPositive
            ? (lang === "id" ? "Untung Bersih" : "Net Profit")
            : (lang === "id" ? "Rugi Bersih" : "Net Loss")}
        </p>
        <p className={`font-display text-3xl sm:text-4xl font-black tracking-tight ${
          netPositive ? th.acc : (th.dark ? "text-[#FB7185]" : "text-[#BE123C]")
        }`}>
          Rp {netDisplay.toLocaleString("id-ID")}
        </p>
        <p className={`text-xs mt-1 ${th.txm}`}>
          {pl.total_orders} {lang === "id" ? "transaksi penjualan" : "sales transactions"}
        </p>
      </div>

      {/* Breakdown layar utama: Pendapatan / Modal Barang / Laba Kotor /
          Pengeluaran / Untung Bersih — pakai bahasa harian. */}
      <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card2}`}>
        <div className={`px-4 py-3 border-b ${th.bdrSoft}`}>
          <p className={`text-xs font-black uppercase tracking-wider ${th.txf}`}>
            {lang === "id" ? "Rincian Laba Rugi" : "Profit/Loss Breakdown"}
          </p>
        </div>

        {/* Pendapatan */}
        <div className="px-4 py-3 flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className={`font-bold text-sm ${th.tx}`}>
              {lang === "id" ? "Pendapatan (Omzet)" : "Revenue"}
            </p>
            <p className={`text-xs ${th.txf}`}>
              {lang === "id" ? "Total penjualan periode ini" : "Total sales in period"}
            </p>
          </div>
          <p className={`font-display font-bold text-base ${th.tx}`}>
            Rp {revenueDisplay.toLocaleString("id-ID")}
          </p>
        </div>

        {/* Modal Barang (HPP) */}
        <div className={`px-4 py-3 flex items-baseline justify-between gap-3 border-t ${th.bdrSoft}`}>
          <div className="min-w-0">
            <p className={`font-bold text-sm ${th.tx}`}>
              − {lang === "id" ? "Modal Barang Terjual" : "Cost of Goods Sold"}
            </p>
            <p className={`text-xs ${th.txf}`}>
              {lang === "id" ? "Harga modal barang yang sudah laku" : "Purchase cost of items sold"}
            </p>
          </div>
          <p className={`font-display font-bold text-base ${th.txm}`}>
            Rp {cogsDisplay.toLocaleString("id-ID")}
          </p>
        </div>

        {/* Laba Kotor */}
        <div className={`px-4 py-3 flex items-baseline justify-between gap-3 border-t ${th.bdrSoft} ${th.elev}`}>
          <p className={`font-bold text-sm ${th.tx}`}>
            = {lang === "id" ? "Laba Kotor" : "Gross Profit"}
          </p>
          <p className={`font-display font-bold text-base ${th.acc}`}>
            Rp {grossDisplay.toLocaleString("id-ID")}
          </p>
        </div>

        {/* Pengeluaran total */}
        <div className={`px-4 py-3 flex items-baseline justify-between gap-3 border-t ${th.bdrSoft}`}>
          <div className="min-w-0">
            <p className={`font-bold text-sm ${th.tx}`}>
              − {lang === "id" ? "Pengeluaran Operasional" : "Operating Expenses"}
            </p>
            <p className={`text-xs ${th.txf}`}>
              {pl.expense_breakdown.length > 0
                ? `${pl.expense_breakdown.length} ${lang === "id" ? "kategori" : "categories"}`
                : (lang === "id" ? "Belum ada pengeluaran" : "No expenses yet")}
            </p>
          </div>
          <p className={`font-display font-bold text-base ${th.txm}`}>
            Rp {expenseDisplay.toLocaleString("id-ID")}
          </p>
        </div>

        {/* Rincian per kategori (kalau ada) */}
        {pl.expense_breakdown.map((b) => (
          <div key={b.category_id} className={`px-4 pl-8 py-2 flex items-baseline justify-between gap-3 border-t ${th.bdrSoft}`}>
            <p className={`text-sm ${th.txm}`}>· {b.category_name}</p>
            <p className={`font-display text-sm ${th.txm}`}>Rp {b.total.toLocaleString("id-ID")}</p>
          </div>
        ))}

        {/* Untung Bersih final */}
        <div className={`px-4 py-4 flex items-center justify-between gap-3 border-t-2 ${
          netPositive
            ? (th.dark ? "border-[#FB7185] bg-[#3A1F2A]/40" : "border-[#E11D48] bg-[#FFF4F6]")
            : (th.dark ? "border-[#BE123C] bg-[#3A1F2A]/40" : "border-[#BE123C] bg-[#FCE4EC]/40")
        }`}>
          <div className="flex items-center gap-2">
            {/* Trend icon: accessibility (color-not-only) — untung naik, rugi turun. */}
            {netPositive
              ? <TrendingUp size={18} className={th.acc} aria-hidden />
              : <TrendingDown size={18} className={th.dark ? "text-[#FB7185]" : "text-[#BE123C]"} aria-hidden />}
            <p className={`font-black text-base uppercase tracking-wider ${
              netPositive ? th.acc : (th.dark ? "text-[#FB7185]" : "text-[#BE123C]")
            }`}>
              = {netPositive
                ? (lang === "id" ? "Untung Bersih" : "Net Profit")
                : (lang === "id" ? "Rugi Bersih" : "Net Loss")}
            </p>
          </div>
          <p className={`font-display font-black text-lg ${
            netPositive ? th.acc : (th.dark ? "text-[#FB7185]" : "text-[#BE123C]")
          }`}>
            Rp {netDisplay.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {/* ─── Arus Kas (cash basis view) ─────────────────────────────────────
          Beda dari Laba Rugi di atas (accrual). Ini hitung uang real yang
          keluar masuk di periode — termasuk bayar supplier (faktur lunas),
          bukan cuma modal barang yang sudah laku. Yang sehari-hari owner
          rasakan di kantong/rekening. */}
      <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card2}`}>
        <div className={`px-4 py-3 border-b ${th.bdrSoft}`}>
          <p className={`text-xs font-black uppercase tracking-wider ${th.txf}`}>
            {lang === "id" ? "Arus Kas Periode Ini" : "Cash Flow This Period"}
          </p>
          <p className={`text-xs mt-0.5 ${th.txf}`}>
            {lang === "id"
              ? "Uang real yang masuk-keluar (beda dari Laba Rugi di atas)"
              : "Actual cash in/out (different from P/L above)"}
          </p>
        </div>

        {/* Uang Masuk */}
        <div className="px-4 py-3 flex items-baseline justify-between gap-3">
          <p className={`font-bold text-sm ${th.tx}`}>
            {lang === "id" ? "Uang Masuk (Penjualan)" : "Cash In (Sales)"}
          </p>
          <p className={`font-display font-bold text-base ${th.tx}`}>
            Rp {revenueDisplay.toLocaleString("id-ID")}
          </p>
        </div>

        {/* Uang Keluar group label */}
        <div className={`px-4 py-2 border-t ${th.bdrSoft} ${th.elev}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${th.txm}`}>
            {lang === "id" ? "Uang Keluar" : "Cash Out"}
          </p>
        </div>

        {/* Bayar Supplier (Faktur lunas) */}
        <div className={`px-4 py-3 pl-8 flex items-baseline justify-between gap-3 border-t ${th.bdrSoft}`}>
          <div className="min-w-0">
            <p className={`text-sm ${th.tx}`}>
              · {lang === "id" ? "Bayar Supplier (Faktur lunas)" : "Pay Supplier (Paid invoices)"}
            </p>
            <p className={`text-xs ${th.txf}`}>
              {lang === "id" ? "Pembelian bahan yang sudah dibayar periode ini" : "Material purchases paid this period"}
            </p>
          </div>
          <p className={`font-display font-bold text-sm ${th.txm}`}>
            Rp {supplierPaidDisplay.toLocaleString("id-ID")}
          </p>
        </div>

        {/* Pengeluaran Operasional */}
        <div className={`px-4 py-3 pl-8 flex items-baseline justify-between gap-3 border-t ${th.bdrSoft}`}>
          <p className={`text-sm ${th.tx}`}>
            · {lang === "id" ? "Pengeluaran Operasional" : "Operating Expenses"}
          </p>
          <p className={`font-display font-bold text-sm ${th.txm}`}>
            Rp {expenseDisplay.toLocaleString("id-ID")}
          </p>
        </div>

        {/* Total Uang Keluar */}
        <div className={`px-4 py-3 flex items-baseline justify-between gap-3 border-t ${th.bdrSoft}`}>
          <p className={`font-bold text-sm ${th.tx}`}>
            {lang === "id" ? "Total Uang Keluar" : "Total Cash Out"}
          </p>
          <p className={`font-display font-bold text-base ${th.txm}`}>
            Rp {cashOutDisplay.toLocaleString("id-ID")}
          </p>
        </div>

        {/* Selisih Kas */}
        <div className={`px-4 py-4 flex items-center justify-between gap-3 border-t-2 ${
          (pl.cash_diff || 0) >= 0
            ? (th.dark ? "border-[#FB7185] bg-[#3A1F2A]/40" : "border-[#E11D48] bg-[#FFF4F6]")
            : (th.dark ? "border-[#BE123C] bg-[#3D1F2C]/40" : "border-[#BE123C] bg-[#FCE4EC]/40")
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {/* Trend icon: accessibility (color-not-only). */}
            {(pl.cash_diff || 0) >= 0
              ? <TrendingUp size={18} className={th.acc} aria-hidden />
              : <TrendingDown size={18} className={th.dark ? "text-[#FB7185]" : "text-[#BE123C]"} aria-hidden />}
            <div className="min-w-0">
              <p className={`font-black text-base uppercase tracking-wider ${
                (pl.cash_diff || 0) >= 0 ? th.acc : (th.dark ? "text-[#FB7185]" : "text-[#BE123C]")
              }`}>
                {lang === "id" ? "Selisih Kas" : "Cash Diff"}
              </p>
              <p className={`text-xs ${th.txf}`}>
                {lang === "id" ? "Uang Masuk − Uang Keluar" : "Cash In − Cash Out"}
              </p>
            </div>
          </div>
          <p className={`font-display font-black text-lg ${
            (pl.cash_diff || 0) >= 0 ? th.acc : (th.dark ? "text-[#FB7185]" : "text-[#BE123C]")
          }`}>
            Rp {cashDiffDisplay.toLocaleString("id-ID")}
          </p>
        </div>

        {/* Info faktur belum lunas (kewajiban yang masih jalan) */}
        {pl.supplier_unpaid > 0 && (
          <div className={`px-4 py-3 border-t ${th.bdrSoft} flex items-start gap-2 ${th.elev}`}>
            <Info size={14} className={`mt-0.5 shrink-0 ${th.txm}`} aria-hidden />
            <p className={`text-xs ${th.txm}`}>
              <b className={th.tx}>{lang === "id" ? "Faktur tempo belum lunas:" : "Unpaid invoices (term):"}</b>{" "}
              Rp {pl.supplier_unpaid.toLocaleString("id-ID")}{" "}
              <span className={th.txf}>
                — {lang === "id" ? "akan jadi uang keluar saat dibayar." : "will become cash out when paid."}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Glossary singkat — buka untuk owner yang gak tahu istilah */}
      <details className={`rounded-2xl border p-4 ${th.bdr} ${th.card2}`}>
        <summary className={`text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 ${th.txm}`}>
          <Info size={14} aria-hidden />
          {lang === "id" ? "Apa artinya istilah-istilah ini?" : "What do these terms mean?"}
        </summary>
        <div className={`mt-3 text-sm space-y-2 ${th.txm}`}>
          <p><b className={th.tx}>{lang === "id" ? "Pendapatan" : "Revenue"}:</b> {lang === "id" ? "Total uang masuk dari penjualan." : "Total money from sales."}</p>
          <p><b className={th.tx}>{lang === "id" ? "Modal Barang Terjual" : "Cost of Goods Sold"}:</b> {lang === "id" ? "Harga beli barang dari supplier yang sudah terjual ke pelanggan." : "Supplier cost of items sold to customers."}</p>
          <p><b className={th.tx}>{lang === "id" ? "Laba Kotor" : "Gross Profit"}:</b> {lang === "id" ? "Untung dari jual barang sebelum dikurangi biaya operasional." : "Profit from selling goods before operating expenses."}</p>
          <p><b className={th.tx}>{lang === "id" ? "Pengeluaran Operasional" : "Operating Expenses"}:</b> {lang === "id" ? "Biaya menjalankan toko: gaji, listrik, plastik, dll." : "Cost of running the store: salary, electricity, packaging, etc."}</p>
          <p><b className={th.tx}>{lang === "id" ? "Untung Bersih" : "Net Profit"}:</b> {lang === "id" ? "Hasil akhir = Pendapatan − Modal − Pengeluaran. Ini yang masuk kantong Anda." : "Bottom line = Revenue − COGS − Expenses."}</p>
          <p><b className={th.tx}>{lang === "id" ? "Arus Kas / Selisih Kas" : "Cash Flow / Cash Diff"}:</b> {lang === "id" ? "Uang real yang masuk-keluar di periode (termasuk bayar supplier). Beda dengan Untung Bersih: barang yang dibeli tapi belum laku tetap ngurangi kas, tapi tidak ngurangi untung." : "Real cash in/out (includes supplier payments). Different from Net Profit: bought but unsold goods reduce cash but not profit."}</p>
        </div>
      </details>
    </div>
  );
}

// ── Helper components ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThemeClasses = any;

// Hero card untuk angka utama — gradient pink + bakery stripe overlay,
// rounded-3xl (lebih besar dari card biasa supaya hierarki jelas), count-up
// animation di angka.
function RevenueHero({ amount, th, lang, label }: { amount: number; th: ThemeClasses; lang: "en" | "id"; label?: string }) {
  const display = useCountUp(amount);
  const heading = label ?? (lang === "id" ? "Total Pendapatan" : "Total Revenue");
  return (
    <div
      className={`lg:col-span-2 rounded-3xl border p-5 bg-bakery-stripe ${th.bdr} ${th.card2} relative overflow-hidden`}
    >
      <p className={`text-xs font-black uppercase tracking-wider mb-1.5 ${th.acc}`}>{heading}</p>
      <p className={`font-display text-3xl sm:text-4xl font-black tracking-tight ${th.acc}`}>
        Rp {display.toLocaleString("id-ID")}
      </p>
    </div>
  );
}

// Stat chip — kecil, untuk pasangan di sebelah hero. rounded-2xl (lebih
// kecil dari hero rounded-3xl) supaya hierarki visual jelas.
function StatChip({ label, value, th, isCurrency = false }: {
  label: string;
  value: number;
  th: ThemeClasses;
  isCurrency?: boolean;
}) {
  const display = useCountUp(value);
  return (
    <div className={`rounded-2xl border p-4 ${th.bdr} ${th.card2}`}>
      <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${th.txf}`}>{label}</p>
      <p className={`font-display text-2xl font-black ${th.tx}`}>
        {isCurrency ? `Rp ${display.toLocaleString("id-ID")}` : display.toLocaleString("id-ID")}
      </p>
    </div>
  );
}
