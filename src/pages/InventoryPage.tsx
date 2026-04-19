import { useState, useMemo, useEffect } from "react";
import { useCategoryStore, useProductStore, useInventoryStore, useBatchStore, useAuthStore, useLangStore, useSupplierStore, useSettingsStore } from "@/stores";
import { INVENTORY_WRITE_ROLES, UNIT_OPTIONS, PAYMENT_TERMS_OPTIONS } from "@/constants";
import { Modal } from "@/components/Modal";
import { ProductImage } from "@/components/ProductImage";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { SupplierDetailModal } from "@/components/SupplierDetailModal";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency as $, formatTime, formatDate, genId, genBatchNumber, calcDueDate, compressImage, printBarcodeLabel, printBarcodeLabels } from "@/utils";
import { exportProducts, exportInventory } from "@/utils/export";
import type { UnitType, StockType, StockMovement, PaymentTerms, PaymentStatus, UnitOfMeasure } from "@/types";
import toast from "react-hot-toast";
import {
  Package, Plus, ChevronDown, ArrowDownCircle, ArrowUpCircle, Barcode,
  LayoutGrid, Clock, AlertTriangle, Truck, X, Check, CircleDollarSign, Pencil, Download, Search, Printer, Trash2,
} from "lucide-react";

type InventoryTab = "overview" | "stockIn" | "stockOut" | "expiry" | "history" | "suppliers";

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

