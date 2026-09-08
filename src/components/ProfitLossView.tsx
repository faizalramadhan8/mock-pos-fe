// ProfitLossView — Laporan Laba Rugi (cash basis).
// Dipindah dari ReportsPage 8 Sep 2026 supaya bisa reuse dari FinancePage
// (halaman baru owner-only untuk Arus Kas + Laba Rugi).
//
// Per request Bu Santi 30 Jun 2026: Prive (penarikan owner kas) yang di-input
// di Arus Kas juga di-include sebagai Pengeluaran di Laba Rugi, supaya
// Untung/Rugi Bersih konsisten dengan Arus Kas. COGS + Laba Kotor tetap ada
// (format accrual standar tidak diubah).

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { capitalApi } from "@/api/capital";
import type { ProfitLossRes } from "@/api/expenses";
import { BakeryLogo } from "@/components/icons";
import { useCountUp } from "@/hooks/useCountUp";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThemeClasses = any;

export function ProfitLossView({ pl, th, lang }: { pl: ProfitLossRes | null; th: ThemeClasses; lang: "en" | "id" }) {
  // Fetch capital injections (modal) + drawings (prive) periode pl.from→pl.to.
  // Injection masuk Arus Kas Periode Ini sebagai PENAMBAH, prive sebagai
  // pengurang. Supaya Selisih Kas klop dengan Saldo Akhir di Arus Kas tab.
  const [totalDrawing, setTotalDrawing] = useState(0);
  const [totalInjection, setTotalInjection] = useState(0);
  useEffect(() => {
    if (!pl?.from || !pl?.to) { setTotalDrawing(0); setTotalInjection(0); return; }
    let cancelled = false;
    capitalApi.list(pl.from, pl.to)
      .then(res => {
        if (cancelled) return;
        const rows = res.body || [];
        setTotalDrawing(rows.filter(r => r.type === "drawing").reduce((s, r) => s + r.amount, 0));
        setTotalInjection(rows.filter(r => r.type === "injection").reduce((s, r) => s + r.amount, 0));
      })
      .catch(() => { if (!cancelled) { setTotalDrawing(0); setTotalInjection(0); } });
    return () => { cancelled = true; };
  }, [pl?.from, pl?.to]);

  // Saldo Laba/Rugi (cash basis, klop dengan Arus Kas):
  //   Pendapatan + Modal − Pengeluaran − Prive
  // Bu Santi 30 Jun 2026: COGS dihapus, Gain dilihat di Dashboard saja.
  const adjustedNet = (pl?.revenue || 0) + totalInjection - (pl?.expense_total || 0) - totalDrawing;

  const revenueDisplay = useCountUp(pl?.revenue || 0);
  const expenseDisplay = useCountUp(pl?.expense_total || 0);
  const driveDisplay = useCountUp(totalDrawing);
  const injectionDisplay = useCountUp(totalInjection);
  const netDisplay = useCountUp(adjustedNet);

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

  const netPositive = adjustedNet >= 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Saldo Laba/Rugi hero — cash basis, klop dengan Arus Kas tab.
          Untuk lihat margin/gain (COGS based), Bu Santi cek di Dashboard
          "Laporan Keuangan". */}
      <div className={`rounded-3xl border p-5 bg-bakery-stripe ${th.bdr} ${th.card2} relative overflow-hidden`}>
        <p className={`text-xs font-black uppercase tracking-wider mb-1.5 ${th.acc}`}>
          {lang === "id" ? "Saldo Laba/Rugi" : "Balance"}
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

      <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card2}`}>
        <div className={`px-4 py-3 border-b ${th.bdrSoft}`}>
          <p className={`text-xs font-black uppercase tracking-wider ${th.txf}`}>
            {lang === "id" ? "Rincian Laba Rugi" : "Profit/Loss Breakdown"}
          </p>
        </div>

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

        {totalInjection > 0 && (
          <div className={`px-4 py-3 flex items-baseline justify-between gap-3 border-t ${th.bdrSoft}`}>
            <div className="min-w-0">
              <p className={`font-bold text-sm ${th.tx}`}>
                + {lang === "id" ? "Tambahan Modal Owner" : "Owner Capital Injection"}
              </p>
              <p className={`text-xs ${th.txf}`}>
                {lang === "id" ? "Otomatis dari input di Arus Kas" : "Auto from Cash Flow input"}
              </p>
            </div>
            <p className={`font-display font-bold text-base ${th.tx}`}>
              Rp {injectionDisplay.toLocaleString("id-ID")}
            </p>
          </div>
        )}

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

        {pl.expense_breakdown.map((b) => (
          <div key={b.category_id} className={`px-4 pl-8 py-2 flex items-baseline justify-between gap-3 border-t ${th.bdrSoft}`}>
            <p className={`text-sm ${th.txm}`}>· {b.category_name}</p>
            <p className={`font-display text-sm ${th.txm}`}>Rp {b.total.toLocaleString("id-ID")}</p>
          </div>
        ))}

        {totalDrawing > 0 && (
          <div className={`px-4 py-3 flex items-baseline justify-between gap-3 border-t ${th.bdrSoft}`}>
            <div className="min-w-0">
              <p className={`font-bold text-sm ${th.tx}`}>
                − {lang === "id" ? "Prive (Penarikan Owner)" : "Owner Drawing"}
              </p>
              <p className={`text-xs ${th.txf}`}>
                {lang === "id" ? "Otomatis dari input di Arus Kas" : "Auto from Cash Flow input"}
              </p>
            </div>
            <p className={`font-display font-bold text-base ${th.txm}`}>
              Rp {driveDisplay.toLocaleString("id-ID")}
            </p>
          </div>
        )}

        <div className={`px-4 py-4 flex items-center justify-between gap-3 border-t-2 ${
          netPositive
            ? (th.dark ? "border-[#FB7185] bg-[#3A1F2A]/40" : "border-[#E11D48] bg-[#FFF4F6]")
            : (th.dark ? "border-[#BE123C] bg-[#3A1F2A]/40" : "border-[#BE123C] bg-[#FCE4EC]/40")
        }`}>
          <div className="flex items-center gap-2">
            {netPositive
              ? <TrendingUp size={18} className={th.acc} aria-hidden />
              : <TrendingDown size={18} className={th.dark ? "text-[#FB7185]" : "text-[#BE123C]"} aria-hidden />}
            <p className={`font-black text-base uppercase tracking-wider ${
              netPositive ? th.acc : (th.dark ? "text-[#FB7185]" : "text-[#BE123C]")
            }`}>
              = {lang === "id" ? "Saldo Laba/Rugi" : "Balance"}
            </p>
          </div>
          <p className={`font-display font-black text-lg ${
            netPositive ? th.acc : (th.dark ? "text-[#FB7185]" : "text-[#BE123C]")
          }`}>
            Rp {netDisplay.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

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
          <p><b className={th.tx}>{lang === "id" ? "Arus Kas / Selisih Kas" : "Cash Flow / Cash Diff"}:</b> {lang === "id" ? "Uang real yang masuk dari penjualan dikurangi semua pengeluaran (gaji, plastik, listrik, bayar supplier, dll). Beda dengan Untung Bersih: barang yang dibeli tapi belum laku tetap ngurangi kas, tapi tidak ngurangi untung." : "Real cash from sales minus all expenses (salary, packaging, utilities, supplier payments, etc.). Different from Net Profit: bought but unsold goods reduce cash but not profit."}</p>
        </div>
      </details>
    </div>
  );
}
