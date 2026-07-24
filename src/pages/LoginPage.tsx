import { useEffect, useRef, useState } from "react";
import { useAuthStore, useThemeStore, useLangStore, hydrateStores } from "@/stores";
import { authApi, setToken } from "@/api";
import { BakeryLogo } from "@/components/icons";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { Sun, Moon, UserPlus, ArrowLeft } from "lucide-react";

// Role-based redirect setelah login (Bu Santi 21 Jul 2026).
// Unified auth: 1 login page untuk semua role, redirect based on role.
function redirectByRole(role: string) {
  if (role === "user") {
    window.location.href = "/shop/";
    return true;
  }
  if (role === "ecom_admin" || role === "ecom_superadmin") {
    window.location.href = "/shop/admin";
    return true;
  }
  // superadmin, admin, staff, cashier → tetap di POS (default flow)
  return false;
}

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

  // Register mode (Bu Santi 21 Jul 2026) — customer daftar akun untuk belanja.
  const [mode, setMode] = useState<"login" | "register">("login");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

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
            const role = useAuthStore.getState().user?.role || "";
            if (redirectByRole(role)) return; // hard redirect ke /shop atau /shop/admin
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
      else {
        // Role-based redirect (Bu Santi 21 Jul 2026). Customer role='user'
        // → storefront. Ecom admin → panel. POS staff → hydrate + normal.
        const role = useAuthStore.getState().user?.role || "";
        if (redirectByRole(role)) return;
        await hydrateStores();
      }
    } catch {
      setErr(t.invalidCred as string);
    } finally {
      setLoading(false);
    }
  };

  // Register customer — force role='user' di BE. Auto-login + redirect /shop.
  const handleRegister = async () => {
    setErr("");
    // Client-side validation.
    if (regName.trim().length < 3) { setErr("Nama minimal 3 karakter"); return; }
    if (!/^\S+@\S+\.\S+$/.test(regEmail)) { setErr("Email tidak valid"); return; }
    if (regPhone.trim().length < 8) { setErr("Nomor HP minimal 8 digit"); return; }
    if (regPassword.length < 6) { setErr("Password minimal 6 karakter"); return; }
    if (regPassword !== regConfirm) { setErr("Konfirmasi password tidak cocok"); return; }

    setLoading(true);
    try {
      const res = await authApi.registerCustomer({
        fullname: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: regPhone.trim(),
        password: regPassword,
      });
      const data = res.body as any;
      if (!data?.access_token) throw new Error("Registrasi gagal");
      setToken(data.access_token);
      // Auto-redirect customer ke storefront setelah register.
      window.location.href = "/shop/";
    } catch (e: any) {
      setErr(e?.message || "Registrasi gagal, coba lagi");
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
          ) : mode === "login" ? (
            <>
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
              <div className={`text-center text-xs mt-2 ${th.txm}`}>
                Belum punya akun?{" "}
                <button onClick={() => { setMode("register"); setErr(""); }}
                  className={`font-bold ${th.acc} inline-flex items-center gap-1 hover:underline`}>
                  <UserPlus size={12} />
                  Daftar sekarang
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => { setMode("login"); setErr(""); }}
                  aria-label="Kembali ke login"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${th.txm} hover:opacity-70`}>
                  <ArrowLeft size={16} />
                </button>
                <p className={`text-sm font-bold ${th.tx}`}>Daftar Akun Baru</p>
              </div>
              <p className={`text-xs mb-3 ${th.txm}`}>
                Buat akun untuk belanja online. Setelah daftar akan otomatis masuk ke toko online.
              </p>
              <div className="flex flex-col gap-2.5 mb-4"
                onKeyDown={e => { if (e.key === "Enter") handleRegister(); }}>
                <input value={regName} onChange={e => setRegName(e.target.value)}
                  placeholder="Nama Lengkap"
                  className={`w-full px-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#E11D48]/20 ${th.inp}`} />
                <input value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  type="email" placeholder="Email"
                  className={`w-full px-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#E11D48]/20 ${th.inp}`} />
                <input value={regPhone} onChange={e => setRegPhone(e.target.value)}
                  type="tel" placeholder="No. HP (08…)"
                  className={`w-full px-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#E11D48]/20 ${th.inp}`} />
                <input value={regPassword} onChange={e => setRegPassword(e.target.value)}
                  type="password" placeholder="Password (min. 6 karakter)"
                  className={`w-full px-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#E11D48]/20 ${th.inp}`} />
                <input value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
                  type="password" placeholder="Ulangi password"
                  className={`w-full px-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#E11D48]/20 ${th.inp}`} />
                <button onClick={handleRegister} disabled={loading}
                  className="w-full py-3.5 rounded-2xl font-bold text-white text-sm bg-gradient-to-r from-[#FB7185] to-[#E11D48] disabled:opacity-60">
                  {loading ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Daftar & Belanja"}
                </button>
              </div>
              <div className={`text-center text-xs mt-2 ${th.txm}`}>
                Sudah punya akun?{" "}
                <button onClick={() => { setMode("login"); setErr(""); }}
                  className={`font-bold ${th.acc} hover:underline`}>
                  Masuk
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
