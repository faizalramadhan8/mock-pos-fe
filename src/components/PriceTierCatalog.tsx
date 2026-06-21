import { useMemo, useState } from "react";
import { useLangStore, useProductStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $ } from "@/utils";
import { Modal } from "./Modal";
import { PriceTierEditor } from "./PriceTierEditor";
import { TierHistoryModal } from "./TierHistoryModal";
import { productApi } from "@/api";
import { Pencil, Plus, Search, Tag, Trash2, Users, UserCheck, History, Settings } from "lucide-react";
import toast from "react-hot-toast";
import type { Product, ProductPriceTier } from "@/types";

interface Props {
  canWrite: boolean;
}

/**
 * Dedicated catalog untuk admin manage tiered pricing per produk.
 * Grouped per produk; reuse PriceTierEditor untuk add/edit/remove flow.
 *
 * Filter: "Semua / Yang Ada Tier" + search by nama / SKU. Default tampil
 * yang sudah punya tier (paling relevan saat admin maintain) + tombol
 * "+ Tambah untuk Produk Lain" untuk pilih produk baru.
 */
export function PriceTierCatalog({ canWrite }: Props) {
  const th = useThemeClasses();
  const { lang } = useLangStore();
  const products = useProductStore(s => s.products);

  const [filter, setFilter] = useState<"with_tiers" | "all">("with_tiers");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  // Tier history view — buka untuk audit "kapan tier diubah / dihapus".
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [deletingTierId, setDeletingTierId] = useState<string | null>(null);
  const fetchProducts = useProductStore(s => s.fetchProducts);

  const deleteTier = async (productId: string, tier: ProductPriceTier) => {
    const ok = confirm(`Hapus tier "Beli ${tier.minQty} = ${$(Math.round(tier.price * tier.minQty))}"?`);
    if (!ok) return;
    setDeletingTierId(tier.id);
    try {
      await productApi.deleteTier(productId, tier.id);
      toast.success("Tier dihapus");
      void fetchProducts();
    } catch (e: any) {
      toast.error(e?.message || "Gagal hapus tier");
    } finally {
      setDeletingTierId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list: Product[] = products.filter(p => p.isActive);
    if (filter === "with_tiers") {
      list = list.filter(p => (p.priceTiers || []).length > 0);
    }
    if (q) {
      list = list.filter(p =>
        (lang === "id" ? p.nameId : p.name).toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, filter, query, lang]);

  const eligibleForPicker = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    // No slice cap — modal punya max-h-[60vh] overflow-y-auto. Slice 30
    // sebelumnya bikin user kira "cuma huruf A" karena alphabetical sort.
    return products
      .filter(p => p.isActive && (p.priceTiers || []).length === 0)
      .filter(p =>
        !q ||
        (lang === "id" ? p.nameId : p.name).toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, pickerQuery, lang]);

  const withTiersCount = useMemo(
    () => products.filter(p => p.isActive && (p.priceTiers || []).length > 0).length,
    [products]
  );

  return (
    <div className="space-y-4">
      {/* Info card */}
      <div className={`p-4 rounded-2xl border ${th.bdr} ${th.card2}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FFE4E9] text-[#E11D48] shrink-0">
            <Tag size={18} strokeWidth={2.4} />
          </div>
          <div>
            <p className={`text-base font-extrabold ${th.tx}`}>Harga Khusus / Grosir</p>
            <p className={`text-sm mt-0.5 ${th.txm}`}>
              Atur harga khusus berdasarkan jumlah beli. Pilih target "Semua Customer"
              supaya berlaku untuk member maupun walk-in, atau "Member Tertentu" untuk
              batasi ke member yang di-pilih.
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl overflow-hidden border">
          {(["with_tiers", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 text-sm font-bold ${filter === f ? "bg-[#E11D48] text-white" : `${th.elev} ${th.txm}`}`}>
              {f === "with_tiers" ? `Sudah punya tier (${withTiersCount})` : "Semua produk"}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[180px] relative">
          <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${th.txf}`} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari nama atau SKU…"
            className={`w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
        </div>
        {canWrite && (
          <button
            onClick={() => { setPickerOpen(true); setPickerQuery(""); }}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] inline-flex items-center gap-1.5">
            <Plus size={16} strokeWidth={2.6} /> Tambah untuk Produk Lain
          </button>
        )}
      </div>

      {/* List of products */}
      {filtered.length === 0 ? (
        <div className={`text-center py-12 rounded-2xl border ${th.bdr} ${th.card2}`}>
          <Tag size={40} className="mx-auto opacity-20 mb-2" />
          <p className={`text-base font-bold ${th.tx}`}>
            {filter === "with_tiers" ? "Belum ada produk dengan tier" : "Tidak ada produk cocok"}
          </p>
          {filter === "with_tiers" && canWrite && (
            <p className={`text-sm mt-1 ${th.txm}`}>
              Klik "Tambah untuk Produk Lain" untuk mulai.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const tiers = p.priceTiers || [];
            return (
              <div key={p.id} className={`rounded-2xl border overflow-hidden ${th.card} ${th.bdr}`}>
                <div className={`px-4 py-3 border-b ${th.bdr} flex items-center justify-between gap-2`}>
                  <div className="min-w-0">
                    <p className={`text-base font-extrabold truncate ${th.tx}`}>
                      {lang === "id" ? p.nameId : p.name}
                    </p>
                    <p className={`text-sm font-mono ${th.txf}`}>
                      {p.sku} · normal {$(p.sellingPrice)}
                      {typeof p.memberPrice === "number" && p.memberPrice > 0 && (
                        <> · member {$(p.memberPrice)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canWrite && (
                      <button
                        onClick={() => setHistoryProductId(p.id)}
                        aria-label="Riwayat perubahan tier"
                        title="Riwayat tier"
                        className={`px-3 py-2 rounded-lg text-sm font-bold ${th.elev} ${th.txm} inline-flex items-center gap-1.5`}>
                        <History size={16} strokeWidth={2.6} /> Riwayat
                      </button>
                    )}
                    {canWrite && (
                      <button
                        onClick={() => setOpenProductId(p.id)}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] inline-flex items-center gap-1.5">
                        <Settings size={16} strokeWidth={2.6} /> Atur Tier
                      </button>
                    )}
                  </div>
                </div>
                {tiers.length === 0 ? (
                  <p className={`px-4 py-3 text-sm ${th.txm}`}>Belum ada tier — klik "Atur Tier" untuk tambah.</p>
                ) : (
                  <div className="px-4 py-3 space-y-2">
                    {tiers.map(t => (
                      <div key={t.id} className={`flex items-center gap-2 text-base flex-wrap px-3 py-2.5 rounded-lg ${th.elev}`}>
                        <span className={`font-bold ${th.tx} shrink-0`}>Beli {t.minQty}</span>
                        <span className={`${th.txm} shrink-0`}>=</span>
                        <span className={`font-black ${th.acc} shrink-0`}>{$(Math.round(t.price * t.minQty))}</span>
                        <span className={`text-sm ${th.txf} shrink-0`}>({$(Math.round(t.price))}/satuan)</span>
                        <span className={`text-sm inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${th.accBg} ${th.acc} font-semibold`}>
                          {t.target === "all_customers" ? (
                            <><Users size={14} strokeWidth={2.8} /> Semua customer</>
                          ) : (
                            <><UserCheck size={14} strokeWidth={2.8} /> {(t.members || []).length} member</>
                          )}
                        </span>
                        {(() => {
                          if (!t.expiresAt) return null;
                          const ms = new Date(t.expiresAt).getTime();
                          const now = Date.now();
                          const expired = ms < now;
                          const daysLeft = Math.ceil((ms - now) / 86400000);
                          return expired ? (
                            <span className="text-sm font-bold inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#FCE4EC] text-[#BE123C]">
                              Sudah expire
                            </span>
                          ) : (
                            <span className={`text-sm font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-md ${th.elev} ${th.txm}`}>
                              Sisa {daysLeft} hari
                            </span>
                          );
                        })()}
                        {t.note && <span className={`text-sm ${th.txf} truncate flex-1 min-w-0`}>· {t.note}</span>}
                        {canWrite && (
                          <div className="ml-auto flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => setOpenProductId(p.id)}
                              aria-label="Edit tier"
                              title="Edit tier"
                              className={`w-9 h-9 rounded-lg flex items-center justify-center ${th.elev} ${th.tx} active:scale-90 transition-transform`}>
                              <Pencil size={16} strokeWidth={2.6} />
                            </button>
                            <button
                              onClick={() => deleteTier(p.id, t)}
                              aria-label="Hapus tier"
                              title="Hapus tier"
                              disabled={deletingTierId === t.id}
                              className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#FCE4EC] text-[#BE123C] active:scale-90 transition-transform disabled:opacity-50">
                              <Trash2 size={16} strokeWidth={2.6} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add-product picker modal */}
      {canWrite && (
        <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Pilih Produk untuk Tier Baru" size="lg">
          <div className="relative mb-3">
            <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${th.txf}`} />
            <input
              autoFocus
              value={pickerQuery}
              onChange={e => setPickerQuery(e.target.value)}
              placeholder="Cari nama atau SKU…"
              className={`w-full pl-10 pr-3 py-3 text-sm rounded-xl border ${th.inp}`} />
          </div>
          {eligibleForPicker.length === 0 ? (
            <p className={`text-center py-8 text-sm ${th.txm}`}>
              Semua produk aktif sudah punya tier, atau tidak ada produk cocok.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto space-y-1.5">
              {eligibleForPicker.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setPickerOpen(false); setOpenProductId(p.id); }}
                  className={`w-full text-left flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border active:scale-[.98] transition-transform ${th.bdr} ${th.card2}`}>
                  <div className="min-w-0">
                    <p className={`text-base font-bold truncate ${th.tx}`}>{lang === "id" ? p.nameId : p.name}</p>
                    <p className={`text-sm font-mono ${th.txf}`}>{p.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-base font-bold ${th.acc}`}>{$(p.sellingPrice)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Per-product tier editor modal — reuse PriceTierEditor */}
      <Modal
        open={openProductId !== null}
        onClose={() => setOpenProductId(null)}
        title={(() => {
          const p = openProductId ? products.find(x => x.id === openProductId) : null;
          return p ? `Atur Tier: ${lang === "id" ? p.nameId : p.name}` : "Atur Tier";
        })()}
        size="lg"
      >
        {openProductId && <PriceTierEditor productId={openProductId} />}
      </Modal>

      {/* Audit timeline modal — admin-only via canWrite gate. */}
      <TierHistoryModal
        productId={historyProductId}
        open={historyProductId !== null}
        onClose={() => setHistoryProductId(null)}
      />
    </div>
  );
}
