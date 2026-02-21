import { useState } from "react";
import { Modal } from "./Modal";
import { ProductImage } from "./ProductImage";
import { ProductDetailModal } from "./ProductDetailModal";
import { useOrderStore, useProductStore, useAuthStore, useLangStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatDate, formatTime, printReceipt } from "@/utils";
import { Printer, Ban } from "lucide-react";
import Barcode from "react-barcode";
import toast from "react-hot-toast";

interface OrderDetailModalProps {
  orderId: string | null;
  onClose: () => void;
}

export function OrderDetailModal({ orderId, onClose }: OrderDetailModalProps) {
  const th = useThemeClasses();
  const { t } = useLangStore();
  const orders = useOrderStore(s => s.orders);
  const cancelOrder = useOrderStore(s => s.cancelOrder);
  const products = useProductStore(s => s.products);
  const user = useAuthStore(s => s.user);
  const users = useAuthStore(s => s.users);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const canVoid = user && ["superadmin", "admin", "cashier"].includes(user.role);

  const order = orderId ? orders.find(o => o.id === orderId) : null;

  if (!order) return null;

  const statusColor = order.status === "completed"
    ? (th.dark ? "bg-[#4A8B3F]/15 text-[#4A8B3F]" : "bg-green-50 text-[#4A8B3F]")
    : order.status === "pending"
    ? (th.dark ? "bg-[#E8B088]/15 text-[#E8B088]" : "bg-[#FFF5EC] text-[#A0673C]")
    : (th.dark ? "bg-[#C4504A]/15 text-[#C4504A]" : "bg-red-50 text-[#C4504A]");

  const paymentColor = order.payment === "cash"
    ? (th.dark ? "bg-[#4A8B3F]/15 text-[#4A8B3F]" : "bg-green-50 text-[#4A8B3F]")
    : order.payment === "card"
    ? (th.dark ? "bg-[#5B8DEF]/15 text-[#5B8DEF]" : "bg-blue-50 text-[#5B8DEF]")
    : (th.dark ? "bg-[#8B6FC0]/15 text-[#8B6FC0]" : "bg-purple-50 text-[#8B6FC0]");

  return (
    <>
      <Modal open={!!orderId} onClose={onClose} title={t.orderDetail as string}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className={`text-base font-extrabold tracking-tight ${th.tx}`}>{order.id}</p>
            <p className={`text-[11px] mt-0.5 ${th.txf}`}>{formatDate(order.createdAt)} · {formatTime(order.createdAt)}</p>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${statusColor}`}>
            {order.status === "completed" ? t.completed : order.status === "cancelled" ? t.cancelled : t.pending}
          </span>
        </div>

        {/* Customer + Payment */}
        <div className={`rounded-2xl border p-4 mb-3 ${th.bdr} ${th.card2}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-[10px] uppercase tracking-wider ${th.txf}`}>{t.customer}</p>
              <p className={`text-sm font-bold ${th.tx}`}>{order.customer || t.walkIn}</p>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${paymentColor}`}>
              {t[order.payment]}
            </span>
          </div>
          {order.createdBy && (
            <p className={`text-[10px] mt-2 ${th.txf}`}>{t.cashier as string}: {users.find(u => u.id === order.createdBy)?.name || order.createdBy}</p>
          )}
          {order.paymentProof && (
            <div className="mt-3">
              <p className={`text-[10px] uppercase tracking-wider mb-1 ${th.txf}`}>{t.uploadProof}</p>
              <img src={order.paymentProof} alt="Payment proof" className="w-full rounded-xl object-cover" />
            </div>
          )}
        </div>

        {/* Items */}
        <div className={`rounded-2xl border overflow-hidden mb-3 ${th.bdr} ${th.card2}`}>
          <div className={`px-4 py-2.5 border-b ${th.bdr}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${th.txf}`}>{t.orderItems} ({order.items.length})</p>
          </div>
          {order.items.map((item, i) => {
            const prod = products.find(p => p.id === item.productId);
            return (
              <div key={i}
                onClick={() => prod && setDetailProductId(item.productId)}
                className={`flex items-center justify-between px-4 py-2.5 border-b last:border-0 ${prod ? "cursor-pointer active:opacity-70" : ""} ${th.bdr}/50`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  {prod && <ProductImage product={prod} size={28} />}
                  <div className="min-w-0">
                    <p className={`text-[12px] font-bold truncate ${th.tx}`}>{item.name}</p>
                    <p className={`text-[10px] ${th.txf}`}>
                      {item.quantity} × {$(item.unitPrice)}
                      {item.unitType === "box" ? ` (${t.box})` : ""}
                    </p>
                  </div>
                </div>
                <p className={`text-[12px] font-bold shrink-0 ${th.tx}`}>{$(item.quantity * item.unitPrice)}</p>
              </div>
            );
          })}
        </div>

        {/* Pricing */}
        <div className={`rounded-2xl border p-4 mb-4 ${th.bdr} ${th.card2}`}>
          {order.ppnRate > 0 && (
            <>
              <div className="flex justify-between mb-1.5">
                <span className={`text-[12px] ${th.txm}`}>{t.subtotal}</span>
                <span className={`text-[13px] ${th.tx}`}>{$(order.subtotal)}</span>
              </div>
              <div className={`flex justify-between mb-1.5 pb-1.5 border-b ${th.bdr}`}>
                <span className={`text-[12px] ${th.txm}`}>{t.ppn} ({order.ppnRate}%)</span>
                <span className={`text-[13px] ${th.tx}`}>{$(order.ppn)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className={`text-[13px] font-extrabold ${th.tx}`}>{t.total}</span>
            <span className={`text-[15px] font-black ${th.acc}`}>{$(order.total)}</span>
          </div>
        </div>

        {/* Barcode + Print */}
        <div className="flex flex-col items-center gap-3">
          <Barcode value={order.id} format="CODE128" width={1.2} height={35} displayValue={true}
            fontSize={10} font="DM Sans" background="transparent" margin={0} />
          <button
            onClick={() => printReceipt(order, { cashierName: order.createdBy ? (users.find(u => u.id === order.createdBy)?.name) : undefined })}
            className={`flex items-center gap-1.5 text-[11px] font-bold px-4 py-2 rounded-xl ${th.accBg} ${th.acc}`}
          >
            <Printer size={12} />
            {t.printReceipt}
          </button>
        </div>

        {/* Void Order */}
        {canVoid && order.status === "completed" && (
          <div className="mt-4">
            {!showVoidConfirm ? (
              <button onClick={() => setShowVoidConfirm(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-bold text-[#C4504A] border border-[#C4504A]/20">
                <Ban size={13} /> {t.voidOrder}
              </button>
            ) : (
              <div className={`rounded-2xl border p-4 ${th.dark ? "border-[#C4504A]/30 bg-[#C4504A]/10" : "border-red-200 bg-red-50"}`}>
                <p className={`text-sm font-bold mb-3 ${th.dark ? "text-[#E8A0A0]" : "text-[#C4504A]"}`}>{t.voidConfirm}</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowVoidConfirm(false)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
                  <button onClick={() => { cancelOrder(order.id); setShowVoidConfirm(false); toast.success(t.orderVoided as string); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#C4504A]">{t.confirm}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      <ProductDetailModal productId={detailProductId} onClose={() => setDetailProductId(null)} />
    </>
  );
}
