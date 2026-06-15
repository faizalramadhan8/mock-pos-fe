import { useEffect, useMemo, useState } from "react";
import { useMemberStore, useProductStore } from "@/stores";
import { productApi } from "@/api";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $ } from "@/utils";
import { Modal } from "./Modal";
import { Plus, Trash2, Users, UserCheck, Search } from "lucide-react";
import toast from "react-hot-toast";
import type { ProductPriceTier, PriceTierTarget } from "@/types";
import type { ProductPriceTierRes } from "@/api/products";

interface Props {
  productId: string;
}

interface DraftTier {
  id?: string;       // present = editing existing tier
  minQty: string;    // string form for input control
  /** Total bundle price untuk beli min_qty satuan. Admin think dalam total,
   *  BE stores per-satuan (= total / min_qty). Convert dua arah saat
   *  load/save. */
  totalPrice: string;
  target: PriceTierTarget;
  memberIds: string[];
  note: string;
}

const emptyDraft: DraftTier = {
  minQty: "",
  totalPrice: "",
  target: "all_members",
  memberIds: [],
  note: "",
};

function mapRes(t: ProductPriceTierRes): ProductPriceTier {
  return {
    id: t.id,
    productId: t.product_id,
    minQty: t.min_qty,
    price: t.price,
    target: t.target_type,
    members: t.members || [],
    note: t.note,
    createdAt: t.created_at,
  };
}

