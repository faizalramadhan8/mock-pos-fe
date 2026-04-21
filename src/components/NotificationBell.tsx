import { useState, useRef, useEffect } from "react";
import { Bell, X, Package, AlertTriangle, Clock, Receipt, ShieldAlert } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useLangStore } from "@/stores";
import type { AppNotification, NotifType } from "@/types";
import { PushPermission } from "@/components/PushPermission";

const DISMISSED_KEY = "bakeshop-notif-dismissed";

function getDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
  } catch { return new Set(); }
}

function setDismissed(ids: Set<string>) {
  // Keep only last 200 to avoid bloat
  const arr = [...ids].slice(-200);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(arr));
}

const ICON_MAP: Record<NotifType, React.ReactNode> = {
  stock_out: <ShieldAlert size={14} />,
  stock_low: <Package size={14} />,
  expired: <AlertTriangle size={14} />,
  expiry_soon: <Clock size={14} />,
  invoice_due: <Receipt size={14} />,
  register_open: <Clock size={14} />,
};

const COLOR_MAP: Record<string, string> = {
  critical: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-400",
};

const BG_MAP_LIGHT: Record<string, string> = {
  critical: "bg-red-50 border-red-100",
  high: "bg-orange-50 border-orange-100",
  medium: "bg-yellow-50 border-yellow-100",
  low: "bg-blue-50 border-blue-100",
};

const BG_MAP_DARK: Record<string, string> = {
  critical: "bg-red-500/10 border-red-500/20",
  high: "bg-orange-500/10 border-orange-500/20",
  medium: "bg-yellow-500/10 border-yellow-500/20",
  low: "bg-blue-500/10 border-blue-500/20",
};

export function NotificationBell() {
  const th = useThemeClasses();
  const { lang } = useLangStore();
  const allNotifs = useNotifications();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissedState] = useState<Set<string>>(getDismissed);
  const panelRef = useRef<HTMLDivElement>(null);

  const notifs = allNotifs.filter(n => !dismissed.has(n.id));
  const count = notifs.length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissedState(next);
    setDismissed(next);
  };

  const dismissAll = () => {
    const next = new Set(dismissed);
    notifs.forEach(n => next.add(n.id));
    setDismissedState(next);
    setDismissed(next);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
          open ? th.accBg : "hover:bg-black/5 dark:hover:bg-white/5"
        } ${count > 0 ? th.acc : th.txm}`}
        aria-label={`Notifications${count > 0 ? ` (${count})` : ""}`}
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-1 animate-pulse">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className={`absolute right-0 top-11 w-[min(360px,calc(100vw-32px))] max-h-[70vh] rounded-2xl border shadow-xl overflow-hidden z-50 ${th.card} ${th.bdr}`}>
          {/* Header */}
          <div className={`px-4 py-3 border-b flex items-center justify-between ${th.bdr}`}>
            <p className={`text-sm font-extrabold ${th.tx}`}>
              {lang === "id" ? "Notifikasi" : "Notifications"} {count > 0 && `(${count})`}
            </p>
            {count > 0 && (
              <button onClick={dismissAll} className={`text-xs font-bold uppercase tracking-wide ${th.acc}`}>
                {lang === "id" ? "Hapus Semua" : "Clear All"}
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[calc(70vh-52px)] overscroll-contain">
            <PushPermission />
            {count === 0 ? (
              <div className={`py-10 text-center ${th.txm}`}>
                <Bell size={28} className="mx-auto opacity-20 mb-2" />
                <p className="text-sm font-semibold">
                  {lang === "id" ? "Tidak ada notifikasi" : "No notifications"}
                </p>
              </div>
            ) : (
              notifs.map((n) => (
                <NotifItem key={n.id} notif={n} onDismiss={() => dismiss(n.id)} dark={th.dark} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifItem({ notif, onDismiss, dark }: { notif: AppNotification; onDismiss: () => void; dark: boolean }) {
  const bgMap = dark ? BG_MAP_DARK : BG_MAP_LIGHT;
  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 ${dark ? "border-white/5" : "border-black/5"}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${bgMap[notif.priority]} ${COLOR_MAP[notif.priority]}`}>
        {ICON_MAP[notif.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold ${COLOR_MAP[notif.priority]}`}>{notif.title}</p>
        <p className={`text-xs mt-0.5 ${dark ? "text-[#94A3B8]" : "text-[#64748B]"} truncate`}>{notif.message}</p>
      </div>
      <button onClick={onDismiss} className={`w-6 h-6 flex items-center justify-center rounded-lg shrink-0 ${dark ? "hover:bg-white/10 text-[#64748B]" : "hover:bg-black/5 text-[#94A3B8]"}`}>
        <X size={12} />
      </button>
    </div>
  );
}
