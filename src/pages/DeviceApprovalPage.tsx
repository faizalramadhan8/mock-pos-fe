import { useEffect, useState } from "react";
import { BakeryLogo } from "@/components/icons";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { authApi } from "@/api";
import { Check, X, AlertTriangle } from "lucide-react";

type Kind = "approve" | "reject";
type State =
  | { status: "loading" }
  | { status: "success"; userName: string; kind: Kind }
  | { status: "error"; message: string };

interface Props {
  kind: Kind;
}

export function DeviceApprovalPage({ kind }: Props) {
  const th = useThemeClasses();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("t")?.trim();
    if (!token) {
      setState({ status: "error", message: "Token pada URL kosong. Buka ulang link dari WhatsApp." });
      return;
    }
    const call = kind === "approve" ? authApi.deviceApprove : authApi.deviceReject;
    call(token)
      .then(res => {
        const name = res.body?.user_name || "Kasir";
        setState({ status: "success", userName: name, kind });
      })
      .catch((e: Error) => {
        setState({ status: "error", message: e.message || "Gagal memproses link." });
      });
  }, [kind]);

  const now = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date());

  let accent = "#1E40AF";
  let barGradient = "from-[#1E40AF] to-[#60A5FA]";
  let title = "Memproses...";
  let description: React.ReactNode = "Mohon tunggu sebentar.";
  let icon = <div className="w-8 h-8 border-[3px] border-current border-t-transparent rounded-full animate-spin" />;
  let liveRegion: "status" | "alert" = "status";

  if (state.status === "success") {
    if (state.kind === "approve") {
      accent = "#10B981";
      barGradient = "from-[#10B981] to-[#34D399]";
      title = "Device disetujui";
      description = <>Login untuk <b>{state.userName}</b> berhasil di-approve. Kasir sudah bisa melanjutkan login di device tersebut.</>;
      icon = <Check size={34} strokeWidth={2.5} aria-label="Disetujui" />;
    } else {
      accent = "#EF4444";
      barGradient = "from-[#EF4444] to-[#F87171]";
      title = "Device ditolak";
      description = <>Login untuk <b>{state.userName}</b> sudah ditolak. Device ini tidak akan bisa login lagi sampai di-reset.</>;
      icon = <X size={34} strokeWidth={2.5} aria-label="Ditolak" />;
    }
  } else if (state.status === "error") {
    accent = "#EF4444";
    barGradient = "from-[#EF4444] to-[#F87171]";
    title = "Gagal memproses";
    description = state.message;
    icon = <AlertTriangle size={32} strokeWidth={2.5} aria-label="Peringatan" />;
    liveRegion = "alert";
  }

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center px-5 py-6 ${
        th.dark
          ? "bg-gradient-to-br from-[#0F172A] to-[#020617]"
          : "bg-gradient-to-br from-[#F0F9FF] via-[#F1F5F9] to-[#DBEAFE]/20"
      }`}
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className={`flex items-center gap-2.5 mb-5 text-xs font-semibold ${th.txm}`}>
        <BakeryLogo size={28} />
        <span>Toko Bahan Kue Santi</span>
      </div>

      <main
        role={liveRegion}
        aria-live="polite"
        className={`w-full max-w-sm rounded-3xl overflow-hidden ${th.card} border ${th.bdr} ${
          th.dark ? "" : "shadow-xl shadow-[#1E3A8A]/[0.08]"
        } animate-page-enter`}
      >
        <div className={`h-1 bg-gradient-to-r ${barGradient}`} aria-hidden="true" />
        <div className="px-6 pt-8 pb-6 text-center">
          <div
            className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-4"
            style={{ background: `${accent}22`, color: accent }}
            aria-hidden="true"
          >
            {icon}
          </div>
          <h1 className={`text-[22px] font-bold tracking-tight mb-2 ${th.tx}`}>{title}</h1>
          <p className={`text-[15px] leading-relaxed ${th.txm}`}>{description}</p>

          {state.status !== "loading" && (
            <>
              <div
                className={`mt-5 pt-4 border-t flex justify-between text-[11px] ${th.txf}`}
                style={{ borderColor: th.dark ? "#334155" : "#E2E8F0" }}
              >
                <span>Security</span>
                <time>{now}</time>
              </div>
              <p className={`mt-4 text-[11px] ${th.txf}`}>Halaman ini aman ditutup.</p>
              <button
                type="button"
                onClick={() => window.close()}
                className={`mt-4 min-h-[40px] px-6 rounded-full text-xs font-semibold transition-colors ${
                  th.dark ? "bg-[#F1F5F9] text-[#1E293B]" : "bg-[#1E293B] text-white"
                }`}
              >
                Tutup
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
