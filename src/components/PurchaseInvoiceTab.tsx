import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { SearchableSelect } from "./SearchableSelect";
import { useProductStore, useSupplierStore, usePurchaseInvoiceStore, useAuthStore, useLangStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatDate, calcDueDate } from "@/utils";
import { PAYMENT_TERMS_OPTIONS, PAYMENT_TERMS_LABELS, INVENTORY_WRITE_ROLES } from "@/constants";
import type { PaymentTerms, PurchaseInvoice } from "@/types";
import type { CreatePurchaseInvoiceBody } from "@/api";
import { Plus, Trash2, Receipt, Calendar, Check, AlertTriangle, Pencil } from "lucide-react";
import toast from "react-hot-toast";

const PPN_RATE = 0.11;

interface DraftItem {
  productId: string;
  qty: string;
  unit: "individual" | "box";
  lineTotal: string;  // total Rp per baris item; unit_price di-compute dari ini saat submit
  expiryDate: string;
  note: string;
}

const emptyDraftItem = (): DraftItem => ({
  productId: "",
  qty: "",
  unit: "individual",
  lineTotal: "",
  expiryDate: "",
  note: "",
});

/** Tab Faktur Pembelian (Faktur dari supplier dengan multi-line items).
 *  owner: 1 surat jalan = banyak produk dari 1 supplier dengan PPN
 *  terpisah + tempo bayar. WA reminder H-0 dikirim oleh BE cron. */
