import { useState, useMemo } from "react";
import { useCategoryStore, useProductStore, useInventoryStore, useBatchStore, useAuthStore, useLangStore } from "@/stores";
import { Modal } from "@/components/Modal";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatTime, genId } from "@/utils";
import type { UnitType, StockType } from "@/types";
import toast from "react-hot-toast";
import {
  Package, Plus, ChevronDown, ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";

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
  const { movements, addMovement, totalIn, totalOut } = useInventoryStore();
  const { addBatch, consumeFIFO } = useBatchStore();
  const user = useAuthStore(s => s.user)!;

  const [stockModal, setStockModal] = useState<StockType | null>(null);
  const [form, setForm] = useState({ prod: "", qty: "", unit: "individual" as UnitType, price: "", note: "", expiryDate: "" });
  const [addProdOpen, setAddProdOpen] = useState(false);
  const [newProd, setNewProd] = useState({ name: "", nameId: "", sku: "", category: "c1", priceIndividual: "", priceBox: "", qtyPerBox: "12", stock: "0", unit: "kg", image: "", minStock: "10" });
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", nameId: "", color: "#C4884A" });
  const catColors = ["#C4884A", "#D4627A", "#5B8DEF", "#7D5A44", "#8B6FC0", "#6F9A4D", "#E89B48", "#2BA5B5", "#9B59B6", "#E74C3C"];
  const [showAll, setShowAll] = useState(false);

  // Group movements by date
  const groupedMovements = useMemo(() => {
    const visible = showAll ? movements : movements.slice(0, 10);
    const groups: { label: string; items: typeof movements }[] = [];
    visible.forEach(m => {
      const label = getDateLabel(m.createdAt, t);
      const existing = groups.find(g => g.label === label);
      if (existing) existing.items.push(m);
      else groups.push({ label, items: [m] });
    });
    return groups;
  }, [movements, showAll, t]);

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

  return (
    <div className="flex flex-col gap-4">
      <h1 className={`text-[22px] font-black tracking-tight ${th.tx}`}>{t.inventory}</h1>

      <div className="flex gap-2.5">
        <button onClick={() => { setStockModal("in"); setForm({ prod: "", qty: "", unit: "individual", price: "", note: "", expiryDate: "" }); }}
          className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-[#4A8B3F] flex items-center justify-center gap-2">
          <ArrowDownCircle size={16} /> {t.stockIn}
        </button>
        <button onClick={() => { setStockModal("out"); setForm({ prod: "", qty: "", unit: "individual", price: "", note: "", expiryDate: "" }); }}
          className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-[#C4504A] flex items-center justify-center gap-2">
          <ArrowUpCircle size={16} /> {t.stockOut}
        </button>
      </div>
      {(user.role === "superadmin" || user.role === "admin") && (
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

      {/* Movement log with date grouping */}
      <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
        <div className={`px-5 py-3.5 border-b ${th.bdr}`}>
          <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.movementLog}</p>
        </div>
        {movements.length === 0 ? (
          <div className={`py-10 text-center ${th.txm}`}>
            <Package size={36} className="mx-auto opacity-20 mb-2" />
            <p className="text-sm font-semibold">{t.noMovements}</p>
          </div>
        ) : (
          <>
            {groupedMovements.map((group) => (
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
            {!showAll && movements.length > 10 && (
              <button onClick={() => setShowAll(true)}
                className={`w-full py-3 text-sm font-bold ${th.acc} hover:opacity-70`}>
                {t.loadMore} ({movements.length - 10})
              </button>
            )}
          </>
        )}
      </div>

      {/* Stock modal */}
      <Modal open={!!stockModal} onClose={() => setStockModal(null)} title={(stockModal === "in" ? t.stockIn : t.stockOut) as string}>
        <div className="flex flex-col gap-3.5">
          <div className="relative">
            <select value={form.prod} onChange={e => setForm({ ...form, prod: e.target.value })}
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
                  <button key={ut} onClick={() => setForm({ ...form, unit: ut })}
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
