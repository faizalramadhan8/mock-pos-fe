import { useState } from "react";
import { Bell, X } from "lucide-react";
import { usePushNotification } from "@/hooks/usePushNotification";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useLangStore } from "@/stores";

export function PushPermission() {
  const th = useThemeClasses();
  const { lang } = useLangStore();
  const { supported, subscribed, loading, subscribe } = usePushNotification();
  const [hidden, setHidden] = useState(false);

  if (!supported || subscribed || hidden) return null;

  return (
    <div className={`mx-3 my-2 p-3 rounded-xl border ${th.dark ? "bg-[#A0673C]/10 border-[#A0673C]/20" : "bg-[#FFF5EC] border-[#E8DDD2]"}`}>
      <div className="flex items-start gap-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${th.accBg} ${th.acc}`}>
          <Bell size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${th.tx}`}>
            {lang === "id" ? "Aktifkan Push Notification" : "Enable Push Notifications"}
          </p>
          <p className={`text-[10px] mt-0.5 ${th.txm}`}>
            {lang === "id"
              ? "Dapat notifikasi stok rendah & kadaluarsa walau app tertutup"
              : "Get low stock & expiry alerts even when app is closed"}
          </p>
          <button
            onClick={subscribe}
            disabled={loading}
            className={`mt-2 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C] disabled:opacity-60`}
          >
            {loading ? "..." : lang === "id" ? "Aktifkan" : "Enable"}
          </button>
        </div>
        <button onClick={() => setHidden(true)} className={`${th.txf}`}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
