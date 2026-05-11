import { useEffect, useMemo, useState } from "react";
import { useAuthStore, useExpenseStore, useLangStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { usePageFetch } from "@/hooks/usePageFetch";
import { useCountUp } from "@/hooks/useCountUp";
import { formatCurrency as $ } from "@/utils";
import { getDateRange, type DateRange, type CustomRange } from "@/utils/dateRange";
import { Plus, Pencil, Trash2, Wallet, User2 } from "lucide-react";
import { BakeryLogo } from "@/components/icons";
import { ExpenseModal } from "@/components/ExpenseModal";
import type { ExpenseRes } from "@/api/expenses";
import toast from "react-hot-toast";

// YYYY-MM-DD in local time (WIB).
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ExpensesPage() {
  const th = useThemeClasses();
  const { lang } = useLangStore();
  const expenses = useExpenseStore(s => s.expenses);
  const categories = useExpenseStore(s => s.categories);
  const fetchExpenses = useExpenseStore(s => s.fetchExpenses);
  const fetchCategories = useExpenseStore(s => s.fetchCategories);
  const deleteExpense = useExpenseStore(s => s.deleteExpense);
  const user = useAuthStore(s => s.user);
  const canEdit = user?.role === "admin" || user?.role === "superadmin";

  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [customRange, setCustomRange] = useState<CustomRange>({ from: "", to: "" });
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRes | null>(null);
  // Loading state — only true selama first fetch belum complete. Cegah
  // "Belum ada pengeluaran" empty state flash sebelum data datang.
  const [loading, setLoading] = useState(true);

  // Custom range validation
  const customError = dateRange === "custom" && (
    !customRange.from || !customRange.to ? (lang === "id" ? "Pilih tanggal awal dan akhir." : "Pick start and end date.")
      : new Date(customRange.from) > new Date(customRange.to) ? (lang === "id" ? "Tanggal awal tidak boleh setelah tanggal akhir." : "Start date cannot be after end date.")
      : ""
  );

  // Refetch saat filter berubah. Pakai BE filter (bukan FE-side) supaya
  // scalable + konsisten dengan endpoint profit-loss.
  useEffect(() => {
    if (customError) return;
    const range = getDateRange(dateRange, customRange);
    setLoading(true);
    fetchExpenses({
      from: range ? toYMD(range.start) : undefined,
      to: range ? toYMD(range.end) : undefined,
      categoryId: categoryFilter || undefined,
    }).finally(() => setLoading(false));
  }, [dateRange, customRange, categoryFilter, customError, fetchExpenses]);

  usePageFetch([{ key: "expense-categories", fetch: () => fetchCategories() }]);

  const dateRangeLabel = (r: DateRange) => {
    const map: Record<DateRange, [string, string]> = {
      today: ["Hari Ini", "Today"],
      yesterday: ["Kemarin", "Yesterday"],
      week: ["Minggu Ini", "This Week"],
      month: ["Bulan Ini", "This Month"],
      all: ["Semua", "All"],
      custom: ["Pilih Tanggal", "Custom"],
    };
    return lang === "id" ? map[r][0] : map[r][1];
  };

  // Totals dari list yang sudah ke-filter di BE.
  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const totalDisplay = useCountUp(total);

  // Breakdown per kategori — FE-side karena data sudah ada di state.
  const breakdown = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const e of expenses) {
      const name = e.category?.name || "Lain-lain";
      const existing = map.get(name);
      if (existing) {
        existing.total += e.amount;
        existing.count += 1;
      } else {
        map.set(name, { name, total: e.amount, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [expenses]);

  const handleDelete = async (e: ExpenseRes) => {
    if (!window.confirm(lang === "id"
      ? `Hapus pengeluaran "${e.description}" sebesar ${$(e.amount)}?`
      : `Delete expense "${e.description}" of ${$(e.amount)}?`)) return;
    await deleteExpense(e.id);
  };

  const openAdd = () => {
    if (!canEdit) { toast.error(lang === "id" ? "Hanya admin yang bisa catat pengeluaran" : "Admin only"); return; }
    setEditingExpense(null);
    setModalOpen(true);
  };
  const openEdit = (e: ExpenseRes) => {
    if (!canEdit) return;
    setEditingExpense(e);
    setModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className={`text-[22px] font-black tracking-tight ${th.tx}`}>
          {lang === "id" ? "Pengeluaran" : "Expenses"}
        </h1>
        {canEdit && (
          <button onClick={openAdd}
            className={`inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] shadow-sm`}>
            <Plus size={16} /> {lang === "id" ? "Catat Pengeluaran" : "Add Expense"}
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[140px]">
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
        <div className="flex-1 min-w-[160px]">
          <label className={`text-xs font-bold ${th.txm} block mb-1`}>
            {lang === "id" ? "Kategori" : "Category"}
          </label>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className={`w-full px-4 py-3 text-sm font-bold rounded-2xl border appearance-none cursor-pointer ${th.inp}`}>
            <option value="">{lang === "id" ? "Semua Kategori" : "All Categories"}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      {customError && (
        <p role="alert" className={`text-xs font-bold ${th.dark ? "text-[#FB7185]" : "text-[#BE123C]"} -mt-2`}>
          {customError}
        </p>
      )}

      {/* Hero: total pengeluaran */}
      <div className={`rounded-3xl border p-5 bg-bakery-stripe ${th.bdr} ${th.card2} relative overflow-hidden`}>
        <div className="flex items-center gap-2 mb-1.5">
          <Wallet size={16} className={th.acc} />
          <p className={`text-xs font-black uppercase tracking-wider ${th.acc}`}>
            {lang === "id" ? "Total Pengeluaran" : "Total Expenses"}
          </p>
        </div>
        <p className={`font-display text-3xl sm:text-4xl font-black tracking-tight ${th.acc}`}>
          Rp {totalDisplay.toLocaleString("id-ID")}
        </p>
        <p className={`text-xs mt-1 ${th.txm}`}>
          {expenses.length} {lang === "id" ? "transaksi" : "entries"}
        </p>
      </div>

      {/* Breakdown per kategori (kalau ≥2 kategori berbeda) */}
      {breakdown.length > 1 && (
        <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card2}`}>
          <div className={`px-4 py-3 border-b ${th.bdrSoft}`}>
            <p className={`text-xs font-black uppercase tracking-wider ${th.txf}`}>
              {lang === "id" ? "Rincian per Kategori" : "Breakdown by Category"}
            </p>
          </div>
          {breakdown.map((b, idx) => {
            const pct = total > 0 ? Math.round((b.total / total) * 100) : 0;
            return (
              <div key={b.name} className={`px-4 py-3 ${idx > 0 ? `border-t ${th.bdrSoft}` : ""}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`font-bold text-sm ${th.tx}`}>{b.name}</p>
                  <p className={`font-display font-bold text-sm ${th.acc}`}>{$(b.total)}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-[#FCE4EC] dark:bg-[#3A1F2A] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#FFB5C0] to-[#E11D48]"
                      style={{ width: `${Math.max(2, pct)}%` }} />
                  </div>
                  <span className={`text-xs font-bold ${th.txm} tabular-nums w-10 text-right`}>{pct}%</span>
                  <span className={`text-xs ${th.txf}`}>· {b.count}×</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List pengeluaran */}
      {loading && expenses.length === 0 ? (
        // Skeleton — cegah flash empty state saat first fetch. 3 row dummy
        // dengan shimmer-like opacity supaya kelihatan "loading", bukan "kosong".
        <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card2}`}>
          <div className={`px-4 py-3 border-b ${th.bdrSoft}`}>
            <div className={`h-3 w-32 rounded ${th.elev}`} aria-hidden />
          </div>
          {[0, 1, 2].map(i => (
            <div key={i} className={`px-4 py-4 ${i > 0 ? `border-t ${th.bdrSoft}` : ""} animate-pulse`} aria-hidden>
              <div className={`h-3 w-20 rounded mb-2 ${th.elev}`} />
              <div className={`h-4 w-3/5 rounded ${th.elev}`} />
            </div>
          ))}
          <span className="sr-only" role="status">{lang === "id" ? "Memuat pengeluaran..." : "Loading expenses..."}</span>
        </div>
      ) : expenses.length === 0 && !customError ? (
        <div className={`rounded-3xl border bg-bakery-stripe p-10 text-center ${th.bdr} ${th.card2}`}>
          <div className="mx-auto mb-4 opacity-70" style={{ width: 80 }}>
            <BakeryLogo size={80} />
          </div>
          {categoryFilter ? (
            // Empty state khusus saat filter aktif — beda dari "belum ada
            // sama sekali". Tawarkan reset filter sebagai recovery path.
            <>
              <p className={`text-base font-bold ${th.tx}`}>
                {lang === "id" ? "Tidak ada hasil untuk filter ini" : "No results for this filter"}
              </p>
              <p className={`text-sm mt-1 ${th.txm}`}>
                {lang === "id"
                  ? "Coba ubah periode atau hapus filter kategori."
                  : "Try changing the period or clearing the category filter."}
              </p>
              <button onClick={() => setCategoryFilter("")}
                className={`mt-4 min-h-[44px] px-4 rounded-xl text-sm font-bold ${th.accBg} ${th.acc}`}>
                {lang === "id" ? "Hapus filter kategori" : "Clear category filter"}
              </button>
            </>
          ) : (
            <>
              <p className={`text-base font-bold ${th.tx}`}>
                {lang === "id" ? "Belum ada pengeluaran" : "No expenses yet"}
              </p>
              <p className={`text-sm mt-1 ${th.txm}`}>
                {lang === "id"
                  ? "Tap \"Catat Pengeluaran\" untuk mulai mencatat."
                  : "Tap \"Add Expense\" to start tracking."}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card2}`}>
          <div className={`px-4 py-3 border-b ${th.bdrSoft}`}>
            <p className={`text-xs font-black uppercase tracking-wider ${th.txf}`}>
              {lang === "id" ? "Daftar Pengeluaran" : "Expense List"}
            </p>
          </div>
          {expenses.map((e, idx) => (
            <div key={e.id} className={`px-4 py-3 ${idx > 0 ? `border-t ${th.bdrSoft}` : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className={`text-xs font-bold ${th.acc} ${th.accBg} px-2 py-0.5 rounded-md`}>
                      {e.category?.name || "—"}
                    </span>
                    <span className={`text-xs ${th.txf}`}>{e.expense_date}</span>
                  </div>
                  <p className={`font-bold text-sm ${th.tx}`}>{e.description}</p>
                  {e.employee_name && (
                    <p className={`text-xs mt-0.5 inline-flex items-center gap-1 ${th.txm}`}>
                      <User2 size={11} /> {e.employee_name}
                    </p>
                  )}
                  {e.note && <p className={`text-xs mt-0.5 ${th.txf}`}>{e.note}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-display font-bold text-base ${th.acc}`}>{$(e.amount)}</p>
                  {canEdit && (
                    <div className="flex gap-2 justify-end mt-2">
                      <button onClick={() => openEdit(e)}
                        aria-label={lang === "id" ? `Ubah pengeluaran ${e.description}` : `Edit expense ${e.description}`}
                        className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl ${th.elev} ${th.txm}`}>
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(e)}
                        aria-label={lang === "id" ? `Hapus pengeluaran ${e.description}` : `Delete expense ${e.description}`}
                        className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl ${th.dark ? "text-[#FB7185] bg-[#3A1F2A]" : "text-[#BE123C] bg-[#FCE4EC]"}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <ExpenseModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          expense={editingExpense}
        />
      )}
    </div>
  );
}
