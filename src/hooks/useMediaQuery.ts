import { useCallback, useSyncExternalStore } from "react";

/**
 * useMediaQuery — true selama media query cocok, ikut berubah saat window
 * di-resize. Dipakai POSPage untuk memutuskan keranjang dibagi berapa kolom:
 * di layar lebar panel keranjang sangat lapang (mode pencarian cepat bikin
 * panelnya flex-1), jadi satu baris per barang membuang ruang horizontal
 * dan memaksa scroll padahal layarnya masih kosong.
 *
 * Pakai useSyncExternalStore — cara baku React untuk berlangganan sumber di
 * luar React. Tidak ada setState di dalam effect, jadi tidak ada render
 * beruntun, dan nilai awalnya tidak pernah meleset dari keadaan sebenarnya.
 * SSR/jsdom aman: tanpa matchMedia hasilnya false.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // Snapshot server selalu false — layar lebar cuma relevan di browser.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
