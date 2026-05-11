import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "./Modal";
import { useAuthStore, useExpenseStore, useLangStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import type { ExpenseRes } from "@/api/expenses";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  expense?: ExpenseRes | null;
}

// Kategori yang aktifkan field "Nama Pegawai" — match seed di migration 000027
// + rename 000029 ("Gaji & Lemburan Pegawai"). Match by keyword supaya tahan
// kalau owner edit nama kategori.
const EMPLOYEE_CATEGORY_NAMES = ["gaji", "lemburan", "pegawai", "beban pegawai"];

// Sentinel value untuk opsi "Pegawai lain..." di dropdown — buka text input
// bebas. Pakai prefix __ supaya tidak collide dengan user name yang valid.
const EMPLOYEE_OTHER = "__other__";

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ExpenseModal({ open, onClose, expense }: Props) {
  const th = useThemeClasses();
  const { lang } = useLangStore();
  const categories = useExpenseStore(s => s.categories);
  const createExpense = useExpenseStore(s => s.createExpense);
  const updateExpense = useExpenseStore(s => s.updateExpense);
  const users = useAuthStore(s => s.users);

  const isEdit = !!expense;
  const [categoryId, setCategoryId] = useState(expense?.category_id || "");
  const [expenseDate, setExpenseDate] = useState(expense?.expense_date || todayYMD());
  const [description, setDescription] = useState(expense?.description || "");
  const [amount, setAmount] = useState(expense?.amount ? String(expense.amount) : "");
  const [employeeName, setEmployeeName] = useState(expense?.employee_name || "");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | "qris">((expense?.payment_method as any) || "cash");
  const [note, setNote] = useState(expense?.note || "");
  const [submitting, setSubmitting] = useState(false);

  // Reset form saat modal di-open ulang dengan expense yang beda
  useEffect(() => {
    if (!open) return;
    setCategoryId(expense?.category_id || "");
    setExpenseDate(expense?.expense_date || todayYMD());
    setDescription(expense?.description || "");
    setAmount(expense?.amount ? String(expense.amount) : "");
    setEmployeeName(expense?.employee_name || "");
    setPaymentMethod((expense?.payment_method as any) || "cash");
    setNote(expense?.note || "");
  }, [open, expense]);

  const selectedCategory = useMemo(
    () => categories.find(c => c.id === categoryId),
    [categoryId, categories]
  );
  const showEmployeeField = useMemo(() => {
    const name = (selectedCategory?.name || "").toLowerCase();
    return EMPLOYEE_CATEGORY_NAMES.some(k => name.includes(k));
  }, [selectedCategory]);

  // Pegawai diambil langsung dari users table (yang sudah punya akun di
  // sistem). Filter: active, exclude superadmin (owner sendiri — jarang
  // gajian dari pengeluaran usaha). owner pilih dari dropdown, atau pilih
  // "Pegawai lain..." untuk pegawai gudang/non-system → text input bebas.
  const employeeOptions = useMemo(
    () => users
      .filter(u => u.isActive !== false && u.role !== "superadmin")
      .map(u => u.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    [users]
  );

  // Apakah employeeName saat ini cocok dengan opsi dropdown? Kalau tidak,
  // berarti sudah diisi manual (pegawai non-system) — show as "Lainnya".
  const employeeSelectValue = employeeName === ""
    ? ""
    : employeeOptions.includes(employeeName) ? employeeName : EMPLOYEE_OTHER;

  // Description optional — kalau kosong, BE auto-fallback ke nama kategori.
  const valid = categoryId && expenseDate && parseFloat(amount) > 0;

  const handleSubmit = async () => {
    if (!valid) {
      toast.error(lang === "id" ? "Pilih kategori, tanggal, dan isi jumlah" : "Pick category, date, and amount");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        category_id: categoryId,
        expense_date: expenseDate,
        description: description.trim(),
        amount: parseFloat(amount),
        employee_name: showEmployeeField ? employeeName.trim() : undefined,
        payment_method: paymentMethod,
        note: note.trim() || undefined,
      };
      const result = isEdit && expense
        ? await updateExpense(expense.id, body)
        : await createExpense(body);
      if (result) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit
      ? (lang === "id" ? "Ubah Pengeluaran" : "Edit Expense")
      : (lang === "id" ? "Catat Pengeluaran" : "Add Expense")} size="md">
      <div className="flex flex-col gap-3">
        <div>
          <label className={`text-xs font-bold ${th.tx} block mb-1`}>
            {lang === "id" ? "Kategori" : "Category"} <span className="text-[#BE123C]">*</span>
          </label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
            className={`w-full px-3 py-3 text-sm font-bold rounded-xl border ${th.inp}`}>
            <option value="">{lang === "id" ? "Pilih kategori..." : "Select category..."}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`text-xs font-bold ${th.tx} block mb-1`}>
              {lang === "id" ? "Tanggal" : "Date"} <span className="text-[#BE123C]">*</span>
            </label>
            <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)}
              className={`w-full px-3 py-3 text-sm font-bold rounded-xl border ${th.inp}`} />
          </div>
          <div>
            <label className={`text-xs font-bold ${th.tx} block mb-1`}>
              {lang === "id" ? "Jumlah (Rp)" : "Amount (Rp)"} <span className="text-[#BE123C]">*</span>
            </label>
            <input type="number" min="0" step="any" inputMode="decimal"
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className={`w-full px-3 py-3 text-sm font-bold rounded-xl border ${th.inp}`} />
          </div>
        </div>

        <div>
          <label className={`text-xs font-bold ${th.tx} block mb-1`}>
            {lang === "id" ? "Deskripsi" : "Description"}{" "}
            <span className={`text-xs font-normal ${th.txf}`}>({lang === "id" ? "opsional" : "optional"})</span>
          </label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder={selectedCategory
              ? (lang === "id" ? `Default: ${selectedCategory.name}` : `Default: ${selectedCategory.name}`)
              : (lang === "id" ? "mis. Beli plastik 1000 pcs" : "e.g. Buy 1000 plastic bags")}
            maxLength={255}
            className={`w-full px-3 py-3 text-sm rounded-xl border ${th.inp}`} />
        </div>

        {showEmployeeField && (
          <div>
            <label className={`text-xs font-bold ${th.tx} block mb-1`}>
              {lang === "id" ? "Nama Pegawai" : "Employee Name"}
            </label>
            <select
              value={employeeSelectValue}
              onChange={e => {
                const v = e.target.value;
                if (v === EMPLOYEE_OTHER) {
                  // Buka text input — kosongkan dulu supaya placeholder
                  // muncul, biar user paham harus ketik nama.
                  setEmployeeName("");
                } else {
                  setEmployeeName(v);
                }
              }}
              className={`w-full px-3 py-3 text-sm font-bold rounded-xl border ${th.inp}`}>
              <option value="">{lang === "id" ? "Pilih pegawai..." : "Select employee..."}</option>
              {employeeOptions.map(n => <option key={n} value={n}>{n}</option>)}
              <option value={EMPLOYEE_OTHER}>
                {lang === "id" ? "+ Pegawai lain (ketik nama)..." : "+ Other employee (type name)..."}
              </option>
            </select>
            {(employeeSelectValue === EMPLOYEE_OTHER || (employeeName && !employeeOptions.includes(employeeName))) && (
              <input type="text" value={employeeName} onChange={e => setEmployeeName(e.target.value)}
                maxLength={100} autoFocus
                placeholder={lang === "id" ? "Ketik nama pegawai..." : "Type employee name..."}
                className={`w-full mt-2 px-3 py-3 text-sm rounded-xl border ${th.inp}`} />
            )}
          </div>
        )}

        <div>
          <label className={`text-xs font-bold ${th.tx} block mb-1`}>
            {lang === "id" ? "Metode Bayar" : "Payment Method"}
          </label>
          <div className="flex gap-2">
            {(["cash", "transfer", "qris"] as const).map(m => (
              <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                className={`flex-1 min-h-[44px] rounded-xl text-sm font-bold border ${
                  paymentMethod === m
                    ? "text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] border-transparent"
                    : `${th.bdr} ${th.card} ${th.txm}`
                }`}>
                {m === "cash" ? (lang === "id" ? "Tunai" : "Cash") : m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={`text-xs font-bold ${th.tx} block mb-1`}>
            {lang === "id" ? "Catatan (opsional)" : "Note (optional)"}
          </label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder={lang === "id" ? "Catatan tambahan..." : "Additional note..."}
            className={`w-full px-3 py-2.5 text-sm rounded-xl border resize-none ${th.inp}`} />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose}
            className={`flex-1 min-h-[44px] rounded-xl text-sm font-bold border ${th.bdr} ${th.card} ${th.txm}`}>
            {lang === "id" ? "Batal" : "Cancel"}
          </button>
          <button onClick={handleSubmit} disabled={!valid || submitting}
            aria-busy={submitting}
            className={`flex-1 min-h-[44px] rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] disabled:opacity-50 inline-flex items-center justify-center gap-2`}>
            {submitting && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {submitting ? (lang === "id" ? "Menyimpan..." : "Saving...") : (lang === "id" ? "Simpan" : "Save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
