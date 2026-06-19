import { useEffect, useMemo, useState } from "react";
import { useOrderStore, useExpenseStore, usePurchaseInvoiceStore, useRefundStore, useLangStore, useAuthStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $ } from "@/utils";
import { cashbookApi } from "@/api/cashbook";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Pencil, Save, Info } from "lucide-react";
import toast from "react-hot-toast";

// ── Helpers ─────────────────────────────────────────────────────────────
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function monthLabel(year: number, month: number, lang: "en" | "id"): string {
  const idMonths = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const enMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${(lang === "id" ? idMonths : enMonths)[month - 1]} ${year}`;
}
function dayLabel(dateStr: string, lang: "en" | "id"): string {
  const d = new Date(dateStr);
  if (lang === "id") {
    const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}`;
  }
  return d.toLocaleDateString("en", { weekday: "short", day: "2-digit" });
}

interface LedgerRow {
  no: number;
  dateStr: string;        // YYYY-MM-DD
  description: string;
  in?: number;
  out?: number;
  balance: number;
  type: "opening" | "sales" | "expense" | "invoice" | "refund";
  detail?: { name: string; amount: number }[]; // for drill-down (sales/refund)
}

/**
 * Arus Kas (Cash Basis Ledger) — laporan keuangan utama Bu Santi.
 * Hapus konsep Laba Kotor (accrual) — pakai cash basis: Pendapatan − Pengeluaran = Selisih.
 *
 * Source data (aggregated client-side):
 * - Sales: orders.status='completed' (sum total per hari, 1 row aggregated)
 * - Refund: refunds (per refund 1 row)
 * - Expense Operasional: expenses (per entry 1 row)
 * - Bayar Faktur: purchase_invoices where paymentStatus='paid' (per faktur paid 1 row, pakai paidAt timestamp)
 *
 * Opening balance per bulan: cashbookApi (manual input owner). Belum di-set → 0.
 */
