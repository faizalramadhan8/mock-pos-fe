import { useState, useMemo, useRef, useEffect } from "react";
import { useAuthStore, useLangStore, useThemeStore, useSettingsStore, useAuditStore } from "@/stores";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  Sun, Moon, UserPlus, X, Plus, Trash2, Search, Building2,
  Palette, Store, Users, LogOut, Clock, ChevronDown, ChevronUp, Key, Power,
} from "lucide-react";
import { genId, formatDate, formatTime, LABEL_PRESETS } from "@/utils";
import { INDONESIAN_BANKS } from "@/constants";
import toast from "react-hot-toast";
import { authApi } from "@/api/auth";
import type { Role, BankAccount } from "@/types";

type SettingsTab = "preferences" | "store" | "team" | "activity";
const DEFAULT_PASSWORD = "bakeshop123";

export function SettingsPage() {
  const th = useThemeClasses();
  const { t, lang, setLang } = useLangStore();
  const { dark, toggle } = useThemeStore();
  const settings = useSettingsStore();
  const user = useAuthStore(s => s.user);
  const users = useAuthStore(s => s.users);
  const addUser = useAuthStore(s => s.addUser);
  const updateUser = useAuthStore(s => s.updateUser);
  const deleteUser = useAuthStore(s => s.deleteUser);
  const toggleUserActive = useAuthStore(s => s.toggleUserActive);
  const logout = useAuthStore(s => s.logout);
  const auditLog = useAuditStore(s => s.log);
  const isAdmin = user?.role === "superadmin" || user?.role === "admin";
  const auditEntries = useAuditStore(s => s.entries);

  const [activeTab, setActiveTab] = useState<SettingsTab>("preferences");

  // ─── Change Password ───
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpLoading, setCpLoading] = useState(false);

  // ─── Store Info State ───
  const [storeName, setStoreName] = useState(settings.storeName);
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress);
  const [storePhone, setStorePhone] = useState(settings.storePhone);
  const [ppnRate, setPpnRate] = useState(String(settings.ppnRate));
  const [labelWidth, setLabelWidth] = useState(settings.labelWidth);
  const [labelHeight, setLabelHeight] = useState(settings.labelHeight);

  // ─── Bank Accounts ───
  const [showAddBank, setShowAddBank] = useState(false);
  const [bankForm, setBankForm] = useState({ bankName: "", accountNumber: "", accountHolder: "" });
  const [bankFormErrors, setBankFormErrors] = useState<Record<string, boolean>>({});
  const [bankQuery, setBankQuery] = useState("");
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [confirmRemoveBankId, setConfirmRemoveBankId] = useState<string | null>(null);
  const bankDropdownRef = useRef<HTMLDivElement>(null);
  const ACTIVITY_PAGE_SIZE = 20;
  const [activityVisible, setActivityVisible] = useState(ACTIVITY_PAGE_SIZE);

  const filteredBanks = useMemo(() =>
    bankQuery ? INDONESIAN_BANKS.filter(b => b.toLowerCase().includes(bankQuery.toLowerCase())) : INDONESIAN_BANKS,
    [bankQuery]
  );

  useEffect(() => {
    if (!showBankDropdown) return;
    const handle = (e: MouseEvent) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) setShowBankDropdown(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showBankDropdown]);

  const handleAddBank = () => {
    const errs: Record<string, boolean> = {};
    if (!bankForm.bankName) errs.bankName = true;
    if (!bankForm.accountNumber.trim()) errs.accountNumber = true;
    if (!bankForm.accountHolder.trim()) errs.accountHolder = true;
    if (Object.keys(errs).length) { setBankFormErrors(errs); return; }
    setBankFormErrors({});
    const newAcc: BankAccount = { id: genId(), ...bankForm };
    const updated = [...settings.bankAccounts, newAcc];
    settings.update({ bankAccounts: updated });
    setBankForm({ bankName: "", accountNumber: "", accountHolder: "" });
    setBankQuery("");
    setShowAddBank(false);
  };

  const handleRemoveBank = (id: string) => {
    const updated = settings.bankAccounts.filter(a => a.id !== id);
    settings.update({ bankAccounts: updated });
  };

  // ─── Registration Modal ───
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({
    nik: "", name: "", email: "", phone: "", dateOfBirth: "", role: "cashier" as Role,
  });
  const [regFormErrors, setRegFormErrors] = useState<Record<string, boolean>>({});
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSave = () => {
    const rate = Math.max(0, Math.min(100, parseFloat(ppnRate) || 0));
    const lw = Math.max(30, Math.min(100, labelWidth || 60));
    const lh = Math.max(20, Math.min(80, labelHeight || 40));
    settings.update({ storeName, storeAddress, storePhone, ppnRate: rate, labelWidth: lw, labelHeight: lh });
    setLabelWidth(lw);
    setLabelHeight(lh);
    setPpnRate(String(rate));
    toast.success(t.settingsSaved as string);
  };

  const handleRegister = () => {
    const errs: Record<string, boolean> = {};
    if (!regForm.name.trim()) errs.name = true;
    if (!regForm.email.trim()) errs.email = true;
    else if (!regForm.email.includes("@")) errs.invalidEmail = true;
    if (Object.keys(errs).length) { setRegFormErrors(errs); return; }
    setRegFormErrors({});
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
    setRegFormErrors({});
    setShowRegister(false);
  };

  const staffUsers = users.filter(u => u.role === "cashier" || u.role === "staff");
  const inp = `w-full px-4 py-3 text-sm rounded-2xl border ${th.inp}`;

  // ─── Available tabs based on role ───
  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "preferences", label: t.preferences as string, icon: <Palette size={15} /> },
    ...(isAdmin ? [
      { id: "store" as SettingsTab, label: t.storeSettings as string, icon: <Store size={15} /> },
      { id: "team" as SettingsTab, label: t.team as string, icon: <Users size={15} /> },
      { id: "activity" as SettingsTab, label: t.activity as string, icon: <Clock size={15} /> },
    ] : []),
  ];

  const currentTab = tabs.find(tab => tab.id === activeTab) ? activeTab : "preferences";

  return (
    <div className="flex flex-col gap-5">
      <h1 className={`text-[22px] font-black tracking-tight ${th.tx}`}>{t.settings}</h1>

      {/* ─── Tab Bar (only show when multiple tabs) ─── */}
      {tabs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => {
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${
                  active
                    ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] shadow-sm"
                    : `${th.elev} ${th.txm}`
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB: Preferences                               */}
      {/* ═══════════════════════════════════════════════ */}
      {currentTab === "preferences" && (
        <div className="flex flex-col gap-4">
          <div className="mb-1">
            <h3 className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.preferences}</h3>
            <p className={`text-xs mt-0.5 ${th.txm}`}>{t.preferencesDesc}</p>
          </div>

          {/* Theme */}
          <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
            <p className={`text-sm font-extrabold mb-3 ${th.tx}`}>{t.theme}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { k: false, l: t.light, ic: <Sun size={14} /> },
                { k: true, l: t.dark, ic: <Moon size={14} /> },
              ].map(o => (
                <button key={String(o.k)} onClick={() => dark !== o.k && toggle()}
                  className={`py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    dark === o.k
                      ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]"
                      : `border ${th.bdr} ${th.txm}`
                  }`}>{o.ic} {o.l}</button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
            <p className={`text-sm font-extrabold mb-3 ${th.tx}`}>{t.language}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { k: "en" as const, l: "English", f: "\u{1F1EC}\u{1F1E7}" },
                { k: "id" as const, l: "Indonesia", f: "\u{1F1EE}\u{1F1E9}" },
              ].map(o => (
                <button key={o.k} onClick={() => setLang(o.k)}
                  className={`py-3.5 rounded-2xl text-sm font-bold transition-all ${
                    lang === o.k
                      ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]"
                      : `border ${th.bdr} ${th.txm}`
                  }`}>{o.f} {o.l}</button>
              ))}
            </div>
          </div>

          {/* Change Password */}
          <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
            <p className={`text-sm font-extrabold mb-3 ${th.tx}`}>
              <Key size={14} className="inline mr-1.5 -mt-0.5" />
              {lang === "id" ? "Ubah Password" : "Change Password"}
            </p>
            <div className="flex flex-col gap-2.5">
              <input
                type="password" value={cpCurrent}
                onChange={e => setCpCurrent(e.target.value)}
                placeholder={lang === "id" ? "Password lama" : "Current password"}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`}
              />
              <input
                type="password" value={cpNew}
                onChange={e => setCpNew(e.target.value)}
                placeholder={lang === "id" ? "Password baru (min 6 karakter)" : "New password (min 6 chars)"}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`}
              />
              <input
                type="password" value={cpConfirm}
                onChange={e => setCpConfirm(e.target.value)}
                placeholder={lang === "id" ? "Konfirmasi password baru" : "Confirm new password"}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border ${th.inp}`}
              />
              {cpNew && cpConfirm && cpNew !== cpConfirm && (
                <p className="text-xs text-red-400 font-medium">
                  {lang === "id" ? "Password baru tidak cocok" : "Passwords don't match"}
                </p>
              )}
              <button
                disabled={cpLoading || !cpCurrent || cpNew.length < 6 || cpNew !== cpConfirm}
                onClick={async () => {
                  setCpLoading(true);
                  try {
                    await authApi.changePassword(cpCurrent, cpNew);
                    toast.success(lang === "id" ? "Password berhasil diubah" : "Password updated");
                    setCpCurrent(""); setCpNew(""); setCpConfirm("");
                  } catch (e: any) {
                    toast.error(e.message || "Gagal ubah password");
                  } finally {
                    setCpLoading(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#1E40AF] disabled:opacity-40"
              >
                {cpLoading
                  ? (lang === "id" ? "Menyimpan…" : "Saving…")
                  : (lang === "id" ? "Simpan Password Baru" : "Save New Password")}
              </button>
            </div>
          </div>

          {/* Sign Out */}
          <button onClick={logout}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-[#C4504A] border border-[#C4504A]/20`}>
            <LogOut size={15} /> {t.signOut}
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB: Store                                     */}
      {/* ═══════════════════════════════════════════════ */}
      {currentTab === "store" && isAdmin && (
        <div className="flex flex-col gap-4">
          {/* ── Store Info ── */}
          <div className="mb-1">
            <h3 className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.storeInfo}</h3>
            <p className={`text-xs mt-0.5 ${th.txm}`}>{t.storeInfoDesc}</p>
          </div>

          <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
            <div className="flex flex-col gap-3">
              <div>
                <label className={`text-xs font-semibold mb-1.5 block ${th.txm}`}>{t.storeName}</label>
                <input value={storeName} onChange={e => setStoreName(e.target.value)}
                  className={inp} placeholder={t.storeName as string} />
              </div>
              <div>
                <label className={`text-xs font-semibold mb-1.5 block ${th.txm}`}>{t.storeAddress}</label>
                <input value={storeAddress} onChange={e => setStoreAddress(e.target.value)}
                  className={inp} placeholder={t.storeAddress as string} />
              </div>
              <div>
                <label className={`text-xs font-semibold mb-1.5 block ${th.txm}`}>{t.storePhone}</label>
                <input value={storePhone} onChange={e => setStorePhone(e.target.value)}
                  className={inp} placeholder={t.storePhone as string} />
              </div>
            </div>
          </div>

          {/* ── Tax ── */}
          <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
            <p className={`text-sm font-extrabold mb-1 ${th.tx}`}>{t.taxSettings}</p>
            <p className={`text-xs mb-3 ${th.txf}`}>{t.taxDesc}</p>
            <div className="relative">
              <input type="number" value={ppnRate} onChange={e => setPpnRate(e.target.value)}
                min="0" max="100" step="0.5"
                className={`w-full px-4 py-3 text-sm rounded-2xl border pr-10 ${th.inp}`} placeholder={t.ppnRate as string} />
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold ${th.txm}`}>%</span>
            </div>
          </div>

          {/* ── Label Size ── */}
          <div className={`rounded-[22px] border p-5 ${th.card} ${th.bdr}`}>
            <p className={`text-sm font-extrabold mb-1 ${th.tx}`}>Label Size (mm)</p>
            <p className={`text-xs mb-3 ${th.txf}`}>{lang === "id" ? "Pilih ukuran label cetak" : "Select print label size"}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(LABEL_PRESETS).map(([key, s]) => (
                <button key={key} type="button"
                  onClick={() => { setLabelWidth(s.width); setLabelHeight(s.height); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    labelWidth === s.width && labelHeight === s.height
                      ? `${th.accBg} ${th.acc} border-[#1E40AF]`
                      : `${th.card2} ${th.bdr}`
                  }`}>
                  {s.width}&times;{s.height}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={`text-xs ${th.txf}`}>{lang === "id" ? "Lebar" : "Width"}</label>
                <input type="number" value={labelWidth} min={30} max={100}
                  onChange={e => setLabelWidth(Number(e.target.value))}
                  className={`w-full px-3 py-2 text-sm rounded-xl border ${th.inp}`} />
              </div>
              <div className="flex-1">
                <label className={`text-xs ${th.txf}`}>{lang === "id" ? "Tinggi" : "Height"}</label>
                <input type="number" value={labelHeight} min={20} max={80}
                  onChange={e => setLabelHeight(Number(e.target.value))}
                  className={`w-full px-3 py-2 text-sm rounded-xl border ${th.inp}`} />
              </div>
            </div>
          </div>

          {/* Save — clearly scoped to store info + tax */}
          <button onClick={handleSave}
            className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]">
            {t.save}
          </button>

          {/* ── Divider ── */}
          <div className={`border-t ${th.bdr}`} />

          {/* ── Bank Accounts ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.bankAccounts}</h3>
                <p className={`text-xs mt-0.5 ${th.txm}`}>{t.bankDesc}</p>
              </div>
              <button onClick={() => setShowAddBank(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] shrink-0">
                <Plus size={13} /> {t.addBankAccount}
              </button>
            </div>

            {settings.bankAccounts.length === 0 ? (
              <div className={`rounded-[22px] border p-8 text-center ${th.card} ${th.bdr}`}>
                <Building2 size={32} className={`mx-auto mb-2 opacity-20 ${th.txm}`} />
                <p className={`text-sm ${th.txm}`}>{t.noBankAccounts}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {settings.bankAccounts.map(acc => (
                  <div key={acc.id} className={`rounded-[18px] border p-4 ${th.card} ${th.bdr}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 ${th.accBg} ${th.acc}`}>
                          {acc.bankName.split("(")[1]?.replace(")", "").trim().slice(0, 3) || acc.bankName.slice(0, 3).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold truncate ${th.tx}`}>{acc.bankName}</p>
                          <p className={`text-sm font-mono mt-0.5 ${th.tx}`}>{acc.accountNumber}</p>
                          <p className={`text-xs mt-0.5 ${th.txm}`}>{acc.accountHolder}</p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {confirmRemoveBankId === acc.id ? (
                          <div className="flex gap-1.5">
                            <button onClick={() => setConfirmRemoveBankId(null)}
                              className={`px-2 py-1 rounded-lg text-xs font-bold border ${th.bdr} ${th.txm}`}>
                              {t.cancel}
                            </button>
                            <button onClick={() => { handleRemoveBank(acc.id); setConfirmRemoveBankId(null); }}
                              className="px-2 py-1 rounded-lg text-xs font-bold text-white bg-[#C4504A]">
                              {t.confirm}
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmRemoveBankId(acc.id)} aria-label="Remove bank account" className="text-[#D4627A]/50 hover:text-[#D4627A] p-1">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB: Team                                      */}
      {/* ═══════════════════════════════════════════════ */}
      {currentTab === "team" && isAdmin && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.staffList}</h3>
              <p className={`text-xs mt-0.5 ${th.txm}`}>{t.teamDesc}</p>
            </div>
            <button onClick={() => setShowRegister(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] shrink-0">
              <UserPlus size={13} /> {t.registerStaff}
            </button>
          </div>

          {staffUsers.length === 0 ? (
            <div className={`rounded-[22px] border p-8 text-center ${th.card} ${th.bdr}`}>
              <Users size={32} className={`mx-auto mb-2 opacity-20 ${th.txm}`} />
              <p className={`text-sm ${th.txm}`}>{t.noStaff}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {staffUsers.map(u => {
                const expanded = expandedUserId === u.id;
                const inactive = u.isActive === false;
                return (
                  <div key={u.id} className={`rounded-[18px] border overflow-hidden ${th.card} ${th.bdr} ${inactive ? "opacity-60" : ""}`}>
                    <button onClick={() => { setExpandedUserId(expanded ? null : u.id); setNewPasswordInput(""); setConfirmDeleteId(null); }}
                      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 ${th.accBg} ${th.acc}`}>
                        {u.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-bold truncate ${th.tx}`}>{u.name}</p>
                          {inactive && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-[#C4504A]/15 text-[#C4504A]">{t.accountInactive}</span>}
                        </div>
                        <p className={`text-xs truncate ${th.txm}`}>{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ${
                        u.role === "cashier"
                          ? (th.dark ? "bg-[#5B8DEF]/15 text-[#5B8DEF]" : "bg-blue-50 text-[#5B8DEF]")
                          : (th.dark ? "bg-[#6F9A4D]/15 text-[#6F9A4D]" : "bg-green-50 text-[#6F9A4D]")
                      }`}>{(t.roles as Record<string, string>)[u.role]}</span>
                      {expanded ? <ChevronUp size={14} className={th.txm} /> : <ChevronDown size={14} className={th.txm} />}
                    </button>

                    {expanded && (
                      <div className={`px-5 pb-4 pt-1 border-t ${th.bdr} flex flex-col gap-3`}>
                        {/* Detail info */}
                        <div className="grid grid-cols-2 gap-2">
                          {u.nik && <div><p className={`text-xs font-semibold ${th.txf}`}>{t.nik}</p><p className={`text-sm font-medium ${th.tx}`}>{u.nik}</p></div>}
                          {u.phone && <div><p className={`text-xs font-semibold ${th.txf}`}>{t.msisdn}</p><p className={`text-sm font-medium ${th.tx}`}>{u.phone}</p></div>}
                          {u.dateOfBirth && <div><p className={`text-xs font-semibold ${th.txf}`}>{t.dateOfBirth}</p><p className={`text-sm font-medium ${th.tx}`}>{u.dateOfBirth}</p></div>}
                          <div><p className={`text-xs font-semibold ${th.txf}`}>{t.email}</p><p className={`text-sm font-medium ${th.tx}`}>{u.email}</p></div>
                        </div>

                        {/* Reset Password */}
                        <div className={`rounded-xl border p-3 ${th.card2} ${th.bdr}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Key size={12} className={th.txm} />
                            <p className={`text-xs font-bold ${th.tx}`}>{t.resetPassword}</p>
                          </div>
                          <div className="flex gap-2">
                            <input value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)}
                              placeholder={t.newPassword as string} type="text"
                              className={`flex-1 px-3 py-2 text-sm rounded-xl border ${th.inp}`} />
                            <button onClick={() => {
                              if (!newPasswordInput.trim()) return;
                              updateUser(u.id, { password: newPasswordInput.trim() });
                              auditLog("password_reset", user!.id, user!.name, u.name);
                              setNewPasswordInput("");
                              toast.success(t.passwordUpdated as string);
                            }} disabled={!newPasswordInput.trim()}
                              className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] disabled:opacity-40">{t.save}</button>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <button onClick={() => {
                            toggleUserActive(u.id);
                            const willDeactivate = u.isActive !== false;
                            auditLog("user_toggled", user!.id, user!.name, `${u.name} → ${willDeactivate ? "inactive" : "active"}`);
                            toast.success((willDeactivate ? t.userDeactivated : t.userActivated) as string);
                          }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border ${th.bdr} ${inactive ? "text-[#4A8B3F]" : "text-[#E89B48]"}`}>
                            <Power size={12} />
                            {inactive ? t.activateUser : t.deactivateUser}
                          </button>

                          {confirmDeleteId === u.id ? (
                            <div className="flex-1 flex gap-1.5">
                              <button onClick={() => setConfirmDeleteId(null)}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
                              <button onClick={() => {
                                deleteUser(u.id);
                                auditLog("user_deleted", user!.id, user!.name, u.name);
                                setExpandedUserId(null);
                                setConfirmDeleteId(null);
                                toast.success(t.userDeleted as string);
                              }}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-[#C4504A]">{t.confirm}</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(u.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-[#C4504A] border border-[#C4504A]/20">
                              <Trash2 size={12} />
                              {t.deleteUser}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB: Activity                                   */}
      {/* ═══════════════════════════════════════════════ */}
      {currentTab === "activity" && isAdmin && (
        <div className="flex flex-col gap-4">
          <div className="mb-1">
            <h3 className={`text-sm font-extrabold tracking-tight ${th.tx}`}>{t.activity}</h3>
            <p className={`text-xs mt-0.5 ${th.txm}`}>{t.activityDesc}</p>
          </div>
          {auditEntries.length === 0 ? (
            <div className={`rounded-[22px] border p-8 text-center ${th.card} ${th.bdr}`}>
              <Clock size={32} className={`mx-auto mb-2 opacity-20 ${th.txm}`} />
              <p className={`text-sm ${th.txm}`}>{t.noActivity}</p>
            </div>
          ) : (
            <div className={`rounded-[22px] border overflow-hidden ${th.card} ${th.bdr}`}>
              {auditEntries.slice(0, activityVisible).map((entry, i) => {
                const actionColor =
                  entry.action === "order_created" ? "text-[#4A8B3F]"
                  : entry.action === "order_voided" ? "text-[#C4504A]"
                  : entry.action === "order_refunded" ? "text-[#E89B48]"
                  : entry.action === "register_closed" ? "text-[#5B8DEF]"
                  : entry.action === "product_added" || entry.action === "product_edited" ? "text-[#8B6FC0]"
                  : th.txm;
                const actionLabel = entry.action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                return (
                  <div key={entry.id} className={`px-5 py-3 ${i > 0 ? `border-t ${th.bdrSoft}` : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold uppercase tracking-wider ${actionColor}`}>{actionLabel}</span>
                      <span className={`text-xs ${th.txf}`}>{formatDate(entry.createdAt)} · {formatTime(entry.createdAt)}</span>
                    </div>
                    <p className={`text-sm mt-0.5 ${th.tx}`}>{entry.details}</p>
                    <p className={`text-xs mt-0.5 ${th.txm}`}>{entry.userName}</p>
                  </div>
                );
              })}
              {activityVisible < auditEntries.length && (
                <button onClick={() => setActivityVisible(v => v + ACTIVITY_PAGE_SIZE)}
                  className={`w-full py-3 text-sm font-bold ${th.acc} hover:opacity-70 border-t ${th.bdr}`}>
                  {t.loadMore} ({auditEntries.length - activityVisible})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL: Add Bank Account                        */}
      {/* ═══════════════════════════════════════════════ */}
      {showAddBank && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in" onClick={() => { setShowAddBank(false); setBankForm({ bankName: "", accountNumber: "", accountHolder: "" }); setBankQuery(""); setShowBankDropdown(false); }}>
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <div className={`relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] border overflow-hidden ${th.card} ${th.bdr} animate-slide-up`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${th.bdr}`}>
              <h3 className={`font-extrabold text-base tracking-tight ${th.tx}`}>{t.addBankAccount}</h3>
              <button onClick={() => { setShowAddBank(false); setBankForm({ bankName: "", accountNumber: "", accountHolder: "" }); setBankQuery(""); setShowBankDropdown(false); }}
                aria-label="Close" className={`p-1.5 rounded-lg ${th.elev} ${th.txm}`}><X size={14} strokeWidth={2.5} /></button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-3">
              {/* Searchable bank dropdown */}
              <div>
                <p className={`text-xs font-semibold mb-1.5 ${th.txm}`}>{t.bankName}</p>
                <div className="relative" ref={bankDropdownRef}>
                  <div className="relative">
                    <Search size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${th.txf}`} />
                    <input
                      value={bankForm.bankName || bankQuery}
                      onChange={e => { setBankQuery(e.target.value); setBankForm(f => ({ ...f, bankName: "" })); setShowBankDropdown(true); setBankFormErrors(p => ({ ...p, bankName: false })); }}
                      onFocus={() => setShowBankDropdown(true)}
                      placeholder={t.searchBank as string}
                      className={`w-full pl-9 pr-9 py-3 text-sm rounded-2xl border ${th.inp} ${bankFormErrors.bankName ? "!border-red-400" : ""}`}
                    />
                    {bankForm.bankName && (
                      <button onClick={() => { setBankForm(f => ({ ...f, bankName: "" })); setBankQuery(""); }}
                        aria-label="Clear" className={`absolute right-3 top-1/2 -translate-y-1/2 ${th.txf}`}><X size={14} /></button>
                    )}
                  </div>
                  {showBankDropdown && !bankForm.bankName && (
                    <div className={`absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border shadow-lg ${th.card} ${th.bdr}`}>
                      {filteredBanks.length === 0 ? (
                        <p className={`px-4 py-3 text-sm ${th.txm}`}>{t.noResults}</p>
                      ) : filteredBanks.map(bank => (
                        <button key={bank} onClick={() => { setBankForm(f => ({ ...f, bankName: bank })); setBankQuery(""); setShowBankDropdown(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:opacity-70 ${th.tx} border-b last:border-0 ${th.bdrSoft}`}>
                          {bank}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {bankFormErrors.bankName && <p className="text-red-400 text-xs mt-1 font-medium">{t.required}</p>}
              </div>
              <div>
                <p className={`text-xs font-semibold mb-1.5 ${th.txm}`}>{t.accountNumber}</p>
                <input value={bankForm.accountNumber}
                  onChange={e => { setBankForm(f => ({ ...f, accountNumber: e.target.value })); setBankFormErrors(p => ({ ...p, accountNumber: false })); }}
                  placeholder="1234567890" inputMode="numeric"
                  className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp} ${bankFormErrors.accountNumber ? "!border-red-400" : ""}`} />
                {bankFormErrors.accountNumber && <p className="text-red-400 text-xs mt-1 font-medium">{t.required}</p>}
              </div>
              <div>
                <p className={`text-xs font-semibold mb-1.5 ${th.txm}`}>{t.accountHolder}</p>
                <input value={bankForm.accountHolder}
                  onChange={e => { setBankForm(f => ({ ...f, accountHolder: e.target.value })); setBankFormErrors(p => ({ ...p, accountHolder: false })); }}
                  placeholder={t.accountHolder as string}
                  className={`w-full px-4 py-3 text-sm rounded-2xl border ${th.inp} ${bankFormErrors.accountHolder ? "!border-red-400" : ""}`} />
                {bankFormErrors.accountHolder && <p className="text-red-400 text-xs mt-1 font-medium">{t.required}</p>}
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => { setShowAddBank(false); setBankForm({ bankName: "", accountNumber: "", accountHolder: "" }); setBankQuery(""); setShowBankDropdown(false); }}
                  className={`flex-1 py-3 rounded-2xl text-sm font-bold border ${th.bdr} ${th.txm}`}>{t.cancel}</button>
                <button onClick={handleAddBank}
                  disabled={!bankForm.bankName || !bankForm.accountNumber.trim() || !bankForm.accountHolder.trim()}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] disabled:opacity-40">{t.save}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL: Register Staff                          */}
      {/* ═══════════════════════════════════════════════ */}
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRegister(false)} />
          <div className={`relative w-full max-w-md rounded-t-3xl sm:rounded-3xl border p-5 max-h-[85vh] overflow-y-auto ${th.card} ${th.bdr}`}>
            <div className="flex items-center justify-between mb-4">
              <p className={`text-sm font-extrabold ${th.tx}`}>{t.registerStaff}</p>
              <button onClick={() => setShowRegister(false)} aria-label="Close" className={`p-1.5 rounded-xl ${th.txm}`}><X size={18} /></button>
            </div>

            <div className="flex flex-col gap-2.5">
              <div>
                <input value={regForm.name} onChange={e => { setRegForm(f => ({ ...f, name: e.target.value })); setRegFormErrors(p => ({ ...p, name: false })); }}
                  className={`${inp} ${regFormErrors.name ? "!border-red-400" : ""}`} placeholder={t.fullName as string} />
                {regFormErrors.name && <p className="text-red-400 text-xs mt-1 font-medium">{t.required}</p>}
              </div>
              <input value={regForm.nik} onChange={e => setRegForm(f => ({ ...f, nik: e.target.value }))}
                className={inp} placeholder={t.nik as string} inputMode="numeric" />
              <div>
                <input value={regForm.email} onChange={e => { setRegForm(f => ({ ...f, email: e.target.value })); setRegFormErrors(p => ({ ...p, email: false, invalidEmail: false })); }}
                  className={`${inp} ${regFormErrors.email || regFormErrors.invalidEmail ? "!border-red-400" : ""}`} placeholder={t.email as string} type="email" />
                {regFormErrors.email && <p className="text-red-400 text-xs mt-1 font-medium">{t.required}</p>}
                {regFormErrors.invalidEmail && <p className="text-red-400 text-xs mt-1 font-medium">{t.invalidEmail}</p>}
              </div>
              <input value={regForm.phone} onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))}
                className={inp} placeholder={t.msisdn as string} type="tel" inputMode="tel" />
              <input value={regForm.dateOfBirth} onChange={e => setRegForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                className={inp} type="date" />

              {/* Role selector */}
              <div>
                <p className={`text-xs font-semibold mb-1.5 ${th.txm}`}>{t.selectRole}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["cashier", "staff"] as Role[]).map(r => (
                    <button key={r} onClick={() => setRegForm(f => ({ ...f, role: r }))}
                      className={`py-3 rounded-2xl text-sm font-bold ${
                        regForm.role === r
                          ? "text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF]"
                          : `border ${th.bdr} ${th.txm}`
                      }`}>{(t.roles as Record<string, string>)[r]}</button>
                  ))}
                </div>
              </div>

              {/* Default password hint */}
              <div className={`rounded-xl p-3 ${th.dark ? "bg-[#E89B48]/10" : "bg-amber-50"}`}>
                <p className={`text-xs font-semibold ${th.dark ? "text-[#E89B48]" : "text-amber-700"}`}>
                  {t.defaultPassword}: <span className="font-mono">{DEFAULT_PASSWORD}</span>
                </p>
              </div>

              <button onClick={handleRegister}
                disabled={!regForm.name.trim() || !regForm.email.trim()}
                className={`w-full py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#60A5FA] to-[#1E40AF] mt-1 ${
                  !regForm.name.trim() || !regForm.email.trim() ? "opacity-40" : ""
                }`}>{t.registerStaff}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
