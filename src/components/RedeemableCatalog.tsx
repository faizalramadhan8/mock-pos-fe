import { useMemo, useState } from "react";
import { useProductStore, useLangStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $ } from "@/utils";
import { Modal } from "./Modal";
import { Gift, Plus, Search, X } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  /** false → tampil read-only (kasir bisa lihat tapi tidak edit) */
  canWrite: boolean;
}

/**
 * Katalog produk yang admin tandai eligible untuk tebus pakai member.points.
 * Admin add/remove dari catalog di sini; POS hanya tampilkan tombol "Tebus"
 * untuk produk yang isRedeemable === true.
 *
 * Poin cost = product.sellingPrice (1 poin = Rp 1). Tidak ada custom cost
 * field — kalau Bu Santi mau hadiah khusus, atur harga jual produk biasa.
 */
export function RedeemableCatalog({ canWrite }: Props) {
  const th = useThemeClasses();
  const { lang } = useLangStore();
  const products = useProductStore(s => s.products);
  const setRedeemable = useProductStore(s => s.setRedeemable);

  const [addOpen, setAddOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const redeemable = useMemo(
    () => products.filter(p => p.isRedeemable && p.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );
  const eligible = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    // No slice cap — semua produk eligible tampil. Container modal punya
    // `max-h-[60vh] overflow-y-auto` jadi scroll natural. Sebelumnya
    // slice(0, 30) bikin user kira "cuma produk huruf A yang muncul"
    // karena sort alphabetical + cap di 30 row pertama.
    return products
      .filter(p => p.isActive && !p.isRedeemable)
      .filter(p =>
        !q ||
        (lang === "id" ? p.nameId : p.name).toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, pickerQuery, lang]);

  const addToCatalog = async (id: string) => {
    setSavingId(id);
    try {
      await setRedeemable(id, true);
      toast.success("Ditambahkan ke katalog tebus");
    } catch {
      /* setRedeemable already toasts error */
    } finally {
      setSavingId(null);
    }
  };

  const removeFromCatalog = async (id: string) => {
    setSavingId(id);
    try {
      await setRedeemable(id, false);
      toast.success("Dihapus dari katalog tebus");
    } catch {
      /* */
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info card */}
      <div className={`p-4 rounded-2xl border ${th.bdr} ${th.card2}`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-[#FFE4E9] text-[#E11D48] shrink-0`}>
            <Gift size={16} strokeWidth={2.4} />
          </div>
          <div>
            <p className={`text-sm font-extrabold ${th.tx}`}>Katalog Tebus Poin</p>
            <p className={`text-xs mt-0.5 ${th.txm}`}>
              Daftar produk yang bisa ditebus pakai poin member di kasir.
              Member bayar pakai poin senilai harga jual produk (1 poin = Rp 1).
            </p>
          </div>
        </div>
      </div>

      {/* Header + Tambah */}
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-extrabold ${th.tx}`}>
            {redeemable.length} produk di katalog
          </p>
          {redeemable.length > 0 && (
            <p className={`text-xs ${th.txm}`}>Kasir bisa tebus barang ini saat ada member aktif</p>
          )}
        </div>
        {canWrite && (
          <button
            onClick={() => { setAddOpen(true); setPickerQuery(""); }}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48] inline-flex items-center gap-1.5">
            <Plus size={14} strokeWidth={2.6} /> Tambah Produk
          </button>
        )}
      </div>

      {/* List of redeemable products */}
      {redeemable.length === 0 ? (
        <div className={`text-center py-12 rounded-2xl border ${th.bdr} ${th.card2}`}>
          <Gift size={36} className="mx-auto opacity-20 mb-2" />
          <p className={`text-sm font-bold ${th.tx}`}>Belum ada produk di katalog tebus</p>
          <p className={`text-xs mt-1 ${th.txm}`}>
            {canWrite
              ? "Klik 'Tambah Produk' di atas untuk pilih produk yang bisa ditebus."
              : "Hubungi admin untuk menambahkan produk."}
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card}`}>
          {redeemable.map((p, idx) => (
            <div key={p.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${idx > 0 ? `border-t ${th.bdrSoft}` : ""}`}>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold truncate ${th.tx}`}>{lang === "id" ? p.nameId : p.name}</p>
                <p className={`text-xs font-mono ${th.txf} truncate`}>{p.sku}</p>
                <p className={`text-xs font-bold mt-0.5 ${th.acc}`}>
                  {$(p.sellingPrice)} = {p.sellingPrice.toLocaleString("id-ID")} poin
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${p.stock > 0 ? `${th.accBg} ${th.acc}` : "bg-[#FCE4EC] text-[#BE123C]"}`}>
                  {p.stock > 0 ? `${p.stock} stok` : "Habis"}
                </span>
                {canWrite && (
                  <button
                    onClick={() => removeFromCatalog(p.id)}
                    disabled={savingId === p.id}
                    aria-label="Hapus dari katalog"
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FCE4EC] text-[#BE123C] active:scale-90 transition-transform disabled:opacity-50">
                    <X size={14} strokeWidth={2.6} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add-product modal */}
      {canWrite && (
        <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Tambah Produk ke Katalog Tebus" size="lg">
          <div className="relative mb-3">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${th.txf}`} />
            <input
              autoFocus
              value={pickerQuery}
              onChange={e => setPickerQuery(e.target.value)}
              placeholder="Cari nama atau SKU…"
              className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border ${th.inp}`} />
          </div>
          {eligible.length === 0 ? (
            <p className={`text-center py-8 text-xs ${th.txm}`}>
              {products.filter(p => p.isActive && !p.isRedeemable).length === 0
                ? "Semua produk sudah di katalog tebus."
                : "Tidak ada produk yang cocok."}
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto space-y-1">
              {eligible.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCatalog(p.id)}
                  disabled={savingId === p.id}
                  className={`w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border active:scale-[.98] transition-transform disabled:opacity-50 ${th.bdr} ${th.card2}`}>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${th.tx}`}>{lang === "id" ? p.nameId : p.name}</p>
                    <p className={`text-xs font-mono ${th.txf}`}>{p.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold ${th.acc}`}>{$(p.sellingPrice)}</p>
                    <p className={`text-xs ${th.txf}`}>{p.stock} stok</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
