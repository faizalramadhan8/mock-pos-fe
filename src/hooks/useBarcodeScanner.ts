import { useEffect, useRef, useCallback } from "react";

interface BarcodeScannerOptions {
  onScan: (code: string) => void;
  minLength?: number;
  maxDelay?: number;
}

export function useBarcodeScanner({
  onScan,
  minLength = 3,
  maxDelay = 50,
}: BarcodeScannerOptions) {
  const bufferRef = useRef("");
  const lastKeyTime = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip when user is typing in a form field — only listen for hardware barcode scanner
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      bufferRef.current = "";
      return;
    }

    const now = Date.now();

    if (e.key === "Enter") {
      const code = bufferRef.current.trim();
      if (code.length >= minLength) {
        e.preventDefault();
        onScan(code);
      }
      bufferRef.current = "";
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (e.key.length !== 1) return;

    if (now - lastKeyTime.current > maxDelay && bufferRef.current.length > 0) {
      bufferRef.current = "";
    }

    bufferRef.current += e.key;
    lastKeyTime.current = now;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      bufferRef.current = "";
    }, 200);
  }, [onScan, minLength, maxDelay]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);
}
