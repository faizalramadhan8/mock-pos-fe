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
import { formatCurrency as $, printReceipt, compressImage, genId, formatTime, printBarcodeLabel, printBarcodeLabels } from "@/utils";
import { calcItemDiscount } from "@/utils/calc";
import Barcode from "react-barcode";
import type { PaymentMethod, UnitType, DiscountType, Product, Order, Member } from "@/types";
import toast from "react-hot-toast";
import {
  Search, ScanLine, ShoppingBag, Minus, Plus, Trash2, ImagePlus, X, UserPlus, Tag, Percent, Wallet, FileText, Printer, Barcode as BarcodeIcon,
} from "lucide-react";

export function POSPage() {
  const th = useThemeClasses();
  const { t, lang } = useLangStore();
  const categories = useCategoryStore(s => s.categories);
  const products = useProductStore(s => s.products);
  const adjustStock = useProductStore(s => s.adjustStock);
  const cartItems = useCartStore(s => s.items);
  const customer = useCartStore(s => s.customer);
  const customerPhone = useCartStore(s => s.customerPhone);
  const setCustomerPhone = useCartStore(s => s.setCustomerPhone);
  const payment = useCartStore(s => s.payment);
  const addItem = useCartStore(s => s.addItem);
  const updateQty = useCartStore(s => s.updateQty);
  const removeItem = useCartStore(s => s.removeItem);
  const clearCart = useCartStore(s => s.clearCart);
  const setCustomer = useCartStore(s => s.setCustomer);
  const setPayment = useCartStore(s => s.setPayment);
  const activeMember = useCartStore(s => s.member);
  const setMember = useCartStore(s => s.setMember);
  const addOrder = useOrderStore(s => s.addOrder);
  const allOrders = useOrderStore(s => s.orders);
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
  const PAGE_SIZE = 60;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [shiftDetailOpen, setShiftDetailOpen] = useState(false);
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
  const [newMemberAddress, setNewMemberAddress] = useState("");
  const [newMemberNumber, setNewMemberNumber] = useState("");
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
  const activeSession = useCashSessionStore(s => s.activeSession);
  const openSession = useCashSessionStore(s => s.openSession);
  const closeSession = useCashSessionStore(s => s.closeSession);
  const sessions = useCashSessionStore(s => s.sessions);
  const canManageRegister = user.role === "superadmin" || user.role === "admin" || user.role === "cashier";
  const [openRegisterOpen, setOpenRegisterOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const labelWidth = useSettingsStore(s => s.labelWidth);
  const labelHeight = useSettingsStore(s => s.labelHeight);
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
    const q = memberQuery.trim().toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.phone.includes(memberQuery.trim()) ||
      (m.memberNumber || "").toLowerCase().includes(q),
    ).slice(0, 5);
  }, [members, memberQuery]);

  const handleAddNewMember = () => {
    if (!newMemberName.trim()) return;
    const member: Member = {
      id: genId(),
      name: newMemberName.trim(),
      phone: newMemberPhone.trim(),
      address: newMemberAddress.trim() || undefined,
      memberNumber: newMemberNumber.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    addMember(member);
    setCustomer(member.name + (member.phone ? ` (${member.phone})` : ""));
    setMemberQuery("");
    setNewMemberName("");
    setNewMemberPhone("");
    setNewMemberAddress("");
    setNewMemberNumber("");
    setShowAddMember(false);
    setShowMemberDropdown(false);
    toast.success(t.memberAdded as string);
  };

  // Discount-aware calculations
  const itemDiscountsTotal = useMemo(() => cartItems.reduce((s, i) => s + calcItemDiscount(i), 0), [cartItems]);
  const cartSubtotal = useMemo(() => cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [cartItems]);
  const memberSavings = useMemo(() =>
    activeMember
      ? cartItems.reduce((s, i) =>
          s + (i.regularPrice && i.regularPrice > i.unitPrice ? (i.regularPrice - i.unitPrice) * i.quantity : 0), 0)
      : 0,
    [cartItems, activeMember]
  );
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

  // Reset pagination whenever filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [debouncedQuery, catFilter]);

  const visibleProducts = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

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

  // Barcode scanner: match barcode first, then fall back to SKU
  const handleBarcodeScan = useCallback((scannedCode: string) => {
    const code = scannedCode.toUpperCase();
    const product = products.find(p =>
      p.isActive && (
        (p.barcode && p.barcode.toUpperCase() === code) ||
        p.sku.toUpperCase() === code
      )
    );
    if (product) {
      handleAddToCart(product, "individual");
      toast.success(`${t.productScanned}: ${lang === "id" ? product.nameId : product.name}`);
      setQuery("");
    } else {
      toast.error(`${t.skuNotFound}: ${scannedCode}`);
    }
  }, [products, handleAddToCart, lang, t.productScanned, t.skuNotFound]);

  useBarcodeScanner({ onScan: handleBarcodeScan });

  // Open Register
  const doOpenRegister = () => {
    const opening = parseFloat(openingCashInput) || 0;
    const session: import("@/types").CashSession = {
      id: genId(), date: new Date().toISOString(),
      openingCash: opening, openedBy: user.id, openedAt: new Date().toISOString(),
      expectedCash: 0, actualCash: 0, difference: 0,
      notes: "", closedBy: "", closedAt: "",
    };
    openSession(session);
    useAuditStore.getState().log("register_opened", user.id, user.name, `${t.openingCash}: ${$(opening)}`);
    setOpenRegisterOpen(false);
    setOpeningCashInput("");
    toast.success(t.registerOpened as string);
  };

  // Close Register
  const expectedCash = useMemo(() => {
    const sessionStart = activeSession ? new Date(activeSession.openedAt) : (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })();
    const cashFromOrders = useOrderStore.getState().orders
      .filter(o => o.status === "completed" && o.payment === "cash" && new Date(o.createdAt) >= sessionStart)
      .reduce((s, o) => s + o.total, 0);
    return (activeSession?.openingCash || 0) + cashFromOrders;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeRegisterOpen, activeSession]);

  const sessionOrders = useMemo(() => {
    if (!activeSession) return [];
    const sessionStart = new Date(activeSession.openedAt);
    return allOrders.filter(o => new Date(o.createdAt) >= sessionStart);
  }, [allOrders, activeSession]);

  const todaySessions = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return sessions.filter(s => new Date(s.closedAt) >= startOfDay);
  }, [sessions]);

  const doCloseRegister = () => {
    const actual = parseFloat(actualCash) || 0;
    const diff = actual - expectedCash;
    closeSession({
      expectedCash, actualCash: actual, difference: diff,
      notes: registerNotes.trim(), closedBy: user.id,
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
    let totalSavings = 0;
    const orderItems = cartItems.map(ci => {
      const disc = calcItemDiscount(ci);
      if (activeMember && ci.regularPrice && ci.regularPrice > ci.unitPrice) {
        totalSavings += (ci.regularPrice - ci.unitPrice) * ci.quantity;
      }
      return {
        productId: ci.productId, name: ci.name, quantity: ci.quantity,
        unitType: ci.unitType, unitPrice: ci.unitPrice,
        ...(ci.regularPrice !== undefined ? { regularPrice: ci.regularPrice } : {}),
        ...(ci.discountType ? { discountType: ci.discountType, discountValue: ci.discountValue, discountAmount: disc } : {}),
      };
    });
    const order: Order = {
      id: `ORD-${Date.now().toString(36).toUpperCase()}`,
      items: orderItems,
      subtotal: discountedSubtotal, ppnRate, ppn: ppnAmount, total: cartTotal,
      payment, status: "completed" as const,
      customer: activeMember ? activeMember.name : (customer || (t.walkIn as string)),
      ...(activeMember ? {
        memberId: activeMember.id,
        member: activeMember,
        memberSavings: totalSavings,
      } : (customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {})),
      createdAt: new Date().toISOString(), createdBy: user.id,
      ...((payment === "qris" || payment === "transfer") && proofImage ? { paymentProof: proofImage } : {}),
      ...(orderDiscountType ? { orderDiscountType, orderDiscountValue, orderDiscount: orderDiscAmount } : {}),
    };
    cartItems.forEach(ci => {
      const delta = ci.unitType === "box" ? ci.quantity * ci.qtyPerBox : ci.quantity;
      adjustStock(ci.productId, -delta);
      consumeFIFO(ci.productId, delta);
    });
    addOrder(order).then(saved => {
      // Use backend-assigned ID for audit log so it matches the real order
      useAuditStore.getState().log("order_created", user.id, user.name, `${saved.id} · ${$(saved.total)}`);
      setLastOrder(saved);
    });
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
      {/* Active member badge — shown when member is selected */}
      {activeMember && (
        <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${th.dark ? "bg-[#1E40AF]/15" : "bg-[#EFF6FF]"}`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">💎</span>
            <div className="min-w-0">
              <p className={`text-xs font-extrabold truncate ${th.acc}`}>{activeMember.name}</p>
              <p className={`text-xs ${th.txm}`}>{activeMember.phone} · Member price aktif</p>
              <p className={`text-xs ${th.txm} mt-0.5`}>📱 Struk akan dikirim ke WhatsApp</p>
            </div>
          </div>
          <button onClick={() => setMember(null)} className={`text-xs font-bold px-2 py-1 rounded-lg ${th.txm} hover:opacity-70`}>
            Lepas
          </button>
        </div>
      )}

      {/* Member search (separate from customer details) */}
      {!activeMember && (
        <div className="relative" ref={memberDropdownRef}>
          <input
            value={memberQuery}
            onChange={e => { setMemberQuery(e.target.value); setShowMemberDropdown(true); }}
            onFocus={() => setShowMemberDropdown(true)}
            placeholder={t.searchMemberPhone as string || t.searchMember as string}
            className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`}
          />
          {showMemberDropdown && (
            <div className={`absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border shadow-lg overflow-hidden ${th.card} ${th.bdr}`}>
              {filteredMembers.length > 0 && filteredMembers.map(m => (
                <button key={m.id} onClick={() => { setMember({ id: m.id, name: m.name, phone: m.phone }); setMemberQuery(""); setShowMemberDropdown(false); setCustomer(""); setCustomerPhone(""); }}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:opacity-70 border-b last:border-0 ${th.bdrSoft}`}>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${th.tx}`}>{m.name}</p>
                    <p className={`text-xs ${th.txm} truncate`}>
                      {[m.phone, m.memberNumber && `#${m.memberNumber}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </button>
              ))}
              <button onClick={() => { setShowAddMember(true); setShowMemberDropdown(false); setNewMemberName(memberQuery); }}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-2 ${th.acc}`}>
                <UserPlus size={13} />
                <span className="text-sm font-bold">{t.addMember}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Non-member customer details — separate Name + Phone fields */}
      {!activeMember && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={customer}
            onChange={e => setCustomer(e.target.value)}
            placeholder="Nama customer (opsional)"
            className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`}
          />
          <input
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
            placeholder="Nomor HP (opsional — untuk kirim struk WA)"
            type="tel"
            inputMode="tel"
            className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`}
          />
        </div>
      )}

      {/* Member-mode note field (add customer note after member selected) */}
      {activeMember && (
        <input
          value={customer}
          onChange={e => setCustomer(e.target.value)}
          placeholder="Tambah catatan pelanggan (opsional)"
          className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`}
        />
      )}

      {/* Add Member mini-modal */}
      {showAddMember && (
        <div className={`rounded-[18px] border p-4 ${th.card2} ${th.bdr}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-extrabold ${th.tx}`}>{t.addMember}</p>
            <button onClick={() => setShowAddMember(false)} aria-label="Close" className={th.txm}><X size={14} /></button>
          </div>
          <div className="flex flex-col gap-2">
            <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)}
              placeholder={t.memberName as string} className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
            <input value={newMemberPhone} onChange={e => setNewMemberPhone(e.target.value)}
              placeholder={t.memberPhone as string} type="tel" inputMode="tel" className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
            <input value={newMemberNumber} onChange={e => setNewMemberNumber(e.target.value)}
              placeholder={t.memberNumber as string} className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
            <textarea value={newMemberAddress} onChange={e => setNewMemberAddress(e.target.value)}
              placeholder={t.memberAddress as string} rows={2}
              className={`w-full px-3 py-2.5 text-sm rounded-xl border resize-none ${th.inp}`} />
            <button onClick={handleAddNewMember} disabled={!newMemberName.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] disabled:opacity-40">{t.save}</button>
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
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${th.accBg} ${th.acc}`}>
                  {ci.unitType === "box" ? `${t.box}(${ci.qtyPerBox})` : t.individual}
                </span>
                {ci.regularPrice && ci.regularPrice > ci.unitPrice ? (
                  <>
                    <span className={`text-xs line-through ${th.txf}`}>{$(ci.regularPrice)}</span>
                    <span className={`text-xs font-bold ${th.acc}`}>{$(ci.unitPrice)}</span>
                    <span className="text-xs font-bold px-1 py-0.5 rounded bg-[#1E40AF]/15 text-[#1E40AF]">💎 Member</span>
                  </>
                ) : (
                  <span className={`text-xs ${th.txm}`}>{$(ci.unitPrice)}</span>
                )}
                {ci.discountType && <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-[#E89B48]/15 text-[#E89B48]">-{ci.discountType === "percent" ? `${ci.discountValue}%` : $(ci.discountValue || 0)}</span>}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleQtyUpdate(ci.id, -1)} aria-label="Decrease quantity" className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${th.elev} ${th.tx}`}><Minus size={12} /></button>
                  <span className={`w-6 text-center text-sm font-extrabold ${th.tx}`}>{ci.quantity}</span>
                  <button onClick={() => handleQtyUpdate(ci.id, 1)} aria-label="Increase quantity" className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${th.elev} ${th.tx}`}><Plus size={12} /></button>
                </div>
                <div className="flex items-center gap-2">
                  {itemDisc > 0 ? (
                    <div className="text-right">
                      <span className={`text-xs line-through ${th.txf}`}>{$(itemGross)}</span>
                      <span className={`text-sm font-extrabold ml-1 ${th.tx}`}>{$(itemGross - itemDisc)}</span>
                    </div>
                  ) : (
                    <span className={`text-sm font-extrabold ${th.tx}`}>{$(itemGross)}</span>
                  )}
                  <button onClick={() => { setDiscountItemId(discountItemId === ci.id ? null : ci.id); setDiscountMode(ci.discountType || "percent"); setDiscountInput(ci.discountValue ? String(ci.discountValue) : ""); }}
                    aria-label="Toggle discount" className={`w-6 h-6 rounded-md flex items-center justify-center ${ci.discountType ? "text-[#E89B48]" : th.txf}`}><Tag size={11} /></button>
                  <button onClick={() => removeItem(ci.id)} aria-label="Remove item" className="text-[#D4627A]/60 hover:text-[#D4627A]"><Trash2 size={14} /></button>
                </div>
              </div>
              {discountItemId === ci.id && (
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="flex rounded-lg overflow-hidden border">
                    <button onClick={() => setDiscountMode("percent")} aria-label="Percent discount" className={`px-2 py-1 text-xs font-bold ${discountMode === "percent" ? "bg-[#E89B48] text-white" : `${th.elev} ${th.txm}`}`}><Percent size={10} /></button>
                    <button onClick={() => setDiscountMode("fixed")} aria-label="Fixed discount" className={`px-2 py-1 text-xs font-bold ${discountMode === "fixed" ? "bg-[#E89B48] text-white" : `${th.elev} ${th.txm}`}`}>Rp</button>
                  </div>
                  <input value={discountInput} onChange={e => setDiscountInput(e.target.value)} type="number" placeholder="0"
                    className={`flex-1 px-2 py-1 text-xs rounded-lg border w-16 ${th.inp}`} />
                  <button onClick={() => { setItemDiscount(ci.id, discountMode, parseFloat(discountInput) || 0); setDiscountItemId(null); }}
                    className="px-2 py-1 rounded-lg text-xs font-bold text-white bg-[#E89B48]">{t.save}</button>
                  {ci.discountType && <button onClick={() => { setItemDiscount(ci.id, null, 0); setDiscountItemId(null); }}
                    aria-label="Remove discount" className="text-xs font-bold text-[#C4504A]"><X size={10} /></button>}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {cartItems.length > 0 && <>
        <div className={`p-4 rounded-[18px] ${th.elev}`}>
          <div className="flex justify-between text-sm"><span className={th.txm}>{t.subtotal}</span><span className={`font-semibold ${th.tx}`}>{$(cartSubtotal)}</span></div>
          {memberSavings > 0 && (
            <div className="flex justify-between text-sm mt-1"><span className={th.acc}>💎 Hemat sebagai member</span><span className={`font-semibold ${th.acc}`}>-{$(memberSavings)}</span></div>
          )}
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
              className={`mt-2 flex items-center gap-1.5 text-xs font-bold ${th.acc}`}>
              <Tag size={11} /> {t.addDiscount}
            </button>
          ) : !showOrderDiscount && orderDiscountType ? (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-bold text-[#E89B48]">{t.orderDiscount}: -{orderDiscountType === "percent" ? `${orderDiscountValue}%` : $(orderDiscountValue)}</span>
              <button onClick={() => { setOrderDiscount(null, 0); }} className="text-xs font-bold text-[#C4504A]">{t.removeDiscount}</button>
            </div>
          ) : null}
          {showOrderDiscount && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="flex rounded-lg overflow-hidden border">
                <button onClick={() => setOrderDiscMode("percent")} aria-label="Percent discount" className={`px-2 py-1 text-xs font-bold ${orderDiscMode === "percent" ? "bg-[#E89B48] text-white" : `${th.elev} ${th.txm}`}`}><Percent size={10} /></button>
                <button onClick={() => setOrderDiscMode("fixed")} aria-label="Fixed discount" className={`px-2 py-1 text-xs font-bold ${orderDiscMode === "fixed" ? "bg-[#E89B48] text-white" : `${th.elev} ${th.txm}`}`}>Rp</button>
              </div>
              <input value={orderDiscInput} onChange={e => setOrderDiscInput(e.target.value)} type="number" placeholder="0"
                className={`flex-1 px-2 py-1 text-xs rounded-lg border w-16 ${th.inp}`} />
              <button onClick={() => { setOrderDiscount(orderDiscMode, parseFloat(orderDiscInput) || 0); setShowOrderDiscount(false); }}
                className="px-2 py-1 rounded-lg text-xs font-bold text-white bg-[#E89B48]">{t.save}</button>
              <button onClick={() => setShowOrderDiscount(false)} aria-label="Close" className={th.txf}><X size={12} /></button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {(["cash", "card", "transfer", "qris"] as PaymentMethod[]).map(pm => (
            <button key={pm} onClick={() => { setPayment(pm); if (pm !== "qris" && pm !== "transfer") setProofImage(""); if (pm !== "transfer") setSelectedBankId(""); }}
              className={`py-3 rounded-[14px] text-xs font-bold transition-all ${
                payment === pm ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]" : `border ${th.bdr} ${th.txm}`
              }`}>{t[pm]}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { clearCart(); if (!isPanel) setCartOpen(false); toast(t.cartCleared as string, { icon: "🗑️" }); }}
            className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.clear}</button>
          <button onClick={() => setCheckoutOpen(true)}
            className="flex-[2] py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]">{t.payNow} {$(cartTotal)}</button>
        </div>
      </>}
    </div>
  );

  // Show open register prompt if no active session (for roles that can manage register)
  if (!activeSession && canManageRegister) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${th.accBg}`}>
          <Wallet size={28} className={th.acc} />
        </div>
        <p className={`text-lg font-black mb-2 ${th.tx}`}>{t.registerNotOpen}</p>
        <p className={`text-sm text-center max-w-sm mb-6 ${th.txm}`}>{t.registerNotOpenHint}</p>
        <button onClick={() => setOpenRegisterOpen(true)}
          className="px-8 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]">
          {t.openRegister}
        </button>

        {/* Open Register modal */}
        <Modal open={openRegisterOpen} onClose={() => { setOpenRegisterOpen(false); setOpeningCashInput(""); }} title={t.openRegister as string}>
          <div className="flex flex-col gap-4">
            <div className={`rounded-[20px] p-6 text-center ${th.accBg}`}>
              <Wallet size={28} className={`mx-auto mb-2 ${th.acc}`} />
              <p className={`text-sm font-semibold ${th.acc}`}>{t.openingCashHint}</p>
            </div>
            <div>
              <p className={`text-sm font-bold mb-1.5 ${th.tx}`}>{t.openingCash}</p>
              <input type="number" value={openingCashInput} onChange={e => setOpeningCashInput(e.target.value)}
                placeholder="0" className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`}
                onKeyDown={e => { if (e.key === "Enter") doOpenRegister(); }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setOpenRegisterOpen(false); setOpeningCashInput(""); }}
                className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
              <button onClick={doOpenRegister}
                className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]">{t.confirm}</button>
            </div>
          </div>
        </Modal>

        {/* Today's register history */}
        {todaySessions.length > 0 && (
          <div className={`mt-8 w-full max-w-md rounded-[18px] border overflow-hidden ${th.card2} ${th.bdr}`}>
            <div className={`px-4 py-3 border-b ${th.bdr}`}>
              <p className={`text-xs font-extrabold tracking-tight ${th.tx}`}>{t.registerHistory}</p>
            </div>
            {todaySessions.map(s => {
              const diffColor = s.difference === 0 ? "text-[#4A8B3F]" : s.difference > 0 ? "text-[#5B8DEF]" : "text-[#C4504A]";
              return (
                <div key={s.id} className={`px-4 py-2.5 border-b last:border-0 ${th.bdrSoft}`}>
                  <div className="flex justify-between">
                    <span className={`text-sm font-bold ${th.tx}`}>{formatTime(s.closedAt)}</span>
                    <span className={`text-sm font-black ${diffColor}`}>{s.difference >= 0 ? "+" : ""}{$(s.difference)}</span>
                  </div>
                  <p className={`text-xs ${th.txm}`}>{t.openingCash}: {$(s.openingCash)} · {t.expectedCash}: {$(s.expectedCash)} · {t.actualCash}: {$(s.actualCash)}</p>
                  {s.notes && <p className={`text-xs mt-0.5 ${th.txf}`}>{s.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

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
            className={`w-full pl-10 pr-12 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/20 font-medium ${th.inp}`} />
          <ScanLine size={16} className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${th.txf}`} />
        </div>
        <button onClick={() => setOrderHistoryOpen(true)} aria-label={t.orderHistory as string}
          className={`shrink-0 flex items-center justify-center w-11 py-3 rounded-2xl text-xs font-bold border ${th.bdr} ${th.txm}`}>
          <FileText size={14} />
        </button>
        <button onClick={() => setLabelModalOpen(true)} aria-label="Cetak Label"
          className={`shrink-0 flex items-center justify-center w-11 py-3 rounded-2xl text-xs font-bold border ${th.bdr} ${th.txm}`}>
          <BarcodeIcon size={14} />
        </button>
        {canManageRegister && (
          <button onClick={() => setCloseRegisterOpen(true)} aria-label={t.closeRegister as string}
            className={`shrink-0 flex items-center justify-center gap-1.5 w-11 sm:w-auto sm:px-3.5 py-3 rounded-2xl text-xs font-bold border ${th.bdr} ${th.txm}`}>
            <Wallet size={14} /> <span className="hidden sm:inline">{t.closeRegister}</span>
          </button>
        )}
        </div>

        {/* Shift summary — only this cashier's orders this shift (or today) */}
        {(() => {
          const sessionStart = activeSession
            ? new Date(activeSession.openedAt)
            : (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })();
          const mine = allOrders.filter(o =>
            o.status === "completed" && o.createdBy === user.id && new Date(o.createdAt) >= sessionStart
          );
          const byMethod = { cash: 0, qris: 0, transfer: 0, card: 0 } as Record<string, number>;
          mine.forEach(o => { byMethod[o.payment] = (byMethod[o.payment] || 0) + o.total; });
          const total = mine.reduce((s, o) => s + o.total, 0);
          // Aggregate items sold this shift
          const itemsMap = new Map<string, { name: string; qty: number; total: number }>();
          mine.forEach(o => {
            (o.items || []).forEach(it => {
              const key = it.productId || it.name;
              const prev = itemsMap.get(key) || { name: it.name, qty: 0, total: 0 };
              prev.qty += it.quantity;
              prev.total += it.unitPrice * it.quantity;
              itemsMap.set(key, prev);
            });
          });
          const itemsSold = Array.from(itemsMap.values()).sort((a, b) => b.qty - a.qty);
          return (
            <div className={`rounded-[18px] border p-3.5 mb-5 ${th.card2} ${th.bdr}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-sm font-extrabold ${th.tx}`}>
                  {activeSession ? "Shift Ini" : "Hari Ini"} · {mine.length} transaksi
                </p>
                <p className={`text-base font-black ${th.acc}`}>{$(total)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className={`rounded-xl px-2 py-1.5 text-center ${th.dark ? "bg-[#4A8B3F]/10" : "bg-green-50"}`}>
                  <p className={`text-xs font-semibold text-[#4A8B3F]`}>Tunai</p>
                  <p className={`text-sm font-black text-[#4A8B3F]`}>{$(byMethod.cash || 0)}</p>
                </div>
                <div className={`rounded-xl px-2 py-1.5 text-center ${th.dark ? "bg-[#60A5FA]/10" : "bg-blue-50"}`}>
                  <p className={`text-xs font-semibold ${th.acc}`}>QRIS</p>
                  <p className={`text-sm font-black ${th.acc}`}>{$(byMethod.qris || 0)}</p>
                </div>
                <div className={`rounded-xl px-2 py-1.5 text-center ${th.dark ? "bg-[#E89B48]/10" : "bg-orange-50"}`}>
                  <p className={`text-xs font-semibold text-[#E89B48]`}>Transfer</p>
                  <p className={`text-sm font-black text-[#E89B48]`}>{$((byMethod.transfer || 0) + (byMethod.card || 0))}</p>
                </div>
              </div>
              {itemsSold.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShiftDetailOpen(v => !v)}
                    className={`mt-2.5 w-full text-xs font-bold py-1.5 rounded-lg border ${th.bdr} ${th.txm}`}
                  >
                    {shiftDetailOpen ? "Tutup Rincian" : `Lihat Rincian Barang (${itemsSold.length})`}
                  </button>
                  {shiftDetailOpen && (
                    <div className={`mt-2 border rounded-xl overflow-hidden max-h-60 overflow-y-auto ${th.bdr}`}>
                      {itemsSold.map((it, idx) => (
                        <div key={idx} className={`flex items-center justify-between px-3 py-2 border-b last:border-0 ${th.bdrSoft}`}>
                          <div className="min-w-0 flex-1 mr-2">
                            <p className={`text-xs font-bold truncate ${th.tx}`}>{it.name}</p>
                            <p className={`text-xs ${th.txm}`}>{it.qty}× · {$(it.total)}</p>
                          </div>
                          <span className={`text-sm font-black shrink-0 ${th.acc}`}>{it.qty}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* Category pills with fade gradient */}
        <div className="relative mb-5">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => setCatFilter("all")}
              className={`shrink-0 px-4 py-2.5 rounded-[14px] text-xs font-bold transition-all ${
                catFilter === "all" ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]" : `border ${th.card} ${th.bdr} ${th.txm}`
              }`}>{t.all}</button>
            {categories.map(cat => {
              const Icon = CategoryIconMap[cat.icon];
              const active = catFilter === cat.id;
              return (
                <button key={cat.id} onClick={() => setCatFilter(cat.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-[14px] text-xs font-bold transition-all ${
                    active ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]" : `border ${th.card} ${th.bdr} ${th.txm}`
                  }`}>
                  {Icon && <Icon color={active ? "#fff" : cat.color} size={18} />}
                  {lang === "id" ? cat.nameId : cat.name}
                </button>
              );
            })}
          </div>
          <div className={`absolute right-0 top-0 bottom-1 w-8 pointer-events-none bg-gradient-to-l ${th.dark ? "from-[#020617]" : "from-[#F1F5F9]"}`} />
        </div>

        {/* Products grid */}
        {filtered.length === 0 ? (
          <div className={`text-center py-16 ${th.txm}`}>
            <Search size={40} className="mx-auto opacity-20 mb-3" />
            <p className="font-semibold text-sm">{t.noResults}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
              {visibleProducts.map(p => (
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
            {visibleCount < filtered.length && (
              <div className="flex justify-center pb-28 lg:pb-4">
                <button
                  onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                  className={`px-6 py-2.5 rounded-full text-sm font-semibold ${th.card} ${th.bdr} border ${th.tx} hover:opacity-80 transition`}
                >
                  Load more ({filtered.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
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
            className="w-full flex items-center justify-between text-white px-5 py-3.5 rounded-[20px] bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] shadow-[0_8px_30px_rgba(160,103,60,0.3)] active:scale-[0.98] transition-transform">
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
              <p className={`text-xs mt-1 ${th.acc} opacity-70`}>
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
                          ? "border-[#1E40AF] bg-gradient-to-r from-[#60A5FA]/10 to-[#1E40AF]/10"
                          : `${th.card2} ${th.bdr}`
                      }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 ${
                          selected ? "bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] text-white" : `${th.accBg} ${th.acc}`
                        }`}>
                          {acc.bankName.split("(")[1]?.replace(")", "").trim().slice(0, 3) || acc.bankName.slice(0, 3).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold truncate ${th.tx}`}>{acc.bankName}</p>
                          <p className={`text-xs font-mono mt-0.5 ${th.tx}`}>{acc.accountNumber}</p>
                          <p className={`text-xs ${th.txm}`}>{acc.accountHolder}</p>
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
              <p className={`text-sm font-bold mb-1.5 ${th.tx}`}>
                {t.uploadProof} <span className={`font-normal text-xs ${th.txm}`}>(opsional)</span>
              </p>
              {proofImage ? (
                <div className="relative">
                  <img src={proofImage} alt="proof" className="w-full rounded-2xl border object-cover max-h-48" />
                  <button onClick={() => setProofImage("")} aria-label="Remove image"
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div
                  className={`flex flex-col items-center justify-center gap-1.5 w-full py-4 rounded-2xl border-2 border-dashed ${th.bdr} ${th.txm}`}
                  onPaste={async (e) => {
                    const item = e.clipboardData.items[0];
                    if (item?.type.startsWith("image/")) {
                      const file = item.getAsFile();
                      if (file) {
                        const base64 = await compressImage(file);
                        setProofImage(base64);
                        toast.success(t.proofUploaded as string);
                      }
                    }
                  }}
                  tabIndex={0}
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    <ImagePlus size={18} />
                    <span className="text-sm font-semibold">{t.chooseImage}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const base64 = await compressImage(file);
                      setProofImage(base64);
                      toast.success(t.proofUploaded as string);
                      e.target.value = "";
                    }} />
                  </label>
                  <span className={`text-xs ${th.txf}`}>atau Ctrl+V untuk paste screenshot</span>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setCheckoutOpen(false)} className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
            <button onClick={doCheckout} disabled={
              (payment === "cash" && (!cashRcv || parseFloat(cashRcv) < cartTotal)) ||
              (payment === "transfer" && bankAccounts.length > 0 && !selectedBankId)
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
                      <span className="text-xs text-[#E89B48]">&nbsp;&nbsp;{t.discount} {item.discountType === "percent" ? `${item.discountValue}%` : ""}</span>
                      <span className="text-xs font-bold text-[#E89B48]">-{$(item.discountAmount || 0)}</span>
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
              className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]">{t.close}</button>
          </div>
        )}
      </Modal>
      {/* Order History modal */}
      <Modal open={labelModalOpen} onClose={() => { setLabelModalOpen(false); setLabelSearch(""); setSelectedLabels(new Set()); }} title="Cetak Label Barcode">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${th.txf}`} />
            <input autoFocus value={labelSearch} onChange={e => setLabelSearch(e.target.value)}
              placeholder="Cari nama produk / SKU / barcode…"
              className={`w-full pl-10 pr-3 py-3 text-sm rounded-2xl border ${th.inp}`} />
          </div>
          <p className={`text-xs ${th.txm}`}>
            Ukuran label: {labelWidth}mm × {labelHeight}mm · Centang produk lalu tekan Cetak.
          </p>
          <div className={`border rounded-2xl overflow-hidden max-h-[50vh] overflow-y-auto ${th.bdr}`}>
            {(() => {
              const q = labelSearch.trim().toLowerCase();
              const list = q
                ? products.filter(p => p.isActive && (
                    p.name.toLowerCase().includes(q) ||
                    p.nameId.toLowerCase().includes(q) ||
                    p.sku.toLowerCase().includes(q) ||
                    (p.barcode || "").toLowerCase().includes(q)
                  ))
                : products.filter(p => p.isActive);
              if (list.length === 0) {
                return <p className={`text-sm text-center py-6 ${th.txf}`}>Tidak ada produk</p>;
              }
              return list.map(p => {
                const checked = selectedLabels.has(p.id);
                return (
                  <label key={p.id} className={`flex items-center gap-3 px-3 py-2.5 border-b last:border-0 cursor-pointer ${th.bdrSoft}`}>
                    <input type="checkbox" checked={checked}
                      onChange={e => {
                        const next = new Set(selectedLabels);
                        if (e.target.checked) next.add(p.id); else next.delete(p.id);
                        setSelectedLabels(next);
                      }}
                      className="w-4 h-4 rounded accent-[#1E40AF] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold truncate ${th.tx}`}>{lang === "id" ? p.nameId : p.name}</p>
                      <p className={`text-xs font-mono ${th.txf}`}>{p.sku}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        printBarcodeLabel(p, lang, { width: labelWidth, height: labelHeight });
                        toast.success("Label dicetak");
                      }}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border ${th.bdr} ${th.acc}`}
                    >
                      <Printer size={12} /> 1
                    </button>
                  </label>
                );
              });
            })()}
          </div>
          {selectedLabels.size > 0 && (
            <div className={`flex items-center justify-between gap-3 pt-2 border-t ${th.bdr}`}>
              <button
                type="button"
                onClick={() => setSelectedLabels(new Set())}
                className={`text-xs font-bold ${th.txm} underline`}
              >
                Batal ({selectedLabels.size})
              </button>
              <button
                type="button"
                onClick={() => {
                  const size = { width: labelWidth, height: labelHeight };
                  const picks = products.filter(p => selectedLabels.has(p.id));
                  printBarcodeLabels(picks, lang, size);
                  toast.success(`${picks.length} label dicetak`);
                  setSelectedLabels(new Set());
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]`}
              >
                <Printer size={12} /> Cetak {selectedLabels.size} Label
              </button>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={orderHistoryOpen} onClose={() => setOrderHistoryOpen(false)} title={t.orderHistory as string}>
        <div className="flex flex-col gap-2">
          {sessionOrders.length === 0 ? (
            <div className={`text-center py-10 ${th.txm}`}>
              <FileText size={36} className="mx-auto opacity-20 mb-3" />
              <p className="font-semibold text-sm">{t.noOrderHistory}</p>
            </div>
          ) : sessionOrders.map(o => {
            const statusColor = o.status === "completed" ? "text-[#4A8B3F]" : o.status === "cancelled" ? "text-[#C4504A]" : o.status === "refunded" ? "text-[#E89B48]" : th.txm;
            const statusLabel = t[o.status as keyof typeof t] as string || o.status;
            return (
              <div key={o.id} className={`rounded-[16px] border p-3.5 ${th.card2} ${th.bdr}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-mono font-bold ${th.tx}`}>{o.id}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${statusColor}`}>{statusLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${th.txm}`}>{formatTime(o.createdAt)} · {o.customer}</span>
                  <span className={`text-sm font-black ${th.acc}`}>{$(o.total)}</span>
                </div>
                <div className={`mt-1.5 pt-1.5 border-t ${th.bdrSoft}`}>
                  {o.items.map((item, i) => (
                    <p key={i} className={`text-xs ${th.txm}`}>{item.name} ×{item.quantity} — {$(item.unitPrice * item.quantity)}</p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      <ProductDetailModal productId={detailProductId} onClose={() => setDetailProductId(null)} />

      {/* Close Register modal */}
      <Modal open={closeRegisterOpen} onClose={() => { setCloseRegisterOpen(false); setActualCash(""); setRegisterNotes(""); }} title={t.closeRegister as string}>
        <div className="flex flex-col gap-4">
          <div className={`rounded-[18px] border p-4 ${th.card2} ${th.bdr}`}>
            {activeSession && (
              <div className={`flex justify-between mb-1.5 pb-1.5 border-b ${th.bdrSoft}`}>
                <span className={`text-sm ${th.txm}`}>{t.openingCash}</span>
                <span className={`text-sm font-bold ${th.tx}`}>{$(activeSession.openingCash)}</span>
              </div>
            )}
            <div className="flex justify-between mb-1">
              <span className={`text-sm ${th.txm}`}>{t.expectedCash}</span>
              <span className={`text-sm font-black ${th.tx}`}>{$(expectedCash)}</span>
            </div>
            <p className={`text-xs ${th.txf}`}>{activeSession ? `${t.openingCash} + ${t.cash} orders` : `${t.cash} orders ${t.today?.toString().toLowerCase()}`}</p>
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
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] disabled:opacity-40">{t.confirm}</button>
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
                  <div key={s.id} className={`px-4 py-2.5 border-b last:border-0 ${th.bdrSoft}`}>
                    <div className="flex justify-between">
                      <span className={`text-sm font-bold ${th.tx}`}>{formatTime(s.closedAt)}</span>
                      <span className={`text-sm font-black ${diffColor}`}>{s.difference >= 0 ? "+" : ""}{$(s.difference)}</span>
                    </div>
                    <p className={`text-xs ${th.txm}`}>{t.openingCash}: {$(s.openingCash)} · {t.expectedCash}: {$(s.expectedCash)} · {t.actualCash}: {$(s.actualCash)}</p>
                    {s.notes && <p className={`text-xs mt-0.5 ${th.txf}`}>{s.notes}</p>}
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
