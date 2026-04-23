import { useState, useMemo } from "react";
import { useLangStore, useOrderStore, useProductStore, useAuthStore, useMemberStore } from "@/stores";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { OrderDetailModal } from "@/components/OrderDetailModal";
import { MemberStatsModal } from "@/components/MemberStatsModal";
import { Modal } from "@/components/Modal";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency as $, formatTime, formatDate, printReport, genId } from "@/utils";
import { exportOrders } from "@/utils/export";
import { getDateRange, type DateRange } from "@/utils/dateRange";
import { Printer, FileText, Download, Search, Users, Trash2, Plus, Receipt, Pencil } from "lucide-react";
import type { Member } from "@/types";
import toast from "react-hot-toast";

type OrdersTab = "orders" | "members";

// Shared pill button for filters/tabs on this page. One shape, one active
// color (pink gradient), one inactive treatment — enforces visual discipline
// across all pill rows (tabs, date range, status, payment method).
function FilterPill({
  active,
  onClick,
  children,
  th,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  th: any;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-[14px] text-sm font-bold transition-all ${
        active
          ? "text-white bg-gradient-to-r from-[#FB7185] to-[#E11D48]"
          : `border ${th.bdr} ${th.card} ${th.txm}`
      }`}
    >
      {children}
    </button>
  );
}

export function OrdersPage() {
  const th = useThemeClasses();
  const { t, lang } = useLangStore();
  const orders = useOrderStore(s => s.orders);
  const products = useProductStore(s => s.products);
  const user = useAuthStore(s => s.user)!;
  const canViewMembers = user.role === "superadmin" || user.role === "admin";
  const [activeTab, setActiveTab] = useState<OrdersTab>("orders");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 150);
  const ORDERS_PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(ORDERS_PAGE_SIZE);
  const [prevFilterKey, setPrevFilterKey] = useState("");

  // Members tab state
  const members = useMemberStore(s => s.members);
  const addMemberAction = useMemberStore(s => s.addMember);
  const updateMemberAction = useMemberStore(s => s.updateMember);
  const deleteMemberAction = useMemberStore(s => s.deleteMember);
  const [memberSearch, setMemberSearch] = useState("");
  const debouncedMemberSearch = useDebounce(memberSearch, 150);
  const [statsMember, setStatsMember] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const emptyMemberForm = { name: "", phone: "", address: "", memberNumber: "" };
  const [newMember, setNewMember] = useState(emptyMemberForm);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [confirmDeleteMemberId, setConfirmDeleteMemberId] = useState<string | null>(null);

  // Filter by date range
  const dateFiltered = useMemo(() => {
    const range = getDateRange(dateRange);
    if (!range) return orders;
    return orders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= range.start && d <= range.end;
    });
  }, [orders, dateRange]);

  // Filter by search query
  const searchFiltered = useMemo(() => {
    if (!debouncedSearch.trim()) return dateFiltered;
    const q = debouncedSearch.toLowerCase();
    return dateFiltered.filter(o =>
      o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q)
    );
  }, [dateFiltered, debouncedSearch]);

  // Filter by status
  const statusFiltered = useMemo(() =>
    statusFilter === "all" ? searchFiltered : searchFiltered.filter(o => o.status === statusFilter),
    [searchFiltered, statusFilter]
  );

  // Filter by payment method
  const filtered = useMemo(() =>
    paymentFilter === "all" ? statusFiltered : statusFiltered.filter(o => o.payment === paymentFilter),
    [statusFiltered, paymentFilter]
  );

  // Reset pagination when filters change
  const filterKey = `${dateRange}-${statusFilter}-${paymentFilter}-${debouncedSearch}`;
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(ORDERS_PAGE_SIZE);
  }
  const visibleOrders = filtered.slice(0, visibleCount);

  // Summary stats (from date-filtered, all statuses)
  const stats = useMemo(() => {
    const completed = dateFiltered.filter(o => o.status === "completed");
    const cancelled = dateFiltered.filter(o => o.status === "cancelled");
    const refunded = dateFiltered.filter(o => o.status === "refunded");
    const revenue = completed.reduce((s, o) => s + o.total, 0);
    const avg = completed.length > 0 ? Math.round(revenue / completed.length) : 0;
    return { revenue, completedCount: completed.length, avg, cancelledCount: cancelled.length, refundedCount: refunded.length };
  }, [dateFiltered]);

  const dateRangeLabel = (r: DateRange) => {
    switch (r) {
      case "today": return t.today;
      case "yesterday": return t.yesterday;
      case "week": return t.thisWeek;
      case "month": return t.thisMonth;
      case "all": return t.allOrders;
    }
  };

  const statusLabel = (f: string) => {
    switch (f) {
      case "all": return t.allOrders;
      case "completed": return t.completed;
      case "pending": return t.pending;
      case "cancelled": return t.cancelled;
      case "refunded": return t.refunded;
      default: return f;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className={`text-[22px] font-black tracking-tight shrink-0 ${th.tx}`}>{t.orders}</h1>
        {activeTab === "orders" && (
          <div className="flex gap-1.5 shrink-0">
            <button onClick={async () => { await exportOrders(dateFiltered, "csv"); toast.success(t.exportSuccess as string); }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold ${th.elev} ${th.txm}`}>
              <Download size={11} /> CSV
            </button>
            <button onClick={async () => { await exportOrders(dateFiltered, "xlsx"); toast.success(t.exportSuccess as string); }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold ${th.elev} ${th.txm}`}>
              <Download size={11} /> Excel
            </button>
            <button onClick={() => printReport(dateFiltered, dateRangeLabel(dateRange) as string)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold ${th.accBg} ${th.acc}`}>
              <Printer size={12} /> {t.printReport}
            </button>
          </div>
        )}
      </div>

      {/* Tab switcher — only show if user can access members */}
      {canViewMembers && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {([
            { id: "orders" as OrdersTab, label: "Transaksi", icon: <Receipt size={14} /> },
            { id: "members" as OrdersTab, label: "Members", icon: <Users size={14} /> },
          ]).map(tab => (
            <FilterPill key={tab.id} th={th} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
              {tab.icon} {tab.label}
            </FilterPill>
          ))}
        </div>
      )}

      {activeTab === "orders" && <>
      {/* Date range pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {(["today", "yesterday", "week", "month", "all"] as DateRange[]).map(r => (
          <FilterPill key={r} th={th} active={dateRange === r} onClick={() => setDateRange(r)}>
            {dateRangeLabel(r)}
          </FilterPill>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${th.txf}`} />
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder={t.searchOrders as string}
          className={`w-full pl-10 pr-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#E11D48]/20 font-medium ${th.inp}`} />
      </div>

      {/* Summary cards — hero total (revenue) is the one accented metric;
          other three stay neutral so the eye lands on the total first. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: t.totalRevenue, value: $(stats.revenue), hero: true },
          { label: t.ordersCount, value: String(stats.completedCount), hero: false },
          { label: t.avgOrder, value: $(stats.avg), hero: false },
          { label: t.cancelledCount, value: String(stats.cancelledCount), hero: false },
        ].map((card, i) => (
          <div key={i} className={`rounded-[20px] border p-4 ${th.card} ${th.bdr}`}>
            <p className={`text-sm font-semibold ${th.txm}`}>{card.label}</p>
            <p
              className={`font-display ${card.hero ? "text-2xl" : "text-xl"} font-black tracking-tight mt-1 leading-none ${card.hero ? th.acc : th.tx}`}
              style={{ fontVariationSettings: '"opsz" 96, "wght" 900' }}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {["all", "completed", "pending", "cancelled", "refunded"].map(f => (
          <FilterPill key={f} th={th} active={statusFilter === f} onClick={() => setStatusFilter(f)}>
            {statusLabel(f)}
          </FilterPill>
        ))}
      </div>

      {/* Payment method filter pills — no emoji, plain label only */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { k: "all", l: lang === "id" ? "Semua Bayar" : "All Payment" },
          { k: "cash", l: lang === "id" ? "Tunai" : "Cash" },
          { k: "transfer", l: "Transfer" },
          { k: "qris", l: "QRIS" },
        ].map(f => (
          <FilterPill key={f.k} th={th} active={paymentFilter === f.k} onClick={() => setPaymentFilter(f.k)}>
            {f.l}
          </FilterPill>
        ))}
      </div>

      {/* Order list */}
      <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
        {filtered.length === 0 ? (
          <div className={`py-10 text-center ${th.txm}`}>
            {debouncedSearch.trim() ? (
              <><Search size={32} className="mx-auto opacity-20 mb-2" /><p className="text-sm font-semibold">{t.noOrdersFound}</p></>
            ) : (
              <><FileText size={32} className="mx-auto opacity-20 mb-2" /><p className="text-sm font-semibold">{t.noOrdersInRange}</p></>
            )}
          </div>
        ) : visibleOrders.map(o => (
          <div key={o.id} onClick={() => setDetailOrderId(o.id)}
            className={`px-5 py-4 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdrSoft}`}>
            <div className="flex items-center justify-between mb-1.5 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${o.status === "completed" ? "bg-[#E11D48]" : o.status === "pending" ? "bg-[#FB7185]" : o.status === "refunded" ? "bg-[#E11D48]" : "bg-[#C4504A]"}`} />
                <div className="min-w-0">
                  <p className={`text-sm font-bold font-mono truncate ${th.tx}`}>{o.id}</p>
                  <p className={`text-sm mt-0.5 ${th.txm} truncate`}>{o.customer} · {formatTime(o.createdAt)}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`font-display text-xl font-black leading-none ${o.status === "cancelled" || o.status === "refunded" ? "line-through opacity-50" : ""} ${th.tx}`}
                  style={{ fontVariationSettings: '"opsz" 96, "wght" 900' }}
                >
                  {$(o.total)}
                </p>
                <span className={`inline-block mt-1 text-sm font-bold px-2.5 py-0.5 rounded-lg ${
                  o.status === "cancelled"
                    ? (th.dark ? "bg-[#C4504A]/15 text-[#C4504A]" : "bg-[#FCE4EC] text-[#C4504A]")
                    : (th.dark ? "bg-[#E11D48]/15 text-[#FB7185]" : "bg-[#FFE4E9] text-[#E11D48]")
                }`}>{o.status === "cancelled" ? t.cancelled : o.status === "refunded" ? t.refunded : t[o.payment]}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 ml-5 mt-2">
              {o.items.map((item, i) => (
                <span key={i}
                  onClick={(e) => { e.stopPropagation(); if (products.find(p => p.id === item.productId)) setDetailProductId(item.productId); }}
                  className={`text-sm px-2.5 py-1 rounded-lg font-semibold cursor-pointer active:opacity-70 ${th.elev} ${th.txm}`}>
                  {item.name} ×{item.quantity}
                </span>
              ))}
            </div>
          </div>
        ))}
        {visibleCount < filtered.length && (
          <button onClick={() => setVisibleCount(v => v + ORDERS_PAGE_SIZE)}
            className={`w-full py-3 text-sm font-bold ${th.acc} hover:opacity-70`}>
            {t.loadMore} ({filtered.length - visibleCount})
          </button>
        )}
      </div>
      </>}

      {/* ======= MEMBERS TAB (admin/superadmin only) ======= */}
      {activeTab === "members" && canViewMembers && (
        <>
          {/* Header: search + add */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${th.txf}`} />
              <input
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Cari nama atau nomor HP…"
                className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border ${th.inp}`}
              />
            </div>
            <button
              onClick={() => { setNewMember(emptyMemberForm); setAddMemberOpen(true); }}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#E11D48]`}
            >
              <Plus size={13} /> Member
            </button>
          </div>

          {(() => {
            const q = debouncedMemberSearch.toLowerCase().trim();
            const filteredMembers = q
              ? members.filter(m =>
                  m.name.toLowerCase().includes(q) ||
                  m.phone.toLowerCase().includes(q) ||
                  (m.memberNumber || "").toLowerCase().includes(q),
                )
              : members;

            if (filteredMembers.length === 0) {
              return (
                <div className={`rounded-[22px] border py-12 text-center ${th.card} ${th.bdr}`}>
                  <Users size={36} className={`mx-auto opacity-20 mb-2 ${th.txm}`} />
                  <p className={`text-sm font-semibold ${th.txm}`}>Tidak ada member</p>
                  <p className={`text-xs ${th.txf} mt-1`}>Klik tombol "+ Member" untuk menambah</p>
                </div>
              );
            }

            return (
              <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
                <div className={`px-5 py-3.5 border-b flex items-center justify-between ${th.bdr}`}>
                  <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>
                    Members ({filteredMembers.length})
                  </p>
                  <p className={`text-xs ${th.txm}`}>Klik row untuk lihat statistik</p>
                </div>
                {filteredMembers.map(m => (
                  <div key={m.id}
                    onClick={() => setStatsMember({ id: m.id, name: m.name, phone: m.phone })}
                    className={`flex items-center justify-between px-4 py-3 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdrSoft}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black ${th.accBg} ${th.acc}`}>
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${th.tx}`}>{m.name}</p>
                        <p className={`text-xs font-mono ${th.txf} truncate`}>
                          {[m.phone, m.memberNumber && `#${m.memberNumber}`].filter(Boolean).join(" · ")}
                        </p>
                        {m.address && (
                          <p className={`text-xs ${th.txf} truncate`}>📍 {m.address}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className={`text-xs ${th.txf} hidden sm:block`}>
                        Sejak {formatDate(m.createdAt)}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditMember(m); }}
                        aria-label="Edit member"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${th.accBg} ${th.acc}`}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteMemberId(m.id); }}
                        aria-label="Delete member"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${th.dark ? "bg-[#BE123C]/15 text-[#BE123C]" : "bg-[#FCE4EC] text-[#BE123C]"}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}

      <ProductDetailModal productId={detailProductId} onClose={() => setDetailProductId(null)} />
      <OrderDetailModal orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
      <MemberStatsModal member={statsMember} onClose={() => setStatsMember(null)} />

      {/* Add Member modal */}
      <Modal open={addMemberOpen} onClose={() => setAddMemberOpen(false)} title="Tambah Member">
        <div className="flex flex-col gap-3">
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>Nama</p>
            <input value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })}
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl border ${th.inp}`}
              placeholder="Nama lengkap" autoFocus />
          </div>
          <div>
            <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>Nomor HP</p>
            <input type="tel" inputMode="tel" value={newMember.phone}
              onChange={e => setNewMember({ ...newMember, phone: e.target.value })}
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl border ${th.inp}`}
              placeholder="08xxxxxxxxxx" />
          </div>
          <p className={`text-xs ${th.txf}`}>
            Nomor anggota dan alamat bisa diisi nanti lewat tombol Edit.
          </p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setAddMemberOpen(false)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${th.bdr} ${th.txm}`}>
              Batal
            </button>
            <button
              onClick={() => {
                if (!newMember.name.trim() || !newMember.phone.trim()) return;
                addMemberAction({
                  id: genId(),
                  name: newMember.name.trim(),
                  phone: newMember.phone.trim(),
                  address: newMember.address.trim() || undefined,
                  memberNumber: newMember.memberNumber.trim() || undefined,
                  createdAt: new Date().toISOString(),
                });
                setAddMemberOpen(false);
                setNewMember(emptyMemberForm);
                toast.success("Member berhasil ditambah");
              }}
              disabled={!newMember.name.trim() || !newMember.phone.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#E11D48] disabled:opacity-40"
            >
              Simpan
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Member modal */}
      <Modal open={!!editMember} onClose={() => setEditMember(null)} title="Edit Member">
        {editMember && (
          <div className="flex flex-col gap-3">
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>Nama</p>
              <input value={editMember.name}
                onChange={e => setEditMember({ ...editMember, name: e.target.value })}
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border ${th.inp}`}
                autoFocus />
            </div>
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>Nomor HP</p>
              <input type="tel" inputMode="tel" value={editMember.phone}
                onChange={e => setEditMember({ ...editMember, phone: e.target.value })}
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border ${th.inp}`} />
            </div>
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>No. Member</p>
              <input value={editMember.memberNumber || ""}
                onChange={e => setEditMember({ ...editMember, memberNumber: e.target.value })}
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border ${th.inp}`}
                placeholder="Contoh: 1207022025" />
            </div>
            <div>
              <p className={`text-xs font-bold mb-1.5 ${th.tx}`}>Alamat</p>
              <textarea value={editMember.address || ""}
                onChange={e => setEditMember({ ...editMember, address: e.target.value })}
                rows={2}
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border resize-none ${th.inp}`}
                placeholder="Alamat lengkap" />
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setEditMember(null)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${th.bdr} ${th.txm}`}>
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!editMember.name.trim() || !editMember.phone.trim()) return;
                  await updateMemberAction(editMember.id, {
                    name: editMember.name.trim(),
                    phone: editMember.phone.trim(),
                    address: (editMember.address || "").trim(),
                    memberNumber: (editMember.memberNumber || "").trim(),
                  });
                  setEditMember(null);
                  toast.success("Member berhasil diperbarui");
                }}
                disabled={!editMember.name.trim() || !editMember.phone.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#E11D48] disabled:opacity-40"
              >
                Simpan
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Member confirm */}
      <Modal open={!!confirmDeleteMemberId} onClose={() => setConfirmDeleteMemberId(null)} title="Hapus Member?">
        <div className="flex flex-col gap-3">
          <p className={`text-sm ${th.tx}`}>
            Member ini akan dihapus. Riwayat transaksi tetap tersimpan tapi tidak lagi terhubung ke member.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDeleteMemberId(null)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${th.bdr} ${th.txm}`}>
              Batal
            </button>
            <button
              onClick={() => {
                if (confirmDeleteMemberId) {
                  deleteMemberAction(confirmDeleteMemberId);
                  toast.success("Member dihapus");
                }
                setConfirmDeleteMemberId(null);
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#C4504A]"
            >
              Hapus
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
