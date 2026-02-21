import { useMemo } from "react";
import { Modal } from "./Modal";
import { useSupplierStore, useInventoryStore, useProductStore, useAuthStore, useLangStore } from "@/stores";
import { INVENTORY_WRITE_ROLES } from "@/constants";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatDate, formatTime } from "@/utils";
import { Phone, Mail, MapPin, ArrowDownCircle, Check, CircleDollarSign } from "lucide-react";
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
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 ${th.dark ? "bg-[#D4956B]/15" : "bg-[#A0673C]/[0.07]"}`}>
          <span className={`text-2xl font-black ${th.acc}`}>{supplier.name.charAt(0)}</span>
        </div>
        <p className={`text-base font-extrabold tracking-tight ${th.tx}`}>{supplier.name}</p>
      </div>

      {/* Contact Info */}
      <div className={`rounded-2xl border p-4 mb-3 ${th.bdr} ${th.card2}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-2.5 ${th.txf}`}>{t.contactInfo}</p>
        <div className="space-y-2">
          {supplier.phone && (
            <div className="flex items-center gap-2.5">
              <Phone size={13} className={th.txm} />
              <span className={`text-[12px] ${th.tx}`}>{supplier.phone}</span>
            </div>
          )}
          {supplier.email && (
            <div className="flex items-center gap-2.5">
              <Mail size={13} className={th.txm} />
              <span className={`text-[12px] ${th.tx}`}>{supplier.email}</span>
            </div>
          )}
          {supplier.address && (
            <div className="flex items-center gap-2.5">
              <MapPin size={13} className={`shrink-0 ${th.txm}`} />
              <span className={`text-[12px] ${th.tx}`}>{supplier.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Unpaid Invoices */}
      {unpaidInvoices.length > 0 && (
        <div className={`rounded-2xl border overflow-hidden mb-3 ${th.bdr} ${th.card2}`}>
          <div className={`px-4 py-2.5 border-b ${th.bdr} flex items-center gap-2`}>
            <CircleDollarSign size={13} className="text-[#D4627A]" />
            <p className={`text-[10px] font-bold uppercase tracking-wider ${th.txf}`}>{t.unpaidInvoices} ({unpaidInvoices.length})</p>
          </div>
          {unpaidInvoices.map(inv => {
            const prod = products.find(p => p.id === inv.productId);
            const isOverdue = inv.dueDate ? new Date(inv.dueDate).getTime() < now : false;
            return (
              <div key={inv.id} className={`flex items-center justify-between px-4 py-2.5 border-b last:border-0 ${th.bdr}/50`}>
                <div className="min-w-0 flex-1">
                  <p className={`text-[12px] font-bold truncate ${th.tx}`}>
                    {lang === "id" ? prod?.nameId : prod?.name}
                  </p>
                  <p className={`text-[10px] ${th.txf}`}>
                    {inv.quantity} · {$(inv.unitPrice * inv.quantity)}
                  </p>
                  <p className={`text-[10px] ${isOverdue ? "text-[#D4627A] font-bold" : th.txm}`}>
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
                    className={`shrink-0 ml-2 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${th.dark ? "bg-[#4A8B3F]/15 text-[#4A8B3F]" : "bg-green-50 text-[#4A8B3F]"}`}
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
          <p className={`text-[10px] font-bold uppercase tracking-wider ${th.txf}`}>{t.stockInHistory} ({supplierMovements.length})</p>
        </div>
        {supplierMovements.length === 0 ? (
          <div className={`px-4 py-6 text-center ${th.txf}`}>
            <p className="text-[12px]">{t.noStockInHistory}</p>
          </div>
        ) : (
          supplierMovements.slice(0, 10).map(m => {
            const prod = products.find(p => p.id === m.productId);
            return (
              <div key={m.id} className={`flex items-center justify-between px-4 py-2.5 border-b last:border-0 ${th.bdr}/50`}>
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowDownCircle size={13} className="shrink-0 text-[#4A8B3F]" />
                  <div className="min-w-0">
                    <p className={`text-[12px] font-bold truncate ${th.tx}`}>
                      {lang === "id" ? prod?.nameId : prod?.name}
                    </p>
                    <p className={`text-[10px] ${th.txf}`}>{m.note}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[12px] font-bold text-[#4A8B3F]`}>+{m.quantity} · {$(m.unitPrice * m.quantity)}</p>
                  <p className={`text-[10px] ${th.txf}`}>{formatDate(m.createdAt)} {formatTime(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <p className={`text-[10px] text-center ${th.txf}`}>{t.createdDate}: {formatDate(supplier.createdAt)}</p>
    </Modal>
  );
}
