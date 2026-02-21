import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useCategoryStore, useProductStore, useCartStore, useOrderStore, useAuthStore, useBatchStore, useLangStore, useSettingsStore, useMemberStore, useAuditStore, useCashSessionStore } from "@/stores";
import { Modal } from "@/components/Modal";
import { ProductImage } from "@/components/ProductImage";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { CategoryIconMap } from "@/components/icons";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useDebounce } from "@/hooks/useDebounce";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { formatCurrency as $, printReceipt, compressImage, genId, formatTime } from "@/utils";
import Barcode from "react-barcode";
import type { PaymentMethod, UnitType, DiscountType, Product, Order } from "@/types";
import toast from "react-hot-toast";
import {
  Search, ScanLine, ShoppingBag, Minus, Plus, Trash2, ImagePlus, X, UserPlus, Tag, Percent, DollarSign,
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
  const ppnRate = useSettingsStore(s => s.ppnRate);
  const bankAccounts = useSettingsStore(s => s.bankAccounts);
  const members = useMemberStore(s => s.members);
  const addMember = useMemberStore(s => s.addMember);
  const setItemDiscount = useCartStore(s => s.setItemDiscount);
  const setOrderDiscount = useCartStore(s => s.setOrderDiscount);
  const orderDiscountType = useCartStore(s => s.orderDiscountType);
  const orderDiscountValue = useCartStore(s => s.orderDiscountValue);

  const [query, setQuery] = useState("");
  const [discountItemId, setDiscountItemId] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [discountMode, setDiscountMode] = useState<DiscountType>("percent");
  const [showOrderDiscount, setShowOrderDiscount] = useState(false);
  const [orderDiscInput, setOrderDiscInput] = useState("");
  const [orderDiscMode, setOrderDiscMode] = useState<DiscountType>("percent");
  const [memberQuery, setMemberQuery] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const memberDropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 150);
  const [catFilter, setCatFilter] = useState("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cashRcv, setCashRcv] = useState("");
  const [proofImage, setProofImage] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [closeRegisterOpen, setCloseRegisterOpen] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [registerNotes, setRegisterNotes] = useState("");
  const addSession = useCashSessionStore(s => s.addSession);
  const sessions = useCashSessionStore(s => s.sessions);
  const canCloseRegister = user.role === "superadmin" || user.role === "admin" || user.role === "cashier";
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

  // Click outside to close member dropdown
  useEffect(() => {
    if (!showMemberDropdown) return;
    const handle = (e: MouseEvent) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node)) setShowMemberDropdown(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showMemberDropdown]);

  const filteredMembers = useMemo(() => {
    if (!memberQuery.trim()) return members.slice(0, 5);
    const q = memberQuery.trim();
    return members.filter(m => m.phone.includes(q)).slice(0, 5);
  }, [members, memberQuery]);

  const handleAddNewMember = () => {
    if (!newMemberName.trim()) return;
    const member = { id: genId(), name: newMemberName.trim(), phone: newMemberPhone.trim(), createdAt: new Date().toISOString() };
    addMember(member);
    setCustomer(member.name + (member.phone ? ` (${member.phone})` : ""));
    setMemberQuery("");
    setNewMemberName("");
    setNewMemberPhone("");
    setShowAddMember(false);
    setShowMemberDropdown(false);
    toast.success(t.memberAdded as string);
  };

  // Discount-aware calculations
  const calcItemDiscount = (ci: typeof cartItems[0]) => {
    if (!ci.discountType || !ci.discountValue) return 0;
    const gross = ci.unitPrice * ci.quantity;
    return ci.discountType === "percent" ? Math.round(gross * ci.discountValue / 100) : Math.min(ci.discountValue, gross);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const itemDiscountsTotal = useMemo(() => cartItems.reduce((s, i) => s + calcItemDiscount(i), 0), [cartItems]);
  const cartSubtotal = useMemo(() => cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [cartItems]);
  const cartSubtotalAfterItemDisc = cartSubtotal - itemDiscountsTotal;
  const orderDiscAmount = useMemo(() => {
    if (!orderDiscountType || !orderDiscountValue) return 0;
    return orderDiscountType === "percent" ? Math.round(cartSubtotalAfterItemDisc * orderDiscountValue / 100) : Math.min(orderDiscountValue, cartSubtotalAfterItemDisc);
  }, [orderDiscountType, orderDiscountValue, cartSubtotalAfterItemDisc]);
  const discountedSubtotal = cartSubtotalAfterItemDisc - orderDiscAmount;
  const ppnAmount = useMemo(() => Math.round(discountedSubtotal * ppnRate / 100), [discountedSubtotal, ppnRate]);
  const cartTotal = discountedSubtotal + ppnAmount;
  const totalDiscount = itemDiscountsTotal + orderDiscAmount;
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

  // Barcode scanner: auto-add product by SKU
  const handleBarcodeScan = useCallback((scannedCode: string) => {
    const product = products.find(p => p.sku.toUpperCase() === scannedCode.toUpperCase() && p.isActive);
    if (product) {
      handleAddToCart(product, "individual");
      toast.success(`${t.productScanned}: ${lang === "id" ? product.nameId : product.name}`);
      setQuery("");
    } else {
      toast.error(`${t.skuNotFound}: ${scannedCode}`);
    }
  }, [products, handleAddToCart, lang, t.productScanned, t.skuNotFound]);

  useBarcodeScanner({ onScan: handleBarcodeScan });

  // Close Register
  const expectedCash = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return useOrderStore.getState().orders
      .filter(o => o.status === "completed" && o.payment === "cash" && new Date(o.createdAt) >= startOfDay)
      .reduce((s, o) => s + o.total, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeRegisterOpen]);

  const todaySessions = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return sessions.filter(s => new Date(s.closedAt) >= startOfDay);
  }, [sessions]);

  const doCloseRegister = () => {
    const actual = parseFloat(actualCash) || 0;
    const diff = actual - expectedCash;
    addSession({
      id: genId(), date: new Date().toISOString(),
      expectedCash, actualCash: actual, difference: diff,
      notes: registerNotes.trim(), closedBy: user.id,
      closedAt: new Date().toISOString(),
    });
    useAuditStore.getState().log("register_closed", user.id, user.name, `Expected: ${$(expectedCash)} · Actual: ${$(actual)} · Diff: ${$(diff)}`);
    setCloseRegisterOpen(false);
    setActualCash("");
    setRegisterNotes("");
    toast.success(t.registerClosed as string);
  };

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
    const order: Order = {
      id: `ORD-${Date.now().toString(36).toUpperCase()}`,
      items: cartItems.map(ci => {
        const disc = calcItemDiscount(ci);
        return {
          productId: ci.productId, name: ci.name, quantity: ci.quantity,
          unitType: ci.unitType, unitPrice: ci.unitPrice,
          ...(ci.discountType ? { discountType: ci.discountType, discountValue: ci.discountValue, discountAmount: disc } : {}),
        };
      }),
      subtotal: discountedSubtotal, ppnRate, ppn: ppnAmount, total: cartTotal,
      payment, status: "completed" as const,
      customer: customer || (t.walkIn as string),
      createdAt: new Date().toISOString(), createdBy: user.id,
      ...((payment === "qris" || payment === "transfer") && proofImage ? { paymentProof: proofImage } : {}),
      ...(orderDiscountType ? { orderDiscountType, orderDiscountValue, orderDiscount: orderDiscAmount } : {}),
    };
    addOrder(order);
    cartItems.forEach(ci => {
      const delta = ci.unitType === "box" ? ci.quantity * ci.qtyPerBox : ci.quantity;
      adjustStock(ci.productId, -delta);
      consumeFIFO(ci.productId, delta);
    });
    useAuditStore.getState().log("order_created", user.id, user.name, `${order.id} · ${$(order.total)}`);
    setLastOrder(order);
    clearCart();
    setCashRcv("");
    setProofImage("");
    setSelectedBankId("");
    setCheckoutOpen(false);
    setCartOpen(false);
    toast.success(t.orderSuccess as string);
  };

  // Shared cart content renderer
  const renderCartContent = (isPanel: boolean) => (
    <div className="flex flex-col gap-3">
      {/* Member / Customer selector */}
      <div className="relative" ref={memberDropdownRef}>
        <input
          value={customer}
          onChange={e => { setCustomer(e.target.value); setMemberQuery(e.target.value); setShowMemberDropdown(true); }}
          onFocus={() => setShowMemberDropdown(true)}
          placeholder={t.searchMemberPhone as string || t.searchMember as string}
          type="tel" inputMode="tel"
          className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`}
        />
        {showMemberDropdown && (
          <div className={`absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border shadow-lg overflow-hidden ${th.card} ${th.bdr}`}>
            {filteredMembers.length > 0 && filteredMembers.map(m => (
              <button key={m.id} onClick={() => { setCustomer(m.name + (m.phone ? ` (${m.phone})` : "")); setMemberQuery(""); setShowMemberDropdown(false); }}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:opacity-70 border-b last:border-0 ${th.bdr}/50`}>
                <div>
                  <p className={`text-sm font-bold ${th.tx}`}>{m.name}</p>
                  {m.phone && <p className={`text-[11px] ${th.txm}`}>{m.phone}</p>}
                </div>
              </button>
            ))}
            <button onClick={() => { setShowAddMember(true); setShowMemberDropdown(false); setNewMemberName(memberQuery || customer); }}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-2 ${th.acc}`}>
              <UserPlus size={13} />
              <span className="text-sm font-bold">{t.addMember}</span>
            </button>
          </div>
        )}
      </div>

      {/* Add Member mini-modal */}
      {showAddMember && (
        <div className={`rounded-[18px] border p-4 ${th.card2} ${th.bdr}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-extrabold ${th.tx}`}>{t.addMember}</p>
            <button onClick={() => setShowAddMember(false)} className={th.txm}><X size={14} /></button>
          </div>
          <div className="flex flex-col gap-2">
            <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)}
              placeholder={t.memberName as string} className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
            <input value={newMemberPhone} onChange={e => setNewMemberPhone(e.target.value)}
              placeholder={t.memberPhone as string} type="tel" inputMode="tel" className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
            <button onClick={handleAddNewMember} disabled={!newMemberName.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C] disabled:opacity-40">{t.save}</button>
          </div>
        </div>
      )}

      {cartItems.length === 0 ? (
        <div className={`text-center py-10 ${th.txm}`}>
          <ShoppingBag size={40} className="mx-auto opacity-20 mb-3" />
          <p className="font-semibold text-sm">{t.emptyCart}</p>
          <p className={`text-xs mt-1 ${th.txf}`}>{t.emptyCartHint}</p>
        </div>
      ) : cartItems.map(ci => {
        const prod = products.find(p => p.id === ci.productId);
        const itemGross = ci.unitPrice * ci.quantity;
        const itemDisc = calcItemDiscount(ci);
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
                {ci.discountType && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#E89B48]/15 text-[#E89B48]">-{ci.discountType === "percent" ? `${ci.discountValue}%` : $(ci.discountValue || 0)}</span>}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleQtyUpdate(ci.id, -1)} className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${th.elev} ${th.tx}`}><Minus size={12} /></button>
                  <span className={`w-6 text-center text-sm font-extrabold ${th.tx}`}>{ci.quantity}</span>
                  <button onClick={() => handleQtyUpdate(ci.id, 1)} className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${th.elev} ${th.tx}`}><Plus size={12} /></button>
                </div>
                <div className="flex items-center gap-2">
                  {itemDisc > 0 ? (
                    <div className="text-right">
                      <span className={`text-[10px] line-through ${th.txf}`}>{$(itemGross)}</span>
                      <span className={`text-sm font-extrabold ml-1 ${th.tx}`}>{$(itemGross - itemDisc)}</span>
                    </div>
                  ) : (
                    <span className={`text-sm font-extrabold ${th.tx}`}>{$(itemGross)}</span>
                  )}
                  <button onClick={() => { setDiscountItemId(discountItemId === ci.id ? null : ci.id); setDiscountMode(ci.discountType || "percent"); setDiscountInput(ci.discountValue ? String(ci.discountValue) : ""); }}
                    className={`w-6 h-6 rounded-md flex items-center justify-center ${ci.discountType ? "text-[#E89B48]" : th.txf}`}><Tag size={11} /></button>
                  <button onClick={() => removeItem(ci.id)} className="text-[#D4627A]/60 hover:text-[#D4627A]"><Trash2 size={14} /></button>
                </div>
              </div>
              {discountItemId === ci.id && (
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="flex rounded-lg overflow-hidden border">
                    <button onClick={() => setDiscountMode("percent")} className={`px-2 py-1 text-[10px] font-bold ${discountMode === "percent" ? "bg-[#E89B48] text-white" : `${th.elev} ${th.txm}`}`}><Percent size={10} /></button>
                    <button onClick={() => setDiscountMode("fixed")} className={`px-2 py-1 text-[10px] font-bold ${discountMode === "fixed" ? "bg-[#E89B48] text-white" : `${th.elev} ${th.txm}`}`}>Rp</button>
                  </div>
                  <input value={discountInput} onChange={e => setDiscountInput(e.target.value)} type="number" placeholder="0"
                    className={`flex-1 px-2 py-1 text-xs rounded-lg border w-16 ${th.inp}`} />
                  <button onClick={() => { setItemDiscount(ci.id, discountMode, parseFloat(discountInput) || 0); setDiscountItemId(null); }}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold text-white bg-[#E89B48]">{t.save}</button>
                  {ci.discountType && <button onClick={() => { setItemDiscount(ci.id, null, 0); setDiscountItemId(null); }}
                    className="text-[10px] font-bold text-[#C4504A]"><X size={10} /></button>}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {cartItems.length > 0 && <>
        <div className={`p-4 rounded-[18px] ${th.elev}`}>
          <div className="flex justify-between text-sm"><span className={th.txm}>{t.subtotal}</span><span className={`font-semibold ${th.tx}`}>{$(cartSubtotal)}</span></div>
          {itemDiscountsTotal > 0 && (
            <div className="flex justify-between text-sm mt-1"><span className="text-[#E89B48]">{t.itemDiscount}</span><span className="font-semibold text-[#E89B48]">-{$(itemDiscountsTotal)}</span></div>
          )}
          {orderDiscAmount > 0 && (
            <div className="flex justify-between text-sm mt-1"><span className="text-[#E89B48]">{t.orderDiscount}</span><span className="font-semibold text-[#E89B48]">-{$(orderDiscAmount)}</span></div>
          )}
          {ppnRate > 0 && (
            <div className="flex justify-between text-sm mt-1"><span className={th.txm}>{t.ppn} ({ppnRate}%)</span><span className={`font-semibold ${th.tx}`}>{$(ppnAmount)}</span></div>
          )}
          <div className={`flex justify-between text-base pt-3 mt-3 border-t ${th.bdr}`}>
            <span className={`font-extrabold ${th.tx}`}>{t.total}</span>
            <span className={`font-black text-xl ${th.acc}`}>{$(cartTotal)}</span>
          </div>
          {/* Order discount toggle */}
          {!showOrderDiscount && !orderDiscountType ? (
            <button onClick={() => { setShowOrderDiscount(true); setOrderDiscMode("percent"); setOrderDiscInput(""); }}
              className={`mt-2 flex items-center gap-1.5 text-[11px] font-bold ${th.acc}`}>
              <Tag size={11} /> {t.addDiscount}
            </button>
          ) : !showOrderDiscount && orderDiscountType ? (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#E89B48]">{t.orderDiscount}: -{orderDiscountType === "percent" ? `${orderDiscountValue}%` : $(orderDiscountValue)}</span>
              <button onClick={() => { setOrderDiscount(null, 0); }} className="text-[10px] font-bold text-[#C4504A]">{t.removeDiscount}</button>
            </div>
          ) : null}
          {showOrderDiscount && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="flex rounded-lg overflow-hidden border">
                <button onClick={() => setOrderDiscMode("percent")} className={`px-2 py-1 text-[10px] font-bold ${orderDiscMode === "percent" ? "bg-[#E89B48] text-white" : `${th.elev} ${th.txm}`}`}><Percent size={10} /></button>
                <button onClick={() => setOrderDiscMode("fixed")} className={`px-2 py-1 text-[10px] font-bold ${orderDiscMode === "fixed" ? "bg-[#E89B48] text-white" : `${th.elev} ${th.txm}`}`}>Rp</button>
              </div>
              <input value={orderDiscInput} onChange={e => setOrderDiscInput(e.target.value)} type="number" placeholder="0"
                className={`flex-1 px-2 py-1 text-xs rounded-lg border w-16 ${th.inp}`} />
              <button onClick={() => { setOrderDiscount(orderDiscMode, parseFloat(orderDiscInput) || 0); setShowOrderDiscount(false); }}
                className="px-2 py-1 rounded-lg text-[10px] font-bold text-white bg-[#E89B48]">{t.save}</button>
              <button onClick={() => setShowOrderDiscount(false)} className={th.txf}><X size={12} /></button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {(["cash", "card", "transfer", "qris"] as PaymentMethod[]).map(pm => (
            <button key={pm} onClick={() => { setPayment(pm); if (pm !== "qris" && pm !== "transfer") setProofImage(""); if (pm !== "transfer") setSelectedBankId(""); }}
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
        {/* Search + Close Register */}
        <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${th.txf}`} />
          <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder={`${t.search}  ( / )`}
            onKeyDown={e => {
              if (e.key === "Enter" && query.trim()) {
                const product = products.find(p => p.sku.toUpperCase() === query.trim().toUpperCase() && p.isActive);
                if (product) {
                  handleAddToCart(product, "individual");
                  toast.success(`${t.productScanned}: ${lang === "id" ? product.nameId : product.name}`);
                  setQuery("");
                }
              }
            }}
            className={`w-full pl-10 pr-12 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#A0673C]/20 font-medium ${th.inp}`} />
          <ScanLine size={16} className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${th.txf}`} />
        </div>
        {canCloseRegister && (
          <button onClick={() => setCloseRegisterOpen(true)}
            className={`shrink-0 flex items-center justify-center gap-1.5 w-11 sm:w-auto sm:px-3.5 py-3 rounded-2xl text-xs font-bold border ${th.bdr} ${th.txm}`}>
            <DollarSign size={14} /> <span className="hidden sm:inline">{t.closeRegister}</span>
          </button>
        )}
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
                onDetail={setDetailProductId}
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
            {(ppnRate > 0 || totalDiscount > 0) && (
              <p className={`text-[11px] mt-1 ${th.acc} opacity-70`}>
                {t.subtotal}: {$(cartSubtotal)}
                {totalDiscount > 0 && ` - ${t.discount}: ${$(totalDiscount)}`}
                {ppnRate > 0 && ` + ${t.ppn} ${ppnRate}%: ${$(ppnAmount)}`}
              </p>
            )}
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
          {payment === "transfer" && bankAccounts.length > 0 && (
            <div>
              <p className={`text-sm font-bold mb-2 ${th.tx}`}>{t.transferTo}</p>
              <div className="flex flex-col gap-2">
                {bankAccounts.map(acc => {
                  const selected = selectedBankId === acc.id;
                  return (
                    <button key={acc.id} onClick={() => setSelectedBankId(acc.id)}
                      className={`w-full text-left rounded-2xl border p-3.5 transition-all ${
                        selected
                          ? "border-[#A0673C] bg-gradient-to-r from-[#E8B088]/10 to-[#A0673C]/10"
                          : `${th.card2} ${th.bdr}`
                      }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                          selected ? "bg-gradient-to-r from-[#E8B088] to-[#A0673C] text-white" : `${th.accBg} ${th.acc}`
                        }`}>
                          {acc.bankName.split("(")[1]?.replace(")", "").trim().slice(0, 3) || acc.bankName.slice(0, 3).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold truncate ${th.tx}`}>{acc.bankName}</p>
                          <p className={`text-[12px] font-mono mt-0.5 ${th.tx}`}>{acc.accountNumber}</p>
                          <p className={`text-[11px] ${th.txm}`}>{acc.accountHolder}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {(payment === "qris" || payment === "transfer") && (
            <div>
              <p className={`text-sm font-bold mb-1.5 ${th.tx}`}>{t.uploadProof}</p>
              {proofImage ? (
                <div className="relative">
                  <img src={proofImage} alt="proof" className="w-full rounded-2xl border object-cover max-h-48" />
                  <button onClick={() => setProofImage("")}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className={`flex items-center justify-center gap-2 w-full py-4 rounded-2xl border-2 border-dashed cursor-pointer ${th.bdr} ${th.txm}`}>
                  <ImagePlus size={18} />
                  <span className="text-sm font-semibold">{t.chooseImage}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const base64 = await compressImage(file);
                    setProofImage(base64);
                    toast.success(t.proofUploaded as string);
                    e.target.value = "";
                  }} />
                </label>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setCheckoutOpen(false)} className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
            <button onClick={doCheckout} disabled={
              (payment === "cash" && (!cashRcv || parseFloat(cashRcv) < cartTotal)) ||
              (payment === "qris" && !proofImage) ||
              (payment === "transfer" && (!proofImage || (bankAccounts.length > 0 && !selectedBankId)))
            }
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
                <div key={i} className={`py-1.5 ${i > 0 ? `border-t ${th.bdr}` : ""}`}>
                  <div className="flex justify-between">
                    <span className={`text-sm ${th.tx}`}>{item.name} ×{item.quantity}</span>
                    <span className={`text-sm font-bold ${th.tx}`}>{$(item.unitPrice * item.quantity)}</span>
                  </div>
                  {(item.discountAmount || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[11px] text-[#E89B48]">&nbsp;&nbsp;{t.discount} {item.discountType === "percent" ? `${item.discountValue}%` : ""}</span>
                      <span className="text-[11px] font-bold text-[#E89B48]">-{$(item.discountAmount || 0)}</span>
                    </div>
                  )}
                </div>
              ))}
              {(() => {
                const grossSub = lastOrder.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                const itemDiscSum = lastOrder.items.reduce((s, i) => s + (i.discountAmount || 0), 0);
                const orderDisc = lastOrder.orderDiscount || 0;
                const hasDisc = itemDiscSum > 0 || orderDisc > 0;
                return (hasDisc || lastOrder.ppnRate > 0) ? (<>
                  <div className={`flex justify-between pt-2 mt-2 border-t ${th.bdr}`}>
                    <span className={`text-sm ${th.txm}`}>{t.subtotal}</span>
                    <span className={`text-sm font-semibold ${th.tx}`}>{$(grossSub)}</span>
                  </div>
                  {itemDiscSum > 0 && (
                    <div className="flex justify-between py-0.5">
                      <span className="text-sm text-[#E89B48]">{t.itemDiscount}</span>
                      <span className="text-sm font-semibold text-[#E89B48]">-{$(itemDiscSum)}</span>
                    </div>
                  )}
                  {orderDisc > 0 && (
                    <div className="flex justify-between py-0.5">
                      <span className="text-sm text-[#E89B48]">{t.orderDiscount}{lastOrder.orderDiscountType === "percent" ? ` ${lastOrder.orderDiscountValue}%` : ""}</span>
                      <span className="text-sm font-semibold text-[#E89B48]">-{$(orderDisc)}</span>
                    </div>
                  )}
                  {lastOrder.ppnRate > 0 && (
                    <div className="flex justify-between py-0.5">
                      <span className={`text-sm ${th.txm}`}>{t.ppn} ({lastOrder.ppnRate}%)</span>
                      <span className={`text-sm font-semibold ${th.tx}`}>{$(lastOrder.ppn)}</span>
                    </div>
                  )}
                </>) : null;
              })()}
              <div className={`flex justify-between pt-2 mt-2 border-t ${th.bdr}`}>
                <span className={`font-extrabold ${th.tx}`}>{t.total}</span>
                <span className={`font-black text-lg ${th.acc}`}>{$(lastOrder.total)}</span>
              </div>
            </div>
            <div className="flex justify-center">
              <Barcode value={lastOrder.id} format="CODE128" width={1.5} height={40} displayValue={true}
                fontSize={11} font="DM Sans" background="transparent" margin={0} />
            </div>
            <button onClick={() => { printReceipt(lastOrder, { cashierName: user.name }); }}
              className={`w-full py-3 rounded-2xl text-sm font-bold border-2 ${th.bdr} ${th.tx}`}>
              🖨 {t.printReceipt}
            </button>
            <button onClick={() => setLastOrder(null)}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]">{t.close}</button>
          </div>
        )}
      </Modal>
      <ProductDetailModal productId={detailProductId} onClose={() => setDetailProductId(null)} />

      {/* Close Register modal */}
      <Modal open={closeRegisterOpen} onClose={() => { setCloseRegisterOpen(false); setActualCash(""); setRegisterNotes(""); }} title={t.closeRegister as string}>
        <div className="flex flex-col gap-4">
          <div className={`rounded-[18px] border p-4 ${th.card2} ${th.bdr}`}>
            <div className="flex justify-between mb-1">
              <span className={`text-sm ${th.txm}`}>{t.expectedCash}</span>
              <span className={`text-sm font-black ${th.tx}`}>{$(expectedCash)}</span>
            </div>
            <p className={`text-[10px] ${th.txf}`}>{t.cash} orders {t.today?.toString().toLowerCase()}</p>
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.actualCash}</p>
            <input type="number" value={actualCash} onChange={e => setActualCash(e.target.value)}
              placeholder="0" className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`} />
          </div>
          {actualCash && (() => {
            const diff = (parseFloat(actualCash) || 0) - expectedCash;
            const color = diff === 0 ? "text-[#4A8B3F]" : diff > 0 ? "text-[#5B8DEF]" : "text-[#C4504A]";
            const label = diff === 0 ? t.cashBalanced : diff > 0 ? t.cashOver : t.cashShort;
            return (
              <div className="flex justify-between px-1">
                <span className={`text-sm font-bold ${color}`}>{t.cashDifference}: {label}</span>
                <span className={`text-sm font-black ${color}`}>{diff >= 0 ? "+" : ""}{$(diff)}</span>
              </div>
            );
          })()}
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.registerNotes}</p>
            <input value={registerNotes} onChange={e => setRegisterNotes(e.target.value)}
              placeholder={t.note as string} className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setCloseRegisterOpen(false); setActualCash(""); setRegisterNotes(""); }}
              className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
            <button onClick={doCloseRegister} disabled={!actualCash}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C] disabled:opacity-40">{t.confirm}</button>
          </div>

          {/* Today's register history */}
          {todaySessions.length > 0 && (
            <div className={`rounded-[18px] border overflow-hidden ${th.card2} ${th.bdr}`}>
              <div className={`px-4 py-3 border-b ${th.bdr}`}>
                <p className={`text-xs font-extrabold tracking-tight ${th.tx}`}>{t.registerHistory}</p>
              </div>
              {todaySessions.map(s => {
                const diffColor = s.difference === 0 ? "text-[#4A8B3F]" : s.difference > 0 ? "text-[#5B8DEF]" : "text-[#C4504A]";
                return (
                  <div key={s.id} className={`px-4 py-2.5 border-b last:border-0 ${th.bdr}/50`}>
                    <div className="flex justify-between">
                      <span className={`text-sm font-bold ${th.tx}`}>{formatTime(s.closedAt)}</span>
                      <span className={`text-sm font-black ${diffColor}`}>{s.difference >= 0 ? "+" : ""}{$(s.difference)}</span>
                    </div>
                    <p className={`text-[11px] ${th.txm}`}>{t.expectedCash}: {$(s.expectedCash)} · {t.actualCash}: {$(s.actualCash)}</p>
                    {s.notes && <p className={`text-[10px] mt-0.5 ${th.txf}`}>{s.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
