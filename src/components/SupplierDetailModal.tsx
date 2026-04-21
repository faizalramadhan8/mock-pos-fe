import { useMemo, useState, useEffect } from "react";
import { Modal } from "./Modal";
import { useSupplierStore, useInventoryStore, useProductStore, useAuthStore, useLangStore } from "@/stores";
import { INVENTORY_WRITE_ROLES } from "@/constants";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatDate, formatTime } from "@/utils";
import { Phone, Mail, MapPin, ArrowDownCircle, Check, CircleDollarSign, Package, Copy, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

interface SupplierDetailModalProps {
  supplierId: string | null;
  onClose: () => void;
}

export function SupplierDetailModal({ supplierId, onClose }: SupplierDetailModalProps) {
  const th = useThemeClasses();
  const { t, lang } = useLangStore();
  const suppliers = useSupplierStore(s => s.suppliers);
  const movements = useInventoryStore(s => s.movements);
  const updatePaymentStatus = useInventoryStore(s => s.updatePaymentStatus);
  const products = useProductStore(s => s.products);
  const user = useAuthStore(s => s.user)!;
  const canWrite = INVENTORY_WRITE_ROLES.includes(user.role);

  const supplier = supplierId ? suppliers.find(s => s.id === supplierId) : null;

  const supplierProducts = useMemo(
    () => (supplier ? products.filter(p => p.supplierId === supplier.id && p.isActive) : []),
    [supplier, products]
  );

  const lowStockProducts = useMemo(
    () => supplierProducts.filter(p => p.stock <= p.minStock),
    [supplierProducts]
  );

  const [reorderChecks, setReorderChecks] = useState<Record<string, boolean>>({});
  const [reorderQtys, setReorderQtys] = useState<Record<string, number>>({});
  const [reorderText, setReorderText] = useState("");

  useEffect(() => {
    if (!supplier) return;
    const checks: Record<string, boolean> = {};
    const qtys: Record<string, number> = {};
    lowStockProducts.forEach(p => {
      checks[p.id] = true;
      const target = Math.max(p.minStock * 2, 5);
      qtys[p.id] = Math.max(target - p.stock, 1);
    });
    setReorderChecks(checks);
    setReorderQtys(qtys);
  }, [supplier?.id, lowStockProducts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!supplier) return;
    const picked = supplierProducts.filter(p => reorderChecks[p.id]);
    if (picked.length === 0) { setReorderText(""); return; }
    const greeting = lang === "id" ? `Selamat siang Pak/Bu, mau pesan:` : `Hi, I'd like to order:`;
    const lines = picked.map(p => {
      const q = reorderQtys[p.id] || 1;
      const name = lang === "id" ? p.nameId : p.name;
      return `• ${name} — ${q} ${p.unit}`;
    });
    const closing = lang === "id" ? `Terima kasih.` : `Thank you.`;
    setReorderText(`${greeting}\n${lines.join("\n")}\n${closing}`);
  }, [supplier?.id, reorderChecks, reorderQtys, supplierProducts, lang]);

  const supplierMovements = useMemo(() =>
    supplier
      ? movements.filter(m => m.type === "in" && m.supplierId === supplier.id)
      : [],
    [supplier, movements]
  );

  const unpaidInvoices = useMemo(() =>
    supplierMovements.filter(m => m.paymentStatus === "unpaid"),
    [supplierMovements]
  );

  if (!supplier) return null;

  const now = Date.now();

  return (
    <Modal open={!!supplierId} onClose={onClose} title={t.supplierDetail as string}>
      {/* Header */}
      <div className="flex flex-col items-center mb-5">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 ${th.dark ? "bg-[#60A5FA]/15" : "bg-[#1E40AF]/[0.07]"}`}>
          <span className={`text-2xl font-black ${th.acc}`}>{supplier.name.charAt(0)}</span>
        </div>
        <p className={`text-base font-extrabold tracking-tight ${th.tx}`}>{supplier.name}</p>
      </div>

      {/* Contact Info */}
      <div className={`rounded-2xl border p-4 mb-3 ${th.bdr} ${th.card2}`}>
        <p className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${th.txf}`}>{t.contactInfo}</p>
        <div className="space-y-2">
          {supplier.phone && (
            <div className="flex items-center gap-2.5">
              <Phone size={13} className={th.txm} />
              <span className={`text-xs ${th.tx}`}>{supplier.phone}</span>
            </div>
          )}
          {supplier.email && (
            <div className="flex items-center gap-2.5">
              <Mail size={13} className={th.txm} />
              <span className={`text-xs ${th.tx}`}>{supplier.email}</span>
            </div>
          )}
          {supplier.address && (
            <div className="flex items-center gap-2.5">
              <MapPin size={13} className={`shrink-0 ${th.txm}`} />
              <span className={`text-xs ${th.tx}`}>{supplier.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Products supplied + Reorder draft */}
      {supplierProducts.length > 0 && (
        <div className={`rounded-2xl border overflow-hidden mb-3 ${th.bdr} ${th.card2}`}>
          <div className={`px-4 py-2.5 border-b ${th.bdr} flex items-center gap-2`}>
            <Package size={13} className={th.acc} />
            <p className={`text-xs font-bold uppercase tracking-wider ${th.txf}`}>
              {lang === "id" ? "Produk" : "Products"} ({supplierProducts.length})
              {lowStockProducts.length > 0 && (
                <span className={`ml-2 px-2 py-0.5 rounded-md ${th.dark ? "bg-[#D4627A]/15 text-[#D4627A]" : "bg-red-50 text-[#D4627A]"}`}>
                  <AlertTriangle size={9} className="inline mr-1" />
                  {lowStockProducts.length} {lang === "id" ? "stok rendah" : "low"}
                </span>
              )}
            </p>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {supplierProducts.map(p => {
              const low = p.stock <= p.minStock;
              return (
                <label key={p.id} className={`flex items-center gap-2 px-4 py-2 border-b last:border-0 cursor-pointer ${th.bdrSoft}`}>
                  <input type="checkbox" checked={!!reorderChecks[p.id]}
                    onChange={(e) => setReorderChecks({ ...reorderChecks, [p.id]: e.target.checked })}
                    className="w-4 h-4 rounded accent-[#1E40AF] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${th.tx}`}>{lang === "id" ? p.nameId : p.name}</p>
                    <p className={`text-xs ${low ? "text-[#D4627A] font-bold" : th.txf}`}>
                      {lang === "id" ? "Stok" : "Stock"}: {p.stock} {p.unit} · min {p.minStock}
                      {low && ` · ${lang === "id" ? "RENDAH" : "LOW"}`}
                    </p>
                  </div>
                  {reorderChecks[p.id] && (
                    <input type="number" min="1" value={reorderQtys[p.id] || 1}
                      onClick={(e) => e.preventDefault()}
                      onChange={(e) => setReorderQtys({ ...reorderQtys, [p.id]: Math.max(1, parseInt(e.target.value) || 1) })}
                      className={`w-16 px-2 py-1 text-xs rounded-lg border text-center ${th.inp}`} />
                  )}
                </label>
              );
            })}
          </div>
          {/* Reorder text box */}
          <div className={`p-4 border-t ${th.bdr}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${th.txf}`}>
              {lang === "id" ? "Draft Pesan" : "Reorder Draft"}
            </p>
            <textarea value={reorderText} onChange={(e) => setReorderText(e.target.value)}
              rows={Math.max(3, Math.min(10, reorderText.split("\n").length))}
              placeholder={lang === "id" ? "Pilih produk di atas untuk otomatis mengisi draft" : "Select products above to auto-fill draft"}
              className={`w-full px-3 py-2 text-xs rounded-xl border font-mono ${th.inp}`} />
            <button
              type="button"
              disabled={!reorderText.trim()}
              onClick={() => {
                navigator.clipboard.writeText(reorderText).then(() => {
                  toast.success(lang === "id" ? "Teks disalin" : "Text copied");
                });
              }}
              className={`mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold ${
                reorderText.trim()
                  ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]"
                  : `${th.txf} ${th.card2} cursor-not-allowed`
              }`}
            >
              <Copy size={12} /> {lang === "id" ? "Salin Teks" : "Copy Text"}
            </button>
            {supplier.phone && (
              <p className={`text-xs mt-2 text-center ${th.txm}`}>
                {lang === "id" ? "Nomor supplier" : "Supplier phone"}: <span className="font-mono font-bold">{supplier.phone}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Unpaid Invoices */}
      {unpaidInvoices.length > 0 && (
        <div className={`rounded-2xl border overflow-hidden mb-3 ${th.bdr} ${th.card2}`}>
          <div className={`px-4 py-2.5 border-b ${th.bdr} flex items-center gap-2`}>
            <CircleDollarSign size={13} className="text-[#D4627A]" />
            <p className={`text-xs font-bold uppercase tracking-wider ${th.txf}`}>{t.unpaidInvoices} ({unpaidInvoices.length})</p>
          </div>
          {unpaidInvoices.map(inv => {
            const prod = products.find(p => p.id === inv.productId);
            const isOverdue = inv.dueDate ? new Date(inv.dueDate).getTime() < now : false;
            return (
              <div key={inv.id} className={`flex items-center justify-between px-4 py-2.5 border-b last:border-0 ${th.bdrSoft}`}>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-bold truncate ${th.tx}`}>
                    {lang === "id" ? prod?.nameId : prod?.name}
                  </p>
                  <p className={`text-xs ${th.txf}`}>
                    {inv.quantity} · {$(inv.unitPrice * inv.quantity)}
                  </p>
                  <p className={`text-xs ${isOverdue ? "text-[#D4627A] font-bold" : th.txm}`}>
                    {t.dueDate}: {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                    {isOverdue && ` · ${t.overdue}`}
                  </p>
                </div>
                {canWrite && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updatePaymentStatus(inv.id, "paid");
                      toast.success(t.paid as string);
                    }}
                    className={`shrink-0 ml-2 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${th.dark ? "bg-[#4A8B3F]/15 text-[#4A8B3F]" : "bg-green-50 text-[#4A8B3F]"}`}
                  >
                    <Check size={10} /> {t.markAsPaid}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stock-In History */}
      <div className={`rounded-2xl border overflow-hidden mb-3 ${th.bdr} ${th.card2}`}>
        <div className={`px-4 py-2.5 border-b ${th.bdr}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${th.txf}`}>{t.stockInHistory} ({supplierMovements.length})</p>
        </div>
        {supplierMovements.length === 0 ? (
          <div className={`px-4 py-6 text-center ${th.txf}`}>
            <p className="text-xs">{t.noStockInHistory}</p>
          </div>
        ) : (
          supplierMovements.slice(0, 10).map(m => {
            const prod = products.find(p => p.id === m.productId);
            return (
              <div key={m.id} className={`flex items-center justify-between px-4 py-2.5 border-b last:border-0 ${th.bdrSoft}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowDownCircle size={13} className="shrink-0 text-[#4A8B3F]" />
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${th.tx}`}>
                      {lang === "id" ? prod?.nameId : prod?.name}
                    </p>
                    <p className={`text-xs ${th.txf}`}>{m.note}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-bold text-[#4A8B3F]`}>+{m.quantity} · {$(m.unitPrice * m.quantity)}</p>
                  <p className={`text-xs ${th.txf}`}>{formatDate(m.createdAt)} {formatTime(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <p className={`text-xs text-center ${th.txf}`}>{t.createdDate}: {formatDate(supplier.createdAt)}</p>
    </Modal>
  );
}
