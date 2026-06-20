import { useEffect, useMemo, useState } from "react";
import { useRedeemableStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { Modal } from "./Modal";
import { Gift, Plus, Search, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import type { RedeemableItem } from "@/types";

interface Props {
  /** Read-only kalau kasir (non-admin). */
  canWrite: boolean;
}

interface Draft {
  id?: string;
  name: string;
  description: string;
  image: string;
  pointsCost: string;
  stock: string;
  isActive: boolean;
}

const emptyDraft: Draft = {
  name: "",
  description: "",
  image: "",
  pointsCost: "",
  stock: "0",
  isActive: true,
};

/**
 * Katalog barang khusus tebus poin — TERPISAH dari katalog produk POS.
 * Admin set manual: nama, gambar (opsional), points_cost, stok awal.
 * Saat customer tebus di POS, stok auto-decrement + redeemed counter ++.
 *
 * Beda dengan flow lama (`products.is_redeemable` boolean) — sekarang
 * full standalone catalog di tabel `redeemable_items`. Lihat migration 000040.
 */
export function RedeemableCatalog({ canWrite }: Props) {
  const th = useThemeClasses();
  const items = useRedeemableStore(s => s.items);
  const loading = useRedeemableStore(s => s.loading);
  const fetchItems = useRedeemableStore(s => s.fetchItems);
  const createItem = useRedeemableStore(s => s.create);
  const updateItem = useRedeemableStore(s => s.update);
  const removeItem = useRedeemableStore(s => s.remove);

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.description || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const openAdd = () => { setDraft({ ...emptyDraft }); setEditorOpen(true); };
  const openEdit = (it: RedeemableItem) => {
    setDraft({
      id: it.id,
      name: it.name,
      description: it.description || "",
      image: it.image || "",
      pointsCost: String(it.pointsCost),
      stock: String(it.stock),
      isActive: it.isActive,
    });
    setEditorOpen(true);
  };

  const save = async () => {
    const pointsN = parseInt(draft.pointsCost);
    const stockN = parseInt(draft.stock);
    if (!draft.name.trim()) { toast.error("Nama wajib diisi"); return; }
    if (!Number.isFinite(pointsN) || pointsN < 1) { toast.error("Poin harus ≥ 1"); return; }
    if (!Number.isFinite(stockN) || stockN < 0) { toast.error("Stok tidak valid"); return; }
    setSaving(true);
    try {
      if (draft.id) {
        await updateItem(draft.id, {
          name: draft.name.trim(),
          description: draft.description.trim(),
          image: draft.image.trim(),
          pointsCost: pointsN,
          stock: stockN,
          isActive: draft.isActive,
        });
        toast.success("Item tebus diperbarui");
      } else {
        await createItem({
          name: draft.name.trim(),
          description: draft.description.trim(),
          image: draft.image.trim(),
          pointsCost: pointsN,
          stock: stockN,
          isActive: draft.isActive,
        });
        toast.success("Item tebus ditambahkan");
      }
      setEditorOpen(false);
    } catch {
      /* toast already shown in store */
    } finally {
      setSaving(false);
    }
  };

  const remove = async (it: RedeemableItem) => {
    if (!confirm(`Hapus "${it.name}" dari katalog tebus?\n(Stok yang sudah ke-redeem ${it.redeemed}× akan tetap terlihat di history transaksi.)`)) return;
    try {
      await removeItem(it.id);
      toast.success("Item tebus dihapus");
    } catch { /* */ }
  };

  return (
    <div className="space-y-4">
      {/* Info card */}
      <div className={`p-4 rounded-2xl border ${th.bdr} ${th.card2}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FFE4E9] text-[#E11D48] shrink-0">
            <Gift size={18} strokeWidth={2.4} />
          </div>
          <div>
            <p className={`text-base font-extrabold ${th.tx}`}>Katalog Tebus Poin</p>
            <p className={`text-sm mt-0.5 ${th.txm}`}>
              Daftar barang khusus tebus poin yang admin siapkan (mug, kaos, voucher, hampers, dll).
              Terpisah dari katalog produk jual normal. Poin cost di-set sendiri sesuai value reward.
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[180px] relative">
          <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${th.txf}`} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari nama item…"
            className={`w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
        </div>
        {canWrite && (
          <button
            onClick={openAdd}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] inline-flex items-center gap-1.5">
            <Plus size={16} strokeWidth={2.6} /> Tambah Item
          </button>
        )}
      </div>

      {/* List */}
      {loading && items.length === 0 ? (
        <p className={`text-center py-8 text-sm ${th.txm}`}>Memuat…</p>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-12 rounded-2xl border ${th.bdr} ${th.card2}`}>
          <Gift size={40} className="mx-auto opacity-20 mb-2" />
          <p className={`text-base font-bold ${th.tx}`}>
            {query ? "Tidak ada item cocok" : "Belum ada item tebus"}
          </p>
          {!query && canWrite && (
            <p className={`text-sm mt-1 ${th.txm}`}>Klik "Tambah Item" untuk mulai.</p>
          )}
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card}`}>
          {filtered.map((it, idx) => (
            <div key={it.id} className={`flex items-start gap-3 px-4 py-3.5 ${idx > 0 ? `border-t ${th.bdrSoft}` : ""}`}>
              {it.image ? (
                <img src={it.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[#FFE4E9] text-[#E11D48] shrink-0 flex items-center justify-center">
                  <Gift size={20} strokeWidth={2.2} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-base font-extrabold truncate ${th.tx}`}>{it.name}</p>
                  {!it.isActive && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md bg-[#FCE4EC] text-[#BE123C]`}>Non-aktif</span>
                  )}
                </div>
                {it.description && (
                  <p className={`text-sm mt-0.5 truncate ${th.txm}`}>{it.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-sm font-bold ${th.acc}`}>
                    {it.pointsCost.toLocaleString("id-ID")} poin
                  </span>
                  <span className={`text-sm ${th.txm}`}>·</span>
                  <span className={`text-sm font-semibold ${it.stock > 0 ? th.tx : "text-[#BE123C]"}`}>
                    {it.stock > 0 ? `Stok ${it.stock}` : "Stok habis"}
                  </span>
                  {it.redeemed > 0 && (
                    <>
                      <span className={`text-sm ${th.txm}`}>·</span>
                      <span className={`text-sm ${th.txm}`}>Sudah ditebus {it.redeemed}×</span>
                    </>
                  )}
                </div>
              </div>
              {canWrite && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => openEdit(it)}
                    aria-label="Edit item"
                    title="Edit item"
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${th.elev} ${th.tx} active:scale-90 transition-transform`}>
                    <Pencil size={16} strokeWidth={2.6} />
                  </button>
                  <button
                    onClick={() => remove(it)}
                    aria-label="Hapus item"
                    title="Hapus item"
                    className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#FCE4EC] text-[#BE123C] active:scale-90 transition-transform">
                    <Trash2 size={16} strokeWidth={2.6} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={draft.id ? "Edit Item Tebus" : "Tambah Item Tebus"}>
        <div className="space-y-3.5">
          <div>
            <p className={`text-sm font-semibold mb-1.5 ${th.txm}`}>Nama barang</p>
            <input
              autoFocus
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="Contoh: Mug Toko Santi"
              className={`w-full px-3 py-3 text-base rounded-xl border ${th.inp}`} />
          </div>
          <div>
            <p className={`text-sm font-semibold mb-1.5 ${th.txm}`}>Deskripsi (opsional)</p>
            <input
              value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              placeholder="Mug keramik 350ml warna pink"
              className={`w-full px-3 py-3 text-base rounded-xl border ${th.inp}`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={`text-sm font-semibold mb-1.5 ${th.txm}`}>Poin tebus</p>
              <input
                type="number"
                min="1"
                value={draft.pointsCost}
                onChange={e => setDraft({ ...draft, pointsCost: e.target.value })}
                placeholder="5000"
                className={`w-full px-3 py-3 text-base rounded-xl border ${th.inp}`} />
            </div>
            <div>
              <p className={`text-sm font-semibold mb-1.5 ${th.txm}`}>Stok awal</p>
              <input
                type="number"
                min="0"
                value={draft.stock}
                onChange={e => setDraft({ ...draft, stock: e.target.value })}
                placeholder="10"
                className={`w-full px-3 py-3 text-base rounded-xl border ${th.inp}`} />
            </div>
          </div>
          <div>
            <p className={`text-sm font-semibold mb-1.5 ${th.txm}`}>URL gambar (opsional)</p>
            <input
              value={draft.image}
              onChange={e => setDraft({ ...draft, image: e.target.value })}
              placeholder="https://…"
              className={`w-full px-3 py-3 text-base rounded-xl border ${th.inp}`} />
          </div>
          <label className={`flex items-center gap-2 cursor-pointer text-sm ${th.tx}`}>
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={e => setDraft({ ...draft, isActive: e.target.checked })}
              className="w-4 h-4 accent-[#E11D48]" />
            <span className="font-semibold">Aktif (tampil di POS untuk customer tebus)</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditorOpen(false)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold border ${th.bdr} ${th.txm}`}>
              Batal
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] disabled:opacity-40">
              {saving ? "Menyimpan…" : draft.id ? "Update" : "Tambah"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
