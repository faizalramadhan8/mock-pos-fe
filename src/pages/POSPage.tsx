import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useCategoryStore, useProductStore, useCartStore, useOrderStore, useAuthStore, useBatchStore, useLangStore } from "@/stores";
import { Modal } from "@/components/Modal";
import { ProductImage } from "@/components/ProductImage";
import { ProductCard } from "@/components/ProductCard";
import { CategoryIconMap } from "@/components/icons";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency as $, printReceipt } from "@/utils";
import type { PaymentMethod, UnitType, Product, Order } from "@/types";
import toast from "react-hot-toast";
import {
  Search, ShoppingBag, Minus, Plus, Trash2,
} from "lucide-react";

export function POSPage() {
  const th = useThemeClasses();
  const { t, lang } = useLangStore();
  const categories = useCategoryStore(s => s.categories);
  const products = useProductStore(s => s.products);
  const adjustStock = useProductStore(s => s.adjustStock);
  const cartItems = useCartStore(s => s.items);
  const customer = useCartStore(s => s.customer);
  const payment = useCartStore(s => s.payment);
  const addItem = useCartStore(s => s.addItem);
  const updateQty = useCartStore(s => s.updateQty);
  const removeItem = useCartStore(s => s.removeItem);
  const clearCart = useCartStore(s => s.clearCart);
  const setCustomer = useCartStore(s => s.setCustomer);
  const setPayment = useCartStore(s => s.setPayment);
  const addOrder = useOrderStore(s => s.addOrder);
  const consumeFIFO = useBatchStore(s => s.consumeFIFO);
  const user = useAuthStore(s => s.user)!;

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 150);
  const [catFilter, setCatFilter] = useState("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cashRcv, setCashRcv] = useState("");
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  const cartTotal = useMemo(() => cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [cartItems]);
  const cartCount = useMemo(() => cartItems.reduce((s, i) => s + i.quantity, 0), [cartItems]);

  const filtered = useMemo(() => products.filter(p => {
    const name = (lang === "id" ? p.nameId : p.name).toLowerCase();
    return p.isActive && (name.includes(debouncedQuery.toLowerCase()) || p.sku.toLowerCase().includes(debouncedQuery.toLowerCase()))
      && (catFilter === "all" || p.category === catFilter);
  }), [products, debouncedQuery, catFilter, lang]);

  // Cart quantity validation
  const handleAddToCart = useCallback((product: Product, unitType: UnitType) => {
    const currentInCart = useCartStore.getState().items
      .filter(i => i.productId === product.id)
      .reduce((sum, i) => sum + (i.unitType === "box" ? i.quantity * i.qtyPerBox : i.quantity), 0);
    const addingPcs = unitType === "box" ? product.qtyPerBox : 1;

    if (currentInCart + addingPcs > product.stock) {
      toast.error(t.insufficientStock as string);
      return;
    }
    addItem(product, unitType, lang);
  }, [addItem, lang, t.insufficientStock]);

  const handleQtyUpdate = useCallback((itemId: string, delta: number) => {
    if (delta > 0) {
      const item = cartItems.find(i => i.id === itemId);
      if (item) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const currentPcs = cartItems
            .filter(i => i.productId === item.productId)
            .reduce((sum, i) => sum + (i.unitType === "box" ? i.quantity * i.qtyPerBox : i.quantity), 0);
          const addingPcs = item.unitType === "box" ? item.qtyPerBox : 1;
          if (currentPcs + addingPcs > product.stock) {
            toast.error(t.insufficientStock as string);
            return;
          }
        }
      }
    }
    updateQty(itemId, delta);
  }, [cartItems, products, updateQty, t.insufficientStock]);

  const doCheckout = () => {
    const order = {
      id: `ORD-${Date.now().toString(36).toUpperCase()}`,
      items: cartItems.map(ci => ({ productId: ci.productId, name: ci.name, quantity: ci.quantity, unitType: ci.unitType, unitPrice: ci.unitPrice })),
      total: cartTotal, payment, status: "completed" as const,
      customer: customer || (t.walkIn as string),
      createdAt: new Date().toISOString(), createdBy: user.id,
    };
    addOrder(order);
    cartItems.forEach(ci => {
      const delta = ci.unitType === "box" ? ci.quantity * ci.qtyPerBox : ci.quantity;
      adjustStock(ci.productId, -delta);
      consumeFIFO(ci.productId, delta);
    });
    setLastOrder(order);
    clearCart();
    setCashRcv("");
    setCheckoutOpen(false);
    setCartOpen(false);
    toast.success(t.orderSuccess as string);
  };

  // Shared cart content renderer
  const renderCartContent = (isPanel: boolean) => (
    <div className="flex flex-col gap-3">
      <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder={t.customer as string}
        className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`} />

      {cartItems.length === 0 ? (
        <div className={`text-center py-10 ${th.txm}`}>
          <ShoppingBag size={40} className="mx-auto opacity-20 mb-3" />
          <p className="font-semibold text-sm">{t.emptyCart}</p>
          <p className={`text-xs mt-1 ${th.txf}`}>{t.emptyCartHint}</p>
        </div>
      ) : cartItems.map(ci => {
        const prod = products.find(p => p.id === ci.productId);
        return (
          <div key={ci.id} className={`flex gap-3 p-3 rounded-[18px] border ${th.card2} ${th.bdr}`}>
            {prod && <ProductImage product={prod} size={40} />}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${th.tx}`}>{ci.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${th.accBg} ${th.acc}`}>
                  {ci.unitType === "box" ? `${t.box}(${ci.qtyPerBox})` : t.individual}
                </span>
                <span className={`text-[11px] ${th.txm}`}>{$(ci.unitPrice)}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleQtyUpdate(ci.id, -1)} className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${th.elev} ${th.tx}`}><Minus size={12} /></button>
                  <span className={`w-6 text-center text-sm font-extrabold ${th.tx}`}>{ci.quantity}</span>
                  <button onClick={() => handleQtyUpdate(ci.id, 1)} className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${th.elev} ${th.tx}`}><Plus size={12} /></button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-extrabold ${th.tx}`}>{$(ci.unitPrice * ci.quantity)}</span>
                  <button onClick={() => removeItem(ci.id)} className="text-[#D4627A]/60 hover:text-[#D4627A]"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {cartItems.length > 0 && <>
        <div className={`p-4 rounded-[18px] ${th.elev}`}>
          <div className="flex justify-between text-sm"><span className={th.txm}>{t.subtotal}</span><span className={`font-semibold ${th.tx}`}>{$(cartTotal)}</span></div>
          <div className={`flex justify-between text-base pt-3 mt-3 border-t ${th.bdr}`}>
            <span className={`font-extrabold ${th.tx}`}>{t.total}</span>
            <span className={`font-black text-xl ${th.acc}`}>{$(cartTotal)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(["cash", "card", "transfer"] as PaymentMethod[]).map(pm => (
            <button key={pm} onClick={() => setPayment(pm)}
              className={`py-3 rounded-[14px] text-xs font-bold transition-all ${
                payment === pm ? "text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]" : `border ${th.bdr} ${th.txm}`
              }`}>{t[pm]}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { clearCart(); if (!isPanel) setCartOpen(false); toast(t.cartCleared as string, { icon: "🗑️" }); }}
            className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.clear}</button>
          <button onClick={() => setCheckoutOpen(true)}
            className="flex-[2] py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]">{t.payNow} {$(cartTotal)}</button>
        </div>
      </>}
    </div>
  );

  return (
    <div className="lg:flex lg:gap-5">
      {/* Left: products */}
      <div className="flex-1 min-w-0">
        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${th.txf}`} />
          <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder={`${t.search}  ( / )`}
            className={`w-full pl-10 pr-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#A0673C]/20 font-medium ${th.inp}`} />
        </div>

        {/* Category pills with fade gradient */}
        <div className="relative mb-5">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => setCatFilter("all")}
              className={`shrink-0 px-4 py-2.5 rounded-[14px] text-xs font-bold transition-all ${
                catFilter === "all" ? "text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]" : `border ${th.card} ${th.bdr} ${th.txm}`
              }`}>{t.all}</button>
            {categories.map(cat => {
              const Icon = CategoryIconMap[cat.icon];
              const active = catFilter === cat.id;
              return (
                <button key={cat.id} onClick={() => setCatFilter(cat.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-[14px] text-xs font-bold transition-all ${
                    active ? "text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]" : `border ${th.card} ${th.bdr} ${th.txm}`
                  }`}>
                  {Icon && <Icon color={active ? "#fff" : cat.color} size={18} />}
                  {lang === "id" ? cat.nameId : cat.name}
                </button>
              );
            })}
          </div>
          <div className={`absolute right-0 top-0 bottom-1 w-8 pointer-events-none bg-gradient-to-l ${th.dark ? "from-[#12100E]" : "from-[#F8F3ED]"}`} />
        </div>

        {/* Products grid */}
        {filtered.length === 0 ? (
          <div className={`text-center py-16 ${th.txm}`}>
            <Search size={40} className="mx-auto opacity-20 mb-3" />
            <p className="font-semibold text-sm">{t.noResults}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-28 lg:pb-4">
            {filtered.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                inCart={cartItems.some(c => c.productId === p.id)}
                lang={lang}
                t={t}
                onAdd={handleAddToCart}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right: cart side panel (desktop only) */}
      <div className={`hidden lg:flex lg:flex-col lg:w-[380px] lg:sticky lg:top-[68px] lg:max-h-[calc(100vh-148px)] lg:rounded-[22px] lg:border lg:overflow-hidden ${th.card} ${th.bdr}`}>
        <div className={`px-5 py-3.5 border-b ${th.bdr} flex items-center justify-between`}>
          <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.cart} · {cartCount}</p>
          <p className={`text-sm font-black ${th.acc}`}>{$(cartTotal)}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {renderCartContent(true)}
        </div>
      </div>

      {/* Mobile floating cart bar */}
      {cartCount > 0 && (
        <div className="lg:hidden fixed bottom-20 left-4 right-4 z-30">
          <button onClick={() => setCartOpen(true)}
            className="w-full flex items-center justify-between text-white px-5 py-3.5 rounded-[20px] bg-gradient-to-r from-[#E8B088] to-[#A0673C] shadow-[0_8px_30px_rgba(160,103,60,0.3)] active:scale-[0.98] transition-transform">
            <span className="flex items-center gap-2.5">
              <ShoppingBag size={18} />
              <span className="font-bold text-sm">{t.cart} · {cartCount}</span>
            </span>
            <span className="font-black text-lg tracking-tight">{$(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* Mobile cart modal */}
      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title={`${t.cart} · ${cartCount}`}>
        {renderCartContent(false)}
      </Modal>

      {/* Checkout modal */}
      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title={t.checkout as string}>
        <div className="flex flex-col gap-4">
          <div className={`rounded-[20px] p-6 text-center ${th.accBg}`}>
            <p className={`text-xs font-semibold ${th.acc}`}>{t.totalAmount}</p>
            <p className={`text-[32px] font-black tracking-tight mt-1 ${th.acc}`}>{$(cartTotal)}</p>
          </div>
          {payment === "cash" && (
            <div>
              <p className={`text-sm font-bold mb-1.5 ${th.tx}`}>{t.cashReceived}</p>
              <input type="number" value={cashRcv} onChange={e => setCashRcv(e.target.value)} placeholder="0"
                className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`}
                onKeyDown={e => { if (e.key === "Enter" && parseFloat(cashRcv) >= cartTotal) doCheckout(); }} />
              {parseFloat(cashRcv) >= cartTotal && (
                <p className="text-sm font-bold text-[#4A8B3F] mt-2">{t.change}: {$(parseFloat(cashRcv) - cartTotal)}</p>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setCheckoutOpen(false)} className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
            <button onClick={doCheckout} disabled={payment === "cash" && (!cashRcv || parseFloat(cashRcv) < cartTotal)}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-[#4A8B3F] disabled:opacity-40">{t.confirm}</button>
          </div>
        </div>
      </Modal>

      {/* Receipt modal (after successful checkout) */}
      <Modal open={!!lastOrder} onClose={() => setLastOrder(null)} title={t.receipt as string}>
        {lastOrder && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#4A8B3F]/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">✓</span>
              </div>
              <p className={`text-lg font-black ${th.tx}`}>{t.orderSuccess}</p>
              <p className={`text-sm ${th.txm}`}>{lastOrder.id}</p>
            </div>
            <div className={`rounded-[18px] border p-4 ${th.card2} ${th.bdr}`}>
              {lastOrder.items.map((item, i) => (
                <div key={i} className={`flex justify-between py-1.5 ${i > 0 ? `border-t ${th.bdr}` : ""}`}>
                  <span className={`text-sm ${th.tx}`}>{item.name} ×{item.quantity}</span>
                  <span className={`text-sm font-bold ${th.tx}`}>{$(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
              <div className={`flex justify-between pt-2 mt-2 border-t ${th.bdr}`}>
                <span className={`font-extrabold ${th.tx}`}>{t.total}</span>
                <span className={`font-black text-lg ${th.acc}`}>{$(lastOrder.total)}</span>
              </div>
            </div>
            <button onClick={() => { printReceipt(lastOrder); }}
              className={`w-full py-3 rounded-2xl text-sm font-bold border-2 ${th.bdr} ${th.tx}`}>
              🖨 {t.printReceipt}
            </button>
            <button onClick={() => setLastOrder(null)}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]">{t.close}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
