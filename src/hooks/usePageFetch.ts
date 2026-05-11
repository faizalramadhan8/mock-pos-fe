import { useEffect, useRef } from "react";

// TTL global per-key. Cegah multi-fetch berurutan (rapid tab switch / mount).
// Default 10 detik — cukup untuk POS volume owner (1-2 kasir).
const lastFetchAt = new Map<string, number>();
const DEFAULT_TTL_MS = 10_000;

interface FetchSpec {
  /** Key unik per store (e.g. "products", "orders"). Jangan duplikat antar page. */
  key: string;
  /** Function yang panggil store fetch (e.g. () => useProductStore.getState().fetchProducts()). */
  fetch: () => Promise<unknown>;
}

interface Options {
  /** TTL dalam ms. Skip fetch kalau jarak ke last fetch < TTL. Default 10s. */
  ttlMs?: number;
  /** Refetch saat tab kembali visible (kasir balik dari WA/aplikasi lain). Default true. */
  refetchOnFocus?: boolean;
}

// Run sebuah fetch dengan TTL guard. Return Promise yang resolve void (silent —
// caller tidak perlu await). Error dilog ke console, tidak throw — fetch
// gagal cuma berarti data tetap stale, tidak break UI.
async function runWithTTL(spec: FetchSpec, ttlMs: number, force = false): Promise<void> {
  const now = Date.now();
  const last = lastFetchAt.get(spec.key) || 0;
  if (!force && now - last < ttlMs) return;
  lastFetchAt.set(spec.key, now);
  try {
    await spec.fetch();
  } catch (err) {
    console.warn(`[usePageFetch] ${spec.key} failed`, err);
  }
}

/**
 * Hook untuk auto-refresh data setiap kali user buka page atau kembali ke tab.
 *
 * Pattern: Approach A + B + TTL polling.
 * - A. On-mount: fetch semua spec saat page mount (with TTL guard).
 * - B. On-focus: refetch saat document.visibilityState flip ke "visible".
 * - TTL: skip fetch kalau <ttlMs dari fetch terakhir untuk key yg sama.
 *
 * @example
 * usePageFetch([
 *   { key: "products", fetch: () => useProductStore.getState().fetchProducts() },
 *   { key: "orders",   fetch: () => useOrderStore.getState().fetchOrders() },
 * ]);
 */
export function usePageFetch(specs: FetchSpec[], opts: Options = {}) {
  const { ttlMs = DEFAULT_TTL_MS, refetchOnFocus = true } = opts;
  // Stable ref: spec list bisa di-recreate per-render, tapi key+fetch tetap.
  // Ambil yang terkini setiap callback fire.
  const specsRef = useRef(specs);
  specsRef.current = specs;

  useEffect(() => {
    // On mount: fetch semua (silent, parallel, fire-and-forget).
    for (const s of specsRef.current) {
      void runWithTTL(s, ttlMs);
    }

    if (!refetchOnFocus) return;

    // On focus: window visible lagi → refetch (TTL tetap berlaku, jadi
    // rapid tab switch tidak spam network).
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      for (const s of specsRef.current) {
        void runWithTTL(s, ttlMs);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [ttlMs, refetchOnFocus]);
}

/** Force-refresh helper: ignore TTL, dipakai setelah user-triggered mutation. */
export async function refreshNow(...specs: FetchSpec[]) {
  await Promise.allSettled(specs.map(s => runWithTTL(s, 0, true)));
}
