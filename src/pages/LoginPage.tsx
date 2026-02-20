import { useState } from "react";
import { useAuthStore, useThemeStore, useLangStore } from "@/stores";
import { BakeryLogo } from "@/components/icons";
import { MOCK_USERS } from "@/constants";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { Sun, Moon } from "lucide-react";

export function LoginPage() {
  const th = useThemeClasses();
  const { t, lang, setLang } = useLangStore();
  const toggle = useThemeStore(s => s.toggle);
  const { login, loginDirect } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const handleLogin = () => {
    if (!login(email, password)) setErr(t.invalidCred as string);
    else setErr("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-5 ${th.dark ? "bg-gradient-to-br from-[#1E1610] to-[#12100E]" : "bg-gradient-to-br from-[#FFF8F0] via-[#F8F3ED] to-[#FFE0EB]/20"}`}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center gap-2 mb-8">
          <button onClick={toggle} className={`p-2.5 rounded-xl border ${th.card} ${th.bdr} ${th.txm}`}>
            {th.dark ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} />}
          </button>
          <button onClick={() => setLang(lang === "en" ? "id" : "en")}
            className={`px-3 py-2 rounded-xl border text-xs font-bold ${th.card} ${th.bdr} ${th.tx}`}>
            {lang === "en" ? "🇮🇩 ID" : "🇬🇧 EN"}
          </button>
        </div>

        <div className="flex flex-col items-center mb-8">
          <BakeryLogo size={56} />
          <h1 className={`text-[28px] font-black tracking-tighter mt-4 ${th.tx}`}>{t.appName}</h1>
          <p className={`text-sm mt-1 ${th.txm}`}>Baking Ingredients POS</p>
        </div>

        <div className={`rounded-3xl border p-6 ${th.card} ${th.bdr} ${th.dark ? "" : "shadow-xl shadow-[#8B5E3C]/[0.04]"}`}>
          {err && <p className="text-xs text-red-400 mb-3 flex items-center gap-1.5">⚠ {err}</p>}
          <div className="flex flex-col gap-2.5 mb-4" onKeyDown={handleKeyDown}>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email as string}
              className={`w-full px-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#A0673C]/20 ${th.inp}`} />
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder={t.password as string}
              className={`w-full px-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#A0673C]/20 ${th.inp}`} />
            <button onClick={handleLogin}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-sm bg-gradient-to-r from-[#E8B088] to-[#A0673C]">
              {t.signIn}
            </button>
          </div>

          <div className={`pt-4 border-t ${th.bdr}`}>
            <p className={`text-[10px] text-center mb-3 uppercase tracking-widest font-medium ${th.txf}`}>{t.quickAccess}</p>
            <div className="grid grid-cols-2 gap-2">
              {MOCK_USERS.filter(u => u.role !== "superadmin" && u.role !== "user").map(u => (
                <button key={u.id} onClick={() => loginDirect(u)}
                  className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all active:scale-[0.97] ${th.card2} ${th.bdr} hover:border-[#A0673C]/40`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-extrabold ${th.accBg} ${th.acc}`}>{u.initials}</div>
                  <div>
                    <p className={`text-xs font-bold ${th.tx}`}>{u.name}</p>
                    <p className={`text-[10px] ${th.txm}`}>{(t.roles as Record<string, string>)[u.role]}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
