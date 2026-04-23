import { useState, useMemo } from "react";
import { useAuthStore, useLangStore, useOrderStore, useProductStore, useBatchStore } from "@/stores";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { OrderDetailModal } from "@/components/OrderDetailModal";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatTime } from "@/utils";
import { AlertCircle, Clock, Package, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";

type Range = "today" | "yesterday" | "week" | "month" | "custom";

// Compute [from, to) window for a named range. All times are local; end of
// window is exclusive so "today" == [00:00 hari ini, 00:00 besok).
function getRangeWindow(mode: Range, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (mode === "custom") {
    return {
      from: new Date(customFrom + "T00:00:00"),
      to: new Date(customTo + "T23:59:59.999"),
    };
  }
  if (mode === "yesterday") {
    const y = new Date(startOfToday);
    y.setDate(y.getDate() - 1);
    return { from: y, to: startOfToday };
  }
  if (mode === "week") {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - d.getDay());
    return { from: d, to: new Date(startOfToday.getTime() + 86400000) };
  }
  if (mode === "month") {
    const d = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
    return { from: d, to: new Date(startOfToday.getTime() + 86400000) };
  }
  return { from: startOfToday, to: new Date(startOfToday.getTime() + 86400000) };
}

// Previous-period window, used to compute comparative delta (↑ 12% vs kemarin).
function getPreviousWindow(mode: Range, customFrom: string, customTo: string): { from: Date; to: Date } {
  const cur = getRangeWindow(mode, customFrom, customTo);
  const lenMs = cur.to.getTime() - cur.from.getTime();
  return { from: new Date(cur.from.getTime() - lenMs), to: cur.from };
}

