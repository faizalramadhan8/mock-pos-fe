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
  const users = useAuthStore(s => s.users);
  const orders = useOrderStore(s => s.orders);
  const [cashierRange, setCashierRange] = useState<"today" | "yesterday" | "week" | "month">("today");
  const [profitRange, setProfitRange] = useState<"today" | "yesterday" | "week" | "month" | "custom">("today");
  const [customFrom, setCustomFrom] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [profitPerProdOpen, setProfitPerProdOpen] = useState(false);
  const [profitSort, setProfitSort] = useState<"net" | "gross" | "qty" | "margin">("net");
  const products = useProductStore(s => s.products);

  const completedOrders = useMemo(() => orders.filter(o => o.status === "completed"), [orders]);
  const revenue = useMemo(() => completedOrders.reduce((s, o) => s + o.total, 0), [completedOrders]);
  const lowStock = useMemo(() => products.filter(p => p.stock <= p.minStock), [products]);
  const paymentBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    for (const o of completedOrders) {
      if (!map[o.payment]) map[o.payment] = { count: 0, total: 0 };
      map[o.payment].count++;
      map[o.payment].total += o.total;
    }
    return map;
  }, [completedOrders]);

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

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 11) return t.goodMorning;
    if (h < 15) return t.goodAfternoon;
    if (h < 18) return t.goodEvening;
    return t.goodNight;
  }, [t]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className={`text-[22px] font-black tracking-tight ${th.tx}`}>{greeting}, {user.name.split(" ")[0]}</h1>
        <p className={`text-sm mt-0.5 ${th.txm}`}>{t.todayOverview}</p>
      </div>

      {/* ─── Owner Stats ─── */}
      {isOwner && (
        <div className="grid grid-cols-[1.2fr_1fr] gap-3">
          <div className="row-span-2 rounded-[22px] p-5 text-white bg-gradient-to-br from-[#60A5FA] to-[#1E3A8A]">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{t.revenue}</p>
            <p className="text-[28px] font-black tracking-tight mt-1.5">{$(revenue)}</p>
            <p className={`text-xs mt-2 opacity-50`}>{orders.length} {t.ordersCount?.toString().toLowerCase()}</p>
          </div>
          {[
            { label: t.ordersCount, value: orders.length, color: "#5B8DEF" },
            { label: t.lowAlerts, value: lowStock.length, color: lowStock.length > 3 ? "#D4627A" : "#4A8B3F" },
          ].map((s, i) => (
            <div key={i} className={`rounded-[18px] border p-4 ${th.card} ${th.bdr}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${th.txm}`}>{s.label}</p>
              <p className={`text-[22px] font-black mt-1 ${th.tx}`}>{s.value}</p>
              <div className="w-7 h-[3px] rounded-full mt-1.5 opacity-50" style={{ background: s.color }} />
            </div>
          ))}
        </div>
      )}

      {/* ─── Laporan Keuntungan (Owner/Admin) ─── */}
      {isOwner && (() => {
        const now = new Date();
        let from: Date;
        let to: Date;
        if (profitRange === "custom") {
          from = new Date(customFrom + "T00:00:00");
          to = new Date(customTo + "T23:59:59");
        } else {
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          if (profitRange === "yesterday") {
            from.setDate(from.getDate() - 1);
            to.setDate(to.getDate() - 1);
          } else if (profitRange === "week") {
            from.setDate(from.getDate() - from.getDay());
          } else if (profitRange === "month") {
            from.setDate(1);
          }
        }
        const ranged = completedOrders.filter(o => {
          const t = new Date(o.createdAt);
          return t >= from && t < to;
        });
        let gross = 0;
        let cogs = 0;
        let itemsCount = 0;
        // Per-product aggregation for profit-per-product breakdown
        const perProd = new Map<string, { name: string; qty: number; gross: number; cogs: number }>();
        for (const o of ranged) {
          gross += o.total;
          for (const it of o.items || []) {
            const lineRevenue = it.unitPrice * it.quantity - (it.discountAmount || 0);
            let lineCogs = 0;
            const pp = it.purchasePrice;
            if (typeof pp === "number" && pp >= 0) {
              lineCogs = pp * it.quantity;
            } else {
              // Fallback: lookup current product purchase_price (historical orders
              // before snapshot column added). Approximation only.
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
        const perProdRows = Array.from(perProd.values())
          .map(p => ({ ...p, net: p.gross - p.cogs, margin: p.gross > 0 ? ((p.gross - p.cogs) / p.gross) * 100 : 0 }))
          .sort((a, b) => {
            if (profitSort === "gross") return b.gross - a.gross;
            if (profitSort === "qty") return b.qty - a.qty;
            if (profitSort === "margin") return b.margin - a.margin;
            return b.net - a.net;
          });
        const net = gross - cogs;
        const margin = gross > 0 ? (net / gross) * 100 : 0;
        const rangeLabels: Record<typeof profitRange, string> = {
          today: "Hari Ini", yesterday: "Kemarin", week: "Minggu Ini", month: "Bulan Ini", custom: "Custom",
        };
        return (
          <div className={`rounded-[22px] border p-4 ${th.card} ${th.bdr}`}>
            <div className="flex items-center justify-between mb-3">
              <p className={`text-xs font-bold uppercase tracking-wider ${th.txm}`}>
                Laporan Keuntungan
              </p>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {(["today", "yesterday", "week", "month", "custom"] as const).map(r => (
                <button key={r} onClick={() => setProfitRange(r)}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                    profitRange === r
                      ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]"
                      : `border ${th.bdr} ${th.txm}`
                  }`}>{rangeLabels[r]}</button>
              ))}
            </div>
            {profitRange === "custom" && (
              <div className="grid grid-cols-2 gap-2 mb-3">
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
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className={`rounded-xl p-3 ${th.dark ? "bg-[#60A5FA]/10" : "bg-blue-50"}`}>
                <p className={`text-xs font-semibold ${th.acc}`}>GROSS (Omzet)</p>
                <p className={`text-base font-black mt-0.5 ${th.acc}`}>{$(gross)}</p>
                <p className={`text-xs mt-0.5 ${th.txm}`}>{ranged.length} transaksi · {itemsCount} item</p>
              </div>
              <div className={`rounded-xl p-3 ${th.dark ? "bg-[#4A8B3F]/10" : "bg-green-50"}`}>
                <p className="text-xs font-semibold text-[#4A8B3F]">NET (Keuntungan)</p>
                <p className="text-base font-black mt-0.5 text-[#4A8B3F]">{$(net)}</p>
                <p className={`text-xs mt-0.5 ${th.txm}`}>Margin {margin.toFixed(1)}%</p>
              </div>
            </div>
            <div className={`rounded-xl p-3 ${th.dark ? "bg-[#E89B48]/10" : "bg-orange-50"}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#E89B48]">HPP (Harga Pokok)</p>
                <p className="text-sm font-black text-[#E89B48]">{$(cogs)}</p>
              </div>
              <p className={`text-xs mt-1 ${th.txm}`}>
                NET = GROSS − HPP. Keuntungan = harga jual dikurangi harga beli per item.
              </p>
            </div>

            {perProdRows.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setProfitPerProdOpen(v => !v)}
                  className={`w-full text-xs font-bold py-2 rounded-lg border ${th.bdr} ${th.txm}`}
                >
                  {profitPerProdOpen ? "Tutup Rincian per Produk" : `Lihat Keuntungan per Produk (${perProdRows.length})`}
                </button>
                {profitPerProdOpen && (
                  <>
                    <div className="flex items-center gap-1 mt-2 mb-2">
                      <span className={`text-xs ${th.txm}`}>Urut:</span>
                      {(["net", "gross", "qty", "margin"] as const).map(s => {
                        const label = s === "net" ? "Untung" : s === "gross" ? "Omzet" : s === "qty" ? "Qty" : "Margin%";
                        return (
                          <button key={s} onClick={() => setProfitSort(s)}
                            className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                              profitSort === s
                                ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]"
                                : `border ${th.bdr} ${th.txm}`
                            }`}>{label}</button>
                        );
                      })}
                    </div>
                    <div className={`border rounded-xl overflow-hidden max-h-80 overflow-y-auto ${th.bdr}`}>
                      {perProdRows.map((p, idx) => (
                        <div key={idx} className={`px-3 py-2.5 border-b last:border-0 ${th.bdrSoft}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={`text-sm font-bold truncate ${th.tx}`}>{p.name}</p>
                            <p className="text-sm font-black text-[#4A8B3F] shrink-0">{$(p.net)}</p>
                          </div>
                          <div className={`flex items-center gap-3 text-xs ${th.txm}`}>
                            <span>Qty: <b className={th.tx}>{p.qty}</b></span>
                            <span>Omzet: <b className={th.acc}>{$(p.gross)}</b></span>
                            <span>HPP: <b className="text-[#E89B48]">{$(p.cogs)}</b></span>
                            <span>Margin: <b className={p.margin >= 20 ? "text-[#4A8B3F]" : p.margin >= 10 ? "text-[#E89B48]" : "text-[#D4627A]"}>{p.margin.toFixed(1)}%</b></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── Pendapatan per Kasir (Owner/Admin only) ─── */}
      {isOwner && (() => {
        const now = new Date();
        const startOf = (mode: typeof cashierRange) => {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (mode === "yesterday") d.setDate(d.getDate() - 1);
          if (mode === "week") d.setDate(d.getDate() - d.getDay());
          if (mode === "month") d.setDate(1);
          return d;
        };
        const endOf = (mode: typeof cashierRange) => {
          if (mode === "yesterday") {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return d;
          }
          return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        };
        const from = startOf(cashierRange);
        const to = endOf(cashierRange);
        const ranged = completedOrders.filter(o => {
          const t = new Date(o.createdAt);
          return t >= from && t < to;
        });
        const byUser = new Map<string, { name: string; count: number; total: number; cash: number; qris: number; transfer: number }>();
        ranged.forEach(o => {
          const u = users.find(u => u.id === o.createdBy);
          const uname = u?.name || "(User)";
          const prev = byUser.get(o.createdBy) || { name: uname, count: 0, total: 0, cash: 0, qris: 0, transfer: 0 };
          prev.count += 1;
          prev.total += o.total;
          if (o.payment === "cash") prev.cash += o.total;
          else if (o.payment === "qris") prev.qris += o.total;
          else prev.transfer += o.total;
          byUser.set(o.createdBy, prev);
        });
        const rows = Array.from(byUser.values()).sort((a, b) => b.total - a.total);
        const grandTotal = rows.reduce((s, r) => s + r.total, 0);
        const rangeLabel: Record<typeof cashierRange, string> = {
          today: "Hari Ini", yesterday: "Kemarin", week: "Minggu Ini", month: "Bulan Ini",
        };
        return (
          <div className={`rounded-[22px] border p-4 ${th.card} ${th.bdr}`}>
            <div className="flex items-center justify-between mb-3">
              <p className={`text-xs font-bold uppercase tracking-wider ${th.txm}`}>
                Pendapatan per Kasir
              </p>
              <div className="flex gap-1">
                {(["today", "yesterday", "week", "month"] as const).map(r => (
                  <button key={r} onClick={() => setCashierRange(r)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      cashierRange === r
                        ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]"
                        : `border ${th.bdr} ${th.txm}`
                    }`}>{rangeLabel[r]}</button>
                ))}
              </div>
            </div>
            {rows.length === 0 ? (
              <p className={`text-sm text-center py-6 ${th.txf}`}>Belum ada transaksi</p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {rows.map(r => (
                    <div key={r.name} className={`rounded-xl border p-3 ${th.bdr} ${th.card2}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className={`text-sm font-extrabold ${th.tx}`}>{r.name}</p>
                        <p className={`text-sm font-black ${th.acc}`}>{$(r.total)}</p>
                      </div>
                      <p className={`text-xs ${th.txm} mb-1.5`}>{r.count} transaksi</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="text-center py-1 rounded-lg bg-green-50 dark:bg-[#4A8B3F]/10">
                          <p className="text-xs font-bold text-[#4A8B3F]">Tunai</p>
                          <p className="text-xs font-black text-[#4A8B3F]">{$(r.cash)}</p>
                        </div>
                        <div className="text-center py-1 rounded-lg bg-blue-50 dark:bg-[#60A5FA]/10">
                          <p className={`text-xs font-bold ${th.acc}`}>QRIS</p>
                          <p className={`text-xs font-black ${th.acc}`}>{$(r.qris)}</p>
                        </div>
                        <div className="text-center py-1 rounded-lg bg-orange-50 dark:bg-[#E89B48]/10">
                          <p className="text-xs font-bold text-[#E89B48]">Transfer</p>
                          <p className="text-xs font-black text-[#E89B48]">{$(r.transfer)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`mt-3 pt-3 border-t flex items-center justify-between ${th.bdr}`}>
                  <p className={`text-sm font-extrabold ${th.tx}`}>Total Toko</p>
                  <p className={`text-base font-black ${th.acc}`}>{$(grandTotal)}</p>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ─── Payment Breakdown ─── */}
      {(isOwner || isCashier) && completedOrders.length > 0 && (
        <div className={`rounded-[22px] border p-4 ${th.card} ${th.bdr}`}>
          <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${th.txm}`}>
            {lang === "id" ? "Pembayaran" : "Payment Breakdown"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "cash", label: lang === "id" ? "Tunai" : "Cash", icon: "💵", color: "#4A8B3F" },
              { key: "transfer", label: "Transfer", icon: "🏦", color: "#5B8DEF" },
              { key: "qris", label: "QRIS", icon: "📱", color: "#8B6FC0" },
            ].map(m => {
              const data = paymentBreakdown[m.key];
              return (
                <div key={m.key} className={`rounded-xl p-3 ${th.elev}`}>
                  <p className={`text-xs ${th.txm}`}>{m.icon} {m.label}</p>
                  <p className="text-sm font-black mt-1" style={{ color: m.color }}>
                    {data ? $(data.total) : "Rp 0"}
                  </p>
                  <p className={`text-xs mt-0.5 ${th.txf}`}>
                    {data ? `${data.count}x` : "0x"}
                    {data && revenue > 0 ? ` · ${Math.round(data.total / revenue * 100)}%` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Cashier Stats ─── */}
      {isCashier && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[22px] p-5 text-white bg-gradient-to-br from-[#60A5FA] to-[#1E3A8A]">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{t.revenue}</p>
            <p className="text-[28px] font-black tracking-tight mt-1.5">{$(revenue)}</p>
          </div>
          <div className={`rounded-[18px] border p-4 flex flex-col justify-center ${th.card} ${th.bdr}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider ${th.txm}`}>{t.ordersCount}</p>
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
              <p className={`text-xs font-semibold uppercase tracking-wider ${th.txm}`}>{s.label}</p>
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
              className={`flex items-center justify-between px-5 py-3 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdrSoft}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${o.status === "completed" ? "bg-[#4A8B3F]" : "bg-[#60A5FA]"}`} />
                <div>
                  <p className={`text-sm font-bold ${th.tx}`}>{o.id}</p>
                  <p className={`text-xs ${th.txm}`}>{o.customer} · {formatTime(o.createdAt)}</p>
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
              className={`flex items-center justify-between px-5 py-2.5 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdrSoft}`}>
              <div className="flex items-center gap-2.5">
                <ProductImage product={p} size={28} />
                <p className={`text-sm font-semibold ${th.tx}`}>{lang === "id" ? p.nameId : p.name}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                p.stock === 0
                  ? (th.dark ? "bg-[#D4627A]/15 text-[#D4627A]" : "bg-red-50 text-[#D4627A]")
                  : (th.dark ? "bg-[#60A5FA]/15 text-[#60A5FA]" : "bg-[#EFF6FF] text-[#1E40AF]")
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
                className={`flex items-center justify-between px-5 py-2.5 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdrSoft}`}>
                <div className="flex items-center gap-2.5">
                  {product && <ProductImage product={product} size={28} />}
                  <div>
                    <p className={`text-sm font-semibold ${th.tx}`}>{product ? (lang === "id" ? product.nameId : product.name) : batch.productId}</p>
                    <p className={`text-xs ${th.txf}`}>{batch.quantity} {product?.unit || "pcs"}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  isExpired
                    ? (th.dark ? "bg-[#D4627A]/15 text-[#D4627A]" : "bg-red-50 text-[#D4627A]")
                    : isUrgent
                    ? (th.dark ? "bg-[#60A5FA]/15 text-[#60A5FA]" : "bg-[#EFF6FF] text-[#1E40AF]")
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
