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
import { Printer, FileText, Download, Search, Users, Trash2, Plus, Receipt } from "lucide-react";
import toast from "react-hot-toast";

type OrdersTab = "orders" | "members";

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
  const deleteMemberAction = useMemberStore(s => s.deleteMember);
  const [memberSearch, setMemberSearch] = useState("");
  const debouncedMemberSearch = useDebounce(memberSearch, 150);
  const [statsMember, setStatsMember] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", phone: "" });
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
              className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold ${th.elev} ${th.txm}`}>
              <Download size={11} /> CSV
            </button>
            <button onClick={async () => { await exportOrders(dateFiltered, "xlsx"); toast.success(t.exportSuccess as string); }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold ${th.elev} ${th.txm}`}>
              <Download size={11} /> Excel
            </button>
            <button onClick={() => printReport(dateFiltered, dateRangeLabel(dateRange) as string)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold ${th.accBg} ${th.acc}`}>
              <Printer size={12} /> {t.printReport}
            </button>
          </div>
        )}
      </div>

      {/* Tab switcher — only show if user can access members */}
      {canViewMembers && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {([
            { id: "orders" as OrdersTab, label: "Transaksi", icon: <Receipt size={13} /> },
            { id: "members" as OrdersTab, label: "Members", icon: <Users size={13} /> },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-[14px] text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]"
                  : `${th.elev} ${th.txm}`
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "orders" && <>
      {/* Date range pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {(["today", "yesterday", "week", "month", "all"] as DateRange[]).map(r => (
          <button key={r} onClick={() => setDateRange(r)}
            className={`shrink-0 px-3.5 py-2 rounded-[14px] text-xs font-bold transition-all ${
              dateRange === r
                ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]"
                : `${th.elev} ${th.txm}`
            }`}>{dateRangeLabel(r)}</button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${th.txf}`} />
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder={t.searchOrders as string}
          className={`w-full pl-10 pr-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/20 font-medium ${th.inp}`} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: t.totalRevenue, value: $(stats.revenue), color: th.acc },
          { label: t.ordersCount, value: String(stats.completedCount), color: th.dark ? "text-[#4A8B3F]" : "text-[#4A8B3F]" },
          { label: t.avgOrder, value: $(stats.avg), color: th.dark ? "text-[#5B8DEF]" : "text-[#5B8DEF]" },
          { label: t.cancelledCount, value: String(stats.cancelledCount), color: "text-[#C4504A]" },
        ].map((card, i) => (
          <div key={i} className={`rounded-[18px] border p-3.5 ${th.card} ${th.bdr}`}>
            <p className={`text-[10px] font-semibold ${th.txm}`}>{card.label}</p>
            <p className={`text-lg font-black tracking-tight mt-0.5 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {["all", "completed", "pending", "cancelled", "refunded"].map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`shrink-0 px-3.5 py-2 rounded-[14px] text-xs font-bold ${
              statusFilter === f ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]" : `border ${th.card} ${th.bdr} ${th.txm}`
            }`}>{statusLabel(f)}</button>
        ))}
      </div>

      {/* Payment method filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { k: "all", l: lang === "id" ? "Semua Bayar" : "All Payment" },
          { k: "cash", l: lang === "id" ? "💵 Tunai" : "💵 Cash" },
          { k: "transfer", l: "🏦 Transfer" },
          { k: "qris", l: "📱 QRIS" },
        ].map(f => (
          <button key={f.k} onClick={() => setPaymentFilter(f.k)}
            className={`shrink-0 px-3.5 py-2 rounded-[14px] text-xs font-bold ${
              paymentFilter === f.k ? "text-white bg-gradient-to-r from-[#5B8DEF] to-[#3B6FCF]" : `border ${th.card} ${th.bdr} ${th.txm}`
            }`}>{f.l}</button>
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
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${o.status === "completed" ? "bg-[#4A8B3F]" : o.status === "pending" ? "bg-[#60A5FA]" : o.status === "refunded" ? "bg-[#E89B48]" : "bg-[#C4504A]"}`} />
                <div>
                  <p className={`text-sm font-bold ${th.tx}`}>{o.id}</p>
                  <p className={`text-[11px] ${th.txm}`}>{o.customer} · {formatTime(o.createdAt)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-black ${o.status === "cancelled" || o.status === "refunded" ? "line-through opacity-50" : ""} ${th.tx}`}>{$(o.total)}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  o.status === "cancelled"
                    ? (th.dark ? "bg-[#C4504A]/15 text-[#C4504A]" : "bg-red-50 text-[#C4504A]")
                    : o.status === "refunded"
                    ? (th.dark ? "bg-[#E89B48]/15 text-[#E89B48]" : "bg-amber-50 text-[#E89B48]")
                    : o.payment === "cash" ? (th.dark ? "bg-[#4A8B3F]/15 text-[#4A8B3F]" : "bg-green-50 text-[#4A8B3F]")
                    : o.payment === "card" ? (th.dark ? "bg-[#5B8DEF]/15 text-[#5B8DEF]" : "bg-blue-50 text-[#5B8DEF]")
                    : (th.dark ? "bg-[#8B6FC0]/15 text-[#8B6FC0]" : "bg-purple-50 text-[#8B6FC0]")
                }`}>{o.status === "cancelled" ? t.cancelled : o.status === "refunded" ? t.refunded : t[o.payment]}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 ml-5">
              {o.items.map((item, i) => (
                <span key={i}
                  onClick={(e) => { e.stopPropagation(); if (products.find(p => p.id === item.productId)) setDetailProductId(item.productId); }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium cursor-pointer active:opacity-70 ${th.elev} ${th.txm}`}>
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
              onClick={() => { setNewMember({ name: "", phone: "" }); setAddMemberOpen(true); }}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#1E40AF]`}
            >
              <Plus size={13} /> Member
            </button>
          </div>

          {(() => {
            const q = debouncedMemberSearch.toLowerCase().trim();
            const filteredMembers = q
              ? members.filter(m => m.name.toLowerCase().includes(q) || m.phone.toLowerCase().includes(q))
              : members;

            if (filteredMembers.length === 0) {
              return (
                <div className={`rounded-[22px] border py-12 text-center ${th.card} ${th.bdr}`}>
                  <Users size={36} className={`mx-auto opacity-20 mb-2 ${th.txm}`} />
                  <p className={`text-sm font-semibold ${th.txm}`}>Tidak ada member</p>
                  <p className={`text-[11px] ${th.txf} mt-1`}>Klik tombol "+ Member" untuk menambah</p>
                </div>
              );
            }

            return (
              <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
                <div className={`px-5 py-3.5 border-b flex items-center justify-between ${th.bdr}`}>
                  <p className={`text-sm font-extrabold tracking-tight ${th.tx}`}>
                    Members ({filteredMembers.length})
                  </p>
                  <p className={`text-[10px] ${th.txm}`}>Klik row untuk lihat statistik</p>
                </div>
                {filteredMembers.map(m => (
                  <div key={m.id}
                    onClick={() => setStatsMember({ id: m.id, name: m.name, phone: m.phone })}
                    className={`flex items-center justify-between px-4 py-3 border-b last:border-0 cursor-pointer active:opacity-70 ${th.bdrSoft}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${th.accBg} ${th.acc}`}>💎</div>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${th.tx}`}>{m.name}</p>
                        <p className={`text-[11px] font-mono ${th.txf}`}>{m.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className={`text-[10px] ${th.txf} hidden sm:block`}>
                        Sejak {formatDate(m.createdAt)}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteMemberId(m.id); }}
                        aria-label="Delete member"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${th.dark ? "bg-[#D4627A]/15 text-[#D4627A]" : "bg-red-50 text-[#D4627A]"}`}
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
                  createdAt: new Date().toISOString(),
                });
                setAddMemberOpen(false);
                setNewMember({ name: "", phone: "" });
                toast.success("Member berhasil ditambah");
              }}
              disabled={!newMember.name.trim() || !newMember.phone.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#1E40AF] disabled:opacity-40"
            >
              Simpan
            </button>
          </div>
        </div>
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
