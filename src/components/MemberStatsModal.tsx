import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $ } from "@/utils";
import { memberApi } from "@/api/support";
import type { MemberStatsRes } from "@/api/support";

interface Props {
  member: { id: string; name: string; phone: string } | null;
  onClose: () => void;
}

type Period = "7d" | "30d" | "3m" | "year" | "lifetime" | "custom";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function startOfYearISO() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

export function MemberStatsModal({ member, onClose }: Props) {
  const th = useThemeClasses();
  const [period, setPeriod] = useState<Period>("30d");
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<MemberStatsRes | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Range derived from period selection
  useEffect(() => {
    if (period === "7d") { setFrom(daysAgoISO(7)); setTo(todayISO()); }
    else if (period === "30d") { setFrom(daysAgoISO(30)); setTo(todayISO()); }
    else if (period === "3m") { setFrom(daysAgoISO(90)); setTo(todayISO()); }
    else if (period === "year") { setFrom(startOfYearISO()); setTo(todayISO()); }
    else if (period === "lifetime") { setFrom(""); setTo(""); }
  }, [period]);

  // Fetch stats whenever member or range changes
  useEffect(() => {
    if (!member) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = period === "lifetime" ? undefined : { from, to };
    memberApi.getStats(member.id, params)
      .then(res => {
        if (cancelled) return;
        if (res.body) setStats(res.body);
      })
      .catch(e => { if (!cancelled) setError(e.message || "Gagal memuat statistik"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [member, from, to, period]);

  const periodLabel = useMemo(() => {
    if (period === "lifetime") return "Sepanjang masa";
    if (period === "custom") return `${from} → ${to}`;
    return ({ "7d": "7 hari", "30d": "30 hari", "3m": "3 bulan", "year": "Tahun ini" } as Record<string, string>)[period];
  }, [period, from, to]);

  const maxBarSpend = useMemo(() => {
    if (!stats?.monthly_breakdown?.length) return 0;
    return Math.max(...stats.monthly_breakdown.map(m => m.spend));
  }, [stats]);

  if (!member) return null;

  return (
    <Modal open={!!member} onClose={onClose} title={`Statistik Member`}>
      {/* Header */}
      <div className={`flex items-center gap-3 mb-3 px-1`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base ${th.accBg} ${th.acc}`}>💎</div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-extrabold ${th.tx} truncate`}>{member.name}</p>
          <p className={`text-[11px] ${th.txm}`}>{member.phone}</p>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {(["7d", "30d", "3m", "year", "lifetime", "custom"] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${period === p ? `${th.accBg} ${th.acc}` : `${th.elev} ${th.txm}`}`}
          >
            {({ "7d": "7 hari", "30d": "30 hari", "3m": "3 bulan", "year": "Tahun ini", "lifetime": "All time", "custom": "Custom" } as Record<string, string>)[p]}
          </button>
        ))}
      </div>

      {/* Custom range pickers */}
      {period === "custom" && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className={`text-[10px] font-bold mb-1 ${th.txm}`}>Dari</p>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-lg border ${th.inp}`} />
          </div>
          <div>
            <p className={`text-[10px] font-bold mb-1 ${th.txm}`}>Sampai</p>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-lg border ${th.inp}`} />
          </div>
        </div>
      )}

      {loading && <p className={`text-xs text-center py-6 ${th.txm}`}>Memuat…</p>}
      {error && <p className={`text-xs text-center py-6 text-red-500`}>{error}</p>}

      {!loading && !error && stats && (
        <>
          {/* Big summary cards */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className={`rounded-2xl p-3 ${th.elev}`}>
              <p className={`text-[10px] uppercase tracking-wider ${th.txf}`}>Total Belanja</p>
              <p className={`text-base font-black ${th.acc}`}>{$(stats.total_spend)}</p>
              <p className={`text-[10px] ${th.txm}`}>{periodLabel}</p>
            </div>
            <div className={`rounded-2xl p-3 ${th.elev}`}>
              <p className={`text-[10px] uppercase tracking-wider ${th.txf}`}>Transaksi</p>
              <p className={`text-base font-black ${th.tx}`}>{stats.order_count}x</p>
              <p className={`text-[10px] ${th.txm}`}>Avg {$(stats.avg_basket)}</p>
            </div>
            <div className={`rounded-2xl p-3 ${th.elev}`}>
              <p className={`text-[10px] uppercase tracking-wider ${th.txf}`}>💎 Total Hemat</p>
              <p className={`text-base font-black ${th.acc}`}>{$(stats.total_savings)}</p>
            </div>
            <div className={`rounded-2xl p-3 ${th.elev}`}>
              <p className={`text-[10px] uppercase tracking-wider ${th.txf}`}>Last Visit</p>
              <p className={`text-sm font-bold ${th.tx}`}>
                {stats.last_visit ? new Date(stats.last_visit).toLocaleDateString("id-ID") : "—"}
              </p>
            </div>
          </div>

          {/* Lifetime summary */}
          <div className={`flex justify-between items-center mb-3 px-1 py-2 rounded-xl ${th.dark ? "bg-[#A0673C]/10" : "bg-[#FFF5EC]"}`}>
            <p className={`text-[11px] ${th.txm}`}>📈 Lifetime</p>
            <p className={`text-xs font-bold ${th.tx}`}>
              {$(stats.lifetime_spend)} · {stats.lifetime_orders}x
            </p>
          </div>

          {/* Monthly bar chart */}
          {stats.monthly_breakdown.length > 0 && (
            <div className={`rounded-2xl p-3 mb-3 border ${th.bdr} ${th.card2}`}>
              <p className={`text-[11px] font-bold mb-2 ${th.txm}`}>Per Bulan</p>
              <div className="space-y-2">
                {stats.monthly_breakdown.map(m => {
                  const pct = maxBarSpend > 0 ? (m.spend / maxBarSpend) * 100 : 0;
                  return (
                    <div key={m.month}>
                      <div className="flex justify-between mb-1 text-[10px]">
                        <span className={th.txm}>{m.month}</span>
                        <span className={`font-bold ${th.tx}`}>{$(m.spend)} · {m.orders}x</span>
                      </div>
                      <div className={`h-2 rounded-full ${th.dark ? "bg-[#352E28]" : "bg-[#F0E4D2]"}`}>
                        <div className={`h-2 rounded-full bg-[#A0673C]`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top products */}
          {stats.top_products.length > 0 && (
            <div className={`rounded-2xl p-3 border ${th.bdr} ${th.card2}`}>
              <p className={`text-[11px] font-bold mb-2 ${th.txm}`}>Top Produk</p>
              <div className="space-y-1.5">
                {stats.top_products.map(p => (
                  <div key={p.product_id} className="flex justify-between items-center">
                    <span className={`text-[12px] font-medium truncate flex-1 ${th.tx}`}>{p.name}</span>
                    <span className={`text-[10px] font-bold ml-2 ${th.txm}`}>{p.quantity}x · {$(p.spend)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.order_count === 0 && (
            <p className={`text-center py-6 text-xs ${th.txm}`}>Belum ada transaksi pada periode ini</p>
          )}
        </>
      )}
    </Modal>
  );
}
