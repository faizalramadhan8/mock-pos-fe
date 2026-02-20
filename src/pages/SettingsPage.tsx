import { useState } from "react";
import { useAuthStore, useLangStore, useThemeStore, useSettingsStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { Sun, Moon, UserPlus, X } from "lucide-react";
import { genId } from "@/utils";
import toast from "react-hot-toast";
import type { Role } from "@/types";

const DEFAULT_PASSWORD = "bakeshop123";

export function SettingsPage() {
  const th = useThemeClasses();
  const { t, lang, setLang } = useLangStore();
  const { dark, toggle } = useThemeStore();
  const settings = useSettingsStore();
  const user = useAuthStore(s => s.user);
  const users = useAuthStore(s => s.users);
  const addUser = useAuthStore(s => s.addUser);
  const isAdmin = user?.role === "superadmin" || user?.role === "admin";

  const [storeName, setStoreName] = useState(settings.storeName);
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress);
  const [storePhone, setStorePhone] = useState(settings.storePhone);
  const [ppnRate, setPpnRate] = useState(String(settings.ppnRate));

  // Registration modal
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({
    nik: "", name: "", email: "", phone: "", dateOfBirth: "", role: "cashier" as Role,
  });

  const handleSave = () => {
    const rate = Math.max(0, Math.min(100, parseFloat(ppnRate) || 0));
    settings.update({ storeName, storeAddress, storePhone, ppnRate: rate });
    setPpnRate(String(rate));
    toast.success(t.settingsSaved as string);
  };

  const handleRegister = () => {
    if (!regForm.name.trim() || !regForm.email.trim()) return;
    // Check duplicate email
    if (users.some(u => u.email.toLowerCase() === regForm.email.toLowerCase())) {
      toast.error(t.emailExists as string);
      return;
    }
    const nameParts = regForm.name.trim().split(" ");
    const initials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : regForm.name.trim().slice(0, 2).toUpperCase();

    addUser({
      id: genId(),
      name: regForm.name.trim(),
      email: regForm.email.trim(),
      password: DEFAULT_PASSWORD,
      role: regForm.role,
      initials,
      nik: regForm.nik.trim() || undefined,
      phone: regForm.phone.trim() || undefined,
      dateOfBirth: regForm.dateOfBirth || undefined,
    });
    toast.success(t.userRegistered as string);
    setRegForm({ nik: "", name: "", email: "", phone: "", dateOfBirth: "", role: "cashier" });
    setShowRegister(false);
  };

  const staffUsers = users.filter(u => u.role === "cashier" || u.role === "staff");
  const inp = `w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className={`text-[22px] font-black tracking-tight ${th.tx}`}>{t.settings}</h1>

      <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
        <p className={`text-sm font-extrabold mb-3 ${th.tx}`}>{t.theme}</p>
        <div className="grid grid-cols-2 gap-2">
          {[{ k: false, l: t.light, ic: <Sun size={14} /> }, { k: true, l: t.dark, ic: <Moon size={14} /> }].map(o => (
            <button key={String(o.k)} onClick={() => dark !== o.k && toggle()}
              className={`py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 ${
                dark === o.k ? "text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]" : `border ${th.bdr} ${th.txm}`
              }`}>{o.ic} {o.l}</button>
          ))}
        </div>
      </div>

      <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
        <p className={`text-sm font-extrabold mb-3 ${th.tx}`}>{t.language}</p>
        <div className="grid grid-cols-2 gap-2">
          {[{ k: "en" as const, l: "English", f: "\u{1F1EC}\u{1F1E7}" }, { k: "id" as const, l: "Indonesia", f: "\u{1F1EE}\u{1F1E9}" }].map(o => (
            <button key={o.k} onClick={() => setLang(o.k)}
              className={`py-3.5 rounded-2xl text-sm font-bold ${
                lang === o.k ? "text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]" : `border ${th.bdr} ${th.txm}`
              }`}>{o.f} {o.l}</button>
          ))}
        </div>
      </div>

      <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
        <p className={`text-sm font-extrabold mb-3 ${th.tx}`}>{t.storeInfo}</p>
        <div className="flex flex-col gap-2">
          <input value={storeName} onChange={e => setStoreName(e.target.value)}
            className={inp} placeholder={t.storeName as string} />
          <input value={storeAddress} onChange={e => setStoreAddress(e.target.value)}
            className={inp} placeholder={t.storeAddress as string} />
          <input value={storePhone} onChange={e => setStorePhone(e.target.value)}
            className={inp} placeholder={t.storePhone as string} />
        </div>
      </div>

      {isAdmin && (
        <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
          <p className={`text-sm font-extrabold mb-3 ${th.tx}`}>{t.taxSettings}</p>
          <div className="flex flex-col gap-2">
            <div className="relative">
              <input type="number" value={ppnRate} onChange={e => setPpnRate(e.target.value)}
                min="0" max="100" step="0.5"
                className={`w-full px-4 py-3 text-sm rounded-2xl border pr-10 ${th.inp}`} placeholder={t.ppnRate as string} />
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold ${th.txm}`}>%</span>
            </div>
            <p className={`text-[11px] ${th.txf}`}>
              {lang === "id" ? "Pajak akan ditambahkan ke setiap pesanan" : "Tax will be added to every order"}
            </p>
          </div>
        </div>
      )}

      <button onClick={handleSave}
        className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]">{t.save}</button>

      {/* ─── Staff Management (Owner only) ─── */}
      {isAdmin && (
        <>
          <div className={`flex items-center justify-between mt-2`}>
            <p className={`text-[15px] font-extrabold tracking-tight ${th.tx}`}>{t.staffList}</p>
            <button onClick={() => setShowRegister(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]">
              <UserPlus size={13} /> {t.registerStaff}
            </button>
          </div>

          {staffUsers.length === 0 ? (
            <div className={`rounded-[22px] border p-8 text-center ${th.card} ${th.bdr}`}>
              <p className={`text-sm ${th.txm}`}>{t.noStaff}</p>
            </div>
          ) : (
            <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
              {staffUsers.map((u, i) => (
                <div key={u.id} className={`flex items-center gap-3 px-5 py-3.5 ${i > 0 ? `border-t ${th.bdr}` : ""}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-extrabold shrink-0 ${th.accBg} ${th.acc}`}>
                    {u.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${th.tx}`}>{u.name}</p>
                    <p className={`text-[11px] truncate ${th.txm}`}>{u.email}{u.phone ? ` \u00B7 ${u.phone}` : ""}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                    u.role === "cashier"
                      ? (th.dark ? "bg-[#5B8DEF]/15 text-[#5B8DEF]" : "bg-blue-50 text-[#5B8DEF]")
                      : (th.dark ? "bg-[#6F9A4D]/15 text-[#6F9A4D]" : "bg-green-50 text-[#6F9A4D]")
                  }`}>{(t.roles as Record<string, string>)[u.role]}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Registration Modal ─── */}
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRegister(false)} />
          <div className={`relative w-full max-w-md rounded-t-3xl sm:rounded-3xl border p-5 max-h-[85vh] overflow-y-auto ${th.card} ${th.bdr}`}>
            <div className="flex items-center justify-between mb-4">
              <p className={`text-[15px] font-extrabold ${th.tx}`}>{t.registerStaff}</p>
              <button onClick={() => setShowRegister(false)} className={`p-1.5 rounded-xl ${th.txm}`}><X size={18} /></button>
            </div>

            <div className="flex flex-col gap-2.5">
              <input value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                className={inp} placeholder={t.fullName as string} />
              <input value={regForm.nik} onChange={e => setRegForm(f => ({ ...f, nik: e.target.value }))}
                className={inp} placeholder={t.nik as string} inputMode="numeric" />
              <input value={regForm.email} onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                className={inp} placeholder={t.email as string} type="email" />
              <input value={regForm.phone} onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))}
                className={inp} placeholder={t.msisdn as string} type="tel" inputMode="tel" />
              <input value={regForm.dateOfBirth} onChange={e => setRegForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                className={inp} type="date" />

              {/* Role selector */}
              <div>
                <p className={`text-[11px] font-semibold mb-1.5 ${th.txm}`}>{t.selectRole}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["cashier", "staff"] as Role[]).map(r => (
                    <button key={r} onClick={() => setRegForm(f => ({ ...f, role: r }))}
                      className={`py-3 rounded-2xl text-sm font-bold ${
                        regForm.role === r
                          ? "text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C]"
                          : `border ${th.bdr} ${th.txm}`
                      }`}>{(t.roles as Record<string, string>)[r]}</button>
                  ))}
                </div>
              </div>

              {/* Default password hint */}
              <div className={`rounded-xl p-3 ${th.dark ? "bg-[#E89B48]/10" : "bg-amber-50"}`}>
                <p className={`text-[11px] font-semibold ${th.dark ? "text-[#E89B48]" : "text-amber-700"}`}>
                  {t.defaultPassword}: <span className="font-mono">{DEFAULT_PASSWORD}</span>
                </p>
              </div>

              <button onClick={handleRegister}
                disabled={!regForm.name.trim() || !regForm.email.trim()}
                className={`w-full py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#E8B088] to-[#A0673C] mt-1 ${
                  !regForm.name.trim() || !regForm.email.trim() ? "opacity-40" : ""
                }`}>{t.registerStaff}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
