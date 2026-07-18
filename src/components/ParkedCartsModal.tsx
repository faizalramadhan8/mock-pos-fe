import { useState } from "react";
import { Modal } from "./Modal";
import { useParkedCartStore, useCartStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { formatCurrency as $, formatDate, formatTime } from "@/utils";
import { Bookmark, Trash2, ShoppingBag } from "lucide-react";

// ParkedCartsModal — Bu Santi 12 Jul 2026.
// Skenario: kasir hold cart Customer 1 supaya bisa layani Customer 2 dulu,
// nanti lanjut Customer 1. Beda dari "Simpan Pending WA" (yang kirim invoice
// ke customer_phone) — parkir cart 100% local, tidak kirim WA, tidak ke BE.
//
// UX principles:
//  - Empty state jelas ("Belum ada cart yang diparkir")
//  - Confirm sebelum muat kalau cart current ada isi (cegah kehilangan data)
//  - Confirm sebelum hapus (destructive action)
//  - Row menampilkan info yang cukup: nama, jumlah item, total, waktu
export function ParkedCartsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const th = useThemeClasses();
  const parked = useParkedCartStore(s => s.parked);
  const load = useParkedCartStore(s => s.load);
  const remove = useParkedCartStore(s => s.remove);
  const cartItemsCount = useCartStore(s => s.items.length);
  const [confirmLoadId, setConfirmLoadId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const doLoad = (id: string) => {
    if (cartItemsCount > 0) {
      setConfirmLoadId(id);
      return;
    }
    load(id);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Cart Diparkir">
      {parked.length === 0 ? (
        <div className="py-10 text-center">
          <Bookmark size={36} className={`mx-auto opacity-20 mb-3 ${th.txf}`} />
          <p className={`text-sm font-bold ${th.tx}`}>Belum ada cart yang diparkir</p>
          <p className={`text-xs mt-1 ${th.txm}`}>
            Klik "Parkir" di cart panel untuk simpan cart sementara
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className={`text-xs mb-1 ${th.txm}`}>
            {parked.length} cart diparkir · klik untuk muat
          </p>
          {parked.map(p => {
            const total = p.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
            const qty = p.items.reduce((s, i) => s + i.quantity, 0);
            const isConfirmDelete = confirmDeleteId === p.id;
            const isConfirmLoad = confirmLoadId === p.id;
            return (
              <div key={p.id}
                className={`rounded-2xl border p-3 ${th.bdr} ${th.card2}`}>
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => doLoad(p.id)}
                    disabled={isConfirmDelete || isConfirmLoad}
                    className="flex-1 text-left min-w-0 active:opacity-70 disabled:opacity-40">
                    <p className={`text-sm font-bold truncate ${th.tx}`}>{p.name}</p>
                    <p className={`text-xs mt-0.5 ${th.txm}`}>
                      {p.items.length} item · {qty} qty · {formatDate(p.createdAt)} {formatTime(p.createdAt)}
                    </p>
                    {p.member && (
                      <p className={`text-xs mt-0.5 ${th.acc}`}>💎 {p.member.name}</p>
                    )}
                  </button>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <p className={`font-display font-black text-sm ${th.acc}`}>{$(total)}</p>
                    {!isConfirmDelete && !isConfirmLoad && (
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        aria-label="Hapus cart parkir"
                        className={`p-1.5 rounded-lg text-[#C4504A] active:opacity-70`}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Confirm delete inline */}
                {isConfirmDelete && (
                  <div className={`mt-3 pt-3 border-t ${th.bdrSoft}`}>
                    <p className={`text-xs mb-2 ${th.txm}`}>
                      Hapus cart "{p.name}"? Data tidak bisa dikembalikan.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmDeleteId(null)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border ${th.bdr} ${th.txm}`}>
                        Batal
                      </button>
                      <button onClick={() => {
                        remove(p.id);
                        setConfirmDeleteId(null);
                      }}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-[#C4504A]">
                        Hapus
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirm load inline (cart current ada isi) */}
                {isConfirmLoad && (
                  <div className={`mt-3 pt-3 border-t ${th.bdrSoft}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <ShoppingBag size={12} className={`mt-0.5 shrink-0 text-[#BE123C]`} />
                      <p className={`text-xs ${th.txm}`}>
                        Cart saat ini punya {cartItemsCount} item. Muat "{p.name}" akan
                        <span className={`font-bold ${th.tx}`}> menghapus cart saat ini</span>.
                        Lanjut?
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmLoadId(null)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border ${th.bdr} ${th.txm}`}>
                        Batal
                      </button>
                      <button onClick={() => {
                        load(p.id);
                        setConfirmLoadId(null);
                        onClose();
                      }}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48]">
                        Ya, muat
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
