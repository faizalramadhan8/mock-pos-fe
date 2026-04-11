import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useThemeClasses } from "@/hooks/useThemeClasses";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
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

    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCloseRef.current(); return; }
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
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-hidden="true" />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-title"
        className={`relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] max-h-[88vh] flex flex-col overflow-hidden border ${th.card} ${th.bdr} animate-slide-up`} onClick={e => e.stopPropagation()}>
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
