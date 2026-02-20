import { useEffect } from "react";
import { X } from "lucide-react";
import { useThemeClasses } from "@/hooks/useThemeClasses";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const th = useThemeClasses();

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className={`relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] max-h-[88vh] flex flex-col overflow-hidden border ${th.card} ${th.bdr} animate-slide-up`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${th.bdr}`}>
          <h3 className={`font-extrabold text-base tracking-tight ${th.tx}`}>{title}</h3>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${th.elev} ${th.txm} hover:opacity-70`}>
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1 scrollbar-hide">{children}</div>
      </div>
    </div>
  );
}
