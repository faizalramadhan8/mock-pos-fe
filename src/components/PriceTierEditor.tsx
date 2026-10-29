import { useEffect, useMemo, useState } from "react";
import { useMemberStore, useProductStore } from "@/stores";
import { productApi } from "@/api";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, statusJadwalTier } from "@/utils";
import { Modal } from "./Modal";
import { Plus, Trash2, Users, UserCheck, UsersRound, Search, CalendarClock } from "lucide-react";
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
  /** Periode berlaku, "YYYY-MM-DD". Kosong = tidak dibatasi di sisi itu.
   *  Menggantikan pilihan durasi (1/3/6/12/30 hari) yang selalu mulai detik
   *  itu juga — Bu Santi 30 Okt 2026 butuh memasang promo bulan depan dari
   *  sekarang, dan durasi tidak bisa menyatakan itu. */
  mulai: string;
  sampai: string;
}

const emptyDraft: DraftTier = {
  minQty: "",
  totalPrice: "",
  target: "all_customers",
  memberIds: [],
  note: "",
  mulai: "",
  sampai: "",
};

const TARGET_OPSI: { v: PriceTierTarget; label: string; jelas: string; Icon: typeof Users }[] = [
  { v: "all_customers", label: "Semua Customer", jelas: "Siapa saja, termasuk yang bukan member", Icon: Users },
  { v: "all_members", label: "Semua Member", jelas: "Semua member terdaftar, bukan walk-in", Icon: UsersRound },
  { v: "member_specific", label: "Member Tertentu", jelas: "Hanya member yang dipilih di bawah", Icon: UserCheck },
];

function fmtTgl(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ISO dari backend → nilai untuk <input type="date">. */
function tglMulaiInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : fmtTgl(d);
}

/**
 * Kebalikan dari cara backend menyimpan batas akhir: tanggal yang diketik
 * admin disimpan sebagai 00:00 hari BERIKUTNYA (lihat parseJadwalTier) supaya
 * hari terakhir terhitung penuh. Untuk ditampilkan lagi harus dimundurkan
 * sehari — kalau tidak, admin membuka tier "sampai 31 Des" dan membacanya
 * sebagai 1 Januari.
 *
 * Tier lama yang dibuat lewat pilihan durasi punya jam sembarang (NOW + N
 * hari); itu ditampilkan apa adanya.
 */
function tglSampaiInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
    d.setDate(d.getDate() - 1);
  }
  return fmtTgl(d);
}

/** Pintasan periode. "Bulan depan" adalah kasus yang Bu Santi sebut sendiri. */
function pintasanPeriode(): { label: string; mulai: string; sampai: string }[] {
  const now = new Date();
  const akhirBulanIni = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const awalBulanDepan = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const akhirBulanDepan = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const tujuhHari = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);
  return [
    { label: "Berlaku terus", mulai: "", sampai: "" },
    { label: "7 hari ke depan", mulai: fmtTgl(now), sampai: fmtTgl(tujuhHari) },
    { label: "Sisa bulan ini", mulai: fmtTgl(now), sampai: fmtTgl(akhirBulanIni) },
    { label: "Bulan depan", mulai: fmtTgl(awalBulanDepan), sampai: fmtTgl(akhirBulanDepan) },
  ];
}

