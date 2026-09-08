// FinancePage — halaman baru superadmin-only untuk Arus Kas + Laba Rugi.
// Split dari Laporan 8 Sep 2026 per request Bu Santi:
//   "Untuk laporan Arus Kas + Laba Rugi tolong dibuat selain saya tidak ada
//   yang bisa lihat. Termasuk Pak Komar dan siapapun yang punya akses admin
//   tidak bisa lihat laporan. Aksesnya terbatas karna bersifat rahasia."
//
// RBAC 2 lapis:
//   1. Header icon Wallet hidden untuk role != "superadmin" (App.tsx)
//   2. Page-level check di bawah — kalau nyasar via state hack, render access
//      denied. Defense in depth.

import { useEffect, useMemo, useState } from "react";
import { useAuthStore, useLangStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { getDateRange, type DateRange, type CustomRange } from "@/utils/dateRange";
import { expenseApi, type ProfitLossRes } from "@/api/expenses";
import { BookOpen, Wallet, Lock } from "lucide-react";
import { CashflowTab } from "@/components/CashflowTab";
import { ProfitLossView } from "@/components/ProfitLossView";

type FinanceTab = "cashflow" | "profit-loss";

export function FinancePage() {
  const th = useThemeClasses();
  const { t, lang } = useLangStore();
  const user = useAuthStore(s => s.user);

  // ── Guard: hanya superadmin. Kalau nyasar (mis. state hack), render
  // access denied screen — 2nd defense di atas header visibility check. ──
  const isOwner = user?.role === "superadmin";
  if (!isOwner) {
    return (
      <div className={`rounded-3xl border p-10 text-center ${th.bdr} ${th.card2}`}>
        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${th.card}`}>
          <Lock size={28} className={th.acc} aria-hidden />
        </div>
        <p className={`text-base font-black mb-1 ${th.tx}`}>
          {lang === "id" ? "Halaman ini bersifat rahasia" : "This page is confidential"}
        </p>
        <p className={`text-sm ${th.txm} max-w-md mx-auto`}>
          {lang === "id"
            ? "Laporan Arus Kas dan Laba Rugi hanya dapat dilihat oleh Owner. Hubungi Owner kalau butuh akses."
            : "Cash flow and profit/loss reports are visible to the Owner only. Contact the Owner if you need access."}
        </p>
      </div>
    );
  }

  const [tab, setTab] = useState<FinanceTab>("cashflow");

  // Date range untuk Laba Rugi tab. Cashflow tab pakai month picker sendiri
  // (self-contained di CashflowTab).
  const [range, setRange] = useState<DateRange>("month");
  const [customRange] = useState<CustomRange>({ from: "", to: "" });

  // getDateRange return {start, end} sebagai Date — convert ke YYYY-MM-DD
  // local time (WIB), bukan toISOString (yang UTC dan bisa geser 1 hari).
  const { from, to } = useMemo(() => {
    const r = getDateRange(range, customRange);
    if (!r) return { from: "", to: "" };
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { from: ymd(r.start), to: ymd(r.end) };
  }, [range, customRange]);

  const [profitLoss, setProfitLoss] = useState<ProfitLossRes | null>(null);
  useEffect(() => {
    if (tab !== "profit-loss" || !from || !to) return;
    let cancelled = false;
    expenseApi.profitLoss({ from, to })
      .then(res => { if (!cancelled) setProfitLoss(res.body ?? null); })
      .catch(err => { if (!cancelled) { console.error("profit-loss failed", err); setProfitLoss(null); } });
    return () => { cancelled = true; };
  }, [tab, from, to]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header — confidential badge supaya Bu Santi aware ini page rahasia */}
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#FB7185] to-[#E11D48] text-white shrink-0`}>
          <Wallet size={20} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className={`text-lg font-black ${th.tx}`}>
              {lang === "id" ? "Keuangan" : "Finance"}
            </h1>
            <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
              th.dark ? "bg-[#3A1F2A] text-[#FB7185] border border-[#FB7185]/30" : "bg-[#FFF4F6] text-[#BE123C] border border-[#E11D48]/30"
            }`}>
              <Lock size={9} aria-hidden />
              {lang === "id" ? "Rahasia" : "Confidential"}
            </span>
          </div>
          <p className={`text-xs ${th.txm}`}>
            {lang === "id" ? "Arus kas & laba rugi — hanya Owner" : "Cash flow & P/L — Owner only"}
          </p>
        </div>
      </div>

      {/* Date range picker — hidden untuk Cashflow tab (self-contained) */}
      {tab === "profit-loss" && (
        <div className={`rounded-2xl border p-3 ${th.bdr} ${th.card2}`}>
          <p className={`text-xs font-black uppercase tracking-wider mb-2 ${th.txf}`}>
            {t.period}
          </p>
          <div className="flex flex-wrap gap-2">
            {(["today", "yesterday", "week", "month"] as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 min-h-[44px] rounded-xl text-sm font-bold transition-colors ${
                  range === r
                    ? "text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48]"
                    : `border ${th.bdr} ${th.card} ${th.txm}`
                }`}
              >
                {t[r as keyof typeof t] as string}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div role="tablist" aria-label={lang === "id" ? "Pilih laporan keuangan" : "Finance report category"}
        className="flex gap-2 overflow-x-auto scrollbar-hide">
        {([
          { id: "cashflow" as FinanceTab, label: lang === "id" ? "Arus Kas" : "Cash Flow", icon: <BookOpen size={16} /> },
          { id: "profit-loss" as FinanceTab, label: lang === "id" ? "Laba Rugi" : "Profit/Loss", icon: <Wallet size={16} /> },
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

      {/* Tab content */}
      {tab === "cashflow" && <CashflowTab />}
      {tab === "profit-loss" && <ProfitLossView pl={profitLoss} th={th} lang={lang} />}
    </div>
  );
}
