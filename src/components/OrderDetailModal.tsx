import { useState } from "react";
import { Modal } from "./Modal";
import { ProductImage } from "./ProductImage";
import { ProductDetailModal } from "./ProductDetailModal";
import { useOrderStore, useProductStore, useAuthStore, useLangStore, useRefundStore, useAuditStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatDate, formatTime, printReceipt } from "@/utils";
import { Printer, Ban, RotateCcw, CheckSquare, Square } from "lucide-react";
import Barcode from "react-barcode";
import toast from "react-hot-toast";
import { genId } from "@/utils";

interface OrderDetailModalProps {
  orderId: string | null;
  onClose: () => void;
}

export function OrderDetailModal({ orderId, onClose }: OrderDetailModalProps) {
  const th = useThemeClasses();
  const { t } = useLangStore();
  const orders = useOrderStore(s => s.orders);
  const cancelOrder = useOrderStore(s => s.cancelOrder);
  const refundOrder = useOrderStore(s => s.refundOrder);
  const addRefund = useRefundStore(s => s.addRefund);
  const products = useProductStore(s => s.products);
  const user = useAuthStore(s => s.user);
  const users = useAuthStore(s => s.users);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [refundSelections, setRefundSelections] = useState<Record<number, number>>({});
  const [refundReason, setRefundReason] = useState("");
  const canVoid = user && ["superadmin", "admin", "cashier"].includes(user.role);
  const canRefund = user && ["superadmin", "admin", "cashier"].includes(user.role);

  const order = orderId ? orders.find(o => o.id === orderId) : null;

  if (!order) return null;

  const statusColor = order.status === "completed"
    ? (th.dark ? "bg-[#4A8B3F]/15 text-[#4A8B3F]" : "bg-green-50 text-[#4A8B3F]")
    : order.status === "pending"
    ? (th.dark ? "bg-[#E8B088]/15 text-[#E8B088]" : "bg-[#FFF5EC] text-[#A0673C]")
    : order.status === "refunded"
    ? (th.dark ? "bg-[#E89B48]/15 text-[#E89B48]" : "bg-amber-50 text-[#E89B48]")
    : (th.dark ? "bg-[#C4504A]/15 text-[#C4504A]" : "bg-red-50 text-[#C4504A]");

  const statusText = order.status === "completed" ? t.completed
    : order.status === "cancelled" ? t.cancelled
    : order.status === "refunded" ? t.refunded
    : t.pending;

  const paymentColor = order.payment === "cash"
    ? (th.dark ? "bg-[#4A8B3F]/15 text-[#4A8B3F]" : "bg-green-50 text-[#4A8B3F]")
    : order.payment === "card"
    ? (th.dark ? "bg-[#5B8DEF]/15 text-[#5B8DEF]" : "bg-blue-50 text-[#5B8DEF]")
    : (th.dark ? "bg-[#8B6FC0]/15 text-[#8B6FC0]" : "bg-purple-50 text-[#8B6FC0]");

  // Refund calculations
  const toggleRefundItem = (idx: number) => {
    setRefundSelections(prev => {
      const next = { ...prev };
      if (next[idx] !== undefined) delete next[idx];
      else next[idx] = order.items[idx].quantity;
      return next;
    });
  };

  const setRefundQty = (idx: number, qty: number) => {
    const max = order.items[idx].quantity;
    setRefundSelections(prev => ({ ...prev, [idx]: Math.min(Math.max(1, qty), max) }));
  };

  const refundAll = () => {
    const sel: Record<number, number> = {};
    order.items.forEach((item, i) => { sel[i] = item.quantity; });
    setRefundSelections(sel);
  };

  const selectedCount = Object.keys(refundSelections).length;
  const isFullRefund = selectedCount === order.items.length &&
    order.items.every((item, i) => refundSelections[i] === item.quantity);

  const refundTotal = Object.entries(refundSelections).reduce((sum, [idx, qty]) => {
    const item = order.items[parseInt(idx)];
    const itemGross = item.unitPrice * qty;
    const disc = item.discountAmount ? Math.round(item.discountAmount * qty / item.quantity) : 0;
    return sum + itemGross - disc;
  }, 0);

  const doRefund = () => {
    if (!user || selectedCount === 0 || !refundReason.trim()) return;
    const refundItems = Object.entries(refundSelections).map(([idx, qty]) => {
      const item = order.items[parseInt(idx)];
      const disc = item.discountAmount ? Math.round(item.discountAmount * qty / item.quantity) : 0;
      return {
        productId: item.productId, name: item.name,
        quantity: qty, unitType: item.unitType,
        unitPrice: item.unitPrice,
        refundAmount: item.unitPrice * qty - disc,
      };
    });
    const refund = {
      id: genId(), orderId: order.id,
      items: refundItems, amount: refundTotal,
      reason: refundReason.trim(),
      createdAt: new Date().toISOString(), createdBy: user.id,
    };
    addRefund(refund);
    if (isFullRefund) refundOrder(order.id);
    useAuditStore.getState().log("order_refunded", user.id, user.name, `${order.id} · ${$(refundTotal)} · ${isFullRefund ? "Full" : "Partial"}`);
    setShowRefund(false);
    setRefundSelections({});
    setRefundReason("");
    toast.success(`${t.refundSuccess} — ${$(refundTotal)}`);
  };

  // Discount display helpers
  const grossSubtotal = order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const itemDiscTotal = order.items.reduce((s, i) => s + (i.discountAmount || 0), 0);
  const orderDisc = order.orderDiscount || 0;
  const hasDiscounts = itemDiscTotal > 0 || orderDisc > 0;

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
            {statusText}
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
            const gross = item.quantity * item.unitPrice;
            const disc = item.discountAmount || 0;
            return (
              <div key={i}
                onClick={() => prod && setDetailProductId(item.productId)}
                className={`px-4 py-2.5 border-b last:border-0 ${prod ? "cursor-pointer active:opacity-70" : ""} ${th.bdr}/50`}>
                <div className="flex items-center justify-between">
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
                  <p className={`text-[12px] font-bold shrink-0 ${th.tx}`}>{$(disc > 0 ? gross - disc : gross)}</p>
                </div>
                {disc > 0 && (
                  <div className="flex justify-between mt-0.5 ml-10">
                    <span className="text-[10px] text-[#E89B48]">
                      {t.discount} {item.discountType === "percent" ? `${item.discountValue}%` : ""}
                    </span>
                    <span className="text-[10px] font-bold text-[#E89B48]">-{$(disc)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pricing */}
        <div className={`rounded-2xl border p-4 mb-4 ${th.bdr} ${th.card2}`}>
          {(hasDiscounts || order.ppnRate > 0) && (
            <>
              <div className="flex justify-between mb-1.5">
                <span className={`text-[12px] ${th.txm}`}>{t.subtotal}</span>
                <span className={`text-[13px] ${th.tx}`}>{$(grossSubtotal)}</span>
              </div>
              {itemDiscTotal > 0 && (
                <div className="flex justify-between mb-1.5">
                  <span className="text-[12px] text-[#E89B48]">{t.itemDiscount}</span>
                  <span className="text-[13px] font-semibold text-[#E89B48]">-{$(itemDiscTotal)}</span>
                </div>
              )}
              {orderDisc > 0 && (
                <div className="flex justify-between mb-1.5">
                  <span className="text-[12px] text-[#E89B48]">{t.orderDiscount}{order.orderDiscountType === "percent" ? ` ${order.orderDiscountValue}%` : ""}</span>
                  <span className="text-[13px] font-semibold text-[#E89B48]">-{$(orderDisc)}</span>
                </div>
              )}
              {order.ppnRate > 0 && (
                <div className={`flex justify-between mb-1.5 pb-1.5 border-b ${th.bdr}`}>
                  <span className={`text-[12px] ${th.txm}`}>{t.ppn} ({order.ppnRate}%)</span>
                  <span className={`text-[13px] ${th.tx}`}>{$(order.ppn)}</span>
                </div>
              )}
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

        {/* Refund Order */}
        {canRefund && order.status === "completed" && !showRefund && (
          <div className="mt-4">
            <button onClick={() => { setShowRefund(true); setRefundSelections({}); setRefundReason(""); }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-bold text-[#E89B48] border border-[#E89B48]/20">
              <RotateCcw size={13} /> {t.refundOrder}
            </button>
          </div>
        )}

        {/* Refund panel */}
        {showRefund && (
          <div className={`mt-4 rounded-2xl border p-4 ${th.dark ? "border-[#E89B48]/30 bg-[#E89B48]/5" : "border-amber-200 bg-amber-50/50"}`}>
            <div className="flex items-center justify-between mb-3">
              <p className={`text-sm font-bold ${th.dark ? "text-[#E89B48]" : "text-amber-700"}`}>{t.selectItemsToRefund}</p>
              <button onClick={refundAll} className="text-[11px] font-bold text-[#E89B48]">{t.refundAll}</button>
            </div>
            {order.items.map((item, idx) => {
              const selected = refundSelections[idx] !== undefined;
              return (
                <div key={idx} className={`flex items-center gap-2.5 py-2 ${idx > 0 ? `border-t ${th.bdr}/30` : ""}`}>
                  <button onClick={() => toggleRefundItem(idx)} className="shrink-0">
                    {selected ? <CheckSquare size={16} className="text-[#E89B48]" /> : <Square size={16} className={th.txf} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-bold truncate ${th.tx}`}>{item.name}</p>
                    <p className={`text-[10px] ${th.txf}`}>{$(item.unitPrice)} × {item.quantity}</p>
                  </div>
                  {selected && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setRefundQty(idx, (refundSelections[idx] || 1) - 1)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${th.elev} ${th.tx}`}>-</button>
                      <span className={`w-5 text-center text-xs font-bold ${th.tx}`}>{refundSelections[idx]}</span>
                      <button onClick={() => setRefundQty(idx, (refundSelections[idx] || 1) + 1)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${th.elev} ${th.tx}`}>+</button>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="mt-3">
              <input value={refundReason} onChange={e => setRefundReason(e.target.value)}
                placeholder={t.refundReason as string}
                className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
            </div>
            {selectedCount > 0 && (
              <div className={`flex justify-between mt-3 pt-3 border-t ${th.bdr}/30`}>
                <span className={`text-sm font-bold ${th.dark ? "text-[#E89B48]" : "text-amber-700"}`}>{t.refundAmount}</span>
                <span className="text-sm font-black text-[#E89B48]">{$(refundTotal)}</span>
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowRefund(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
              <button onClick={doRefund} disabled={selectedCount === 0 || !refundReason.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#E89B48] disabled:opacity-40">{t.confirm}</button>
            </div>
          </div>
        )}

        {/* Void Order */}
        {canVoid && order.status === "completed" && !showRefund && (
          <div className="mt-3">
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
                  <button onClick={() => {
                    cancelOrder(order.id);
                    useAuditStore.getState().log("order_voided", user!.id, user!.name, `${order.id} · ${$(order.total)}`);
                    setShowVoidConfirm(false);
                    toast.success(t.orderVoided as string);
                  }}
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