export function DashboardPage() {
  const th = useThemeClasses();
  const { t, lang } = useLangStore();
  const user = useAuthStore(s => s.user)!;
  const users = useAuthStore(s => s.users);
  const orders = useOrderStore(s => s.orders);
  const products = useProductStore(s => s.products);
  const getExpiringBatches = useBatchStore(s => s.getExpiringBatches);
  const batches = useBatchStore(s => s.batches);

  const [range, setRange] = useState<Range>("today");
  const [customFrom, setCustomFrom] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [cashierExpandedId, setCashierExpandedId] = useState<string | null>(null);
  const [profitPerProdOpen, setProfitPerProdOpen] = useState(false);
  const [profitSort, setProfitSort] = useState<"net" | "gross" | "qty" | "margin">("net");
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  const isOwner = user.role === "superadmin" || user.role === "admin";
  const isCashier = user.role === "cashier";
  const isStaff = user.role === "staff";

  const completedOrders = useMemo(() => orders.filter(o => o.status === "completed"), [orders]);
  const pendingOrders = useMemo(() => orders.filter(o => o.status === "pending"), [orders]);
  const outOfStock = useMemo(() => products.filter(p => p.isActive && p.stock === 0), [products]);
  const lowStock = useMemo(() => products.filter(p => p.isActive && p.stock > 0 && p.stock <= p.minStock), [products]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const expiringBatches = useMemo(() => getExpiringBatches(30), [batches, getExpiringBatches]);

  // Orders that fall within the currently-selected range
  const { from, to } = getRangeWindow(range, customFrom, customTo);
  const prev = getPreviousWindow(range, customFrom, customTo);
  const rangedOrders = useMemo(() =>
    completedOrders.filter(o => {
      const t = new Date(o.createdAt);
      return t >= from && t < to;
    }),
    [completedOrders, from, to]
  );
  const prevRangedOrders = useMemo(() =>
    completedOrders.filter(o => {
      const t = new Date(o.createdAt);
      return t >= prev.from && t < prev.to;
    }),
    [completedOrders, prev.from, prev.to]
  );

  const rangeRevenue = useMemo(() => rangedOrders.reduce((s, o) => s + o.total, 0), [rangedOrders]);
  const prevRevenue = useMemo(() => prevRangedOrders.reduce((s, o) => s + o.total, 0), [prevRangedOrders]);
  const revenueDeltaPct = prevRevenue > 0 ? ((rangeRevenue - prevRevenue) / prevRevenue) * 100 : (rangeRevenue > 0 ? 100 : 0);

  const rangeLabel: Record<Range, string> = {
    today: "Hari Ini", yesterday: "Kemarin", week: "Minggu Ini", month: "Bulan Ini", custom: "Custom",
  };
  const prevLabel: Record<Range, string> = {
    today: "kemarin", yesterday: "2 hari lalu", week: "minggu lalu", month: "bulan lalu", custom: "periode sebelumnya",
  };

  // Compact greeting
  const greetingLine = useMemo(() => {
    const h = new Date().getHours();
    const salut = h < 11 ? t.goodMorning : h < 15 ? t.goodAfternoon : h < 18 ? t.goodEvening : t.goodNight;
    const date = new Date().toLocaleDateString(lang === "id" ? "id-ID" : "en-US", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    return `${salut}, ${user.name.split(" ")[0]} · ${date}`;
  }, [t, lang, user.name]);

  // Laporan Keuangan computation follows the unified range
  const finReport = useMemo(() => {
    let gross = 0, cogs = 0, itemsCount = 0;
    const perProd = new Map<string, { name: string; qty: number; gross: number; cogs: number }>();
    for (const o of rangedOrders) {
      gross += o.total;
      for (const it of o.items || []) {
        const lineRevenue = it.unitPrice * it.quantity - (it.discountAmount || 0);
        let lineCogs = 0;
        const pp = it.purchasePrice;
        if (typeof pp === "number" && pp >= 0) {
          lineCogs = pp * it.quantity;
        } else {
          const prod = products.find(p => p.id === it.productId);
          if (prod) lineCogs = prod.purchasePrice * it.quantity;
        }
        cogs += lineCogs;
        itemsCount += it.quantity;
        const key = it.productId || it.name;
        const prev = perProd.get(key) || { name: it.name, qty: 0, gross: 0, cogs: 0 };
        prev.qty += it.quantity;
        prev.gross += lineRevenue;
        prev.cogs += lineCogs;
        perProd.set(key, prev);
      }
    }
    const rows = Array.from(perProd.values())
      .map(p => ({ ...p, net: p.gross - p.cogs, margin: p.gross > 0 ? ((p.gross - p.cogs) / p.gross) * 100 : 0 }))
      .sort((a, b) => {
        if (profitSort === "gross") return b.gross - a.gross;
        if (profitSort === "qty") return b.qty - a.qty;
        if (profitSort === "margin") return b.margin - a.margin;
        return b.net - a.net;
      });
    return { gross, cogs, itemsCount, rows, net: gross - cogs, margin: gross > 0 ? ((gross - cogs) / gross) * 100 : 0 };
  }, [rangedOrders, products, profitSort]);

  // Per-kasir breakdown on current range
  const perCashier = useMemo(() => {
    const byUser = new Map<string, { id: string; name: string; count: number; total: number; cash: number; qris: number; transfer: number }>();
    rangedOrders.forEach(o => {
      const u = users.find(u => u.id === o.createdBy);
      const uname = u?.name || "(User)";
      const prev = byUser.get(o.createdBy) || { id: o.createdBy, name: uname, count: 0, total: 0, cash: 0, qris: 0, transfer: 0 };
      prev.count += 1;
      prev.total += o.total;
      if (o.payment === "cash") prev.cash += o.total;
      else if (o.payment === "qris") prev.qris += o.total;
      else prev.transfer += o.total;
      byUser.set(o.createdBy, prev);
    });
    return Array.from(byUser.values()).sort((a, b) => b.total - a.total);
  }, [rangedOrders, users]);

  const totalByMethod = useMemo(() => {
    return perCashier.reduce(
      (acc, r) => ({ cash: acc.cash + r.cash, qris: acc.qris + r.qris, transfer: acc.transfer + r.transfer }),
      { cash: 0, qris: 0, transfer: 0 }
    );
  }, [perCashier]);

  // Perlu Perhatian — conditional alert card
  const hasAlerts = pendingOrders.length > 0 || outOfStock.length > 0 || lowStock.length > 0 || (isOwner && expiringBatches.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Compact greeting */}
      <p className={`text-base ${th.txm}`}>{greetingLine}</p>

      {/* ─── PERLU PERHATIAN ─── conditional hero alert card */}
      {(isOwner || isStaff) && hasAlerts && (
        <div className={`relative rounded-[22px] border-2 border-[#FFB5C0] p-5 overflow-hidden ${th.card}`}>
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30 blur-2xl"
            style={{ background: "radial-gradient(circle, #FFB5C0 0%, transparent 70%)" }}
          />
          <div className="relative flex items-center gap-2 mb-3">
            <AlertCircle size={18} className={th.acc} />
            <p className={`text-sm font-bold uppercase tracking-wider ${th.acc}`}>Perlu Perhatian</p>
          </div>
          <div className="relative flex flex-col gap-2">
            {pendingOrders.length > 0 && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock size={16} className={th.acc} />
                  <p className={`text-sm ${th.tx} truncate`}>
                    <b>{pendingOrders.length}</b> pesanan pending menunggu lunas
                  </p>
                </div>
                <ChevronRight size={16} className={th.txm} />
              </div>
            )}
            {outOfStock.length > 0 && (
              <div className="flex items-start gap-2">
                <Package size={16} className="text-[#BE123C] mt-0.5 shrink-0" />
                <p className={`text-sm ${th.tx}`}>
                  <b className="text-[#BE123C]">{outOfStock.length} produk stok habis</b>
                  <span className={`ml-1 ${th.txm}`}>
                    · {outOfStock.slice(0, 3).map(p => lang === "id" ? p.nameId : p.name).join(", ")}
                    {outOfStock.length > 3 && ` +${outOfStock.length - 3} lagi`}
                  </span>
                </p>
              </div>
            )}
            {lowStock.length > 0 && (
              <div className="flex items-start gap-2">
                <Package size={16} className={`${th.acc} mt-0.5 shrink-0`} />
                <p className={`text-sm ${th.tx}`}>
                  <b className={th.acc}>{lowStock.length} produk stok rendah</b>
                  <span className={`ml-1 ${th.txm}`}>
                    · {lowStock.slice(0, 3).map(p => lang === "id" ? p.nameId : p.name).join(", ")}
                    {lowStock.length > 3 && ` +${lowStock.length - 3} lagi`}
                  </span>
                </p>
              </div>
            )}
            {isOwner && expiringBatches.length > 0 && (
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-[#BE123C] mt-0.5 shrink-0" />
                <p className={`text-sm ${th.tx}`}>
                  <b className="text-[#BE123C]">{expiringBatches.length} batch</b>
                  <span className={`ml-1 ${th.txm}`}>kadaluarsa ≤ 30 hari</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── UNIFIED RANGE PICKER (Owner/Admin only) ─── */}
      {isOwner && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(["today", "yesterday", "week", "month", "custom"] as const).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`text-sm font-bold px-3 py-1.5 rounded-xl ${
                  range === r
                    ? "text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48]"
                    : `border ${th.bdr} ${th.txm}`
                }`}>{rangeLabel[r]}</button>
            ))}
          </div>
          {range === "custom" && (
            <div className="grid grid-cols-2 gap-2 -mt-2">
              <div>
                <p className={`text-xs font-semibold mb-1 ${th.txm}`}>Dari</p>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-xl border ${th.inp}`} />
              </div>
              <div>
                <p className={`text-xs font-semibold mb-1 ${th.txm}`}>Sampai</p>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-xl border ${th.inp}`} />
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── PENDAPATAN HERO (Owner/Admin only) ─── now follows unified range */}
      {isOwner && (
        <div className="relative rounded-[24px] p-6 text-white bg-gradient-to-br from-[#FB7185] to-[#9F1239] overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, #FFD1DB 0%, transparent 70%)" }}
          />
          <p className="relative text-sm font-semibold uppercase tracking-wider opacity-75">Pendapatan · {rangeLabel[range]}</p>
          <p className="relative font-display text-[42px] font-black tracking-tight mt-2 leading-none" style={{ fontVariationSettings: '"wght" 900' }}>
            {$(rangeRevenue)}
          </p>
          <div className="relative flex items-center gap-2 mt-3">
            <p className="text-sm opacity-70">{rangedOrders.length} transaksi</p>
            {prevRevenue > 0 && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                revenueDeltaPct >= 0 ? "bg-white/25" : "bg-[#3D1F2C]/40"
              }`}>
                {revenueDeltaPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {revenueDeltaPct >= 0 ? "+" : ""}{revenueDeltaPct.toFixed(0)}% vs {prevLabel[range]}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── CASHIER STATS (cashier only) ─── */}
      {isCashier && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[24px] p-6 text-white bg-gradient-to-br from-[#FB7185] to-[#9F1239]">
            <p className="text-sm font-semibold uppercase tracking-wider opacity-75">{t.revenue}</p>
            <p className="font-display text-[38px] font-black tracking-tight mt-2 leading-none" style={{ fontVariationSettings: '"wght" 900' }}>
              {$(completedOrders.reduce((s, o) => s + o.total, 0))}
            </p>
          </div>
          <div className={`rounded-[20px] border p-5 flex flex-col justify-center ${th.card} ${th.bdr}`}>
            <p className={`text-sm font-semibold uppercase tracking-wider ${th.txm}`}>{t.ordersCount}</p>
            <p className={`font-display text-[34px] font-black mt-1 leading-none ${th.tx}`} style={{ fontVariationSettings: '"wght" 900' }}>
              {orders.length}
            </p>
          </div>
        </div>
      )}

      {/* ─── STAFF STATS (staff only) ─── */}
      {isStaff && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t.productsCount, value: products.length, alert: false },
            { label: t.lowAlerts, value: lowStock.length + outOfStock.length, alert: lowStock.length + outOfStock.length > 0 },
            { label: t.invExpiry, value: expiringBatches.length, alert: expiringBatches.length > 0 },
          ].map((s, i) => (
            <div key={i} className={`rounded-[20px] border p-4 ${th.card} ${th.bdr}`}>
              <p className={`text-sm font-semibold uppercase tracking-wider ${th.txm}`}>{s.label}</p>
              <p className={`font-display text-[28px] font-black mt-1 leading-none ${s.alert ? "text-[#BE123C] dark:text-[#FB7185]" : th.tx}`} style={{ fontVariationSettings: '"wght" 900' }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ─── LAPORAN KEUANGAN (Owner/Admin) ─── follows unified range */}
      {isOwner && (
        <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
          <p className={`text-sm font-bold uppercase tracking-wider mb-4 ${th.txm}`}>
            Laporan Keuangan · {rangeLabel[range]}
          </p>
          <div className={`rounded-2xl border overflow-hidden ${th.bdr}`}>
            <div className={`flex items-baseline justify-between px-5 py-4 border-b ${th.bdrSoft} ${th.card2}`}>
              <div>
                <p className={`text-sm font-semibold uppercase tracking-wider ${th.txm}`}>Harga Jual</p>
                <p className={`text-sm mt-1 ${th.txf}`}>{rangedOrders.length} transaksi · {finReport.itemsCount} item</p>
              </div>
              <p className={`font-display text-2xl font-black ${th.tx}`} style={{ fontVariationSettings: '"wght" 900' }}>
                {$(finReport.gross)}
              </p>
            </div>
            <div className={`flex items-baseline justify-between px-5 py-4 border-b ${th.bdrSoft} ${th.card2}`}>
              <div>
                <p className={`text-sm font-semibold uppercase tracking-wider ${th.txm}`}>Modal (Harga Beli)</p>
                <p className={`text-sm mt-1 ${th.txf}`}>Total harga beli barang terjual</p>
              </div>
              <p className={`font-display text-2xl font-black ${th.tx}`} style={{ fontVariationSettings: '"wght" 900' }}>
                − {$(finReport.cogs)}
              </p>
            </div>
            <div className="relative flex items-baseline justify-between px-5 py-5 bg-gradient-to-br from-[#FFE4E9] to-[#FFD1DB] dark:from-[#E11D48]/15 dark:to-[#9F1239]/20">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-6 -right-4 w-24 h-24 rounded-full blur-2xl opacity-60"
                style={{ background: "radial-gradient(circle, #FFB5C0 0%, transparent 70%)" }}
              />
              <div className="relative">
                <p className={`text-sm font-semibold uppercase tracking-wider ${th.acc}`}>Gain</p>
                <p className={`text-sm mt-1 ${th.txm}`}>{finReport.margin.toFixed(1)}% dari harga jual</p>
              </div>
              <p className={`relative font-display text-[32px] font-black leading-none ${th.acc}`} style={{ fontVariationSettings: '"wght" 900' }}>
                {$(finReport.net)}
              </p>
            </div>
          </div>
          <p className={`text-sm mt-3 ${th.txf}`}>Gain = Harga Jual − Modal.</p>

          {finReport.rows.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setProfitPerProdOpen(v => !v)}
                className={`w-full text-xs font-bold py-2 rounded-lg border ${th.bdr} ${th.txm}`}
              >
                {profitPerProdOpen ? "Tutup Rincian per Produk" : `Lihat Gain per Produk (${finReport.rows.length})`}
              </button>
              {profitPerProdOpen && (
                <>
                  <div className="flex items-center gap-1 mt-2 mb-2">
                    <span className={`text-xs ${th.txm}`}>Urut:</span>
                    {(["net", "gross", "qty", "margin"] as const).map(s => {
                      const label = s === "net" ? "Gain" : s === "gross" ? "Harga Jual" : s === "qty" ? "Qty" : "Margin%";
                      return (
                        <button key={s} onClick={() => setProfitSort(s)}
                          className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                            profitSort === s
                              ? "text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48]"
                              : `border ${th.bdr} ${th.txm}`
                          }`}>{label}</button>
                      );
                    })}
                  </div>
                  <div className={`border rounded-xl overflow-hidden max-h-80 overflow-y-auto ${th.bdr}`}>
                    {finReport.rows.map((p, idx) => {
                      const lowMargin = p.margin < 10;
                      return (
                        <div key={idx} className={`px-3 py-2.5 border-b last:border-0 ${th.bdrSoft}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={`text-sm font-bold truncate ${th.tx}`}>{p.name}</p>
                            <p className={`font-display text-sm font-black shrink-0 ${th.acc}`} style={{ fontVariationSettings: '"wght" 800' }}>
                              {$(p.net)}
                            </p>
                          </div>
                          <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs ${th.txm}`}>
                            <span>Qty <b className={th.tx}>{p.qty}</b></span>
                            <span>Jual <b className={th.tx}>{$(p.gross)}</b></span>
                            <span>Modal <b className={th.tx}>{$(p.cogs)}</b></span>
                            <span className={lowMargin ? "text-[#BE123C] font-bold" : ""}>
                              Margin {p.margin.toFixed(1)}%{lowMargin && " ⚠"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── RECENT ORDERS (Owner + Cashier) ─── moved up, top 3 */}
      {(isOwner || isCashier) && (
        <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
          <div className={`px-5 py-4 border-b flex items-center justify-between ${th.bdr}`}>
            <p className={`text-base font-extrabold tracking-tight ${th.tx}`}>{t.recentOrders}</p>
            {orders.length > 3 && (
              <span className={`text-xs ${th.txm}`}>{orders.length} total</span>
            )}
          </div>
          {orders.length === 0 ? (
            <div className={`px-5 py-6 text-center text-sm ${th.txf}`}>Belum ada transaksi</div>
          ) : orders.slice(0, 3).map(o => (
            <div key={o.id} onClick={() => setDetailOrderId(o.id)}
              className={`flex items-center justify-between px-5 py-4 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdrSoft}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  o.status === "completed" ? "bg-[#E11D48]"
                  : o.status === "pending" ? "bg-[#FB7185]"
                  : "bg-[#C4504A]"
                }`} />
                <div className="min-w-0">
                  <p className={`text-sm font-bold font-mono truncate max-w-[220px] ${th.tx}`}>#{o.id.slice(-8).toUpperCase()}</p>
                  <p className={`text-sm mt-0.5 ${th.txm}`}>{o.customer || "Umum"} · {formatTime(o.createdAt)}</p>
                </div>
              </div>
              <p className={`font-display text-lg font-black ${th.tx}`} style={{ fontVariationSettings: '"wght" 900' }}>
                {$(o.total)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ─── PENDAPATAN PER KASIR + PAYMENT BREAKDOWN (merged) ─── */}
      {isOwner && (
        <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
          <p className={`text-sm font-bold uppercase tracking-wider mb-4 ${th.txm}`}>
            Pendapatan per Kasir · {rangeLabel[range]}
          </p>
          {perCashier.length === 0 ? (
            <p className={`text-base text-center py-8 ${th.txf}`}>Belum ada transaksi</p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {perCashier.map(r => {
                  const expanded = cashierExpandedId === r.id;
                  return (
                    <div key={r.id} className={`rounded-2xl border ${th.bdr} ${th.card2} overflow-hidden`}>
                      <button
                        onClick={() => setCashierExpandedId(expanded ? null : r.id)}
                        className="w-full flex items-center justify-between p-4"
                      >
                        <div className="text-left">
                          <p className={`text-base font-extrabold ${th.tx}`}>{r.name}</p>
                          <p className={`text-sm ${th.txf}`}>{r.count} transaksi</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={`font-display text-xl font-black ${th.acc}`} style={{ fontVariationSettings: '"wght" 900' }}>
                            {$(r.total)}
                          </p>
                          <ChevronRight
                            size={18}
                            className={`${th.txm} transition-transform ${expanded ? "rotate-90" : ""}`}
                          />
                        </div>
                      </button>
                      {expanded && (
                        <div className={`grid grid-cols-3 divide-x border-t ${th.bdr}`}>
                          {[
                            { k: "Tunai", v: r.cash },
                            { k: "QRIS", v: r.qris },
                            { k: "Transfer", v: r.transfer },
                          ].map((m, i) => (
                            <div key={i} className="px-2 py-3 text-center">
                              <p className={`text-sm font-semibold ${th.txm}`}>{m.k}</p>
                              <p className={`text-sm font-black ${th.tx}`}>{$(m.v)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* TOTAL TOKO footer with payment breakdown */}
              <div className={`mt-4 pt-4 border-t ${th.bdr}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-base font-extrabold ${th.tx}`}>Total Toko</p>
                  <p className={`font-display text-2xl font-black ${th.acc}`} style={{ fontVariationSettings: '"wght" 900' }}>
                    {$(rangeRevenue)}
                  </p>
                </div>
                <div className={`grid grid-cols-3 gap-2`}>
                  {[
                    { k: "Tunai", v: totalByMethod.cash },
                    { k: "QRIS", v: totalByMethod.qris },
                    { k: "Transfer", v: totalByMethod.transfer },
                  ].map((m, i) => {
                    const pct = rangeRevenue > 0 ? (m.v / rangeRevenue) * 100 : 0;
                    return (
                      <div key={i} className={`relative rounded-xl border p-3 overflow-hidden ${th.bdr} ${th.card2}`}>
                        <p className={`text-xs font-semibold ${th.txm}`}>{m.k}</p>
                        <p className={`font-display text-base font-black mt-1 ${th.tx}`} style={{ fontVariationSettings: '"wght" 900' }}>
                          {$(m.v)}
                        </p>
                        <p className={`text-xs mt-0.5 ${th.txf}`}>{pct.toFixed(0)}%</p>
                        <div className="absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-[#FFB5C0] to-[#E11D48]" style={{ width: `${pct}%` }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── LOW STOCK (Staff) ─── */}
      {isStaff && (lowStock.length > 0 || outOfStock.length > 0) && (
        <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
          <div className={`px-5 py-4 border-b ${th.bdr}`}>
            <p className={`text-base font-extrabold tracking-tight ${th.tx}`}>{t.lowAlerts}</p>
          </div>
          {[...outOfStock, ...lowStock].slice(0, 5).map(p => (
            <div key={p.id} onClick={() => setDetailProductId(p.id)}
              className={`flex items-center justify-between px-5 py-3 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdrSoft}`}>
              <p className={`text-sm font-bold truncate ${th.tx}`}>{lang === "id" ? p.nameId : p.name}</p>
              <p className={`font-display text-sm font-black ${p.stock === 0 ? "text-[#BE123C]" : th.acc}`} style={{ fontVariationSettings: '"wght" 800' }}>
                {p.stock} {p.unit}
              </p>
            </div>
          ))}
        </div>
      )}

      <ProductDetailModal productId={detailProductId} onClose={() => setDetailProductId(null)} />
      <OrderDetailModal orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
    </div>
  );
}