export function PurchaseInvoiceTab() {
  const th = useThemeClasses();
  const { lang } = useLangStore();
  const user = useAuthStore(s => s.user)!;
  const canWrite = INVENTORY_WRITE_ROLES.includes(user.role);

  const invoices = usePurchaseInvoiceStore(s => s.invoices);
  const fetchInvoices = usePurchaseInvoiceStore(s => s.fetchInvoices);
  const createInvoice = usePurchaseInvoiceStore(s => s.createInvoice);
  const updateInvoice = usePurchaseInvoiceStore(s => s.updateInvoice);
  const deleteInvoice = usePurchaseInvoiceStore(s => s.deleteInvoice);
  const markPaid = usePurchaseInvoiceStore(s => s.markPaid);
  const products = useProductStore(s => s.products);
  const suppliers = useSupplierStore(s => s.suppliers);

  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  // editInvoice: kalau set, modal jadi mode "edit" — prefill data + call update
  const [editInvoice, setEditInvoice] = useState<PurchaseInvoice | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices({ status: statusFilter, supplierId: supplierFilter });
  }, [statusFilter, supplierFilter, fetchInvoices]);

  // Stats — count + total unpaid (untuk awareness owner)
  const stats = useMemo(() => {
    const unpaid = invoices.filter(i => i.paymentStatus === "unpaid");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueSoonOrOverdue = unpaid.filter(i => i.dueDate && new Date(i.dueDate) <= new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000));
    return {
      total: invoices.length,
      unpaidCount: unpaid.length,
      unpaidAmount: unpaid.reduce((s, i) => s + i.totalAmount, 0),
      dueSoonCount: dueSoonOrOverdue.length,
    };
  }, [invoices]);

  const detail = detailId ? invoices.find(i => i.id === detailId) || null : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Header + create button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className={`font-black text-lg ${th.tx}`}>
            {lang === "id" ? "Catat Faktur Barang Masuk" : "Stock-In Invoices"}
          </h2>
          <p className={`text-xs ${th.txm}`}>
            {stats.unpaidCount > 0 ? (
              <>
                {stats.unpaidCount} faktur belum lunas · total {$(stats.unpaidAmount)}
                {stats.dueSoonCount > 0 && (
                  <span className={`ml-2 inline-flex items-center gap-1 text-[#BE123C] font-bold`}>
                    <AlertTriangle size={11} /> {stats.dueSoonCount} jatuh tempo 3 hari
                  </span>
                )}
              </>
            ) : (
              <>{stats.total} faktur tersimpan</>
            )}
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48]">
            <Plus size={14} /> Buat Faktur
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className={`px-3 py-2 text-sm font-bold rounded-xl border ${th.inp}`}>
          <option value="all">Semua Status</option>
          <option value="unpaid">Belum Lunas</option>
          <option value="paid">Lunas</option>
        </select>
        <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}
          className={`px-3 py-2 text-sm font-bold rounded-xl border ${th.inp}`}>
          <option value="">Semua Pemasok</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* List */}
      {invoices.length === 0 ? (
        <div className={`rounded-2xl border p-8 text-center ${th.bdr} ${th.card2}`}>
          <Receipt size={28} className={`mx-auto mb-2 ${th.txf}`} />
          <p className={`text-sm font-bold ${th.tx}`}>Belum ada faktur</p>
          <p className={`text-xs mt-1 ${th.txm}`}>Klik &quot;Buat Faktur&quot; untuk mulai catat faktur dari supplier.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {invoices.map(inv => {
            const overdue = inv.paymentStatus === "unpaid" && inv.dueDate && new Date(inv.dueDate) < new Date();
            const dueSoon = inv.paymentStatus === "unpaid" && inv.dueDate &&
              new Date(inv.dueDate).getTime() <= Date.now() + 3 * 24 * 60 * 60 * 1000 && !overdue;
            return (
              <button key={inv.id} onClick={() => setDetailId(inv.id)}
                className={`text-left rounded-2xl border p-4 ${th.bdr} ${th.card2} hover:shadow-sm transition`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-bold text-sm ${th.tx}`}>{inv.supplierName || "—"}</p>
                      {inv.invoiceNumber && (
                        <span className={`text-xs font-mono ${th.txm}`}>#{inv.invoiceNumber}</span>
                      )}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        inv.paymentStatus === "paid"
                          ? (th.dark ? "bg-[#FFB5C0]/15 text-[#FFB5C0]" : "bg-[#FFE4E9] text-[#E11D48]")
                          : overdue
                            ? (th.dark ? "bg-[#BE123C]/20 text-[#FB7185]" : "bg-[#FCE4EC] text-[#BE123C]")
                            : dueSoon
                              ? (th.dark ? "bg-[#FB7185]/15 text-[#FB7185]" : "bg-[#FFD1DB] text-[#BE123C]")
                              : (th.dark ? "bg-[#3D2230] text-[#9F7686]" : "bg-[#F5E1E6] text-[#6E4E57]")
                      }`}>
                        {inv.paymentStatus === "paid" ? "Lunas" : overdue ? "Lewat Tempo" : dueSoon ? "Tempo Dekat" : "Belum Lunas"}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 ${th.txm}`}>
                      {inv.items.length} item · {formatDate(inv.invoiceDate, lang)}
                      {inv.dueDate && (
                        <> · jatuh tempo {formatDate(inv.dueDate, lang)} ({PAYMENT_TERMS_LABELS[inv.paymentTerms]})</>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-display font-black text-base ${th.acc}`}>{$(inv.totalAmount)}</p>
                    {inv.ppnAmount > 0 && (
                      <p className={`text-xs ${th.txf}`}>incl PPN {$(inv.ppnAmount)}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <DetailModal
        invoice={detail}
        onClose={() => setDetailId(null)}
        onMarkPaid={(id) => { markPaid(id); setDetailId(null); }}
        onEdit={(inv) => { setEditInvoice(inv); setDetailId(null); }}
        onDelete={(id) => { setConfirmDeleteId(id); setDetailId(null); }}
        canWrite={canWrite}
      />

      {/* Create / Edit Modal — reused. editInvoice menentukan mode. */}
      {(createOpen || editInvoice) && (
        <CreateModal
          open={createOpen || !!editInvoice}
          initialInvoice={editInvoice}
          onClose={() => { setCreateOpen(false); setEditInvoice(null); }}
          onSubmit={async (body) => {
            if (editInvoice) {
              const updated = await updateInvoice(editInvoice.id, body);
              if (updated) setEditInvoice(null);
            } else {
              const created = await createInvoice(body);
              if (created) {
                toast.success("Faktur tersimpan");
                setCreateOpen(false);
              }
            }
          }}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteId && (() => {
        const inv = invoices.find(i => i.id === confirmDeleteId);
        if (!inv) return null;
        const sup = suppliers.find(s => s.id === inv.supplierId);
        return (
          <Modal open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="Hapus Faktur?">
            <div className="flex flex-col gap-3">
              <p className={`text-sm ${th.tx}`}>
                Faktur dari <b>{sup?.name || "supplier"}</b> tanggal <b>{formatDate(inv.invoiceDate)}</b>
                {" "}senilai <b>{$(inv.totalAmount)}</b> akan dihapus.
              </p>
              <div className={`rounded-xl border px-3 py-2.5 text-xs flex items-start gap-2 ${th.dark ? "border-[#BE123C]/40 bg-[#3A1F2A]/40 text-[#FB7185]" : "border-[#BE123C]/30 bg-[#FCE4EC] text-[#BE123C]"}`}>
                <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden />
                <span>Tindakan ini tidak bisa dibatalkan. Faktur ini hanya catatan — stok produk tidak terpengaruh.</span>
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setConfirmDeleteId(null)}
                  className={`flex-1 min-h-[44px] rounded-xl text-sm font-bold border ${th.bdr} ${th.txm}`}>
                  Batal
                </button>
                <button
                  onClick={async () => {
                    await deleteInvoice(confirmDeleteId);
                    setConfirmDeleteId(null);
                  }}
                  className="flex-1 min-h-[44px] rounded-xl text-sm font-bold text-white bg-[#C4504A]">
                  Hapus
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────

interface DetailModalProps {
  invoice: PurchaseInvoice | null;
  onClose: () => void;
  onMarkPaid: (id: string) => void;
  onEdit: (invoice: PurchaseInvoice) => void;
  onDelete: (id: string) => void;
  canWrite: boolean;
}

function DetailModal({ invoice, onClose, onMarkPaid, onEdit, onDelete, canWrite }: DetailModalProps) {
  const th = useThemeClasses();
  const { lang } = useLangStore();
  if (!invoice) return null;
  const overdue = invoice.paymentStatus === "unpaid" && invoice.dueDate && new Date(invoice.dueDate) < new Date();

  return (
    <Modal open={!!invoice} onClose={onClose} title="Detail Faktur" size="lg">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className={`rounded-2xl border p-4 ${th.bdr} ${th.card2}`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className={`font-bold text-base ${th.tx}`}>{invoice.supplierName || "—"}</p>
              {invoice.invoiceNumber && (
                <p className={`text-xs font-mono mt-0.5 ${th.txm}`}>No. {invoice.invoiceNumber}</p>
              )}
              <p className={`text-xs mt-2 ${th.txm}`}>
                Tanggal faktur: {formatDate(invoice.invoiceDate, lang)}
              </p>
              {invoice.dueDate && (
                <p className={`text-xs mt-0.5 ${overdue ? "text-[#BE123C] font-bold" : th.txm}`}>
                  Jatuh tempo: {formatDate(invoice.dueDate, lang)}
                  {overdue && ` · LEWAT TEMPO`}
                </p>
              )}
              <p className={`text-xs mt-0.5 ${th.txm}`}>
                Tempo bayar: {PAYMENT_TERMS_LABELS[invoice.paymentTerms]}
              </p>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
              invoice.paymentStatus === "paid"
                ? (th.dark ? "bg-[#FFB5C0]/15 text-[#FFB5C0]" : "bg-[#FFE4E9] text-[#E11D48]")
                : (th.dark ? "bg-[#BE123C]/20 text-[#FB7185]" : "bg-[#FCE4EC] text-[#BE123C]")
            }`}>
              {invoice.paymentStatus === "paid" ? "LUNAS" : "BELUM LUNAS"}
            </span>
          </div>
        </div>

        {/* Items */}
        <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card2}`}>
          <div className={`px-4 py-2.5 border-b ${th.bdr}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${th.txf}`}>Item ({invoice.items.length})</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {invoice.items.map(it => (
              <div key={it.id} className={`px-4 py-2.5 border-b last:border-0 ${th.bdrSoft}`}>
                <p className={`text-sm font-bold truncate ${th.tx}`}>{it.productName || "—"}</p>
                <div className={`flex items-center justify-between gap-2 mt-1 text-xs ${th.txm}`}>
                  <span>{it.quantity} pcs × {$(it.unitPrice)}</span>
                  <span className={`font-bold ${th.tx}`}>{$(it.quantity * it.unitPrice)}</span>
                </div>
                {it.expiryDate && (
                  <p className={`text-xs mt-0.5 ${th.txf} inline-flex items-center gap-1`}>
                    <Calendar size={10} /> ED {formatDate(it.expiryDate, lang)}
                  </p>
                )}
                {it.note && <p className={`text-xs mt-0.5 ${th.txf}`}>{it.note}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className={`rounded-2xl border p-4 ${th.bdr} ${th.card2}`}>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className={th.txm}>Subtotal</span>
              <span className={th.tx}>{$(invoice.subtotalAmount)}</span>
            </div>
            {invoice.ppnAmount > 0 && (
              <div className="flex justify-between">
                <span className={th.txm}>PPN</span>
                <span className={th.tx}>{$(invoice.ppnAmount)}</span>
              </div>
            )}
            <div className={`flex justify-between border-t pt-1.5 ${th.bdr}`}>
              <span className={`font-bold ${th.tx}`}>Total (Netto)</span>
              <span className={`font-display font-black text-base ${th.acc}`}>{$(invoice.totalAmount)}</span>
            </div>
          </div>
          {invoice.note && (
            <p className={`text-xs mt-3 pt-3 border-t ${th.bdr} ${th.txm}`}>Catatan: {invoice.note}</p>
          )}
        </div>

        {/* Actions */}
        {canWrite && (
          <div className="flex flex-col gap-2">
            {invoice.paymentStatus === "unpaid" && (
              <button onClick={() => onMarkPaid(invoice.id)}
                className="w-full min-h-[44px] rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] inline-flex items-center justify-center gap-2">
                <Check size={14} /> Tandai Lunas
              </button>
            )}
            <div className="flex gap-2">
              <button onClick={() => onEdit(invoice)}
                className={`flex-1 min-h-[44px] rounded-2xl text-sm font-bold border inline-flex items-center justify-center gap-1.5 ${th.bdr} ${th.acc}`}>
                <Pencil size={14} /> Edit Faktur
              </button>
              <button onClick={() => onDelete(invoice.id)}
                className={`flex-1 min-h-[44px] rounded-2xl text-sm font-bold border inline-flex items-center justify-center gap-1.5 ${th.dark ? "border-[#BE123C]/40 text-[#FB7185]" : "border-[#BE123C]/30 text-[#BE123C]"}`}>
                <Trash2 size={14} /> Hapus
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: CreatePurchaseInvoiceBody) => Promise<void>;
  /** Kalau set, modal jadi mode "Edit Faktur" — prefill semua field dari
   *  invoice ini. onSubmit pemanggil yang handle update endpoint. */
  initialInvoice?: PurchaseInvoice | null;
}

function CreateModal({ open, onClose, onSubmit, initialInvoice }: CreateModalProps) {
  const th = useThemeClasses();
  const products = useProductStore(s => s.products);
  const suppliers = useSupplierStore(s => s.suppliers);

  const today = new Date().toISOString().slice(0, 10);
  const isEdit = !!initialInvoice;

  // Helper: map PurchaseInvoice → DraftItem[] untuk prefill di edit mode.
  // qty_per_box conversion: kalau item disimpan dengan unit_type='box' dan
  // qty sudah dikali qtyPerBox saat create, balik ke nilai semula. Untuk
  // simplicity di edit, default ke 'individual' dengan qty actual.
  const prefillItems = (inv: PurchaseInvoice): DraftItem[] => {
    if (!inv.items || inv.items.length === 0) return [emptyDraftItem()];
    return inv.items.map(it => ({
      productId: it.productId,
      qty: String(it.quantity),
      unit: "individual" as const,  // simplify: edit selalu individual
      lineTotal: String(it.unitPrice * it.quantity),
      expiryDate: it.expiryDate || "",
      note: it.note || "",
    }));
  };

  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoice?.invoiceNumber || "");
  const [supplierId, setSupplierId] = useState(initialInvoice?.supplierId || "");
  const [invoiceDate, setInvoiceDate] = useState(
    initialInvoice ? initialInvoice.invoiceDate.slice(0, 10) : today
  );
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(initialInvoice?.paymentTerms as PaymentTerms || "COD");
  const [dueDate, setDueDate] = useState(
    initialInvoice?.dueDate ? initialInvoice.dueDate.slice(0, 10) : today
  );
  const [ppnEnabled, setPpnEnabled] = useState(initialInvoice ? initialInvoice.ppnAmount > 0 : false);
  const [ppnOverride, setPpnOverride] = useState(initialInvoice && initialInvoice.ppnAmount > 0 ? String(initialInvoice.ppnAmount) : "");
  const [note, setNote] = useState(initialInvoice?.note || "");
  const [items, setItems] = useState<DraftItem[]>(
    initialInvoice ? prefillItems(initialInvoice) : [emptyDraftItem()]
  );
  const [submitting, setSubmitting] = useState(false);

  // Auto-update dueDate when paymentTerms or invoiceDate changes
  useEffect(() => {
    if (!invoiceDate) return;
    const newDue = calcDueDate(invoiceDate + "T00:00:00", paymentTerms).slice(0, 10);
    setDueDate(newDue);
  }, [invoiceDate, paymentTerms]);

  // Compute subtotal from items — sekarang langsung sum dari lineTotal yang
  // di-input user (bukan dihitung qty × harga satuan lagi). Lebih simple +
  // match input style.
  const subtotal = useMemo(() => {
    return items.reduce((s, it) => s + (parseFloat(it.lineTotal) || 0), 0);
  }, [items]);

  const ppnAmount = useMemo(() => {
    if (!ppnEnabled) return 0;
    if (ppnOverride.trim() !== "") {
      return parseFloat(ppnOverride) || 0;
    }
    return Math.round(subtotal * PPN_RATE);
  }, [subtotal, ppnEnabled, ppnOverride]);

  const total = subtotal + ppnAmount;

  const addItem = () => setItems([...items, emptyDraftItem()]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, patch: Partial<DraftItem>) => {
    setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };

  const valid = supplierId && items.length > 0 &&
    items.every(it => it.productId && parseInt(it.qty) > 0 && parseFloat(it.lineTotal) >= 0);

  const handleSubmit = async () => {
    if (!valid) {
      toast.error("Lengkapi semua field");
      return;
    }
    setSubmitting(true);
    try {
      const body: CreatePurchaseInvoiceBody = {
        invoice_number: invoiceNumber.trim() || undefined,
        supplier_id: supplierId,
        invoice_date: invoiceDate,
        payment_terms: paymentTerms,
        due_date: dueDate,
        subtotal_amount: subtotal,
        ppn_amount: ppnAmount,
        total_amount: total,
        note: note.trim() || undefined,
        items: items.map(it => {
          // Compute unit_price dari total / qty_individual untuk audit trail
          // di purchase_invoice_items.unit_price. User input total saja —
          // unit_price ini behind-the-scene saja, snapshot harga historis.
          const qtyN = parseInt(it.qty) || 0;
          const product = products.find(p => p.id === it.productId);
          const qtyIndividual = it.unit === "box" && product ? qtyN * (product.qtyPerBox || 1) : qtyN;
          const totalN = parseFloat(it.lineTotal) || 0;
          const unitPrice = qtyIndividual > 0 ? totalN / qtyIndividual : 0;
          return {
            product_id: it.productId,
            quantity: parseInt(it.qty),
            unit_type: it.unit,
            unit_price: unitPrice,
            expiry_date: it.expiryDate || undefined,
            note: it.note.trim() || undefined,
          };
        }),
      };
      await onSubmit(body);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Faktur Barang Masuk" : "Catat Faktur Barang Masuk"} size="xl">
      <div className="flex flex-col gap-3">
        {/* Info banner — Faktur sekarang PURE RECORD (request owner):
            tidak update stok, batch, atau movement. Owner aware via banner ini. */}
        <div className={`rounded-2xl border px-4 py-3 text-xs flex items-start gap-2 ${th.dark ? "border-[#FB7185]/30 bg-[#3A1F2A]/40" : "border-[#FFB5C0] bg-[#FFF4F6]"}`}>
          <AlertTriangle size={14} className={`shrink-0 mt-0.5 ${th.acc}`} aria-hidden />
          <div className={th.txm}>
            <p className={`font-bold mb-0.5 ${th.tx}`}>Faktur ini hanya sebagai catatan</p>
            <p>
              Stok produk <b>tidak otomatis bertambah</b> dari faktur ini.
              Update stok lewat <b>Edit Produk → Tambah Stok Baru</b> (kalau ada ED)
              atau <b>Sesuaikan Stok</b> untuk koreksi tanpa ED.
            </p>
          </div>
        </div>

        {/* Supplier + invoice number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={`text-xs font-bold ${th.tx} block mb-1`}>Pemasok <span className="text-[#BE123C]">*</span></label>
            <SearchableSelect
              value={supplierId}
              onChange={setSupplierId}
              options={suppliers.map(s => ({ id: s.id, label: s.name }))}
              placeholder="Pilih supplier..."
            />
          </div>
          <div>
            <label className={`text-xs font-bold ${th.tx} block mb-1`}>No. Faktur Supplier</label>
            <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="opsional (e.g. MRA-2026-105001)"
              className={`w-full px-3 py-3 text-sm rounded-xl border ${th.inp}`} />
          </div>
        </div>

        {/* Dates + payment terms */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={`text-xs font-bold ${th.tx} block mb-1`}>Tanggal Faktur <span className="text-[#BE123C]">*</span></label>
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
              className={`w-full px-3 py-3 text-sm font-bold rounded-xl border ${th.inp}`} />
          </div>
          <div>
            <label className={`text-xs font-bold ${th.tx} block mb-1`}>Tempo Bayar <span className="text-[#BE123C]">*</span></label>
            <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value as PaymentTerms)}
              className={`w-full px-3 py-3 text-sm font-bold rounded-xl border ${th.inp}`}>
              {PAYMENT_TERMS_OPTIONS.map(t => (
                <option key={t} value={t}>{PAYMENT_TERMS_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`text-xs font-bold ${th.tx} block mb-1`}>Jatuh Tempo</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className={`w-full px-3 py-3 text-sm font-bold rounded-xl border ${th.inp}`} />
          </div>
        </div>

        {/* Line items */}
        <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card2}`}>
          <div className={`px-4 py-3 border-b ${th.bdr}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${th.txf}`}>Item ({items.length})</p>
            {/* Hint discoverability — owner pernah ngira harus bikin faktur
                terpisah per produk. Jelaskan multi-item langsung di sini. */}
            <p className={`text-xs mt-1.5 ${th.txm}`}>
              1 faktur bisa berisi banyak produk dari supplier yang sama. Klik <b>Tambah Produk Lain</b> di bawah list untuk tambah produk.
            </p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.map((it, idx) => {
              const product = products.find(p => p.id === it.productId);
              const qtyN = parseInt(it.qty) || 0;
              const qtyIndividual = it.unit === "box" && product ? qtyN * (product.qtyPerBox || 1) : qtyN;
              const lineTotalN = parseFloat(it.lineTotal) || 0;
              // Display: harga per pcs untuk informational (auto-compute dari total).
              const pricePerUnit = qtyIndividual > 0 ? lineTotalN / qtyIndividual : 0;
              return (
                <div key={idx} className={`px-4 py-3 border-b last:border-0 ${th.bdrSoft}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className={`text-sm font-bold ${th.txm} mt-2.5`}>{idx + 1}.</span>
                    <div className="flex-1">
                      <SearchableSelect
                        value={it.productId}
                        onChange={(v) => updateItem(idx, { productId: v })}
                        options={products.filter(p => p.isActive).map(p => ({
                          id: p.id,
                          label: `${p.nameId || p.name} (${p.sku})`,
                        }))}
                        placeholder="Pilih produk..."
                      />
                    </div>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)}
                        className={`shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl ${th.dark ? "text-[#FB7185] hover:bg-[#BE123C]/15" : "text-[#BE123C] hover:bg-[#FCE4EC]"}`}
                        aria-label={`Hapus item ${idx + 1}`}
                        title="Hapus item">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 ml-6">
                    <div>
                      <label className={`text-xs font-bold ${th.txm} block mb-1`}>Qty <span className="text-[#BE123C]">*</span></label>
                      <input type="number" min="1" value={it.qty}
                        inputMode="numeric"
                        onChange={e => updateItem(idx, { qty: e.target.value })}
                        className={`w-full px-2.5 py-2.5 text-sm font-bold rounded-xl border ${th.inp}`} />
                    </div>
                    <div>
                      <label className={`text-xs font-bold ${th.txm} block mb-1`}>Unit</label>
                      <select value={it.unit}
                        onChange={e => updateItem(idx, { unit: e.target.value as "box" | "individual" })}
                        className={`w-full px-2.5 py-2.5 text-sm font-bold rounded-xl border ${th.inp}`}>
                        <option value="individual">Satuan</option>
                        <option value="box">Dus</option>
                      </select>
                    </div>
                    <div>
                      <label className={`text-xs font-bold ${th.txm} block mb-1`}>Total <span className="text-[#BE123C]">*</span></label>
                      <input type="number" min="0" step="any" value={it.lineTotal}
                        inputMode="decimal"
                        onChange={e => updateItem(idx, { lineTotal: e.target.value })}
                        placeholder="0"
                        className={`w-full px-2.5 py-2.5 text-sm font-bold rounded-xl border ${th.inp}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 ml-6 mt-2">
                    <div>
                      <label className={`text-xs font-bold ${th.txm} block mb-1`}>ED (opsional)</label>
                      <input type="date" value={it.expiryDate}
                        onChange={e => updateItem(idx, { expiryDate: e.target.value })}
                        className={`w-full px-2.5 py-2.5 text-sm rounded-xl border ${th.inp}`} />
                    </div>
                    <div className="text-right pt-4">
                      {/* Display info: harga per pcs (auto-compute dari total/qty).
                          Owner cuma input total, harga per unit otomatis muncul
                          sebagai info — tidak perlu dihitung manual. */}
                      {pricePerUnit > 0 && (
                        <p className={`text-xs ${th.txf}`}>≈ {$(Math.round(pricePerUnit))} / pcs</p>
                      )}
                      <p className={`font-display text-base font-bold ${th.tx}`}>{$(lineTotalN)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Bottom Tambah Item — full-width, dashed border supaya feel
                "add row" like spreadsheet. Diletakkan setelah item terakhir
                karena itu posisi mata user setelah isi field harga. */}
            <button type="button" onClick={addItem}
              className={`w-full flex items-center justify-center gap-2 px-4 py-4 border-t-2 border-dashed text-sm font-bold ${th.bdr} ${th.acc} hover:opacity-80 active:opacity-60`}>
              <Plus size={16} strokeWidth={2.5} />
              {items.length === 0 ? "Tambah Produk Pertama" : "Tambah Produk Lain"}
            </button>
          </div>
        </div>

        {/* PPN + Total */}
        <div className={`rounded-2xl border p-4 ${th.bdr} ${th.card2}`}>
          <label className={`flex items-center gap-2 cursor-pointer mb-3 min-h-[36px]`}>
            <input type="checkbox" checked={ppnEnabled}
              onChange={e => setPpnEnabled(e.target.checked)}
              className="w-5 h-5 accent-[#E11D48]" />
            <span className={`text-sm font-bold ${th.tx}`}>Faktur ini ada PPN</span>
            <span className={`text-xs ${th.txm}`}>(default 11%)</span>
          </label>
          {ppnEnabled && (
            <div className="mb-3">
              <label className={`text-xs font-bold ${th.txm} block mb-1`}>PPN (kosongkan untuk auto 11%)</label>
              <input type="number" min="0" step="any" value={ppnOverride}
                inputMode="decimal"
                onChange={e => setPpnOverride(e.target.value)}
                placeholder={Math.round(subtotal * PPN_RATE).toString()}
                className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
            </div>
          )}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className={th.txm}>Subtotal</span>
              <span className={th.tx}>{$(subtotal)}</span>
            </div>
            {ppnAmount > 0 && (
              <div className="flex justify-between">
                <span className={th.txm}>PPN</span>
                <span className={th.tx}>{$(ppnAmount)}</span>
              </div>
            )}
            <div className={`flex justify-between border-t pt-1.5 ${th.bdr}`}>
              <span className={`font-bold ${th.tx}`}>Total (Netto)</span>
              <span className={`font-display font-black text-base ${th.acc}`}>{$(total)}</span>
            </div>
          </div>
        </div>

        {/* Note */}
        <div>
          <label className={`text-xs font-bold ${th.tx} block mb-1`}>Catatan (opsional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="Misal: barang masuk tgl X jam Y"
            className={`w-full px-3 py-2 text-sm rounded-xl border resize-none ${th.inp}`} />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={onClose}
            className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>
            Batal
          </button>
          <button onClick={handleSubmit} disabled={!valid || submitting}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] disabled:opacity-40">
            {submitting ? "Menyimpan..." : (isEdit ? "Simpan Perubahan" : "Simpan Faktur")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