export function CashflowTab() {
  const th = useThemeClasses();
  const { lang } = useLangStore();
  const orders = useOrderStore(s => s.orders);
  const expenses = useExpenseStore(s => s.expenses);
  const invoices = usePurchaseInvoiceStore(s => s.invoices);
  const refunds = useRefundStore(s => s.refunds);
  const user = useAuthStore(s => s.user)!;
  const canWrite = user.role === "admin" || user.role === "superadmin";

  // ── Month picker state ───────────────────────────────────────────────
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12

  // ── Opening balance state ────────────────────────────────────────────
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingSetExplicitly, setOpeningSetExplicitly] = useState(false);
  const [editingOpening, setEditingOpening] = useState(false);
  const [openingInput, setOpeningInput] = useState("");
  const [savingOpening, setSavingOpening] = useState(false);

  // Fetch opening balance saat year/month berubah
  useEffect(() => {
    cashbookApi.getOpening(year, month)
      .then(res => {
        if (res.body) {
          setOpeningBalance(res.body.balance);
          setOpeningSetExplicitly(true);
          setOpeningInput(String(res.body.balance));
        } else {
          setOpeningBalance(0);
          setOpeningSetExplicitly(false);
          setOpeningInput("");
        }
      })
      .catch(() => { /* silent — biarkan tampil 0 */ });
  }, [year, month]);

  const saveOpening = async () => {
    const v = parseFloat(openingInput) || 0;
    if (v < 0) { toast.error("Saldo awal tidak boleh negatif"); return; }
    setSavingOpening(true);
    try {
      await cashbookApi.setOpening({ year, month, balance: v });
      setOpeningBalance(v);
      setOpeningSetExplicitly(true);
      setEditingOpening(false);
      toast.success("Saldo awal disimpan");
    } catch (e: any) {
      toast.error(e?.message || "Gagal simpan saldo awal");
    } finally {
      setSavingOpening(false);
    }
  };

  // ── Month bounds ─────────────────────────────────────────────────────
  const monthStart = useMemo(() => new Date(year, month - 1, 1), [year, month]);
  const monthEnd = useMemo(() => new Date(year, month, 0, 23, 59, 59, 999), [year, month]);
  const isCurrentOrPastMonth = monthStart <= today;
  const isCurrentMonth = today >= monthStart && today <= monthEnd;

  // ── Aggregate per-day sums ───────────────────────────────────────────
  //
  // PENTING (per Bu Santi 19 Jun 2026): "Pengeluaran" yang muncul di summary
  // dan masuk hitungan Selisih HANYA "operasional" (expense entries — listrik,
  // plastik, dll). Faktur supplier yang dibayar lunas TIDAK termasuk
  // pengeluaran operasional — itu siklus beli-jual stok, dilaporkan terpisah
  // sebagai info "Bayar Supplier" supaya owner tetap aware cash out untuk
  // stok, tapi tidak masuk hitungan selisih operasional.
  //
  // Implikasi: Saldo Akhir di laporan ini = Saldo Awal + Pendapatan − Operasional.
  // Bukan saldo cash actual di laci (yang juga harus dikurangi bayar supplier).
  // Per request owner: ini "operating cash flow" view, bukan "true cash position".
  const { ledger, totalIn, totalOut, totalInvoicePaid, salesDays } = useMemo(() => {
    // Map: date YYYY-MM-DD → { salesTotal, salesCount, salesOrders[] }
    const salesByDay = new Map<string, { total: number; count: number; orders: typeof orders }>();
    orders.forEach(o => {
      if (o.status !== "completed") return;
      const d = new Date(o.createdAt);
      if (d < monthStart || d > monthEnd) return;
      const key = ymd(d);
      const cur = salesByDay.get(key) || { total: 0, count: 0, orders: [] };
      cur.total += o.total;
      cur.count += 1;
      cur.orders.push(o);
      salesByDay.set(key, cur);
    });

    // Expense entries per date
    const expenseRows = expenses.filter(e => {
      const d = new Date(e.expense_date);
      return d >= monthStart && d <= monthEnd;
    });

    // Invoices paid per date (gunakan paidAt sebagai timing cash basis)
    const invoiceRows = invoices.filter(i => {
      if (!i.paidAt) return false;
      const d = new Date(i.paidAt);
      return d >= monthStart && d <= monthEnd;
    });

    // Refunds per date
    const refundRows = refunds.filter(r => {
      const d = new Date(r.createdAt);
      return d >= monthStart && d <= monthEnd;
    });

    // Bangun ledger: chronological per day
    // Order tiap hari: sales summary → expenses (urut created_at) → invoices (urut paidAt) → refunds (urut createdAt)
    type RawRow = Omit<LedgerRow, "no" | "balance">;
    const rawRows: RawRow[] = [];

    // Collect all dates yang punya event
    const allDates = new Set<string>();
    salesByDay.forEach((_, k) => allDates.add(k));
    expenseRows.forEach(e => allDates.add(e.expense_date));
    invoiceRows.forEach(i => allDates.add(i.paidAt!.slice(0, 10)));
    refundRows.forEach(r => allDates.add(r.createdAt.slice(0, 10)));

    const sortedDates = Array.from(allDates).sort();
    let runningIn = 0;
    let runningOut = 0;
    let runningInvoicePaid = 0;
    let salesDaysCount = 0;

    for (const date of sortedDates) {
      // Sales row (aggregated per hari)
      const sales = salesByDay.get(date);
      if (sales) {
        rawRows.push({
          dateStr: date,
          description: `Penjualan ${sales.count} transaksi`,
          in: sales.total,
          type: "sales",
          detail: sales.orders.map(o => ({
            name: `${o.id.slice(0, 8)} · ${o.customer || "Walk-in"}`,
            amount: o.total,
          })),
        });
        runningIn += sales.total;
        salesDaysCount += 1;
      }

      // Expenses per hari (sort by created_at ASC)
      const eRows = expenseRows
        .filter(e => e.expense_date === date)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      for (const e of eRows) {
        rawRows.push({
          dateStr: date,
          description: e.description || (e.category?.name || "Pengeluaran"),
          out: e.amount,
          type: "expense",
        });
        runningOut += e.amount;
      }

      // Invoice paid per hari — TIDAK masuk runningOut (Bu Santi: faktur
      // bukan pengeluaran operasional). Tetap tampil di ledger sebagai
      // info dengan styling lebih muted supaya jelas "tidak dihitung".
      const iRows = invoiceRows
        .filter(i => i.paidAt!.slice(0, 10) === date)
        .sort((a, b) => (a.paidAt || "").localeCompare(b.paidAt || ""));
      for (const i of iRows) {
        rawRows.push({
          dateStr: date,
          description: `Bayar faktur ${i.invoiceNumber || i.id.slice(0, 8)} · ${i.supplierName || ""}`.trim(),
          out: i.totalAmount,
          type: "invoice",
        });
        runningInvoicePaid += i.totalAmount;
        // tidak runningOut += i.totalAmount;
      }

      // Refunds per hari
      const rRows = refundRows
        .filter(r => r.createdAt.slice(0, 10) === date)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const r of rRows) {
        rawRows.push({
          dateStr: date,
          description: `Refund order ${r.orderId.slice(0, 8)} · ${r.reason || ""}`.trim(),
          out: r.amount,
          type: "refund",
        });
        runningOut += r.amount;
      }
    }

    // Convert ke LedgerRow dengan running balance — invoice rows tidak
    // mengurangi saldo (sesuai keputusan "faktur ≠ pengeluaran operasional").
    let balance = openingBalance;
    const finalRows: LedgerRow[] = [];
    finalRows.push({
      no: 1,
      dateStr: ymd(monthStart),
      description: "Saldo awal bulan",
      balance,
      type: "opening",
    });
    rawRows.forEach((row, idx) => {
      if (row.type !== "invoice") {
        balance += (row.in || 0) - (row.out || 0);
      }
      finalRows.push({ ...row, no: idx + 2, balance });
    });

    return {
      ledger: finalRows,
      totalIn: runningIn,
      totalOut: runningOut,
      totalInvoicePaid: runningInvoicePaid,
      salesDays: salesDaysCount,
    };
  }, [orders, expenses, invoices, refunds, monthStart, monthEnd, openingBalance]);

  const selisih = totalIn - totalOut;
  const saldoAkhir = openingBalance + selisih;

  // Aggregate untuk "nilai stok" + "utang faktur belum lunas" — info tambahan
  const unpaidInvoicesValue = useMemo(
    () => invoices.filter(i => i.paymentStatus === "unpaid").reduce((s, i) => s + i.totalAmount, 0),
    [invoices]
  );
  const unpaidInvoicesCount = useMemo(
    () => invoices.filter(i => i.paymentStatus === "unpaid").length,
    [invoices]
  );

  // Expand row state
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // ── Render ───────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
    setExpandedRow(null);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
    setExpandedRow(null);
  };

  return (
    <div className="space-y-3">
      {/* Period selector */}
      <div className={`rounded-2xl border p-3.5 ${th.bdr} ${th.card2} flex items-center justify-between gap-2`}>
        <button onClick={prevMonth} className={`w-9 h-9 rounded-xl flex items-center justify-center border ${th.bdr} ${th.txm}`} aria-label="Bulan sebelumnya">
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className={`text-xs ${th.txm}`}>Periode</p>
          <p className={`text-base font-extrabold ${th.tx}`}>{monthLabel(year, month, lang)}</p>
        </div>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className={`w-9 h-9 rounded-xl flex items-center justify-center border ${th.bdr} ${th.txm} disabled:opacity-30`}
          aria-label="Bulan berikutnya">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Opening balance edit */}
      <div className={`rounded-2xl border p-4 ${th.bdr} ${th.card2}`}>
        <div className="flex items-center justify-between mb-1.5">
          <p className={`text-xs font-bold uppercase tracking-wider ${th.txm}`}>Saldo Awal Bulan</p>
          {canWrite && !editingOpening && (
            <button onClick={() => { setEditingOpening(true); setOpeningInput(String(openingBalance || "")); }}
              className={`text-xs font-bold inline-flex items-center gap-1 ${th.acc}`}>
              <Pencil size={11} /> {openingSetExplicitly ? "Ubah" : "Isi"}
            </button>
          )}
        </div>
        {editingOpening ? (
          <div className="flex items-center gap-2">
            <span className={`text-sm ${th.txm}`}>Rp</span>
            <input type="number" min="0" value={openingInput}
              onChange={e => setOpeningInput(e.target.value)}
              placeholder="0"
              className={`flex-1 px-3 py-2 text-sm rounded-xl border ${th.inp}`} />
            <button onClick={saveOpening} disabled={savingOpening}
              className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-[#E11D48] inline-flex items-center gap-1 disabled:opacity-50">
              <Save size={11} /> Simpan
            </button>
            <button onClick={() => setEditingOpening(false)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border ${th.bdr} ${th.txm}`}>
              Batal
            </button>
          </div>
        ) : (
          <p className={`font-display text-2xl font-black ${openingSetExplicitly ? th.tx : th.txf}`}>
            {$(openingBalance)}
            {!openingSetExplicitly && <span className={`text-xs font-normal ml-2 ${th.txf}`}>(belum di-isi — anggap nol)</span>}
          </p>
        )}
      </div>

      {/* Ringkasan */}
      <div className={`rounded-2xl border p-4 ${th.bdr} ${th.card2}`}>
        <p className={`text-xs font-bold uppercase tracking-wider ${th.txm} mb-2`}>Ringkasan Periode</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={`text-xs ${th.txm}`}>Pendapatan (Omzet)</p>
            <p className={`text-lg font-black ${th.acc}`}>+{$(totalIn)}</p>
            <p className={`text-xs ${th.txf}`}>{salesDays} hari aktif</p>
          </div>
          <div>
            <p className={`text-xs ${th.txm}`}>Pengeluaran</p>
            <p className="text-lg font-black text-[#BE123C] dark:text-[#FB7185]">−{$(totalOut)}</p>
            <p className={`text-xs ${th.txf}`}>operasional (listrik, plastik, dll)</p>
          </div>
        </div>
        <div className={`mt-3 pt-3 border-t ${th.bdr}`}>
          <p className={`text-xs ${th.txm}`}>Selisih Bulan Ini</p>
          <p className={`font-display text-2xl font-black ${selisih >= 0 ? th.acc : "text-[#BE123C] dark:text-[#FB7185]"}`}>
            {selisih >= 0 ? "+" : ""}{$(selisih)}
          </p>
          <p className={`text-xs mt-2 ${th.txf}`}>
            Saldo akhir (= modal bulan berikutnya): <strong className={th.tx}>{$(saldoAkhir)}</strong>
          </p>
        </div>
      </div>

      {/* Info tambahan: Bayar Supplier — bukan pengeluaran operasional,
          tapi tetap perlu tampil supaya owner aware cash out untuk stok. */}
      {totalInvoicePaid > 0 && (
        <div className={`rounded-2xl border p-3 ${th.card2} ${th.bdr} flex items-start gap-2`}>
          <Info size={14} className={`${th.txm} mt-0.5 shrink-0`} />
          <div className="flex-1">
            <p className={`text-xs font-bold ${th.tx}`}>Bayar Supplier Bulan Ini</p>
            <p className={`text-xs mt-0.5 ${th.txm}`}>
              <strong className={th.tx}>{$(totalInvoicePaid)}</strong> — pembelian stok, tidak masuk hitungan Pengeluaran/Selisih.
            </p>
          </div>
        </div>
      )}

      {/* Utang faktur belum lunas — liability info, tidak masuk hitungan. */}
      {unpaidInvoicesCount > 0 && (
        <div className={`rounded-2xl border border-[#BE123C]/30 p-3 ${th.card2} flex items-start gap-2`}>
          <Info size={14} className="text-[#BE123C] dark:text-[#FB7185] mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className={`text-xs font-bold text-[#BE123C] dark:text-[#FB7185]`}>Utang Faktur Belum Lunas</p>
            <p className={`text-xs mt-0.5 ${th.txm}`}>
              <strong className={th.tx}>{$(unpaidInvoicesValue)}</strong> dari {unpaidInvoicesCount} faktur — belum dibayar.
            </p>
          </div>
        </div>
      )}

      {/* Ledger table */}
      {ledger.length <= 1 && isCurrentOrPastMonth ? (
        <div className={`text-center py-12 rounded-2xl border ${th.bdr} ${th.card2}`}>
          <p className={`text-sm font-bold ${th.tx}`}>Belum ada transaksi bulan ini</p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card}`}>
          <div className={`px-4 py-3 border-b ${th.bdr} flex items-center justify-between`}>
            <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>Detail Arus Kas</p>
            <p className={`text-xs ${th.txm}`}>{ledger.length - 1} kejadian</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className={`${th.elev} ${th.txm}`}>
                <tr>
                  <th className="px-3 py-2 text-left font-bold">No</th>
                  <th className="px-3 py-2 text-left font-bold">Tgl</th>
                  <th className="px-3 py-2 text-left font-bold">Keterangan</th>
                  <th className="px-3 py-2 text-right font-bold">Masuk</th>
                  <th className="px-3 py-2 text-right font-bold">Keluar</th>
                  <th className="px-3 py-2 text-right font-bold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map(row => {
                  const isExpandable = row.detail && row.detail.length > 0;
                  const isExpanded = expandedRow === row.no;
                  return (
                    <>
                      <tr key={row.no}
                        onClick={() => isExpandable && setExpandedRow(isExpanded ? null : row.no)}
                        className={`border-t ${th.bdrSoft} ${isExpandable ? "cursor-pointer hover:opacity-70" : ""} ${row.type === "opening" ? "bg-[#FFE4E9]/40 dark:bg-[#E11D48]/10 font-semibold" : ""} ${row.type === "invoice" ? "opacity-60" : ""}`}>
                        <td className={`px-3 py-2 ${th.txm} font-mono`}>{row.no}</td>
                        <td className={`px-3 py-2 ${th.tx} whitespace-nowrap`}>{dayLabel(row.dateStr, lang)}</td>
                        <td className={`px-3 py-2 ${th.tx}`}>
                          {row.description}
                          {row.type === "invoice" && (
                            <span className={`ml-1.5 text-xs ${th.txf} italic`}>(tidak masuk selisih)</span>
                          )}
                          {isExpandable && (
                            <span className="inline-flex items-center ml-1 align-middle">
                              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </span>
                          )}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${row.in ? th.acc : th.txf}`}>
                          {row.in ? `+${$(row.in)}` : "—"}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${row.out ? (row.type === "invoice" ? `${th.txm} line-through` : "text-[#BE123C] dark:text-[#FB7185]") : th.txf}`}>
                          {row.out ? `−${$(row.out)}` : "—"}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${th.tx}`}>{$(row.balance)}</td>
                      </tr>
                      {isExpanded && row.detail && (
                        <tr key={`${row.no}-detail`} className={th.elev}>
                          <td colSpan={6} className="px-3 py-2">
                            <p className={`text-xs font-bold mb-1.5 ${th.txm}`}>Detail transaksi:</p>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {row.detail.map((d, idx) => (
                                <div key={idx} className={`flex items-center justify-between text-xs ${th.tx}`}>
                                  <span className="font-mono truncate">{d.name}</span>
                                  <span className="font-bold ml-2">{$(d.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
