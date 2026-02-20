import { useState, useMemo } from "react";
import { useCategoryStore, useProductStore, useInventoryStore, useBatchStore, useAuthStore, useLangStore } from "@/stores";
import { INVENTORY_WRITE_ROLES } from "@/constants";
import { Modal } from "@/components/Modal";
import { ProductImage } from "@/components/ProductImage";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatTime, genId, printBarcodeLabel } from "@/utils";
import type { UnitType, StockType, StockMovement } from "@/types";
import toast from "react-hot-toast";
import {
  Package, Plus, ChevronDown, ArrowDownCircle, ArrowUpCircle, Barcode,
  LayoutGrid, Clock, AlertTriangle,
} from "lucide-react";

type InventoryTab = "overview" | "stockIn" | "stockOut" | "expiry" | "history";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDateLabel(dateStr: string, t: Record<string, any>): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return t.today as string;
  if (date.toDateString() === yesterday.toDateString()) return t.yesterday as string;
  return date.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

export function InventoryPage() {
  const th = useThemeClasses();
  const { t, lang } = useLangStore();
  const { categories, addCategory } = useCategoryStore();
  const products = useProductStore(s => s.products);
  const adjustStock = useProductStore(s => s.adjustStock);
  const addProduct = useProductStore(s => s.addProduct);
  const toggleActive = useProductStore(s => s.toggleActive);
  const { movements, addMovement, totalIn, totalOut } = useInventoryStore();
  const { addBatch, consumeFIFO, getExpiringBatches } = useBatchStore();
  const batches = useBatchStore(s => s.batches);
  const user = useAuthStore(s => s.user)!;
  const canWrite = INVENTORY_WRITE_ROLES.includes(user.role);

  const [activeTab, setActiveTab] = useState<InventoryTab>("overview");
  const [stockModal, setStockModal] = useState<StockType | null>(null);
  const [form, setForm] = useState({ prod: "", qty: "", unit: "individual" as UnitType, price: "", note: "", expiryDate: "" });
  const [addProdOpen, setAddProdOpen] = useState(false);
  const [newProd, setNewProd] = useState({ name: "", nameId: "", sku: "", category: "c1", priceIndividual: "", priceBox: "", qtyPerBox: "12", stock: "0", unit: "kg", image: "", minStock: "10" });
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", nameId: "", color: "#C4884A" });
  const catColors = ["#C4884A", "#D4627A", "#5B8DEF", "#7D5A44", "#8B6FC0", "#6F9A4D", "#E89B48", "#2BA5B5", "#9B59B6", "#E74C3C"];
  const [overviewFilter, setOverviewFilter] = useState<"all" | "low" | "out" | "inactive">("all");

  // Tab definitions
  const tabs: { id: InventoryTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: t.invOverview as string, icon: <LayoutGrid size={14} /> },
    { id: "stockIn", label: t.invStockIn as string, icon: <ArrowDownCircle size={14} /> },
    { id: "stockOut", label: t.invStockOut as string, icon: <ArrowUpCircle size={14} /> },
    { id: "expiry", label: t.invExpiry as string, icon: <AlertTriangle size={14} /> },
    { id: "history", label: t.invHistory as string, icon: <Clock size={14} /> },
  ];

  // Overview stats
  const lowStockCount = useMemo(() => products.filter(p => p.stock > 0 && p.stock <= p.minStock).length, [products]);
  const outOfStockCount = useMemo(() => products.filter(p => p.stock === 0).length, [products]);
  const inactiveCount = useMemo(() => products.filter(p => !p.isActive).length, [products]);

  const filteredProducts = useMemo(() => {
    switch (overviewFilter) {
      case "low": return products.filter(p => p.stock > 0 && p.stock <= p.minStock);
      case "out": return products.filter(p => p.stock === 0);
      case "inactive": return products.filter(p => !p.isActive);
      default: return products;
    }
  }, [products, overviewFilter]);

  // Expiry data — batches dependency triggers recalculation when store updates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const expiringBatches = useMemo(() => getExpiringBatches(60), [batches, getExpiringBatches]);

  // Movement helpers
  const groupMovements = (list: StockMovement[]) => {
    const groups: { label: string; items: StockMovement[] }[] = [];
    list.forEach(m => {
      const label = getDateLabel(m.createdAt, t);
      const existing = groups.find(g => g.label === label);
      if (existing) existing.items.push(m);
      else groups.push({ label, items: [m] });
    });
    return groups;
  };

  const doAddCategory = () => {
    if (!newCat.name || !newCat.nameId) return;
    addCategory({ id: genId(), name: newCat.name, nameId: newCat.nameId, icon: "", color: newCat.color });
    setAddCatOpen(false);
    setNewCat({ name: "", nameId: "", color: "#C4884A" });
    toast.success(t.categoryAdded as string);
  };

  const doAddProduct = () => {
    if (!newProd.name || !newProd.nameId || !newProd.sku) return;
    addProduct({
      id: genId(), sku: newProd.sku, name: newProd.name, nameId: newProd.nameId,
      category: newProd.category, priceIndividual: parseInt(newProd.priceIndividual) || 0,
      priceBox: parseInt(newProd.priceBox) || 0, qtyPerBox: parseInt(newProd.qtyPerBox) || 12,
      stock: parseInt(newProd.stock) || 0, unit: newProd.unit || "kg",
      image: newProd.image || "", minStock: parseInt(newProd.minStock) || 10, isActive: true,
    });
    setAddProdOpen(false);
    setNewProd({ name: "", nameId: "", sku: "", category: "c1", priceIndividual: "", priceBox: "", qtyPerBox: "12", stock: "0", unit: "kg", image: "", minStock: "10" });
    toast.success(t.productAdded as string);
  };

  const doStock = () => {
    const prod = products.find(p => p.id === form.prod);
    if (!prod || !form.qty || !stockModal) return;
    const qty = parseInt(form.qty);
    const total = form.unit === "box" ? qty * prod.qtyPerBox : qty;
    if (stockModal === "out" && total > prod.stock) {
      toast.error(t.insufficientStock as string);
      return;
    }
    adjustStock(prod.id, stockModal === "in" ? total : -total);
    if (stockModal === "in") {
      addBatch({ id: genId(), productId: prod.id, quantity: total, expiryDate: form.expiryDate || "", receivedAt: new Date().toISOString(), note: form.note || "—" });
    } else {
      consumeFIFO(prod.id, total);
    }
    addMovement({
      id: genId(), productId: prod.id, type: stockModal, quantity: total, unitType: form.unit,
      unitPrice: form.price ? parseInt(form.price) : (form.unit === "box" ? prod.priceBox : prod.priceIndividual),
      note: form.note || "—", createdAt: new Date().toISOString(), createdBy: user.id,
      expiryDate: stockModal === "in" ? form.expiryDate || undefined : undefined,
    });
    setStockModal(null);
    setForm({ prod: "", qty: "", unit: "individual", price: "", note: "", expiryDate: "" });
    toast.success(t.stockRecorded as string);
  };

  // Render movement list (reused by stockIn, stockOut, history tabs)
  const renderMovementList = (list: StockMovement[], showAll: boolean, setShowAll: (v: boolean) => void, totalCount: number) => {
    const visible = showAll ? list : list.slice(0, 10);
    const grouped = groupMovements(visible);
    if (list.length === 0) {
      return (
        <div className={`py-10 text-center ${th.txm}`}>
          <Package size={36} className="mx-auto opacity-20 mb-2" />
          <p className="text-sm font-semibold">{t.noMovements}</p>
        </div>
      );
    }
    return (
      <>
        {grouped.map(group => (
          <div key={group.label}>
            <div className={`px-5 py-2 ${th.elev}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${th.txm}`}>{group.label}</p>
            </div>
            {group.items.map(m => {
              const prod = products.find(p => p.id === m.productId);
              return (
                <div key={m.id} className={`flex items-center justify-between px-5 py-3 border-b last:border-0 ${th.bdr}/50`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      m.type === "in" ? (th.dark ? "bg-[#4A8B3F]/15" : "bg-green-50") : (th.dark ? "bg-[#C4504A]/15" : "bg-red-50")
                    }`}>
                      {m.type === "in" ? <ArrowDownCircle size={14} className="text-[#4A8B3F]" /> : <ArrowUpCircle size={14} className="text-[#C4504A]" />}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${th.tx}`}>
                        {lang === "id" ? prod?.nameId : prod?.name}
                        <span className={`ml-1.5 ${th.txm}`}>{m.type === "in" ? "+" : "-"}{m.quantity}</span>
                      </p>
                      <p className={`text-[11px] ${th.txf}`}>{m.note}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${m.type === "in" ? "text-[#4A8B3F]" : "text-[#C4504A]"}`}>{$(m.unitPrice * m.quantity)}</p>
                    <p className={`text-[11px] ${th.txf}`}>{formatTime(m.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {!showAll && totalCount > 10 && (
          <button onClick={() => setShowAll(true)}
            className={`w-full py-3 text-sm font-bold ${th.acc} hover:opacity-70`}>
            {t.loadMore} ({totalCount - 10})
          </button>
        )}
      </>
    );
  };

  // Tab-specific show-all state
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllIn, setShowAllIn] = useState(false);
  const [showAllOut, setShowAllOut] = useState(false);

  const stockInMovements = useMemo(() => movements.filter(m => m.type === "in"), [movements]);
  const stockOutMovements = useMemo(() => movements.filter(m => m.type === "out"), [movements]);

  const getDaysUntilExpiry = (dateStr: string) => {
    const now = new Date();
    const expiry = new Date(dateStr);
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className={`text-[22px] font-black tracking-tight ${th.tx}`}>{t.inventory}</h1>
      </div>

      {/* Tab bar */}
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-[14px] text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? "text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]"
                  : `border ${th.card} ${th.bdr} ${th.txm}`
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <div className={`absolute right-0 top-0 bottom-1 w-8 pointer-events-none bg-gradient-to-l ${th.dark ? "from-[#12100E]" : "from-[#F8F3ED]"}`} />
      </div>

      {/* Admin-only action buttons */}
      {canWrite && activeTab === "overview" && (
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => setAddProdOpen(true)}
            className={`py-3 rounded-2xl text-sm font-bold border-2 border-dashed flex items-center justify-center gap-2 ${th.bdr} ${th.acc}`}>
            <Plus size={16} /> {t.addProduct}
          </button>
          <button onClick={() => setAddCatOpen(true)}
            className={`py-3 rounded-2xl text-sm font-bold border-2 border-dashed flex items-center justify-center gap-2 ${th.bdr} ${th.txm}`}>
            <Plus size={16} /> {t.addCategory}
          </button>
        </div>
      )}

      {/* ═══════ OVERVIEW TAB ═══════ */}
      {activeTab === "overview" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { l: t.all, v: products.length, clr: "#5B8DEF", f: "all" as const },
              { l: t.lowStock, v: lowStockCount, clr: "#E89B48", f: "low" as const },
              { l: t.outOfStock, v: outOfStockCount, clr: "#C4504A", f: "out" as const },
              { l: t.inactive, v: inactiveCount, clr: "#8A7E73", f: "inactive" as const },
            ].map(s => (
              <button key={s.f} onClick={() => setOverviewFilter(s.f)}
                className={`rounded-[14px] border p-2.5 text-left transition-all ${
                  overviewFilter === s.f ? `ring-2 ring-[${s.clr}]/30` : ""
                } ${th.card} ${th.bdr}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${th.txm}`}>{s.l}</p>
                <p className="text-lg font-black mt-0.5" style={{ color: s.clr }}>{s.v}</p>
              </button>
            ))}
          </div>

          {/* Product list */}
          <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
            <div className={`px-5 py-3.5 border-b ${th.bdr}`}>
              <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>
                {t.product} ({filteredProducts.length})
              </p>
            </div>
            {filteredProducts.length === 0 ? (
              <div className={`py-10 text-center ${th.txm}`}>
                <Package size={36} className="mx-auto opacity-20 mb-2" />
                <p className="text-sm font-semibold">{t.noResults}</p>
              </div>
            ) : filteredProducts.map(product => (
              <div key={product.id} className={`flex items-center justify-between px-4 py-3 border-b last:border-0 ${th.bdr}/50`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <ProductImage product={product} size={36} />
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${th.tx} ${!product.isActive ? "line-through opacity-50" : ""}`}>
                      {lang === "id" ? product.nameId : product.name}
                    </p>
                    <p className={`text-[10px] font-mono ${th.txf}`}>{product.sku}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <p className={`text-sm font-black ${th.tx}`}>{product.stock} <span className={`text-[10px] font-medium ${th.txf}`}>{product.unit}</span></p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      product.stock === 0
                        ? (th.dark ? "bg-[#D4627A]/15 text-[#D4627A]" : "bg-red-50 text-[#D4627A]")
                        : product.stock <= product.minStock
                        ? (th.dark ? "bg-[#D4956B]/15 text-[#E8B088]" : "bg-[#FFF5EC] text-[#A0673C]")
                        : (th.dark ? "bg-[#4A8B3F]/15 text-[#4A8B3F]" : "bg-green-50 text-[#4A8B3F]")
                    }`}>
                      {product.stock === 0 ? t.outOfStock : product.stock <= product.minStock ? t.lowStock : t.normalStock}
                    </span>
                  </div>
                  {canWrite && (
                    <button
                      onClick={() => {
                        toggleActive(product.id);
                        toast.success(product.isActive ? t.productHidden as string : t.productShown as string);
                      }}
                      className={`w-10 h-6 rounded-full transition-colors relative ${
                        product.isActive ? "bg-[#4A8B3F]" : (th.dark ? "bg-[#352E28]" : "bg-[#E8DDD2]")
                      }`}
                      title={product.isActive ? t.hideFromPOS as string : t.showInPOS as string}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        product.isActive ? "translate-x-[18px]" : "translate-x-0.5"
                      }`} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ═══════ STOCK IN TAB ═══════ */}
      {activeTab === "stockIn" && (
        <>
          {canWrite && (
            <button onClick={() => { setStockModal("in"); setForm({ prod: "", qty: "", unit: "individual", price: "", note: "", expiryDate: "" }); }}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-[#4A8B3F] flex items-center justify-center gap-2">
              <ArrowDownCircle size={16} /> {t.stockIn}
            </button>
          )}
          <div className={`rounded-[18px] border p-3.5 ${th.card} ${th.bdr}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${th.txm}`}>{t.totalIn}</p>
            <p className="text-xl font-black mt-1 text-[#4A8B3F]">+{totalIn()}</p>
          </div>
          <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
            {renderMovementList(stockInMovements, showAllIn, setShowAllIn, stockInMovements.length)}
          </div>
        </>
      )}

      {/* ═══════ STOCK OUT TAB ═══════ */}
      {activeTab === "stockOut" && (
        <>
          {canWrite && (
            <button onClick={() => { setStockModal("out"); setForm({ prod: "", qty: "", unit: "individual", price: "", note: "", expiryDate: "" }); }}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-[#C4504A] flex items-center justify-center gap-2">
              <ArrowUpCircle size={16} /> {t.stockOut}
            </button>
          )}
          <div className={`rounded-[18px] border p-3.5 ${th.card} ${th.bdr}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${th.txm}`}>{t.totalOut}</p>
            <p className="text-xl font-black mt-1 text-[#C4504A]">-{totalOut()}</p>
          </div>
          <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
            {renderMovementList(stockOutMovements, showAllOut, setShowAllOut, stockOutMovements.length)}
          </div>
        </>
      )}

      {/* ═══════ EXPIRY TAB ═══════ */}
      {activeTab === "expiry" && (
        <>
          {expiringBatches.length === 0 ? (
            <div className={`text-center py-16 ${th.txm}`}>
              <AlertTriangle size={40} className="mx-auto opacity-20 mb-3" />
              <p className="font-semibold text-sm">{t.noExpiryAlerts}</p>
            </div>
          ) : (
            <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
              <div className={`px-5 py-3.5 border-b ${th.bdr}`}>
                <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>
                  {t.expiryAlerts} ({expiringBatches.length})
                </p>
              </div>
              {expiringBatches.map(batch => {
                const product = products.find(p => p.id === batch.productId);
                const days = getDaysUntilExpiry(batch.expiryDate);
                const isExpired = days <= 0;
                const isUrgent = days > 0 && days <= 14;

                return (
                  <div key={batch.id} className={`flex items-center justify-between px-4 py-3 border-b last:border-0 ${th.bdr}/50`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {product && <ProductImage product={product} size={32} />}
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${th.tx}`}>
                          {product ? (lang === "id" ? product.nameId : product.name) : batch.productId}
                        </p>
                        <p className={`text-[11px] ${th.txf}`}>
                          {batch.note} — {batch.quantity} {product?.unit || "pcs"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[11px] font-mono ${th.txm}`}>
                        {new Date(batch.expiryDate).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isExpired
                          ? (th.dark ? "bg-[#D4627A]/15 text-[#D4627A]" : "bg-red-50 text-[#D4627A]")
                          : isUrgent
                          ? (th.dark ? "bg-[#D4956B]/15 text-[#E8B088]" : "bg-[#FFF5EC] text-[#A0673C]")
                          : (th.dark ? "bg-[#E89B48]/10 text-[#E89B48]" : "bg-amber-50 text-[#E89B48]")
                      }`}>
                        {isExpired ? t.alreadyExpired : `${t.expiringIn} ${days} ${t.days}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════ HISTORY TAB ═══════ */}
      {activeTab === "history" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: t.totalIn, v: `+${totalIn()}`, clr: "#4A8B3F" },
              { l: t.totalOut, v: `-${totalOut()}`, clr: "#C4504A" },
              { l: t.netChange, v: `${totalIn() - totalOut() >= 0 ? "+" : ""}${totalIn() - totalOut()}`, clr: "#5B8DEF" },
            ].map((s, i) => (
              <div key={i} className={`rounded-[18px] border p-3.5 ${th.card} ${th.bdr}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${th.txm}`}>{s.l}</p>
                <p className="text-xl font-black mt-1" style={{ color: s.clr }}>{s.v}</p>
              </div>
            ))}
          </div>
          <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
            <div className={`px-5 py-3.5 border-b ${th.bdr}`}>
              <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.movementLog}</p>
            </div>
            {renderMovementList(movements, showAllHistory, setShowAllHistory, movements.length)}
          </div>
        </>
      )}

      {/* ═══════ MODALS ═══════ */}

      {/* Stock In/Out modal */}
      <Modal open={!!stockModal} onClose={() => setStockModal(null)} title={(stockModal === "in" ? t.stockIn : t.stockOut) as string}>
        <div className="flex flex-col gap-3.5">
          <div className="relative">
            <select value={form.prod} onChange={e => {
                const prodId = e.target.value;
                if (stockModal === "out") {
                  const sp = products.find(p => p.id === prodId);
                  setForm({ ...form, prod: prodId, price: sp ? String(form.unit === "box" ? sp.priceBox : sp.priceIndividual) : "" });
                } else {
                  setForm({ ...form, prod: prodId });
                }
              }}
              className={`w-full px-4 py-3 text-sm rounded-2xl border appearance-none ${th.inp}`}>
              <option value="">{t.selectProduct}</option>
              {products.map(p => <option key={p.id} value={p.id}>{lang === "id" ? p.nameId : p.name} ({p.stock})</option>)}
            </select>
            <ChevronDown size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 ${th.txf}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.unitType}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(["individual", "box"] as UnitType[]).map(ut => (
                  <button key={ut} onClick={() => {
                    if (stockModal === "out" && form.prod) {
                      const sp = products.find(p => p.id === form.prod);
                      setForm({ ...form, unit: ut, price: sp ? String(ut === "box" ? sp.priceBox : sp.priceIndividual) : "" });
                    } else {
                      setForm({ ...form, unit: ut });
                    }
                  }}
                    className={`py-2.5 rounded-xl text-xs font-bold ${
                      form.unit === ut ? "text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]" : `border ${th.bdr} ${th.txm}`
                    }`}>{ut === "individual" ? t.individual : (form.prod ? `${t.box} (${products.find(p => p.id === form.prod)?.qtyPerBox || "?"})` : t.box)}</button>
                ))}
              </div>
              {form.unit === "box" && form.prod && (() => {
                const sp = products.find(p => p.id === form.prod);
                return sp ? <p className={`text-[11px] mt-1.5 font-medium ${th.acc}`}>{t.boxEquals} = {sp.qtyPerBox} {sp.unit}</p> : null;
              })()}
            </div>
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.quantity}</p>
              <input type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`} min="1" />
            </div>
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.price}</p>
            <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
              placeholder={form.prod ? $((form.unit === "box" ? products.find(p => p.id === form.prod)?.priceBox : products.find(p => p.id === form.prod)?.priceIndividual) || 0) : ""}
              className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`} min="0" />
          </div>
          {stockModal === "in" && (
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.expiryDate}</p>
              <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`} />
            </div>
          )}
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.note}</p>
            <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2}
              className={`w-full px-4 py-2.5 text-sm rounded-xl border resize-none ${th.inp}`} />
          </div>
          {form.prod && (
            <button onClick={() => { const p = products.find(pr => pr.id === form.prod); if (p) printBarcodeLabel(p, lang); }}
              className={`w-full py-2.5 rounded-2xl text-xs font-bold border flex items-center justify-center gap-2 ${th.bdr} ${th.txm}`}>
              <Barcode size={14} /> {t.printLabel}
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStockModal(null)} className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
            <button onClick={doStock} disabled={!form.prod || !form.qty}
              className={`flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-40 ${stockModal === "in" ? "bg-[#4A8B3F]" : "bg-[#C4504A]"}`}>{t.confirm}</button>
          </div>
        </div>
      </Modal>

      {/* Add Product modal */}
      <Modal open={addProdOpen} onClose={() => setAddProdOpen(false)} title={t.addProduct as string}>
        <div className="flex flex-col gap-3">
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.productName}</p>
            <input value={newProd.name} onChange={e => setNewProd({ ...newProd, name: e.target.value })}
              className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`} />
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.productNameId}</p>
            <input value={newProd.nameId} onChange={e => setNewProd({ ...newProd, nameId: e.target.value })}
              className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.sku}</p>
              <input value={newProd.sku} onChange={e => setNewProd({ ...newProd, sku: e.target.value })}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`} />
            </div>
            <div className="relative">
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{lang === "id" ? "Kategori" : "Category"}</p>
              <select value={newProd.category} onChange={e => setNewProd({ ...newProd, category: e.target.value })}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border appearance-none ${th.inp}`}>
                {categories.map(c => <option key={c.id} value={c.id}>{lang === "id" ? c.nameId : c.name}</option>)}
              </select>
              <ChevronDown size={14} className={`absolute right-4 bottom-3 ${th.txf}`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.priceIndividual}</p>
              <input type="number" value={newProd.priceIndividual} onChange={e => setNewProd({ ...newProd, priceIndividual: e.target.value })}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`} min="0" />
            </div>
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.priceBox}</p>
              <input type="number" value={newProd.priceBox} onChange={e => setNewProd({ ...newProd, priceBox: e.target.value })}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`} min="0" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.qtyPerBox}</p>
              <input type="number" value={newProd.qtyPerBox} onChange={e => setNewProd({ ...newProd, qtyPerBox: e.target.value })}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`} min="1" />
            </div>
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.unitLabel}</p>
              <input value={newProd.unit} onChange={e => setNewProd({ ...newProd, unit: e.target.value })}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`} />
            </div>
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.minStockLabel}</p>
              <input type="number" value={newProd.minStock} onChange={e => setNewProd({ ...newProd, minStock: e.target.value })}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`} min="0" />
            </div>
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => setAddProdOpen(false)} className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
            <button onClick={doAddProduct} disabled={!newProd.name || !newProd.nameId || !newProd.sku}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C] disabled:opacity-40">{t.save}</button>
          </div>
        </div>
      </Modal>

      {/* Add Category modal */}
      <Modal open={addCatOpen} onClose={() => setAddCatOpen(false)} title={t.addCategory as string}>
        <div className="flex flex-col gap-3">
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.categoryName}</p>
            <input value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })}
              className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`} />
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.categoryNameId}</p>
            <input value={newCat.nameId} onChange={e => setNewCat({ ...newCat, nameId: e.target.value })}
              className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`} />
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.categoryColor}</p>
            <div className="flex flex-wrap gap-2">
              {catColors.map(c => (
                <button key={c} onClick={() => setNewCat({ ...newCat, color: c })}
                  className={`w-8 h-8 rounded-xl border-2 ${newCat.color === c ? "border-current scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => setAddCatOpen(false)} className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
            <button onClick={doAddCategory} disabled={!newCat.name || !newCat.nameId}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C] disabled:opacity-40">{t.save}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
