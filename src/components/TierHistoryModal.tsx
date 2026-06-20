import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { productApi } from "@/api";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useMemberStore, useProductStore } from "@/stores";
import { formatCurrency as $ } from "@/utils";
import type { ProductPriceTierHistoryEntry } from "@/types";
import type { ProductPriceTierHistoryRes } from "@/api/products";
import { History, Plus, Pencil, Trash2, Users, UserCheck } from "lucide-react";

interface Props {
  productId: string | null;
  open: boolean;
  onClose: () => void;
}

function mapHistory(r: ProductPriceTierHistoryRes): ProductPriceTierHistoryEntry {
  return {
    id: r.id,
    tierId: r.tier_id,
    productId: r.product_id,
    minQty: r.min_qty,
    price: r.price,
    targetType: (r.target_type === "all_members" as any) ? "all_customers" : r.target_type,
    memberIds: r.member_ids || [],
    note: r.note || undefined,
    status: r.status,
    action: r.action,
    startDate: r.start_date,
    endDate: r.end_date,
    changedBy: r.changed_by,
    createdAt: r.created_at,
  };
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Timeline view audit perubahan tier per produk. Reverse-chronological:
 * versi tier paling baru di atas, paling lama di bawah. Action ditandai
 * dengan icon + warna distinct (create/update/delete).
 */
export function TierHistoryModal({ productId, open, onClose }: Props) {
  const th = useThemeClasses();
  const products = useProductStore(s => s.products);
  const members = useMemberStore(s => s.members);
  const product = useMemo(() => products.find(p => p.id === productId), [products, productId]);

  const [rows, setRows] = useState<ProductPriceTierHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !productId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    productApi.getTierHistory(productId)
      .then(res => { if (!cancelled) setRows((res.body || []).map(mapHistory)); })
      .catch(e => { if (!cancelled) setError(e?.message || "Gagal memuat riwayat"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, productId]);

  // Group by tierId — tampil per tier dengan versi-versinya.
  const grouped = useMemo(() => {
    const map = new Map<string, ProductPriceTierHistoryEntry[]>();
    for (const r of rows) {
      const list = map.get(r.tierId) || [];
      list.push(r);
      map.set(r.tierId, list);
    }
    return Array.from(map.entries()).map(([tierId, versions]) => ({
      tierId,
      versions: versions.sort((a, b) => b.startDate.localeCompare(a.startDate)),
    })).sort((a, b) => {
      const aLatest = a.versions[0]?.startDate || "";
      const bLatest = b.versions[0]?.startDate || "";
      return bLatest.localeCompare(aLatest);
    });
  }, [rows]);

  const memberName = (id: string) => members.find(m => m.id === id)?.name || id.slice(0, 8);
  const userName = (uid: string | null | undefined) => {
    if (!uid) return "—";
    return uid.slice(0, 8) + "…";
  };

  return (
    <Modal open={open} onClose={onClose} title={`Riwayat Tier: ${product ? product.nameId || product.name : ""}`} size="lg">
      {loading ? (
        <p className={`text-center py-8 text-base ${th.txm}`}>Memuat riwayat…</p>
      ) : error ? (
        <p className={`text-center py-8 text-base text-[#BE123C]`}>{error}</p>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12">
          <History size={40} className={`mx-auto opacity-20 mb-2`} />
          <p className={`text-base font-bold ${th.tx}`}>Belum ada riwayat tier</p>
          <p className={`text-sm mt-1 ${th.txm}`}>
            Riwayat tampil otomatis setelah admin tambah / ubah / hapus tier.
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {grouped.map(({ tierId, versions }) => {
            const latest = versions[0];
            const isDeleted = latest.status === "inactive" && latest.action === "delete";
            return (
              <div key={tierId} className={`rounded-2xl border overflow-hidden ${th.bdr} ${th.card2}`}>
                <div className={`px-4 py-3 border-b ${th.bdr} flex items-center justify-between gap-2`}>
                  <p className={`text-sm font-bold ${th.tx} truncate`}>
                    Tier <span className="font-mono opacity-60">#{tierId.slice(0, 8)}</span>
                  </p>
                  {isDeleted ? (
                    <span className="text-sm font-bold px-2.5 py-1 rounded-md bg-[#FCE4EC] text-[#BE123C]">Dihapus</span>
                  ) : (
                    <span className={`text-sm font-bold px-2.5 py-1 rounded-md ${th.accBg} ${th.acc}`}>Aktif</span>
                  )}
                </div>
                <ol className="relative">
                  {versions.map((v, idx) => {
                    const Icon = v.action === "create" ? Plus : v.action === "delete" ? Trash2 : Pencil;
                    const actionColor =
                      v.action === "create" ? "text-[#0F766E] bg-[#CCFBF1]" :
                      v.action === "delete" ? "text-[#BE123C] bg-[#FCE4EC]" :
                      "text-[#9F1239] bg-[#FFE4E9]";
                    const actionLabel =
                      v.action === "create" ? "Dibuat" :
                      v.action === "delete" ? "Dihapus" :
                      "Diubah";
                    return (
                      <li key={v.id} className={`px-4 py-3.5 ${idx > 0 ? `border-t ${th.bdrSoft}` : ""}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${actionColor}`}>
                            <Icon size={18} strokeWidth={2.8} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <span className={`text-sm font-bold ${th.tx}`}>{actionLabel}</span>
                              <span className={`text-sm ${th.txf}`}>{formatDate(v.startDate)}</span>
                              <span className={`text-sm ${th.txm}`}>· oleh {userName(v.changedBy)}</span>
                            </div>
                            <div className={`text-base ${th.tx} flex items-center gap-2 flex-wrap`}>
                              <span className="font-bold">Beli {v.minQty}</span>
                              <span className={th.txm}>=</span>
                              <span className={`font-black ${th.acc}`}>{$(Math.round(v.price * v.minQty))}</span>
                              <span className={`text-sm ${th.txf}`}>({$(Math.round(v.price))}/satuan)</span>
                              <span className={`text-sm inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${th.accBg} ${th.acc} font-semibold`}>
                                {v.targetType === "all_customers" ? (
                                  <><Users size={14} strokeWidth={2.8} /> Semua customer</>
                                ) : (
                                  <><UserCheck size={14} strokeWidth={2.8} /> {(v.memberIds || []).length} member</>
                                )}
                              </span>
                            </div>
                            {v.targetType === "member_specific" && v.memberIds && v.memberIds.length > 0 && (
                              <p className={`text-sm ${th.txm} mt-1.5 truncate`}>
                                Member: {v.memberIds.map(memberName).join(", ")}
                              </p>
                            )}
                            {v.note && (
                              <p className={`text-sm ${th.txf} mt-1.5 truncate`}>Catatan: {v.note}</p>
                            )}
                            {v.endDate && (
                              <p className={`text-sm ${th.txf} mt-1.5`}>
                                Berakhir: {formatDate(v.endDate)}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
