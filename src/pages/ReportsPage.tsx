import { useEffect, useMemo, useState } from "react";
import { useLangStore, useOrderStore, useProductStore, useExpenseStore, usePurchaseInvoiceStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { usePageFetch } from "@/hooks/usePageFetch";
import { useCountUp } from "@/hooks/useCountUp";
import { formatCurrency as $, salesTotal } from "@/utils";
import { exportOrders, exportOrderReport } from "@/utils/export";
import { getDateRange, type DateRange, type CustomRange } from "@/utils/dateRange";
import { orderApi, type OrderAggregateResponse } from "@/api/orders";
import { BakeryLogo } from "@/components/icons";
import { Package, Users, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Download, Tag, Info } from "lucide-react";
import toast from "react-hot-toast";

// Sprint 8 Sep 2026 — "cashflow" + "profit-loss" DIPINDAH ke FinancePage
// (halaman terpisah, superadmin-only) per request Bu Santi: laporan keuangan
// bersifat rahasia, admin (Pak Komar) tidak boleh lihat. Laporan operasional
// (Top Produk / Member / Bundling) tetap di sini untuk admin + superadmin.
type ReportTab = "products" | "members" | "bundling";

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
    // Cashflow tab butuh expenses + invoices untuk aggregate ledger.
    // Refunds di-skip — belum ada bulk fetch endpoint (rare di flow Bu Santi).
    { key: "expenses", fetch: () => useExpenseStore.getState().fetchExpenses() },
    { key: "purchase-invoices", fetch: () => usePurchaseInvoiceStore.getState().fetchInvoices() },
  ]);
  const th = useThemeClasses();
  const { lang } = useLangStore();
  const orders = useOrderStore(s => s.orders);
  const products = useProductStore(s => s.products);

  const [tab, setTab] = useState<ReportTab>("products");
  const [sourceFilter, setSourceFilter] = useState<"all" | "pos" | "ecom">("all");
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
    let completed = orders.filter(o => o.status === "completed");
    // Asal transaksi — order ecom ikut masuk laporan sejak 29 Sep 2026.
    // Aman digabung karena ecom yang sudah dibayar ikut berstatus
    // "completed"; yang belum bayar tetap "pending" dan tidak terhitung.
    if (sourceFilter !== "all") {
      completed = completed.filter(o => (o.orderSource ?? "pos") === sourceFilter);
    }
    if (!range) return completed;
    return completed.filter(o => {
      const d = new Date(o.createdAt);
      return d >= range.start && d <= range.end;
    });
  }, [orders, dateRange, customRange, sourceFilter]);

  // Ringkasan per asal — supaya Bu Santi bisa lihat porsi toko vs online
  // tanpa harus ganti filter bolak-balik. Dihitung dari periode yang sama
  // tapi mengabaikan sourceFilter (kalau ikut, angkanya jadi tidak berguna).
  const sourceSplit = useMemo(() => {
    const range = getDateRange(dateRange, customRange);
    const inRange = orders.filter(o => {
      if (o.status !== "completed") return false;
      if (!range) return true;
      const d = new Date(o.createdAt);
      return d >= range.start && d <= range.end;
    });
    const acc = { pos: { count: 0, total: 0 }, ecom: { count: 0, total: 0 } };
    inRange.forEach(o => {
      const bucket = (o.orderSource ?? "pos") === "ecom" ? acc.ecom : acc.pos;
      bucket.count += 1;
      bucket.total += salesTotal(o);
    });
    return acc;
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

  // Profit/Loss fetch DIHAPUS 8 Sep 2026 — pindah ke FinancePage. Excel
  // export dari halaman ini tidak lagi include sheet Laba Rugi supaya admin
  // (Pak Komar) tidak bisa dapat data keuangan lewat export.

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

  // Bundling stats — agregat order_items dengan price_source ∈ tier_*.
  // Group by (productId, tierId) supaya tier yang beda di produk sama
  // tampil terpisah. Tier yang sudah dihapus tetap muncul (tierId NULL ok).
  // Untuk tier yang masih ada, label "Beli N = Rp X" diambil dari product.priceTiers.
  const bundlingStats = useMemo(() => {
    type Row = {
      key: string;
      productId: string;
      productName: string;
      tierId: string | null;
      tierLabel: string;
      orderCount: number;
      orderIds: Set<string>;
      totalQty: number;
      totalPaket: number;
      totalExtra: number;
      revenue: number;
      memberSet: Set<string>;
      walkInCount: number;
      memberPriceCount: number;
    };
    const map = new Map<string, Row>();
    for (const o of filteredOrders) {
      for (const it of o.items) {
        if (it.priceSource !== "tier_all" && it.priceSource !== "tier_member") continue;
        const tierId = it.tierId || null;
        const key = `${it.productId}__${tierId || "deleted"}`;
        const product = products.find(p => p.id === it.productId);
        const tier = product?.priceTiers?.find(t => t.id === tierId);
        const tierLabel = tier
          ? `Beli ${tier.minQty} = ${$(Math.round(tier.price * tier.minQty))}`
          : tierId ? `Tier #${tierId.slice(0, 8)} (sudah dihapus)` : "Tier tidak ter-link";
        const row = map.get(key) || {
          key,
          productId: it.productId,
          productName: it.name,
          tierId,
          tierLabel,
          orderCount: 0,
          orderIds: new Set<string>(),
          totalQty: 0,
          totalPaket: 0,
          totalExtra: 0,
          revenue: 0,
          memberSet: new Set<string>(),
          walkInCount: 0,
          memberPriceCount: 0,
        };
        row.orderIds.add(o.id);
        row.totalQty += it.quantity;
        row.totalPaket += it.paketCount || 0;
        row.totalExtra += it.extraCount || 0;
        row.revenue += it.unitPrice * it.quantity;
        if (it.priceSource === "tier_member") {
          row.memberPriceCount += 1;
          if (o.member?.id) row.memberSet.add(o.member.id);
        } else {
          row.walkInCount += 1;
          if (o.member?.id) row.memberSet.add(o.member.id);
        }
        map.set(key, row);
      }
    }
    return Array.from(map.values())
      .map(r => ({ ...r, orderCount: r.orderIds.size }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, products]);

  const bundlingTotals = useMemo(() => {
    const trxIds = new Set<string>();
    let qty = 0, paket = 0, extra = 0, revenue = 0;
    const memberIds = new Set<string>();
    for (const r of bundlingStats) {
      for (const id of r.orderIds) trxIds.add(id);
      qty += r.totalQty;
      paket += r.totalPaket;
      extra += r.totalExtra;
      revenue += r.revenue;
      for (const m of r.memberSet) memberIds.add(m);
    }
    return { trxCount: trxIds.size, qty, paket, extra, revenue, memberCount: memberIds.size };
  }, [bundlingStats]);

  const [expandedBundle, setExpandedBundle] = useState<string | null>(null);

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
              // profitLoss di-pass null — sheet Laba Rugi sengaja tidak
              // di-include supaya admin tidak bisa dapat data keuangan lewat
              // export. Owner export Laba Rugi dari halaman Keuangan.
              await exportOrderReport(filteredOrders, exportRangeLabel(), null);
              toast.success(lang === "id" ? "Laporan diunduh" : "Report downloaded");
            }}
            title={lang === "id" ? "Excel berisi: Transaksi, Top Produk, Member, Bundling" : "Excel contains: Transactions, Top Products, Members, Bundling"}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold ${th.accBg} ${th.acc} disabled:opacity-40`}>
            <Download size={12} /> Excel
          </button>
        </div>
      </div>

      {/* Date range row — selalu tampil sekarang (Arus Kas yang punya month
          picker sendiri sudah pindah ke FinancePage). */}
      {true && (
        <>
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
        </>
      )}

      {/* Tab switch — role=tablist + touch target ≥44px */}
      {/* Toko vs Online — Bu Santi 17 Sep 2026: "Paling nanti di kasih tanda
          aja ya. Antara e commerce dan offline." Selalu tampil porsinya,
          klik kartu untuk memfilter laporan di bawahnya. */}
      {/* Hanya muncul kalau memang ADA pesanan online di periode ini. Toko
          online belum jalan (yang ada cuma transaksi uji coba, dihapus
          30 Sep 2026) — memisah "Toko vs Online" saat online-nya nol cuma
          menambah kotak berisi Rp 0. Sengaja bukan pakai saklar on/off:
          begitu pesanan online pertama masuk, kartunya muncul sendiri tanpa
          perlu ada yang ingat menyalakannya. */}
      {sourceSplit.ecom.count > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: "all" as const, label: lang === "id" ? "Semua" : "All",
              count: sourceSplit.pos.count + sourceSplit.ecom.count,
              total: sourceSplit.pos.total + sourceSplit.ecom.total },
            { key: "pos" as const, label: lang === "id" ? "Toko" : "Store",
              count: sourceSplit.pos.count, total: sourceSplit.pos.total },
            { key: "ecom" as const, label: "Online",
              count: sourceSplit.ecom.count, total: sourceSplit.ecom.total },
          ]).map(s => {
            const active = sourceFilter === s.key;
            return (
              <button key={s.key} onClick={() => setSourceFilter(s.key)}
                aria-pressed={active}
                className={`rounded-2xl border p-3 text-left transition ${
                  active ? "border-[#E11D48] bg-[#FFF4F6] dark:bg-[#E11D48]/10" : `${th.bdr} ${th.card2}`
                }`}>
                <p className={`text-xs font-bold uppercase tracking-wider ${active ? th.acc : th.txf}`}>
                  {s.label}
                </p>
                <p className={`font-display text-base font-black tabular-nums mt-0.5 ${th.tx}`}>
                  {$(s.total)}
                </p>
                <p className={`text-xs ${th.txm}`}>{s.count} transaksi</p>
              </button>
            );
          })}
        </div>
      )}

      <div role="tablist" aria-label={lang === "id" ? "Pilih laporan" : "Report category"}
        className="flex gap-2 overflow-x-auto scrollbar-hide">
        {([
          { id: "products" as ReportTab, label: lang === "id" ? "Top Produk" : "Top Products", icon: <Package size={16} /> },
          { id: "members" as ReportTab, label: lang === "id" ? "Member" : "Members", icon: <Users size={16} /> },
          { id: "bundling" as ReportTab, label: lang === "id" ? "Bundling" : "Bundling", icon: <Tag size={16} /> },
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
          generic icon. Bundling tab punya empty state sendiri. */}
      {tab !== "bundling" && !hasData && !customError && (
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

      {/* Bundling — agregat per tier × produk: berapa paket laku, berapa
          revenue, siapa customer (member vs walk-in). Sumber: order_items
          dengan price_source ∈ {tier_all, tier_member} di periode. */}
      {tab === "bundling" && !customError && (
        bundlingStats.length === 0 ? (
          <div className={`rounded-3xl border bg-bakery-stripe p-10 text-center ${th.bdr} ${th.card2}`}>
            <div className="mx-auto mb-4 opacity-70" style={{ width: 64 }}>
              <BakeryLogo size={64} />
            </div>
            <p className={`text-base font-bold ${th.tx}`}>
              {lang === "id" ? "Belum ada transaksi bundling" : "No bundling transactions"}
            </p>
            <p className={`text-sm mt-1 ${th.txm}`}>
              {lang === "id"
                ? "Periode ini tidak ada customer beli paket / harga grosir."
                : "No bundle / wholesale purchases in this period."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Hero + summary stats */}
            <div className="grid gap-3 lg:grid-cols-3">
              <RevenueHero
                amount={bundlingTotals.revenue}
                th={th}
                lang={lang}
                label={lang === "id" ? "Pendapatan Bundling" : "Bundling Revenue"}
              />
              <StatChip
                label={lang === "id" ? "Total Paket Terjual" : "Total Bundles Sold"}
                value={bundlingTotals.paket}
                th={th}
              />
              <StatChip
                label={lang === "id" ? "Customer Beli Bundling" : "Bundle Customers"}
                value={bundlingTotals.trxCount}
                th={th}
              />
            </div>

            <div className={`p-3 rounded-2xl border ${th.bdr} ${th.card2} flex items-start gap-2`}>
              <Info size={16} className={`mt-0.5 shrink-0 ${th.acc}`} />
              <p className={`text-sm ${th.txm}`}>
                {lang === "id" ? (
                  <>
                    <strong className={th.tx}>{bundlingTotals.trxCount}</strong> transaksi pakai bundling ·
                    <strong className={th.tx}> {bundlingTotals.qty}</strong> total satuan
                    (<strong>{bundlingTotals.paket}</strong> paket + <strong>{bundlingTotals.extra}</strong> satuan ekstra) ·
                    <strong className={th.tx}> {bundlingTotals.memberCount}</strong> member terlibat.
                  </>
                ) : (
                  <>
                    <strong className={th.tx}>{bundlingTotals.trxCount}</strong> transactions with bundling ·
                    <strong className={th.tx}> {bundlingTotals.qty}</strong> total units
                    (<strong>{bundlingTotals.paket}</strong> bundles + <strong>{bundlingTotals.extra}</strong> extras) ·
                    <strong className={th.tx}> {bundlingTotals.memberCount}</strong> unique members.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 mt-2 px-1">
              <h2 className={`text-xs font-black uppercase tracking-wider ${th.txf}`}>
                {lang === "id" ? "Peringkat Tier" : "Tier Ranking"}
              </h2>
              <div className={`flex-1 divider-dotted ${th.txm}`} />
            </div>

            {/* Per-tier list, expandable */}
            <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card2}`}>
              {bundlingStats.map((r, idx) => {
                const expanded = expandedBundle === r.key;
                const panelId = `bundling-panel-${r.key}`;
                const rowOrders = filteredOrders.filter(o => r.orderIds.has(o.id));
                return (
                  <div key={r.key} className={`${idx > 0 ? `border-t ${th.bdrSoft}` : ""}`}>
                    <button onClick={() => setExpandedBundle(expanded ? null : r.key)}
                      aria-expanded={expanded} aria-controls={panelId}
                      className="w-full flex items-start gap-3 px-4 py-3.5 text-left">
                      <span aria-hidden className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-black ${
                        idx === 0 ? "text-white bg-gradient-to-br from-[#FFB5C0] to-[#E11D48] shadow-sm"
                        : idx < 3 ? `${th.accBg} ${th.acc}`
                        : `${th.elev} ${th.txm}`
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`font-bold text-base truncate ${th.tx}`}>{r.productName}</p>
                        <p className={`text-sm font-semibold mt-0.5 ${th.acc} truncate`}>{r.tierLabel}</p>
                        <p className={`text-sm mt-1 ${th.txm}`}>
                          <strong className={th.tx}>{r.totalPaket}</strong> {lang === "id" ? "paket" : "bundles"}
                          {r.totalExtra > 0 && <> + <strong className={th.tx}>{r.totalExtra}</strong> {lang === "id" ? "satuan extra" : "extra"}</>}
                          {" "}· {r.orderCount} {lang === "id" ? "trx" : "trx"}
                          {r.memberSet.size > 0 && <> · {r.memberSet.size} member</>}
                          {r.walkInCount > 0 && <> · {r.walkInCount} walk-in</>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-display font-black text-base ${th.acc}`}>{$(r.revenue)}</p>
                        {expanded ? <ChevronUp size={18} className={`mt-1 ${th.txm} ml-auto`} /> : <ChevronDown size={18} className={`mt-1 ${th.txm} ml-auto`} />}
                      </div>
                    </button>
                    {expanded && (
                      <div id={panelId} className={`px-4 pb-3 ${th.elev}`}>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${th.txf}`}>
                          {lang === "id" ? "Daftar Transaksi" : "Transactions"}
                        </p>
                        <div className="space-y-1.5">
                          {rowOrders.map(o => {
                            const items = o.items.filter(it => it.productId === r.productId && (it.tierId || null) === r.tierId);
                            const lineRevenue = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
                            const lineQty = items.reduce((s, it) => s + it.quantity, 0);
                            const linePaket = items.reduce((s, it) => s + (it.paketCount || 0), 0);
                            const buyer = o.member?.name || o.customer || (lang === "id" ? "Walk-in" : "Walk-in");
                            return (
                              <div key={o.id} className={`flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-lg ${th.card}`}>
                                <div className="min-w-0 flex-1">
                                  <p className={`font-bold truncate ${th.tx}`}>{buyer}</p>
                                  <p className={`text-xs ${th.txm}`}>
                                    {new Date(o.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    {" · "}{lineQty} satuan ({linePaket} paket)
                                  </p>
                                </div>
                                <span className={`font-bold ${th.acc} shrink-0`}>{$(lineRevenue)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Laba Rugi + Arus Kas dipindah ke FinancePage (superadmin-only)
          8 Sep 2026 — laporan keuangan bersifat rahasia per request Bu Santi. */}
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