export function PriceTierEditor({ productId }: Props) {
  const th = useThemeClasses();
  const members = useMemberStore(s => s.members);
  const products = useProductStore(s => s.products);
  const fetchProducts = useProductStore(s => s.fetchProducts);
  const product = products.find(p => p.id === productId);

  const [tiers, setTiers] = useState<ProductPriceTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<DraftTier>(emptyDraft);
  const [memberQuery, setMemberQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Initial load — fetch tier dari BE 1× per productId.
  // CATATAN: jangan ikutkan `product` di deps array — referensinya berubah
  // setiap kali products store di-refresh (polling 30s di POS), bikin
  // refetch tier ulang yang sia-sia.
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    setLoading(true);
    productApi.listTiers(productId)
      .then(res => {
        if (!cancelled) setTiers((res.body || []).map(mapRes));
      })
      .catch(e => {
        if (!cancelled) toast.error(e?.message || "Gagal memuat tier");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [productId]);

  // Seed initial state from products store kalau ada (avoid blank-then-load
  // flicker on first render). Independen dari fetch effect di atas.
  useEffect(() => {
    if (productId && product?.priceTiers && tiers.length === 0) {
      setTiers(product.priceTiers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const openAdd = () => {
    setDraft({ ...emptyDraft });
    setMemberQuery("");
    setEditorOpen(true);
  };

  const openEdit = (t: ProductPriceTier) => {
    // Convert per-satuan storage → bundle total untuk admin input model.
    const bundleTotal = Math.round(t.price * t.minQty);
    setDraft({
      id: t.id,
      minQty: String(t.minQty),
      totalPrice: String(bundleTotal),
      target: t.target,
      memberIds: (t.members || []).map(m => m.id),
      note: t.note || "",
    });
    setMemberQuery("");
    setEditorOpen(true);
  };

  const toggleMember = (id: string) => {
    setDraft(d => d.memberIds.includes(id)
      ? { ...d, memberIds: d.memberIds.filter(x => x !== id) }
      : { ...d, memberIds: [...d.memberIds, id] });
  };

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members.slice(0, 20);
    return members
      .filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        (m.memberNumber || "").toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [members, memberQuery]);

  const save = async () => {
    const minQtyN = parseInt(draft.minQty);
    const totalN = parseFloat(draft.totalPrice);
    if (!Number.isFinite(minQtyN) || minQtyN < 1) {
      toast.error("Beli minimal harus ≥ 1"); return;
    }
    if (!Number.isFinite(totalN) || totalN < 0) {
      toast.error("Total bundle tidak valid"); return;
    }
    if (draft.target === "member_specific" && draft.memberIds.length === 0) {
      toast.error("Pilih minimal 1 member"); return;
    }
    setSaving(true);
    try {
      // Convert bundle total → per-satuan untuk storage. Pakai DECIMAL precision
      // (BE schema DECIMAL(15,2)) supaya beli qty pas exact match restore total.
      const pricePerSatuan = totalN / minQtyN;
      const payload = {
        min_qty: minQtyN,
        price: pricePerSatuan,
        target_type: draft.target,
        member_ids: draft.target === "member_specific" ? draft.memberIds : undefined,
        note: draft.note || undefined,
      };
      if (draft.id) {
        const res = await productApi.updateTier(productId, draft.id, payload);
        const updated = res.body ? mapRes(res.body) : null;
        setTiers(prev => updated ? prev.map(t => t.id === draft.id ? updated : t) : prev);
        toast.success("Tier diperbarui");
      } else {
        const res = await productApi.createTier(productId, payload);
        const created = res.body ? mapRes(res.body) : null;
        if (created) setTiers(prev => [...prev, created].sort((a, b) => a.minQty - b.minQty));
        toast.success("Tier ditambahkan");
      }
      setEditorOpen(false);
      // Refresh products store supaya pricing logic POS dapat tier baru.
      void fetchProducts();
    } catch (e: any) {
      toast.error(e?.message || "Gagal simpan tier");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus tier ini?")) return;
    try {
      await productApi.deleteTier(productId, id);
      setTiers(prev => prev.filter(t => t.id !== id));
      toast.success("Tier dihapus");
      void fetchProducts();
    } catch (e: any) {
      toast.error(e?.message || "Gagal hapus tier");
    }
  };

  return (
    <div className={`rounded-2xl border p-3.5 ${th.bdr} ${th.card2}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className={`text-sm font-extrabold ${th.tx}`}>Harga Khusus Member</p>
          <p className={`text-xs ${th.txm}`}>
            Beli jumlah tertentu dapat harga khusus. Hanya untuk member.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] inline-flex items-center gap-1">
          <Plus size={12} strokeWidth={2.8} /> Tambah Tier
        </button>
      </div>

      {loading && tiers.length === 0 ? (
        <p className={`text-xs text-center py-3 ${th.txm}`}>Memuat…</p>
      ) : tiers.length === 0 ? (
        <p className={`text-xs text-center py-3 ${th.txm}`}>Belum ada tier harga khusus</p>
      ) : (
        <div className="space-y-1.5">
          {tiers.map(t => (
            <div key={t.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${th.bdr}`}>
              <button
                onClick={() => openEdit(t)}
                className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold ${th.tx}`}>Beli {t.minQty} satuan</span>
                  <span className={`text-xs ${th.txm}`}>=</span>
                  <span className={`text-xs font-black ${th.acc}`}>{$(Math.round(t.price * t.minQty))}</span>
                  <span className={`text-xs ${th.txf}`}>({$(Math.round(t.price))}/satuan)</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  {t.target === "all_members" ? (
                    <span className={`text-xs font-semibold inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${th.accBg} ${th.acc}`}>
                      <Users size={10} strokeWidth={2.8} /> Semua member
                    </span>
                  ) : (
                    <span className={`text-xs font-semibold inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${th.accBg} ${th.acc}`}>
                      <UserCheck size={10} strokeWidth={2.8} /> {(t.members || []).length} member tertentu
                    </span>
                  )}
                  {t.note && <span className={`text-xs ${th.txf} truncate`}>· {t.note}</span>}
                </div>
              </button>
              <button
                onClick={() => remove(t.id)}
                aria-label="Hapus tier"
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#FCE4EC] text-[#BE123C] active:scale-90 transition-transform">
                <Trash2 size={12} strokeWidth={2.6} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={draft.id ? "Edit Tier" : "Tambah Tier"}>
        <div className="space-y-3">
          {/* Konteks harga normal — read-only display supaya admin
              tidak bingung dengan input "Harga tier" di bawah. */}
          {product && (
            <div className={`rounded-xl border p-2.5 ${th.bdr} ${th.card2}`}>
              <p className={`text-xs ${th.txm}`}>
                Harga jual normal saat ini
              </p>
              <p className={`text-base font-black mt-0.5 ${th.tx}`}>
                {$(product.sellingPrice)}<span className={`text-xs font-normal ${th.txm}`}> / satuan</span>
              </p>
              {typeof product.memberPrice === "number" && product.memberPrice > 0 && (
                <p className={`text-xs mt-0.5 ${th.acc}`}>
                  Member baseline: {$(product.memberPrice)} / satuan
                </p>
              )}
            </div>
          )}

          <p className={`text-xs ${th.txm} -mt-1`}>
            <strong className={th.tx}>Aturan:</strong> Kalau member beli minimal qty di bawah, total bayarnya sesuai harga bundle yang di-set.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={`text-xs font-semibold mb-1 ${th.txm}`}>Beli minimal (satuan)</p>
              <input type="number" min="1"
                value={draft.minQty}
                onChange={e => setDraft({ ...draft, minQty: e.target.value })}
                placeholder="3"
                className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
            </div>
            <div>
              <p className={`text-xs font-semibold mb-1 ${th.txm}`}>Total bundle (Rp)</p>
              <input type="number" min="0"
                value={draft.totalPrice}
                onChange={e => setDraft({ ...draft, totalPrice: e.target.value })}
                placeholder="149000"
                className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
            </div>
          </div>

          {/* Preview live: tampilkan total bundle vs harga normal */}
          {product && draft.totalPrice && draft.minQty && (() => {
            const totalN = parseFloat(draft.totalPrice);
            const minQtyN = parseInt(draft.minQty);
            if (!Number.isFinite(totalN) || totalN <= 0 || !Number.isFinite(minQtyN) || minQtyN < 1) return null;
            const normalTotal = product.sellingPrice * minQtyN;
            const diff = normalTotal - totalN;
            const perSatuan = totalN / minQtyN;
            if (diff > 0) {
              return (
                <div className="text-xs px-3 py-2 rounded-lg bg-[#FFE4E9] dark:bg-[#E11D48]/15 text-[#9F1239] dark:text-[#FB7185] space-y-0.5">
                  <p>Beli {minQtyN} satuan: <strong>{$(totalN)}</strong> (normal {$(normalTotal)})</p>
                  <p>Hemat <strong>{$(diff)}</strong> · efektif {$(Math.round(perSatuan))}/satuan</p>
                </div>
              );
            }
            if (diff < 0) {
              return (
                <p className="text-xs px-3 py-2 rounded-lg bg-[#FCE4EC] text-[#BE123C]">
                  ⚠ Total bundle {$(totalN)} lebih mahal dari harga normal {$(normalTotal)} untuk {minQtyN} satuan. Yakin?
                </p>
              );
            }
            return (
              <p className={`text-xs px-3 py-2 rounded-lg ${th.elev} ${th.txm}`}>
                Total bundle sama dengan harga normal — tier ini tidak memberi diskon.
              </p>
            );
          })()}

          <div>
            <p className={`text-xs font-semibold mb-1 ${th.txm}`}>Untuk siapa?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDraft({ ...draft, target: "all_members" })}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 border ${draft.target === "all_members" ? "bg-gradient-to-r from-[#FB7185] to-[#E11D48] text-white border-transparent" : `${th.bdr} ${th.txm}`}`}>
                <Users size={12} strokeWidth={2.6} /> Semua Member
              </button>
              <button
                onClick={() => setDraft({ ...draft, target: "member_specific" })}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 border ${draft.target === "member_specific" ? "bg-gradient-to-r from-[#FB7185] to-[#E11D48] text-white border-transparent" : `${th.bdr} ${th.txm}`}`}>
                <UserCheck size={12} strokeWidth={2.6} /> Member Tertentu
              </button>
            </div>
          </div>

          {draft.target === "member_specific" && (
            <div className={`rounded-xl border p-2.5 ${th.bdr}`}>
              <p className={`text-xs font-semibold mb-1.5 ${th.txm}`}>
                Pilih member ({draft.memberIds.length} dipilih)
              </p>
              <div className="relative mb-2">
                <Search size={12} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${th.txf}`} />
                <input
                  value={memberQuery}
                  onChange={e => setMemberQuery(e.target.value)}
                  placeholder="Cari nama / nomor HP…"
                  className={`w-full pl-7 pr-2 py-2 text-xs rounded-lg border ${th.inp}`} />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredMembers.length === 0 ? (
                  <p className={`text-xs text-center py-2 ${th.txm}`}>Member tidak ditemukan</p>
                ) : (
                  filteredMembers.map(m => {
                    const selected = draft.memberIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleMember(m.id)}
                        className={`w-full text-left flex items-center justify-between gap-2 p-2 rounded-lg border transition-colors ${selected ? "bg-[#FFE4E9] dark:bg-[#E11D48]/15 border-[#E11D48]/30" : `${th.bdr}`}`}>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${th.tx}`}>{m.name}</p>
                          <p className={`text-xs ${th.txf}`}>{m.phone}</p>
                        </div>
                        {selected && <span className={`text-xs font-bold ${th.acc}`}>✓</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div>
            <p className={`text-xs font-semibold mb-1 ${th.txm}`}>Catatan (opsional)</p>
            <input
              value={draft.note}
              onChange={e => setDraft({ ...draft, note: e.target.value })}
              placeholder="Promo Lebaran, Grosir, dll."
              className={`w-full px-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditorOpen(false)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border ${th.bdr} ${th.txm}`}>
              Batal
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] disabled:opacity-40">
              {saving ? "Menyimpan…" : draft.id ? "Update" : "Tambah"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
