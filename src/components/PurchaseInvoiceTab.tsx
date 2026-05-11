import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { SearchableSelect } from "./SearchableSelect";
import { useProductStore, useSupplierStore, usePurchaseInvoiceStore, useAuthStore, useLangStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatDate, calcDueDate } from "@/utils";
import { PAYMENT_TERMS_OPTIONS, PAYMENT_TERMS_LABELS, INVENTORY_WRITE_ROLES } from "@/constants";
import type { PaymentTerms, PurchaseInvoice } from "@/types";
import type { CreatePurchaseInvoiceBody } from "@/api";
import { Plus, Trash2, Receipt, Calendar, Check, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

const PPN_RATE = 0.11;

interface DraftItem {
  productId: string;
  qty: string;
  unit: "individual" | "box";
  unitPrice: string;
  expiryDate: string;
  note: string;
}

const emptyDraftItem = (): DraftItem => ({
  productId: "",
  qty: "",
  unit: "individual",
  unitPrice: "",
  expiryDate: "",
  note: "",
});

/** Tab Faktur Pembelian (Faktur dari supplier dengan multi-line items).
 *  Bu Santi: 1 surat jalan = banyak produk dari 1 supplier dengan PPN
 *  terpisah + tempo bayar. WA reminder H-0 dikirim oleh BE cron. */
export function PurchaseInvoiceTab() {
  const th = useThemeClasses();
  const { lang } = useLangStore();
  const user = useAuthStore(s => s.user)!;
  const canWrite = INVENTORY_WRITE_ROLES.includes(user.role);

  const invoices = usePurchaseInvoiceStore(s => s.invoices);
  const fetchInvoices = usePurchaseInvoiceStore(s => s.fetchInvoices);
  const createInvoice = usePurchaseInvoiceStore(s => s.createInvoice);
  const markPaid = usePurchaseInvoiceStore(s => s.markPaid);
  const products = useProductStore(s => s.products);
  const suppliers = useSupplierStore(s => s.suppliers);

  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices({ status: statusFilter, supplierId: supplierFilter });
  }, [statusFilter, supplierFilter, fetchInvoices]);

  // Stats — count + total unpaid (untuk awareness Bu Santi)
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
            {lang === "id" ? "Faktur Pembelian" : "Purchase Invoices"}
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
        canWrite={canWrite}
      />

      {/* Create Modal */}
      {createOpen && (
        <CreateModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (body) => {
            const created = await createInvoice(body);
            if (created) {
              toast.success("Faktur tersimpan, stok di-update");
              setCreateOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────

interface DetailModalProps {
  invoice: PurchaseInvoice | null;
  onClose: () => void;
  onMarkPaid: (id: string) => void;
  canWrite: boolean;
}

function DetailModal({ invoice, onClose, onMarkPaid, canWrite }: DetailModalProps) {
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
        {canWrite && invoice.paymentStatus === "unpaid" && (
          <button onClick={() => onMarkPaid(invoice.id)}
            className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] inline-flex items-center justify-center gap-2">
            <Check size={14} /> Tandai Lunas
          </button>
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
}

function CreateModal({ open, onClose, onSubmit }: CreateModalProps) {
  const th = useThemeClasses();
  const products = useProductStore(s => s.products);
  const suppliers = useSupplierStore(s => s.suppliers);

  const today = new Date().toISOString().slice(0, 10);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>("COD");
  const [dueDate, setDueDate] = useState(today);
  const [ppnEnabled, setPpnEnabled] = useState(false); // toggle PPN — Bu Santi: kalau supplier UMKM no-PPN, off
  const [ppnOverride, setPpnOverride] = useState(""); // empty = auto 11% × subtotal
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyDraftItem()]);
  const [submitting, setSubmitting] = useState(false);

  // Auto-update dueDate when paymentTerms or invoiceDate changes
  useEffect(() => {
    if (!invoiceDate) return;
    const newDue = calcDueDate(invoiceDate + "T00:00:00", paymentTerms).slice(0, 10);
    setDueDate(newDue);
  }, [invoiceDate, paymentTerms]);

  // Compute subtotal from items
  const subtotal = useMemo(() => {
    return items.reduce((s, it) => {
      const qtyN = parseInt(it.qty) || 0;
      const priceN = parseFloat(it.unitPrice) || 0;
      const product = products.find(p => p.id === it.productId);
      // Convert to individual count for total calc (priceN per individual)
      const qtyIndividual = it.unit === "box" && product ? qtyN * (product.qtyPerBox || 1) : qtyN;
      return s + qtyIndividual * priceN;
    }, 0);
  }, [items, products]);

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
    items.every(it => it.productId && parseInt(it.qty) > 0 && parseFloat(it.unitPrice) >= 0);

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
        items: items.map(it => ({
          product_id: it.productId,
          quantity: parseInt(it.qty),
          unit_type: it.unit,
          unit_price: parseFloat(it.unitPrice),
          expiry_date: it.expiryDate || undefined,
          note: it.note.trim() || undefined,
        })),
      };
      await onSubmit(body);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Buat Faktur Pembelian" size="xl">
      <div className="flex flex-col gap-3">
        {/* Supplier + invoice number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={`text-xs font-bold ${th.tx} block mb-1`}>Pemasok *</label>
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
              className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
          </div>
        </div>

        {/* Dates + payment terms */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={`text-xs font-bold ${th.tx} block mb-1`}>Tanggal Faktur</label>
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
              className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
          </div>
          <div>
            <label className={`text-xs font-bold ${th.tx} block mb-1`}>Tempo Bayar</label>
            <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value as PaymentTerms)}
              className={`w-full px-3 py-2.5 text-sm font-bold rounded-xl border ${th.inp}`}>
              {PAYMENT_TERMS_OPTIONS.map(t => (
                <option key={t} value={t}>{PAYMENT_TERMS_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`text-xs font-bold ${th.tx} block mb-1`}>Jatuh Tempo</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
          </div>
        </div>

        {/* Line items */}
        <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card2}`}>
          <div className={`px-4 py-2.5 border-b ${th.bdr} flex items-center justify-between`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${th.txf}`}>Item ({items.length})</p>
            <button type="button" onClick={addItem}
              className={`text-xs font-bold inline-flex items-center gap-1 px-2 py-1 rounded-lg ${th.accBg} ${th.acc}`}>
              <Plus size={11} /> Tambah Item
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.map((it, idx) => {
              const product = products.find(p => p.id === it.productId);
              const qtyN = parseInt(it.qty) || 0;
              const priceN = parseFloat(it.unitPrice) || 0;
              const qtyIndividual = it.unit === "box" && product ? qtyN * (product.qtyPerBox || 1) : qtyN;
              const lineTotal = qtyIndividual * priceN;
              return (
                <div key={idx} className={`px-4 py-3 border-b last:border-0 ${th.bdrSoft}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className={`text-xs font-bold ${th.txm} mt-2`}>{idx + 1}.</span>
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
                        className={`p-2 rounded-lg ${th.dark ? "text-[#FB7185] hover:bg-[#BE123C]/15" : "text-[#BE123C] hover:bg-[#FCE4EC]"}`}
                        aria-label="Hapus item">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 ml-6">
                    <div>
                      <label className={`text-xs ${th.txf} block mb-0.5`}>Qty</label>
                      <input type="number" min="1" value={it.qty}
                        onChange={e => updateItem(idx, { qty: e.target.value })}
                        className={`w-full px-2 py-1.5 text-sm rounded-lg border ${th.inp}`} />
                    </div>
                    <div>
                      <label className={`text-xs ${th.txf} block mb-0.5`}>Unit</label>
                      <select value={it.unit}
                        onChange={e => updateItem(idx, { unit: e.target.value as "box" | "individual" })}
                        className={`w-full px-2 py-1.5 text-sm rounded-lg border ${th.inp}`}>
                        <option value="individual">Satuan</option>
                        <option value="box">Dus</option>
                      </select>
                    </div>
                    <div>
                      <label className={`text-xs ${th.txf} block mb-0.5`}>Harga /Satuan</label>
                      <input type="number" min="0" step="any" value={it.unitPrice}
                        onChange={e => updateItem(idx, { unitPrice: e.target.value })}
                        placeholder={product ? String(product.purchasePrice) : "0"}
                        className={`w-full px-2 py-1.5 text-sm rounded-lg border ${th.inp}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 ml-6 mt-2">
                    <div>
                      <label className={`text-xs ${th.txf} block mb-0.5`}>ED (opsional)</label>
                      <input type="date" value={it.expiryDate}
                        onChange={e => updateItem(idx, { expiryDate: e.target.value })}
                        className={`w-full px-2 py-1.5 text-sm rounded-lg border ${th.inp}`} />
                    </div>
                    <div className="text-right pt-3">
                      <p className={`text-xs ${th.txf}`}>Subtotal item</p>
                      <p className={`font-display text-sm font-bold ${th.tx}`}>{$(lineTotal)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PPN + Total */}
        <div className={`rounded-2xl border p-4 ${th.bdr} ${th.card2}`}>
          <label className={`flex items-center gap-2 cursor-pointer mb-3`}>
            <input type="checkbox" checked={ppnEnabled}
              onChange={e => setPpnEnabled(e.target.checked)}
              className="w-4 h-4 accent-[#E11D48]" />
            <span className={`text-sm font-bold ${th.tx}`}>Faktur ini ada PPN</span>
            <span className={`text-xs ${th.txm}`}>(default 11%)</span>
          </label>
          {ppnEnabled && (
            <div className="mb-3">
              <label className={`text-xs font-bold ${th.txm} block mb-1`}>PPN (kosongkan untuk auto 11%)</label>
              <input type="number" min="0" step="any" value={ppnOverride}
                onChange={e => setPpnOverride(e.target.value)}
                placeholder={Math.round(subtotal * PPN_RATE).toString()}
                className={`w-full px-3 py-2 text-sm rounded-xl border ${th.inp}`} />
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
            {submitting ? "Menyimpan..." : "Simpan Faktur"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