function mapRes(t: ProductPriceTierRes): ProductPriceTier {
  return {
    id: t.id,
    productId: t.product_id,
    minQty: t.min_qty,
    price: t.price,
    target: t.target_type,
    members: t.members || [],
    note: t.note,
    startsAt: t.starts_at || undefined,
    expiresAt: t.expires_at || undefined,
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
      // Tanggalnya SEKARANG ikut dimuat. Dulu tidak bisa karena backend
      // menyimpan tanggal sementara layarnya menanyakan durasi — menebak
      // durasi dari tanggal akan salah, jadi isian itu selalu kosong dan
      // menyimpan perubahan apa pun diam-diam menghapus masa berlakunya.
      mulai: tglMulaiInput(t.startsAt),
      sampai: tglSampaiInput(t.expiresAt),
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
    // No slice cap saat search aktif — semua match muncul. Saat search kosong,
    // tampil semua sorted alphabetically. Container scroll natural via
    // `max-h-48 overflow-y-auto` di list bawah. Sebelumnya slice(0, 20) bikin
    // user kira "cuma huruf A doang" karena tanpa search list cuma 20 row
    // pertama alphabetical.
    const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.phone.toLowerCase().includes(q) ||
      (m.memberNumber || "").toLowerCase().includes(q)
    );
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
    // Perbandingan string aman untuk "YYYY-MM-DD".
    if (draft.mulai && draft.sampai && draft.sampai < draft.mulai) {
      toast.error("Tanggal selesai tidak boleh sebelum tanggal mulai"); return;
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
        // Dikirim selalu, termasuk saat kosong — string kosong adalah cara
        // menghapus batasnya. Kalau field-nya dihilangkan saat kosong,
        // backend menganggap "tidak diubah" dan jadwal lama menempel terus.
        starts_at: draft.mulai,
        expires_at: draft.sampai,
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
    <div className={`rounded-2xl border p-4 ${th.bdr} ${th.card2}`}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="min-w-0">
          <p className={`text-base font-extrabold ${th.tx}`}>Tier Harga</p>
          <p className={`text-sm ${th.txm}`}>
            Beli jumlah tertentu dapat harga khusus.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cherry-400 to-cherry-500 inline-flex items-center gap-1.5 shrink-0">
          <Plus size={16} strokeWidth={2.6} /> Tambah Tier
        </button>
      </div>

      {loading && tiers.length === 0 ? (
        <p className={`text-sm text-center py-4 ${th.txm}`}>Memuat…</p>
      ) : tiers.length === 0 ? (
        <p className={`text-sm text-center py-4 ${th.txm}`}>Belum ada tier harga khusus</p>
      ) : (
        <div className="space-y-2">
          {tiers.map(t => (
            <div key={t.id} className={`flex items-center justify-between gap-2 p-3 rounded-xl border ${th.bdr}`}>
              <button
                onClick={() => openEdit(t)}
                className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-base font-bold ${th.tx}`}>Beli {t.minQty} satuan</span>
                  <span className={`text-base ${th.txm}`}>=</span>
                  <span className={`text-base font-black ${th.acc}`}>{$(Math.round(t.price * t.minQty))}</span>
                  <span className={`text-sm ${th.txf}`}>({$(Math.round(t.price))}/satuan)</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {(() => {
                    const opt = TARGET_OPSI.find(o => o.v === t.target) || TARGET_OPSI[0];
                    const label = t.target === "member_specific"
                      ? `${(t.members || []).length} member tertentu`
                      : opt.label;
                    return (
                      <span className={`text-sm font-semibold inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${th.accBg} ${th.acc}`}>
                        <opt.Icon size={14} strokeWidth={2.8} /> {label}
                      </span>
                    );
                  })()}
                  {(() => {
                    const st = statusJadwalTier(t);
                    if (st.kind === "berakhir") {
                      return (
                        <span className="text-sm font-bold inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#FCE4EC] text-[#BE123C]">
                          Sudah berakhir
                        </span>
                      );
                    }
                    if (st.kind === "terjadwal") {
                      // Promo bulan depan terlihat persis seperti promo yang
                      // tidak jalan. Ditandai supaya tidak ada yang mengira
                      // tiernya rusak lalu memasangnya dua kali.
                      return (
                        <span className={`text-sm font-bold inline-flex items-center gap-1 px-2 py-1 rounded-md ${th.elev} ${th.acc}`}>
                          <CalendarClock size={14} strokeWidth={2.8} /> Mulai {st.hariLagi} hari lagi
                        </span>
                      );
                    }
                    if (st.hariLagi === Infinity) return null;
                    return (
                      <span className={`text-sm font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-md ${th.elev} ${th.txm}`}>
                        Sisa {st.hariLagi} hari
                      </span>
                    );
                  })()}
                  {t.note && <span className={`text-sm ${th.txf} truncate`}>· {t.note}</span>}
                </div>
              </button>
              <button
                onClick={() => remove(t.id)}
                aria-label="Hapus tier"
                className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#FCE4EC] text-[#BE123C] active:scale-90 transition-transform shrink-0">
                <Trash2 size={16} strokeWidth={2.6} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={draft.id ? "Edit Tier" : "Tambah Tier"}>
        <div className="space-y-3.5">
          {/* Konteks harga normal — read-only display supaya admin
              tidak bingung dengan input "Harga tier" di bawah. */}
          {product && (
            <div className={`rounded-xl border p-3 ${th.bdr} ${th.card2}`}>
              <p className={`text-sm ${th.txm}`}>
                Harga jual normal saat ini
              </p>
              <p className={`text-lg font-black mt-0.5 ${th.tx}`}>
                {$(product.sellingPrice)}<span className={`text-sm font-normal ${th.txm}`}> / satuan</span>
              </p>
              {typeof product.memberPrice === "number" && product.memberPrice > 0 && (
                <p className={`text-sm mt-0.5 ${th.acc}`}>
                  Member baseline: {$(product.memberPrice)} / satuan
                </p>
              )}
            </div>
          )}

          <p className={`text-sm ${th.txm} -mt-1`}>
            <strong className={th.tx}>Aturan:</strong> Kalau customer beli minimal qty di bawah, total bayarnya sesuai harga bundle yang di-set. Lalu pilih berlaku untuk siapa, dan periode tanggalnya kalau ini promo musiman.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={`text-sm font-semibold mb-1.5 ${th.txm}`}>Beli minimal (satuan)</p>
              <input type="number" min="1"
                value={draft.minQty}
                onChange={e => setDraft({ ...draft, minQty: e.target.value })}
                placeholder="3"
                className={`w-full px-3 py-3 text-base rounded-xl border ${th.inp}`} />
            </div>
            <div>
              <p className={`text-sm font-semibold mb-1.5 ${th.txm}`}>Total bundle (Rp)</p>
              <input type="number" min="0"
                value={draft.totalPrice}
                onChange={e => setDraft({ ...draft, totalPrice: e.target.value })}
                placeholder="149000"
                className={`w-full px-3 py-3 text-base rounded-xl border ${th.inp}`} />
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
                <div className="text-sm px-3.5 py-2.5 rounded-lg bg-cherry-100 dark:bg-cherry-500/15 text-cherry-700 dark:text-cherry-400 space-y-0.5">
                  <p>Beli {minQtyN} satuan: <strong>{$(totalN)}</strong> (normal {$(normalTotal)})</p>
                  <p>Hemat <strong>{$(diff)}</strong> · efektif {$(Math.round(perSatuan))}/satuan</p>
                </div>
              );
            }
            if (diff < 0) {
              return (
                <p className="text-sm px-3.5 py-2.5 rounded-lg bg-[#FCE4EC] text-[#BE123C]">
                  Total bundle {$(totalN)} lebih mahal dari harga normal {$(normalTotal)} untuk {minQtyN} satuan. Yakin?
                </p>
              );
            }
            return (
              <p className={`text-sm px-3.5 py-2.5 rounded-lg ${th.elev} ${th.txm}`}>
                Total bundle sama dengan harga normal — tier ini tidak memberi diskon.
              </p>
            );
          })()}

          <div>
            <p className={`text-sm font-semibold mb-1.5 ${th.txm}`}>Untuk siapa?</p>
            {/* Disusun ke bawah dengan keterangan, bukan tiga tombol
                berdampingan. Beda "Semua Customer" dan "Semua Member" tidak
                terbaca dari namanya saja — memilih yang salah berarti harga
                grosir member bocor ke walk-in, dan itu baru ketahuan dari
                omzet yang menipis. */}
            <div className="space-y-1.5">
              {TARGET_OPSI.map(opt => {
                const aktif = draft.target === opt.v;
                return (
                  <button
                    key={opt.v}
                    onClick={() => setDraft({ ...draft, target: opt.v })}
                    aria-pressed={aktif}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border inline-flex items-center gap-2.5 ${
                      aktif
                        ? "bg-gradient-to-r from-cherry-400 to-cherry-500 text-white border-transparent"
                        : `${th.bdr} ${th.txm}`
                    }`}>
                    <opt.Icon size={18} strokeWidth={2.6} className="shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{opt.label}</span>
                      <span className={`block text-xs ${aktif ? "text-white/80" : th.txf}`}>{opt.jelas}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {draft.target === "member_specific" && (
            <div className={`rounded-xl border p-3 ${th.bdr}`}>
              <p className={`text-sm font-semibold mb-2 ${th.txm}`}>
                Pilih member ({draft.memberIds.length} dipilih)
              </p>
              <div className="relative mb-2">
                <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${th.txf}`} />
                <input
                  value={memberQuery}
                  onChange={e => setMemberQuery(e.target.value)}
                  placeholder="Cari nama / nomor HP…"
                  className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border ${th.inp}`} />
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {filteredMembers.length === 0 ? (
                  <p className={`text-sm text-center py-3 ${th.txm}`}>Member tidak ditemukan</p>
                ) : (
                  filteredMembers.map(m => {
                    const selected = draft.memberIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleMember(m.id)}
                        className={`w-full text-left flex items-center justify-between gap-2 p-2.5 rounded-lg border transition-colors ${selected ? "bg-cherry-100 dark:bg-cherry-500/15 border-cherry-500/30" : `${th.bdr}`}`}>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold truncate ${th.tx}`}>{m.name}</p>
                          <p className={`text-sm ${th.txf}`}>{m.phone}</p>
                        </div>
                        {selected && <span className={`text-sm font-bold ${th.acc}`}>✓</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div>
            <p className={`text-sm font-semibold mb-1.5 ${th.txm}`}>Periode berlaku</p>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {pintasanPeriode().map(p => {
                const aktif = draft.mulai === p.mulai && draft.sampai === p.sampai;
                return (
                  <button
                    key={p.label}
                    onClick={() => setDraft({ ...draft, mulai: p.mulai, sampai: p.sampai })}
                    className={`px-3 py-2 rounded-lg text-sm font-bold border ${
                      aktif
                        ? "bg-gradient-to-r from-cherry-400 to-cherry-500 text-white border-transparent"
                        : `${th.bdr} ${th.txm}`
                    }`}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className={`text-sm mb-1 ${th.txf}`}>Mulai</p>
                <input type="date"
                  value={draft.mulai}
                  onChange={e => setDraft({ ...draft, mulai: e.target.value })}
                  className={`w-full px-3 py-3 text-base rounded-xl border ${th.inp}`} />
              </div>
              <div>
                <p className={`text-sm mb-1 ${th.txf}`}>Sampai</p>
                <input type="date"
                  value={draft.sampai}
                  min={draft.mulai || undefined}
                  onChange={e => setDraft({ ...draft, sampai: e.target.value })}
                  className={`w-full px-3 py-3 text-base rounded-xl border ${th.inp}`} />
              </div>
            </div>
            {/* Kalimat penutup menyebutkan AKIBATNYA, bukan mengulang isian.
                Tanggal mulai di masa depan adalah hal yang paling mudah
                disalahpahami: tiernya tersimpan tapi sengaja belum berlaku,
                dan tanpa kalimat ini terlihat seperti tidak tersimpan. */}
            <p className={`text-xs mt-1.5 ${draft.mulai && draft.mulai > fmtTgl(new Date()) ? th.acc : th.txf}`}>
              {(() => {
                const hariIni = fmtTgl(new Date());
                const belumMulai = draft.mulai && draft.mulai > hariIni;
                const tgl = (v: string) => new Date(v + "T00:00:00")
                  .toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
                if (belumMulai && draft.sampai) return `Belum berlaku. Harga ini aktif ${tgl(draft.mulai)} sampai ${tgl(draft.sampai)}.`;
                if (belumMulai) return `Belum berlaku. Harga ini mulai aktif ${tgl(draft.mulai)} dan tidak dibatasi akhirnya.`;
                if (draft.sampai) return `Berlaku sampai habis ${tgl(draft.sampai)}, lalu otomatis balik ke harga normal.`;
                return "Kosongkan keduanya kalau harga ini berlaku terus.";
              })()}
            </p>
          </div>

          <div>
            <p className={`text-sm font-semibold mb-1.5 ${th.txm}`}>Catatan (opsional)</p>
            <input
              value={draft.note}
              onChange={e => setDraft({ ...draft, note: e.target.value })}
              placeholder="Promo Lebaran, Grosir, dll."
              className={`w-full px-3 py-3 text-base rounded-xl border ${th.inp}`} />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditorOpen(false)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold border ${th.bdr} ${th.txm}`}>
              Batal
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cherry-400 to-cherry-500 disabled:opacity-40">
              {saving ? "Menyimpan…" : draft.id ? "Update" : "Tambah"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
