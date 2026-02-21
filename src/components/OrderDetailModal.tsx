import { useState } from "react";
import { Modal } from "./Modal";
import { ProductImage } from "./ProductImage";
import { ProductDetailModal } from "./ProductDetailModal";
import { useOrderStore, useProductStore, useLangStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatDate, formatTime, printReceipt } from "@/utils";
import { Printer } from "lucide-react";
import Barcode from "react-barcode";

interface OrderDetailModalProps {
  orderId: string | null;
  onClose: () => void;
}

export function OrderDetailModal({ orderId, onClose }: OrderDetailModalProps) {
  const th = useThemeClasses();
  const { t } = useLangStore();
  const orders = useOrderStore(s => s.orders);
  const products = useProductStore(s => s.products);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);

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
            {order.status === "completed" ? t.completed : t.pending}
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
            <p className={`text-[10px] mt-2 ${th.txf}`}>{t.cashier as string}: {order.createdBy}</p>
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
            onClick={() => printReceipt(order)}
            className={`flex items-center gap-1.5 text-[11px] font-bold px-4 py-2 rounded-xl ${th.accBg} ${th.acc}`}
          >
            <Printer size={12} />
            {t.printReceipt}
          </button>
        </div>
      </Modal>
      <ProductDetailModal productId={detailProductId} onClose={() => setDetailProductId(null)} />
    </>
  );
}
