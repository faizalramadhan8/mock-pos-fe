import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useThemeClasses } from "@/hooks/useThemeClasses";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Module-level stack: tracks open modals in mount order. Escape key hanya
// menutup modal paling atas (top of stack), bukan semua sekaligus. Penting
// untuk nested modal (mis. Katalog Harga Khusus → klik produk → tier editor
// → klik Tambah Tier → form modal). Tanpa stack, Escape tutup dua-duanya.
type StackEntry = { close: () => void };
const modalStack: StackEntry[] = [];

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Lebar modal di breakpoint sm+. Default "md" untuk backwards-compat. */
  size?: "md" | "lg" | "xl";
}

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "sm:max-w-md",   // 448px — modal compact (form input, confirm)
  lg: "sm:max-w-2xl",  // 672px — detail dengan banyak konten (produk, pemasok)
  xl: "sm:max-w-4xl",  // 896px — modal ekspansif (laporan, multi-kolom)
};

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  const th = useThemeClasses();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Keep a stable ref of onClose so the effect doesn't re-run on every render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus trap + keyboard handling
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element in modal
    requestAnimationFrame(() => {
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable?.length) focusable[0].focus();
    });

    // Register in modal stack — paling akhir mount = paling atas.
    const entry: StackEntry = { close: () => onCloseRef.current() };
    modalStack.push(entry);

    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Hanya modal paling atas yang respond ke Escape; nested modal di
        // bawahnya tetap open. Tab trap tetap berlaku per-modal.
        if (modalStack[modalStack.length - 1] === entry) {
          onCloseRef.current();
        }
        return;
      }
      if (e.key === "Tab") {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", handle);
    return () => {
      window.removeEventListener("keydown", handle);
      const idx = modalStack.indexOf(entry);
      if (idx >= 0) modalStack.splice(idx, 1);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-hidden="true" />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-title"
        className={`relative w-full ${SIZE_CLASS[size]} rounded-t-[28px] sm:rounded-[28px] max-h-[88vh] flex flex-col overflow-hidden border ${th.card} ${th.bdr} animate-slide-up`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${th.bdr}`}>
          <h3 id="modal-title" className={`font-extrabold text-base tracking-tight ${th.tx}`}>{title}</h3>
          <button onClick={onClose} aria-label="Close" className={`p-1.5 rounded-lg ${th.elev} ${th.txm} hover:opacity-70`}>
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1 scrollbar-hide">{children}</div>
      </div>
    </div>
  );
}
