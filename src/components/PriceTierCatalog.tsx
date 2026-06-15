import { useMemo, useState } from "react";
import { useLangStore, useProductStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $ } from "@/utils";
import { Modal } from "./Modal";
import { PriceTierEditor } from "./PriceTierEditor";
import { Plus, Search, Tag, Users, UserCheck } from "lucide-react";
import type { Product } from "@/types";

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
    return products
      .filter(p => p.isActive && (p.priceTiers || []).length === 0)
      .filter(p =>
        !q ||
        (lang === "id" ? p.nameId : p.name).toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30);
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
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FFE4E9] text-[#E11D48] shrink-0">
            <Tag size={16} strokeWidth={2.4} />
          </div>
          <div>
            <p className={`text-sm font-extrabold ${th.tx}`}>Harga Khusus Member</p>
            <p className={`text-xs mt-0.5 ${th.txm}`}>
              Atur harga khusus berdasarkan jumlah beli untuk member. Walk-in
              non-member selalu bayar harga jual normal. Member yang beli sesuai
              jumlah minimum dapat tier; bisa target semua member atau member tertentu.
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
              className={`px-3 py-2 text-xs font-bold ${filter === f ? "bg-[#E11D48] text-white" : `${th.elev} ${th.txm}`}`}>
              {f === "with_tiers" ? `Sudah punya tier (${withTiersCount})` : "Semua produk"}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[180px] relative">
          <Search size={12} className={`absolute left-3 top-1/2 -translate-y-1/2 ${th.txf}`} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari nama atau SKU…"
            className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${th.inp}`} />
        </div>
        {canWrite && (
          <button
            onClick={() => { setPickerOpen(true); setPickerQuery(""); }}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] inline-flex items-center gap-1.5">
            <Plus size={14} strokeWidth={2.6} /> Tambah untuk Produk Lain
          </button>
        )}
      </div>

      {/* List of products */}
      {filtered.length === 0 ? (
        <div className={`text-center py-12 rounded-2xl border ${th.bdr} ${th.card2}`}>
          <Tag size={36} className="mx-auto opacity-20 mb-2" />
          <p className={`text-sm font-bold ${th.tx}`}>
            {filter === "with_tiers" ? "Belum ada produk dengan tier" : "Tidak ada produk cocok"}
          </p>
          {filter === "with_tiers" && canWrite && (
            <p className={`text-xs mt-1 ${th.txm}`}>
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
                    <p className={`text-sm font-extrabold truncate ${th.tx}`}>
                      {lang === "id" ? p.nameId : p.name}
                    </p>
                    <p className={`text-xs font-mono ${th.txf}`}>
                      {p.sku} · normal {$(p.sellingPrice)}
                      {typeof p.memberPrice === "number" && p.memberPrice > 0 && (
                        <> · member {$(p.memberPrice)}</>
                      )}
                    </p>
                  </div>
                  {canWrite && (
                    <button
                      onClick={() => setOpenProductId(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${th.elev} ${th.tx} inline-flex items-center gap-1`}>
                      <Plus size={12} strokeWidth={2.8} /> Tier
                    </button>
                  )}
                </div>
                {tiers.length === 0 ? (
                  <p className={`px-4 py-3 text-xs ${th.txm}`}>Belum ada tier — klik tombol "Tier" untuk tambah</p>
                ) : (
                  <div className="px-4 py-3 space-y-1.5">
                    {tiers.map(t => (
                      <div key={t.id} className="flex items-center gap-2 text-sm flex-wrap">
                        <span className={`font-bold ${th.tx} shrink-0`}>Beli {t.minQty}</span>
                        <span className={`${th.txm} shrink-0`}>=</span>
                        <span className={`font-black ${th.acc} shrink-0`}>{$(Math.round(t.price * t.minQty))}</span>
                        <span className={`text-xs ${th.txf} shrink-0`}>({$(Math.round(t.price))}/satuan)</span>
                        <span className={`text-xs inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${th.accBg} ${th.acc}`}>
                          {t.target === "all_members" ? (
                            <><Users size={10} strokeWidth={2.8} /> Semua member</>
                          ) : (
                            <><UserCheck size={10} strokeWidth={2.8} /> {(t.members || []).length} member</>
                          )}
                        </span>
                        {t.note && <span className={`text-xs ${th.txf} truncate`}>· {t.note}</span>}
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
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${th.txf}`} />
            <input
              autoFocus
              value={pickerQuery}
              onChange={e => setPickerQuery(e.target.value)}
              placeholder="Cari nama atau SKU…"
              className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
          </div>
          {eligibleForPicker.length === 0 ? (
            <p className={`text-center py-8 text-xs ${th.txm}`}>
              Semua produk aktif sudah punya tier, atau tidak ada produk cocok.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto space-y-1">
              {eligibleForPicker.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setPickerOpen(false); setOpenProductId(p.id); }}
                  className={`w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border active:scale-[.98] transition-transform ${th.bdr} ${th.card2}`}>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${th.tx}`}>{lang === "id" ? p.nameId : p.name}</p>
                    <p className={`text-xs font-mono ${th.txf}`}>{p.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold ${th.acc}`}>{$(p.sellingPrice)}</p>
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
          return p ? `Tier: ${lang === "id" ? p.nameId : p.name}` : "Tier";
        })()}
        size="lg"
      >
        {openProductId && <PriceTierEditor productId={openProductId} />}
      </Modal>
    </div>
  );
}