function generateSku(categoryId: string, products: { sku: string }[], categories: { id: string; name: string }[]): string {
  const cat = categories.find(c => c.id === categoryId);
  const prefix = cat ? cat.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() : "GEN";
  const existing = products
    .filter(p => p.sku.startsWith(prefix + "-"))
    .map(p => parseInt(p.sku.split("-")[1], 10))
    .filter(n => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

export function InventoryPage() {
  const th = useThemeClasses();
  const { t, lang } = useLangStore();
  const { categories, addCategory } = useCategoryStore();
  const products = useProductStore(s => s.products);
  const adjustStock = useProductStore(s => s.adjustStock);
  const addProduct = useProductStore(s => s.addProduct);
  const updateProduct = useProductStore(s => s.updateProduct);
  const toggleActive = useProductStore(s => s.toggleActive);
  const { movements, addMovement, updatePaymentStatus } = useInventoryStore();
  const { addBatch, consumeFIFO, getExpiringBatches } = useBatchStore();
  const batches = useBatchStore(s => s.batches);
  const user = useAuthStore(s => s.user)!;
  const canWrite = INVENTORY_WRITE_ROLES.includes(user.role);
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useSupplierStore();
  const deleteProduct = useProductStore(s => s.deleteProduct);
  const canDeleteProduct = user.role === "superadmin" || user.role === "admin";
  const { labelWidth, labelHeight } = useSettingsStore();

  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [detailSupplierId, setDetailSupplierId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InventoryTab>("overview");
  const [stockModal, setStockModal] = useState<StockType | null>(null);
  const [form, setForm] = useState({
    prod: "", qty: "", unit: "individual" as UnitType, price: "", note: "", expiryDate: "",
    supplierId: "", paymentTerms: "COD" as PaymentTerms, paymentStatus: "unpaid" as PaymentStatus,
  });
  const [addProdOpen, setAddProdOpen] = useState(false);
  const defaultCatId = categories.length > 0 ? categories[0].id : "";
  const [newProd, setNewProd] = useState({
    name: "", nameId: "", sku: "", category: defaultCatId,
    purchasePrice: "", sellingPrice: "", memberPrice: "",
    qtyPerBox: "12", stock: "0", unit: "kg" as UnitOfMeasure, image: "", minStock: "10",
  });
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", nameId: "", color: "#3B82F6" });
  const catColors = ["#3B82F6", "#D4627A", "#5B8DEF", "#7D5A44", "#8B6FC0", "#6F9A4D", "#E89B48", "#2BA5B5", "#9B59B6", "#E74C3C"];
  const [overviewFilter, setOverviewFilter] = useState<"all" | "low" | "out" | "inactive" | "member">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebounce(productSearch, 150);
  const INV_PAGE_SIZE = 50;
  const [invPage, setInvPage] = useState(1);
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [confirmDeleteProductId, setConfirmDeleteProductId] = useState<string | null>(null);
  const [labelIncludeExpiry, setLabelIncludeExpiry] = useState(false);
  const [labelExpiryDate, setLabelExpiryDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [confirmDeleteSupplierId, setConfirmDeleteSupplierId] = useState<string | null>(null);
  const [prodFormErrors, setProdFormErrors] = useState<Record<string, boolean>>({});
  const [editProdOpen, setEditProdOpen] = useState(false);
  const [editProdId, setEditProdId] = useState<string | null>(null);
  const [editProd, setEditProd] = useState({
    name: "", nameId: "", sku: "", category: defaultCatId,
    purchasePrice: "", sellingPrice: "", memberPrice: "",
    qtyPerBox: "12", stock: "0", unit: "kg" as UnitOfMeasure, image: "", minStock: "10",
  });

  // Supplier modal state
  const [supplierModal, setSupplierModal] = useState<"add" | "edit" | null>(null);
  const [editSupplierId, setEditSupplierId] = useState<string | null>(null);
  const [supForm, setSupForm] = useState({ name: "", phone: "", email: "", address: "" });

  // Tab definitions
  const tabs: { id: InventoryTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: t.invOverview as string, icon: <LayoutGrid size={14} /> },
    { id: "stockIn", label: t.invStockIn as string, icon: <ArrowDownCircle size={14} /> },
    { id: "stockOut", label: t.invStockOut as string, icon: <ArrowUpCircle size={14} /> },
    { id: "expiry", label: t.invExpiry as string, icon: <AlertTriangle size={14} /> },
    { id: "history", label: t.invHistory as string, icon: <Clock size={14} /> },
    { id: "suppliers", label: t.invSuppliers as string, icon: <Truck size={14} /> },
  ];

  // Overview stats
  const lowStockCount = useMemo(() => products.filter(p => p.stock > 0 && p.stock <= p.minStock).length, [products]);
  const outOfStockCount = useMemo(() => products.filter(p => p.stock === 0).length, [products]);
  const inactiveCount = useMemo(() => products.filter(p => !p.isActive).length, [products]);
  const memberPriceCount = useMemo(() =>
    products.filter(p => typeof p.memberPrice === "number" && p.memberPrice > 0 && p.memberPrice < p.sellingPrice).length,
    [products]
  );

  const filteredProducts = useMemo(() => {
    let list = products;
    switch (overviewFilter) {
      case "low": list = list.filter(p => p.stock > 0 && p.stock <= p.minStock); break;
      case "out": list = list.filter(p => p.stock === 0); break;
      case "inactive": list = list.filter(p => !p.isActive); break;
      case "member": list = list.filter(p => typeof p.memberPrice === "number" && p.memberPrice > 0 && p.memberPrice < p.sellingPrice); break;
    }
    if (debouncedProductSearch.trim()) {
      const q = debouncedProductSearch.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || p.nameId.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, overviewFilter, debouncedProductSearch]);

  // Reset page when filter or search changes
  useEffect(() => { setInvPage(1); }, [overviewFilter, debouncedProductSearch]);

  const totalInvPages = Math.max(1, Math.ceil(filteredProducts.length / INV_PAGE_SIZE));
  const paginatedProducts = useMemo(
    () => filteredProducts.slice((invPage - 1) * INV_PAGE_SIZE, invPage * INV_PAGE_SIZE),
    [filteredProducts, invPage]
  );

  // Expiry data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const expiringBatches = useMemo(() => getExpiringBatches(60), [batches, getExpiringBatches]);

  // Computed from movements (reactive)
  const unpaidInvoices = useMemo(() =>
    movements.filter(m => m.type === "in" && m.paymentStatus === "unpaid"),
    [movements]
  );
  const totalInCount = useMemo(() =>
    movements.filter(m => m.type === "in").reduce((s, m) => s + m.quantity, 0),
    [movements]
  );
  const totalOutCount = useMemo(() =>
    movements.filter(m => m.type === "out").reduce((s, m) => s + m.quantity, 0),
    [movements]
  );

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
    setNewCat({ name: "", nameId: "", color: "#3B82F6" });
    toast.success(t.categoryAdded as string);
  };

  const doAddProduct = () => {
    const errs: Record<string, boolean> = {};
    if (!newProd.name.trim()) errs.name = true;
    if (!newProd.nameId.trim()) errs.nameId = true;
    if (!newProd.sku.trim()) errs.sku = true;
    if (Object.keys(errs).length) { setProdFormErrors(errs); return; }
    setProdFormErrors({});
    const memberPriceVal = parseInt(newProd.memberPrice);
    addProduct({
      id: genId(), sku: newProd.sku, name: newProd.name, nameId: newProd.nameId,
      category: newProd.category, purchasePrice: parseInt(newProd.purchasePrice) || 0,
      sellingPrice: parseInt(newProd.sellingPrice) || 0,
      ...(Number.isFinite(memberPriceVal) && memberPriceVal > 0 ? { memberPrice: memberPriceVal } : {}),
      qtyPerBox: parseInt(newProd.qtyPerBox) || 12,
      stock: parseInt(newProd.stock) || 0, unit: newProd.unit,
      image: newProd.image || "", minStock: parseInt(newProd.minStock) || 10, isActive: true,
      createdAt: new Date().toISOString(),
    });
    setAddProdOpen(false);
    setNewProd({ name: "", nameId: "", sku: "", category: defaultCatId, purchasePrice: "", sellingPrice: "", memberPrice: "", qtyPerBox: "12", stock: "0", unit: "kg", image: "", minStock: "10" });
    setProdFormErrors({});
    toast.success(t.productAdded as string);
  };

  const openEditProduct = (productId: string) => {
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    setEditProdId(productId);
    setEditProd({
      name: p.name, nameId: p.nameId, sku: p.sku, category: p.category,
      purchasePrice: String(p.purchasePrice), sellingPrice: String(p.sellingPrice),
      memberPrice: typeof p.memberPrice === "number" && p.memberPrice > 0 ? String(p.memberPrice) : "",
      qtyPerBox: String(p.qtyPerBox), stock: String(p.stock), unit: p.unit, image: p.image, minStock: String(p.minStock),
    });
    setEditProdOpen(true);
  };

  const doEditProduct = () => {
    if (!editProdId || !editProd.name || !editProd.nameId || !editProd.sku) return;
    const memberPriceVal = parseInt(editProd.memberPrice);
    // 0 (or invalid) signals BE to clear member_price; positive number sets it
    const memberPriceToSend = Number.isFinite(memberPriceVal) && memberPriceVal > 0 ? memberPriceVal : 0;
    updateProduct(editProdId, {
      name: editProd.name, nameId: editProd.nameId, sku: editProd.sku,
      category: editProd.category, purchasePrice: parseInt(editProd.purchasePrice) || 0,
      sellingPrice: parseInt(editProd.sellingPrice) || 0,
      memberPrice: memberPriceToSend,
      qtyPerBox: parseInt(editProd.qtyPerBox) || 12,
      stock: parseInt(editProd.stock) || 0, unit: editProd.unit, image: editProd.image || "", minStock: parseInt(editProd.minStock) || 10,
    });
    setEditProdOpen(false);
    setEditProdId(null);
    toast.success(t.productUpdated as string);
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await compressImage(file);
    setEditProd({ ...editProd, image: base64 });
    toast.success(t.imageUploaded as string);
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

    const priceForUnit = stockModal === "in"
      ? (form.unit === "box" ? prod.purchasePrice * prod.qtyPerBox : prod.purchasePrice)
      : (form.unit === "box" ? prod.sellingPrice * prod.qtyPerBox : prod.sellingPrice);

    if (stockModal === "in") {
      addBatch({
        id: genId(), productId: prod.id, quantity: total,
        expiryDate: form.expiryDate || "", receivedAt: new Date().toISOString(),
        note: form.note || "\u2014", batchNumber: genBatchNumber(),
      });
    } else {
      consumeFIFO(prod.id, total);
    }

    const now = new Date().toISOString();
    addMovement({
      id: genId(), productId: prod.id, type: stockModal, quantity: total, unitType: form.unit,
      unitPrice: form.price ? parseInt(form.price) : priceForUnit,
      note: form.note || "\u2014", createdAt: now, createdBy: user.id,
      expiryDate: stockModal === "in" ? form.expiryDate || undefined : undefined,
      supplierId: stockModal === "in" && form.supplierId ? form.supplierId : undefined,
      paymentTerms: stockModal === "in" && form.supplierId ? form.paymentTerms : undefined,
      dueDate: stockModal === "in" && form.supplierId ? calcDueDate(now, form.paymentTerms) : undefined,
      paymentStatus: stockModal === "in" && form.supplierId ? form.paymentStatus : undefined,
    });
    setStockModal(null);
    setForm({ prod: "", qty: "", unit: "individual", price: "", note: "", expiryDate: "", supplierId: "", paymentTerms: "COD", paymentStatus: "unpaid" });
    toast.success(t.stockRecorded as string);
  };

  const doAddSupplier = () => {
    if (!supForm.name.trim()) return;
    addSupplier({
      id: genId(), name: supForm.name.trim(), phone: supForm.phone.trim(),
      email: supForm.email.trim(), address: supForm.address.trim(),
      createdAt: new Date().toISOString(),
    });
    setSupplierModal(null);
    setSupForm({ name: "", phone: "", email: "", address: "" });
    toast.success(t.supplierAdded as string);
  };

  const doEditSupplier = () => {
    if (!editSupplierId || !supForm.name.trim()) return;
    updateSupplier(editSupplierId, {
      name: supForm.name.trim(), phone: supForm.phone.trim(),
      email: supForm.email.trim(), address: supForm.address.trim(),
    });
    setSupplierModal(null);
    setEditSupplierId(null);
    setSupForm({ name: "", phone: "", email: "", address: "" });
    toast.success(t.supplierUpdated as string);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await compressImage(file);
    setNewProd({ ...newProd, image: base64 });
    toast.success(t.imageUploaded as string);
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
                <div key={m.id} onClick={() => setDetailProductId(m.productId)}
                  className={`flex items-center justify-between px-5 py-3 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdrSoft}`}>
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

  const inp = `w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className={`text-[22px] font-black tracking-tight shrink-0 ${th.tx}`}>{t.inventory}</h1>
        <div className="flex gap-1.5 shrink-0">
          {activeTab === "overview" && (
            <>
              <button onClick={async () => { await exportProducts(products, "csv"); toast.success(t.exportSuccess as string); }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold ${th.elev} ${th.txm}`}>
                <Download size={11} /> CSV
              </button>
              <button onClick={async () => { await exportProducts(products, "xlsx"); toast.success(t.exportSuccess as string); }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold ${th.elev} ${th.txm}`}>
                <Download size={11} /> Excel
              </button>
            </>
          )}
          {activeTab === "history" && (
            <>
              <button onClick={async () => { await exportInventory(movements, products, "csv"); toast.success(t.exportSuccess as string); }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold ${th.elev} ${th.txm}`}>
                <Download size={11} /> CSV
              </button>
              <button onClick={async () => { await exportInventory(movements, products, "xlsx"); toast.success(t.exportSuccess as string); }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold ${th.elev} ${th.txm}`}>
                <Download size={11} /> Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-[14px] text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]"
                  : `border ${th.card} ${th.bdr} ${th.txm}`
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <div className={`absolute right-0 top-0 bottom-1 w-8 pointer-events-none bg-gradient-to-l ${th.dark ? "from-[#020617]" : "from-[#F1F5F9]"}`} />
      </div>

      {/* Admin-only action buttons */}
      {canWrite && activeTab === "overview" && (
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => { const catId = categories.length > 0 ? categories[0].id : ""; setNewProd(p => ({ ...p, category: catId, sku: generateSku(catId, products, categories) })); setAddProdOpen(true); }}
            className={`py-3 rounded-2xl text-sm font-bold border-2 border-dashed flex items-center justify-center gap-2 ${th.bdr} ${th.acc}`}>
            <Plus size={16} /> {t.addProduct}
          </button>
          <button onClick={() => setAddCatOpen(true)}
            className={`py-3 rounded-2xl text-sm font-bold border-2 border-dashed flex items-center justify-center gap-2 ${th.bdr} ${th.txm}`}>
            <Plus size={16} /> {t.addCategory}
          </button>
        </div>
      )}

      {/* ======= OVERVIEW TAB ======= */}
      {activeTab === "overview" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { l: t.all, v: products.length, clr: "#5B8DEF", f: "all" as const },
              { l: t.lowStock, v: lowStockCount, clr: "#E89B48", f: "low" as const },
              { l: t.outOfStock, v: outOfStockCount, clr: "#C4504A", f: "out" as const },
              { l: t.inactive, v: inactiveCount, clr: "#94A3B8", f: "inactive" as const },
              { l: "💎 Member", v: memberPriceCount, clr: "#1E40AF", f: "member" as const },
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

          {/* Product search */}
          <div className="relative">
            <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${th.txf}`} />
            <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
              placeholder={t.searchProducts as string}
              className={`w-full pl-10 pr-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/20 font-medium ${th.inp}`} />
          </div>

          {/* Product list */}
          <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
            <div className={`px-5 py-3.5 border-b flex items-center justify-between ${th.bdr}`}>
              <div className="flex items-center gap-3">
                {canWrite && (
                  <input type="checkbox"
                    checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(filteredProducts.map(p => p.id)));
                      else setSelectedIds(new Set());
                    }}
                    className="w-4 h-4 rounded accent-[#1E40AF]" />
                )}
                <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>
                  {t.product} ({filteredProducts.length})
                </p>
              </div>
              {canWrite && selectedIds.size > 0 && (
                <button onClick={() => setLabelModalOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${th.accBg} ${th.acc}`}>
                  <Printer size={12} /> Print {selectedIds.size} Label
                </button>
              )}
            </div>
            {filteredProducts.length === 0 ? (
              <div className={`py-10 text-center ${th.txm}`}>
                <Package size={36} className="mx-auto opacity-20 mb-2" />
                <p className="text-sm font-semibold">{t.noResults}</p>
              </div>
            ) : paginatedProducts.map(product => (
              <div key={product.id} onClick={() => setDetailProductId(product.id)}
                className={`flex items-center justify-between px-4 py-3 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdrSoft}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {canWrite && (
                    <input type="checkbox" checked={selectedIds.has(product.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) next.add(product.id);
                        else next.delete(product.id);
                        setSelectedIds(next);
                      }}
                      className="w-4 h-4 rounded accent-[#1E40AF] shrink-0" />
                  )}
                  <ProductImage product={product} size={36} />
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${th.tx} ${!product.isActive ? "line-through opacity-50" : ""}`}>
                      {lang === "id" ? product.nameId : product.name}
                    </p>
                    <p className={`text-[10px] font-mono ${th.txf}`}>{product.sku}</p>
                    {typeof product.memberPrice === "number" && product.memberPrice > 0 && product.memberPrice < product.sellingPrice && (
                      <p className={`text-[10px] mt-0.5 ${th.acc}`}>
                        💎 {$(product.sellingPrice)} → <b>{$(product.memberPrice)}</b>
                        <span className={`ml-1 ${th.txm}`}>
                          (-{Math.round((1 - product.memberPrice / product.sellingPrice) * 100)}%)
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <p className={`text-sm font-black ${th.tx}`}>{product.stock} <span className={`text-[10px] font-medium ${th.txf}`}>{product.unit}</span></p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      product.stock === 0
                        ? (th.dark ? "bg-[#D4627A]/15 text-[#D4627A]" : "bg-red-50 text-[#D4627A]")
                        : product.stock <= product.minStock
                        ? (th.dark ? "bg-[#60A5FA]/15 text-[#60A5FA]" : "bg-[#EFF6FF] text-[#1E40AF]")
                        : (th.dark ? "bg-[#4A8B3F]/15 text-[#4A8B3F]" : "bg-green-50 text-[#4A8B3F]")
                    }`}>
                      {product.stock === 0 ? t.outOfStock : product.stock <= product.minStock ? t.lowStock : t.normalStock}
                    </span>
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditProduct(product.id); }}
                        aria-label="Edit product"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${th.dark ? "bg-[#5B8DEF]/15 text-[#5B8DEF]" : "bg-blue-50 text-[#5B8DEF]"}`}
                      >
                        <Pencil size={12} />
                      </button>
                      {canDeleteProduct && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteProductId(product.id); }}
                          aria-label="Delete product"
                          title="Hapus produk"
                          className={`w-7 h-7 rounded-lg flex items-center justify-center ${th.dark ? "bg-[#D4627A]/15 text-[#D4627A]" : "bg-red-50 text-[#D4627A]"}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActive(product.id);
                          toast.success(product.isActive ? t.productHidden as string : t.productShown as string);
                        }}
                        className={`w-10 h-6 rounded-full transition-colors relative ${
                          product.isActive ? "bg-[#4A8B3F]" : (th.dark ? "bg-[#334155]" : "bg-[#E2E8F0]")
                        }`}
                        aria-label={product.isActive ? t.hideFromPOS as string : t.showInPOS as string}
                        title={product.isActive ? t.hideFromPOS as string : t.showInPOS as string}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                          product.isActive ? "translate-x-[18px]" : "translate-x-0.5"
                        }`} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredProducts.length > INV_PAGE_SIZE && (
            <div className={`flex items-center justify-between mt-3 px-4 py-2.5 rounded-[18px] border ${th.card} ${th.bdr}`}>
              <p className={`text-xs font-semibold ${th.txm}`}>
                {(invPage - 1) * INV_PAGE_SIZE + 1}–{Math.min(invPage * INV_PAGE_SIZE, filteredProducts.length)} / {filteredProducts.length}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setInvPage(p => Math.max(1, p - 1))}
                  disabled={invPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 ${th.bdr} border ${th.tx}`}
                >
                  Prev
                </button>
                <span className={`px-3 py-1.5 text-xs font-bold ${th.tx}`}>
                  {invPage} / {totalInvPages}
                </span>
                <button
                  onClick={() => setInvPage(p => Math.min(totalInvPages, p + 1))}
                  disabled={invPage >= totalInvPages}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 ${th.bdr} border ${th.tx}`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======= STOCK IN TAB ======= */}
      {activeTab === "stockIn" && (
        <>
          {canWrite && (
            <button onClick={() => { setStockModal("in"); setForm({ prod: "", qty: "", unit: "individual", price: "", note: "", expiryDate: "", supplierId: "", paymentTerms: "COD", paymentStatus: "unpaid" }); }}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-[#4A8B3F] flex items-center justify-center gap-2">
              <ArrowDownCircle size={16} /> {t.stockIn}
            </button>
          )}
          <div className={`rounded-[18px] border p-3.5 ${th.card} ${th.bdr}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${th.txm}`}>{t.totalIn}</p>
            <p className="text-xl font-black mt-1 text-[#4A8B3F]">+{totalInCount}</p>
          </div>
          <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
            {renderMovementList(stockInMovements, showAllIn, setShowAllIn, stockInMovements.length)}
          </div>
        </>
      )}

      {/* ======= STOCK OUT TAB ======= */}
      {activeTab === "stockOut" && (
        <>
          {canWrite && (
            <button onClick={() => { setStockModal("out"); setForm({ prod: "", qty: "", unit: "individual", price: "", note: "", expiryDate: "", supplierId: "", paymentTerms: "COD", paymentStatus: "unpaid" }); }}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-[#C4504A] flex items-center justify-center gap-2">
              <ArrowUpCircle size={16} /> {t.stockOut}
            </button>
          )}
          <div className={`rounded-[18px] border p-3.5 ${th.card} ${th.bdr}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${th.txm}`}>{t.totalOut}</p>
            <p className="text-xl font-black mt-1 text-[#C4504A]">-{totalOutCount}</p>
          </div>
          <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
            {renderMovementList(stockOutMovements, showAllOut, setShowAllOut, stockOutMovements.length)}
          </div>
        </>
      )}

      {/* ======= EXPIRY TAB ======= */}
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
                  <div key={batch.id} onClick={() => product && setDetailProductId(product.id)}
                    className={`flex items-center justify-between px-4 py-3 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdrSoft}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {product && <ProductImage product={product} size={32} />}
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${th.tx}`}>
                          {product ? (lang === "id" ? product.nameId : product.name) : batch.productId}
                        </p>
                        <p className={`text-[11px] ${th.txf}`}>
                          {batch.batchNumber} · {batch.quantity} {product?.unit || "pcs"}
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
                          ? (th.dark ? "bg-[#60A5FA]/15 text-[#60A5FA]" : "bg-[#EFF6FF] text-[#1E40AF]")
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

      {/* ======= HISTORY TAB ======= */}
      {activeTab === "history" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: t.totalIn, v: `+${totalInCount}`, clr: "#4A8B3F" },
              { l: t.totalOut, v: `-${totalOutCount}`, clr: "#C4504A" },
              { l: t.netChange, v: `${totalInCount - totalOutCount >= 0 ? "+" : ""}${totalInCount - totalOutCount}`, clr: "#5B8DEF" },
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

      {/* ======= SUPPLIERS TAB ======= */}
      {activeTab === "suppliers" && (
        <>
          {/* Unpaid Invoices */}
          {unpaidInvoices.length > 0 && (
            <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
              <div className={`px-5 py-3.5 border-b ${th.bdr} flex items-center gap-2`}>
                <CircleDollarSign size={14} className="text-[#E89B48]" />
                <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.unpaidInvoices} ({unpaidInvoices.length})</p>
              </div>
              {unpaidInvoices.map(inv => {
                const prod = products.find(p => p.id === inv.productId);
                const sup = suppliers.find(s => s.id === inv.supplierId);
                const isOverdue = inv.dueDate ? new Date(inv.dueDate) < new Date() : false;
                return (
                  <div key={inv.id} className={`flex items-center justify-between px-4 py-3 border-b last:border-0 ${th.bdrSoft}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold truncate ${th.tx}`}>{sup?.name || "\u2014"}</p>
                      <p className={`text-[11px] ${th.txf}`}>
                        {lang === "id" ? prod?.nameId : prod?.name} · {inv.quantity} · {$(inv.unitPrice * inv.quantity)}
                      </p>
                      <p className={`text-[10px] ${isOverdue ? "text-[#D4627A] font-bold" : th.txm}`}>
                        {t.dueDate}: {inv.dueDate ? formatDate(inv.dueDate) : "\u2014"}
                        {isOverdue && ` · ${t.overdue}`}
                      </p>
                    </div>
                    {canWrite && (
                      <button onClick={() => { updatePaymentStatus(inv.id, "paid"); toast.success(t.paid as string); }}
                        className={`shrink-0 ml-3 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 ${
                          th.dark ? "bg-[#4A8B3F]/15 text-[#4A8B3F]" : "bg-green-50 text-[#4A8B3F]"
                        }`}>
                        <Check size={12} /> {t.markAsPaid}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {unpaidInvoices.length === 0 && (
            <div className={`rounded-[18px] border p-3.5 flex items-center gap-2 ${th.card} ${th.bdr}`}>
              <Check size={14} className="text-[#4A8B3F]" />
              <p className={`text-sm font-semibold ${th.txm}`}>{t.noUnpaid}</p>
            </div>
          )}

          {/* Supplier list */}
          <div className="flex items-center justify-between">
            <p className={`text-[15px] font-extrabold tracking-tight ${th.tx}`}>{t.suppliers}</p>
            {canWrite && (
              <button onClick={() => { setSupplierModal("add"); setSupForm({ name: "", phone: "", email: "", address: "" }); }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]">
                <Plus size={13} /> {t.addSupplier}
              </button>
            )}
          </div>

          {suppliers.length === 0 ? (
            <div className={`rounded-[22px] border p-8 text-center ${th.card} ${th.bdr}`}>
              <Truck size={36} className={`mx-auto opacity-20 mb-2 ${th.txm}`} />
              <p className={`text-sm font-semibold ${th.txm}`}>{t.noSuppliers}</p>
            </div>
          ) : (
            <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
              {suppliers.map((sup, i) => (
                <div key={sup.id} onClick={() => setDetailSupplierId(sup.id)}
                  className={`px-5 py-3.5 cursor-pointer active:opacity-70 ${i > 0 ? `border-t ${th.bdr}` : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold ${th.tx}`}>{sup.name}</p>
                      <p className={`text-[11px] ${th.txm}`}>
                        {sup.phone}{sup.email ? ` · ${sup.email}` : ""}
                      </p>
                      {sup.address && <p className={`text-[10px] mt-0.5 ${th.txf}`}>{sup.address}</p>}
                    </div>
                    {canWrite && (
                      <div className="flex gap-1.5 shrink-0 ml-3">
                        <button onClick={(e) => {
                          e.stopPropagation();
                          setEditSupplierId(sup.id);
                          setSupForm({ name: sup.name, phone: sup.phone, email: sup.email, address: sup.address });
                          setSupplierModal("edit");
                        }}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${th.dark ? "bg-[#5B8DEF]/15 text-[#5B8DEF]" : "bg-blue-50 text-[#5B8DEF]"}`}>
                          {t.editSupplier}
                        </button>
                        {confirmDeleteSupplierId === sup.id ? (
                          <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setConfirmDeleteSupplierId(null)}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${th.bdr} ${th.txm}`}>
                              {t.cancel}
                            </button>
                            <button onClick={() => { deleteSupplier(sup.id); setConfirmDeleteSupplierId(null); toast.success(t.supplierDeleted as string); }}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white bg-[#C4504A]">
                              {t.confirm}
                            </button>
                          </div>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteSupplierId(sup.id); }}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${th.dark ? "bg-[#C4504A]/15 text-[#C4504A]" : "bg-red-50 text-[#C4504A]"}`}>
                            {t.deleteSupplier}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}


      {/* ======= MODALS ======= */}

      {/* Stock In/Out modal */}
      <Modal open={!!stockModal} onClose={() => setStockModal(null)} title={(stockModal === "in" ? t.stockIn : t.stockOut) as string}>
        <div className="flex flex-col gap-3.5">
          <div className="relative">
            <SearchableSelect
              value={form.prod}
              onChange={(prodId) => {
                if (stockModal === "out") {
                  const sp = products.find(p => p.id === prodId);
                  setForm({ ...form, prod: prodId, price: sp ? String(form.unit === "box" ? sp.sellingPrice * sp.qtyPerBox : sp.sellingPrice) : "" });
                } else {
                  setForm({ ...form, prod: prodId });
                }
              }}
              placeholder={t.selectProduct as string}
              options={products.map(p => ({
                id: p.id,
                label: lang === "id" ? p.nameId : p.name,
                subtitle: `SKU ${p.sku} · Stok ${p.stock}`,
              }))}
            />
          </div>

          {/* Supplier & Payment (stock-in only) */}
          {stockModal === "in" && (
            <>
              <div className="relative">
                <select value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}
                  className={`w-full px-4 py-3 text-sm rounded-2xl border appearance-none ${th.inp}`}>
                  <option value="">{t.selectSupplier}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 ${th.txf}`} />
              </div>
              {form.supplierId && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.paymentTerms}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PAYMENT_TERMS_OPTIONS.map(pt => (
                        <button key={pt} onClick={() => setForm({ ...form, paymentTerms: pt })}
                          className={`py-2 rounded-xl text-[11px] font-bold ${
                            form.paymentTerms === pt ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]" : `border ${th.bdr} ${th.txm}`
                          }`}>{pt}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.paymentStatus}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["unpaid", "paid"] as PaymentStatus[]).map(ps => (
                        <button key={ps} onClick={() => setForm({ ...form, paymentStatus: ps })}
                          className={`py-2 rounded-xl text-[11px] font-bold ${
                            form.paymentStatus === ps
                              ? (ps === "paid" ? "text-white bg-[#4A8B3F]" : "text-white bg-[#E89B48]")
                              : `border ${th.bdr} ${th.txm}`
                          }`}>{ps === "paid" ? t.paid : t.unpaid}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.unitType}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(["individual", "box"] as UnitType[]).map(ut => (
                  <button key={ut} onClick={() => {
                    if (stockModal === "out" && form.prod) {
                      const sp = products.find(p => p.id === form.prod);
                      setForm({ ...form, unit: ut, price: sp ? String(ut === "box" ? sp.sellingPrice * sp.qtyPerBox : sp.sellingPrice) : "" });
                    } else {
                      setForm({ ...form, unit: ut });
                    }
                  }}
                    className={`py-2.5 rounded-xl text-xs font-bold ${
                      form.unit === ut ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]" : `border ${th.bdr} ${th.txm}`
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
                className={inp} min="1" />
            </div>
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.price}</p>
            <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
              placeholder={form.prod ? (() => {
                const p = products.find(pr => pr.id === form.prod);
                if (!p) return "";
                const val = stockModal === "in"
                  ? (form.unit === "box" ? p.purchasePrice * p.qtyPerBox : p.purchasePrice)
                  : (form.unit === "box" ? p.sellingPrice * p.qtyPerBox : p.sellingPrice);
                return $(val);
              })() : ""}
              className={inp} min="0" />
          </div>
          {stockModal === "in" && (
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.expiryDate}</p>
              <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })}
                className={inp} />
            </div>
          )}
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.note}</p>
            <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2}
              className={`w-full px-4 py-2.5 text-sm rounded-xl border resize-none ${th.inp}`} />
          </div>
          {form.prod && (
            <button onClick={() => { const p = products.find(pr => pr.id === form.prod); if (p) printBarcodeLabel(p, lang, { width: labelWidth, height: labelHeight }); }}
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
            <input value={newProd.name} onChange={e => { setNewProd({ ...newProd, name: e.target.value }); setProdFormErrors(p => ({ ...p, name: false })); }}
              className={`${inp} ${prodFormErrors.name ? "!border-red-400" : ""}`} />
            {prodFormErrors.name && <p className="text-red-400 text-[10px] mt-1 font-medium">{t.required}</p>}
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.productNameId}</p>
            <input value={newProd.nameId} onChange={e => { setNewProd({ ...newProd, nameId: e.target.value }); setProdFormErrors(p => ({ ...p, nameId: false })); }}
              className={`${inp} ${prodFormErrors.nameId ? "!border-red-400" : ""}`} />
            {prodFormErrors.nameId && <p className="text-red-400 text-[10px] mt-1 font-medium">{t.required}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.sku}</p>
              <input value={newProd.sku} onChange={e => { setNewProd({ ...newProd, sku: e.target.value }); setProdFormErrors(p => ({ ...p, sku: false })); }}
                className={`${inp} ${prodFormErrors.sku ? "!border-red-400" : ""}`} />
              {prodFormErrors.sku && <p className="text-red-400 text-[10px] mt-1 font-medium">{t.required}</p>}
            </div>
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{lang === "id" ? "Kategori" : "Category"}</p>
              <SearchableSelect
                value={newProd.category}
                onChange={(cat) => {
                  const sku = generateSku(cat, products, categories);
                  setNewProd({ ...newProd, category: cat, sku });
                }}
                placeholder={lang === "id" ? "Pilih kategori" : "Select category"}
                options={categories.map(c => ({
                  id: c.id,
                  label: lang === "id" ? c.nameId : c.name,
                }))}
              />
            </div>
          </div>
          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.purchasePrice}</p>
              <input type="number" value={newProd.purchasePrice} onChange={e => setNewProd({ ...newProd, purchasePrice: e.target.value })}
                className={inp} min="0" />
            </div>
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.sellingPrice}</p>
              <input type="number" value={newProd.sellingPrice} onChange={e => setNewProd({ ...newProd, sellingPrice: e.target.value })}
                className={inp} min="0" />
            </div>
          </div>
          {/* Member price */}
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>💎 Harga Member <span className={`font-normal ${th.txm}`}>(opsional)</span></p>
            <input type="number" value={newProd.memberPrice} onChange={e => setNewProd({ ...newProd, memberPrice: e.target.value })}
              className={inp} min="0" placeholder="Kosongkan = sama dengan harga jual" />
            {newProd.memberPrice && newProd.sellingPrice && parseInt(newProd.memberPrice) > 0 && (() => {
              const purchase = parseInt(newProd.purchasePrice) || 0;
              const member = parseInt(newProd.memberPrice) || 0;
              const sell = parseInt(newProd.sellingPrice) || 0;
              const memberMargin = purchase > 0 ? ((member - purchase) / purchase * 100) : 0;
              const memberDiscount = sell > 0 ? ((sell - member) / sell * 100) : 0;
              return (
                <p className={`text-[11px] mt-1 font-medium ${memberMargin < 0 ? "text-red-500" : memberMargin < 10 ? "text-[#E89B48]" : th.acc}`}>
                  Diskon member: {memberDiscount.toFixed(1)}% · Margin member: {memberMargin.toFixed(1)}%
                </p>
              );
            })()}
          </div>
          {/* Box price hint */}
          {newProd.sellingPrice && newProd.qtyPerBox && (
            <p className={`text-[11px] -mt-1 font-medium ${th.acc}`}>
              {t.boxPrice}: {$((parseInt(newProd.sellingPrice) || 0) * (parseInt(newProd.qtyPerBox) || 0))}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.qtyPerBox}</p>
              <input type="number" value={newProd.qtyPerBox} onChange={e => setNewProd({ ...newProd, qtyPerBox: e.target.value })}
                className={inp} min="1" />
            </div>
            <div className="relative">
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.unitLabel}</p>
              <select value={newProd.unit} onChange={e => setNewProd({ ...newProd, unit: e.target.value as UnitOfMeasure })}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border appearance-none ${th.inp}`}>
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <ChevronDown size={14} className={`absolute right-4 bottom-3 ${th.txf}`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{lang === "id" ? "Stok Awal" : "Initial Stock"}</p>
              <input type="number" value={newProd.stock} onChange={e => setNewProd({ ...newProd, stock: e.target.value })}
                className={inp} min="0" />
            </div>
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.minStockLabel}</p>
              <input type="number" value={newProd.minStock} onChange={e => setNewProd({ ...newProd, minStock: e.target.value })}
                className={inp} min="0" />
            </div>
          </div>
          {/* Image upload */}
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.uploadImage}</p>
            <div className="flex items-center gap-3">
              <label className={`flex-1 py-2.5 rounded-xl border text-center text-xs font-bold cursor-pointer ${th.bdr} ${th.txm}`}>
                {t.chooseImage}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
              {newProd.image && (
                <div className="relative">
                  <img src={newProd.image} alt="preview" className="w-12 h-12 rounded-xl object-cover" />
                  <button onClick={() => setNewProd({ ...newProd, image: "" })} aria-label="Remove image"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#C4504A] text-white flex items-center justify-center">
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => setAddProdOpen(false)} className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
            <button onClick={doAddProduct} disabled={!newProd.name || !newProd.nameId || !newProd.sku}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] disabled:opacity-40">{t.save}</button>
          </div>
        </div>
      </Modal>

      {/* Add Category modal */}
      <Modal open={addCatOpen} onClose={() => setAddCatOpen(false)} title={t.addCategory as string}>
        <div className="flex flex-col gap-3">
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.categoryName}</p>
            <input value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })}
              className={inp} />
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.categoryNameId}</p>
            <input value={newCat.nameId} onChange={e => setNewCat({ ...newCat, nameId: e.target.value })}
              className={inp} />
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
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] disabled:opacity-40">{t.save}</button>
          </div>
        </div>
      </Modal>

      {/* Supplier Add/Edit modal */}
      <Modal open={!!supplierModal} onClose={() => { setSupplierModal(null); setEditSupplierId(null); }}
        title={(supplierModal === "edit" ? t.editSupplier : t.addSupplier) as string}>
        <div className="flex flex-col gap-3">
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.supplierName}</p>
            <input value={supForm.name} onChange={e => setSupForm({ ...supForm, name: e.target.value })}
              className={inp} />
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.supplierPhone}</p>
            <input value={supForm.phone} onChange={e => setSupForm({ ...supForm, phone: e.target.value })}
              className={inp} type="tel" />
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.supplierEmail}</p>
            <input value={supForm.email} onChange={e => setSupForm({ ...supForm, email: e.target.value })}
              className={inp} type="email" />
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.supplierAddress}</p>
            <textarea value={supForm.address} onChange={e => setSupForm({ ...supForm, address: e.target.value })} rows={2}
              className={`w-full px-4 py-2.5 text-sm rounded-xl border resize-none ${th.inp}`} />
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => { setSupplierModal(null); setEditSupplierId(null); }}
              className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
            <button onClick={supplierModal === "edit" ? doEditSupplier : doAddSupplier}
              disabled={!supForm.name.trim()}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] disabled:opacity-40">{t.save}</button>
          </div>
        </div>
      </Modal>
      {/* Edit Product modal */}
      <Modal open={editProdOpen} onClose={() => setEditProdOpen(false)} title={t.editProduct as string}>
        <div className="flex flex-col gap-3">
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.productName}</p>
            <input value={editProd.name} onChange={e => setEditProd({ ...editProd, name: e.target.value })}
              className={inp} />
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.productNameId}</p>
            <input value={editProd.nameId} onChange={e => setEditProd({ ...editProd, nameId: e.target.value })}
              className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.sku}</p>
              <input value={editProd.sku} onChange={e => setEditProd({ ...editProd, sku: e.target.value })}
                className={inp} />
            </div>
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{lang === "id" ? "Kategori" : "Category"}</p>
              <SearchableSelect
                value={editProd.category}
                onChange={(cat) => setEditProd({ ...editProd, category: cat })}
                placeholder={lang === "id" ? "Pilih kategori" : "Select category"}
                options={categories.map(c => ({
                  id: c.id,
                  label: lang === "id" ? c.nameId : c.name,
                }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.purchasePrice}</p>
              <input type="number" value={editProd.purchasePrice} onChange={e => setEditProd({ ...editProd, purchasePrice: e.target.value })}
                className={inp} min="0" />
            </div>
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.sellingPrice}</p>
              <input type="number" value={editProd.sellingPrice} onChange={e => setEditProd({ ...editProd, sellingPrice: e.target.value })}
                className={inp} min="0" />
            </div>
          </div>
          {/* Member price */}
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>💎 Harga Member <span className={`font-normal ${th.txm}`}>(opsional)</span></p>
            <input type="number" value={editProd.memberPrice} onChange={e => setEditProd({ ...editProd, memberPrice: e.target.value })}
              className={inp} min="0" placeholder="Kosongkan = sama dengan harga jual" />
            {editProd.memberPrice && editProd.sellingPrice && parseInt(editProd.memberPrice) > 0 && (() => {
              const purchase = parseInt(editProd.purchasePrice) || 0;
              const member = parseInt(editProd.memberPrice) || 0;
              const sell = parseInt(editProd.sellingPrice) || 0;
              const memberMargin = purchase > 0 ? ((member - purchase) / purchase * 100) : 0;
              const memberDiscount = sell > 0 ? ((sell - member) / sell * 100) : 0;
              return (
                <p className={`text-[11px] mt-1 font-medium ${memberMargin < 0 ? "text-red-500" : memberMargin < 10 ? "text-[#E89B48]" : th.acc}`}>
                  Diskon member: {memberDiscount.toFixed(1)}% · Margin member: {memberMargin.toFixed(1)}%
                </p>
              );
            })()}
          </div>
          {editProd.sellingPrice && editProd.qtyPerBox && (
            <p className={`text-[11px] -mt-1 font-medium ${th.acc}`}>
              {t.boxPrice}: {$((parseInt(editProd.sellingPrice) || 0) * (parseInt(editProd.qtyPerBox) || 0))}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.qtyPerBox}</p>
              <input type="number" value={editProd.qtyPerBox} onChange={e => setEditProd({ ...editProd, qtyPerBox: e.target.value })}
                className={inp} min="1" />
            </div>
            <div className="relative">
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.unitLabel}</p>
              <select value={editProd.unit} onChange={e => setEditProd({ ...editProd, unit: e.target.value as UnitOfMeasure })}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border appearance-none ${th.inp}`}>
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <ChevronDown size={14} className={`absolute right-4 bottom-3 ${th.txf}`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{lang === "id" ? "Stok" : "Stock"}</p>
              <input type="number" value={editProd.stock} onChange={e => setEditProd({ ...editProd, stock: e.target.value })}
                className={inp} min="0" />
            </div>
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.minStockLabel}</p>
              <input type="number" value={editProd.minStock} onChange={e => setEditProd({ ...editProd, minStock: e.target.value })}
                className={inp} min="0" />
            </div>
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>{t.uploadImage}</p>
            <div className="flex items-center gap-3">
              <label className={`flex-1 py-2.5 rounded-xl border text-center text-xs font-bold cursor-pointer ${th.bdr} ${th.txm}`}>
                {t.chooseImage}
                <input type="file" accept="image/*" onChange={handleEditImageUpload} className="hidden" />
              </label>
              {editProd.image && (
                <div className="relative">
                  <img src={editProd.image} alt="preview" className="w-12 h-12 rounded-xl object-cover" />
                  <button onClick={() => setEditProd({ ...editProd, image: "" })} aria-label="Remove image"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#C4504A] text-white flex items-center justify-center">
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => setEditProdOpen(false)} className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
            <button onClick={doEditProduct} disabled={!editProd.name || !editProd.nameId || !editProd.sku}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] disabled:opacity-40">{t.save}</button>
          </div>
        </div>
      </Modal>
      <ProductDetailModal productId={detailProductId} onClose={() => setDetailProductId(null)} />
      <SupplierDetailModal supplierId={detailSupplierId} onClose={() => setDetailSupplierId(null)} />

      {/* Print Labels Modal — option to include expiry date */}
      {/* Confirm Delete Product */}
      <Modal open={!!confirmDeleteProductId} onClose={() => setConfirmDeleteProductId(null)} title="Hapus Produk?">
        {(() => {
          const p = products.find(pr => pr.id === confirmDeleteProductId);
          return (
            <div className="flex flex-col gap-3">
              <p className={`text-sm ${th.tx}`}>
                {p ? <>Produk <b>{lang === "id" ? p.nameId : p.name}</b> (SKU {p.sku}) akan dihapus.</> : "Produk akan dihapus."}
              </p>
              <div className={`rounded-xl border px-3 py-2.5 text-[11px] ${th.dark ? "border-[#E89B48]/30 bg-[#E89B48]/5 text-[#E89B48]" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                ⚠️ Produk akan hilang dari daftar dan POS. Riwayat transaksi lama tetap aman (nama & harga sudah tersimpan di order).
                <br />
                <span className="opacity-70">Kalau ragu, pakai toggle "Sembunyikan dari POS" saja.</span>
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setConfirmDeleteProductId(null)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${th.bdr} ${th.txm}`}>
                  Batal
                </button>
                <button
                  onClick={async () => {
                    if (confirmDeleteProductId) {
                      await deleteProduct(confirmDeleteProductId);
                      toast.success("Produk dihapus");
                    }
                    setConfirmDeleteProductId(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#C4504A]"
                >
                  Hapus
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={labelModalOpen} onClose={() => setLabelModalOpen(false)} title="Print Barcode Label">
        <div className="flex flex-col gap-3">
          <p className={`text-xs ${th.txm}`}>
            {selectedIds.size} produk akan dicetak.
          </p>

          <label className={`flex items-center gap-2 cursor-pointer px-3 py-2.5 rounded-xl border ${th.bdr}`}>
            <input type="checkbox" checked={labelIncludeExpiry}
              onChange={e => setLabelIncludeExpiry(e.target.checked)}
              className="w-4 h-4 rounded accent-[#1E40AF]" />
            <span className={`text-sm font-bold ${th.tx}`}>Tampilkan tanggal kadaluarsa</span>
          </label>

          {labelIncludeExpiry && (
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>Tanggal kadaluarsa</p>
              <input type="date" value={labelExpiryDate}
                onChange={e => setLabelExpiryDate(e.target.value)}
                className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
              <p className={`text-[10px] mt-1 ${th.txm}`}>
                Berlaku untuk semua {selectedIds.size} label yang dicetak.
              </p>
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <button onClick={() => setLabelModalOpen(false)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${th.bdr} ${th.txm}`}>
              Batal
            </button>
            <button onClick={() => {
              const selected = products.filter(p => selectedIds.has(p.id));
              printBarcodeLabels(
                selected, lang,
                { width: labelWidth, height: labelHeight },
                labelIncludeExpiry && labelExpiryDate ? { expiryDate: labelExpiryDate } : undefined
              );
              setLabelModalOpen(false);
            }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#1E40AF]`}>
              Print
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
