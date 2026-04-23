import { useEffect, useRef, useState } from "react";
import { useAuthStore, useThemeStore, useLangStore, hydrateStores } from "@/stores";
import { authApi } from "@/api";
import { BakeryLogo } from "@/components/icons";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { Sun, Moon } from "lucide-react";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export function LoginPage() {
  const th = useThemeClasses();
  const { t, lang, setLang } = useLangStore();
  const toggle = useThemeStore(s => s.toggle);
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const pollRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  useEffect(() => clearTimers, []);

  const startPolling = (emailToCheck: string, pwToRetry: string) => {
    setPending(true);
    setErr("");
    pollRef.current = window.setInterval(async () => {
      try {
        const r = await authApi.deviceStatus(emailToCheck);
        const status = r.body?.status;
        if (status === "approved") {
          clearTimers();
          const result = await login(emailToCheck, pwToRetry);
          setPending(false);
          if (result === true) {
            await hydrateStores();
          } else {
            setErr("Gagal login ulang setelah approval. Coba lagi.");
          }
        } else if (status === "rejected") {
          clearTimers();
          setPending(false);
          setErr("Device ditolak oleh owner.");
        }
      } catch { /* keep polling */ }
    }, POLL_INTERVAL_MS);

    timeoutRef.current = window.setTimeout(() => {
      clearTimers();
      setPending(false);
      setErr("Timeout menunggu approval. Coba login lagi atau minta owner cek WhatsApp.");
    }, POLL_TIMEOUT_MS);
  };

  const handleLogin = async () => {
    setLoading(true);
    setErr("");
    try {
      const result = await login(email, password);
      if (result === "inactive") setErr(t.accountInactive as string);
      else if (result === "pending") startPolling(email, password);
      else if (result === "rejected") setErr("Device ini ditolak. Hubungi owner.");
      else if (!result) setErr(t.invalidCred as string);
      else await hydrateStores();
    } catch {
      setErr(t.invalidCred as string);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPending = () => {
    clearTimers();
    setPending(false);
    setErr("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !pending) handleLogin();
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-5 ${th.dark ? "bg-gradient-to-br from-[#2B1318] to-[#140B0F]" : "bg-gradient-to-br from-[#F0F9FF] via-[#FBE8EE] to-[#FFD1DB]/20"}`}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center gap-2 mb-8">
          <button onClick={toggle} className={`p-2.5 rounded-xl border ${th.card} ${th.bdr} ${th.txm}`}>
            {th.dark ? <Sun size={14} className="text-[#E11D48]" /> : <Moon size={14} />}
          </button>
          <button onClick={() => setLang(lang === "en" ? "id" : "en")}
            className={`px-3 py-2 rounded-xl border text-xs font-bold ${th.card} ${th.bdr} ${th.tx}`}>
            {lang === "en" ? "🇮🇩 ID" : "🇬🇧 EN"}
          </button>
        </div>

        <div className="flex flex-col items-center mb-8">
          <BakeryLogo size={96} />
          <h1 className={`text-[28px] font-black tracking-tighter mt-4 ${th.tx}`}>{t.appName}</h1>
          <p className={`text-sm mt-1 ${th.txm}`}>Baking Ingredients Depot</p>
        </div>

        <div className={`rounded-3xl border p-6 ${th.card} ${th.bdr} ${th.dark ? "" : "shadow-xl shadow-[#9F1239]/[0.04]"}`}>
          {err && <p className="text-xs text-[#BE123C] mb-3 flex items-center gap-1.5">⚠ {err}</p>}
          {pending ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <span className="inline-block w-10 h-10 border-4 border-[#E11D48] border-t-transparent rounded-full animate-spin" />
              <p className={`text-sm font-bold ${th.tx}`}>Menunggu persetujuan owner</p>
              <p className={`text-xs text-center ${th.txm}`}>
                Device ini belum terdaftar. Owner akan menerima pesan WhatsApp untuk meng-approve. Mohon tunggu...
              </p>
              <button onClick={handleCancelPending} className={`text-xs underline ${th.txm}`}>
                Batal
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 mb-4" onKeyDown={handleKeyDown}>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email as string}
                className={`w-full px-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#E11D48]/20 ${th.inp}`} />
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder={t.password as string}
                className={`w-full px-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#E11D48]/20 ${th.inp}`} />
              <button onClick={handleLogin} disabled={loading}
                className="w-full py-3.5 rounded-2xl font-bold text-white text-sm bg-gradient-to-r from-[#FB7185] to-[#E11D48] disabled:opacity-60">
                {loading ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t.signIn}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
