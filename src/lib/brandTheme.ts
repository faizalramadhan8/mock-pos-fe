// Warna merek POS — dipilih Bu Santi di Pengaturan.
//
// Paletnya didefinisikan di index.css sebagai penimpa variabel CSS pada
// `:root[data-brand="…"]`. Modul ini cuma memasang atributnya; semua
// pekerjaan warna dilakukan CSS.
//
// Yang ikut berubah hanya warna IDENTITAS (cherry-*, ink-*, shade-*).
// Merah sinyal (stok habis, galat isian, aksi merusak) dan biru zona
// keranjang sengaja tidak ikut — warnanya membawa arti, bukan hiasan.

export const PALET = [
  { v: "", label: "Merah Muda", contoh: "#E11D48" },
  { v: "biru", label: "Biru", contoh: "#2563EB" },
  { v: "hijau", label: "Hijau", contoh: "#16A34A" },
  { v: "ungu", label: "Ungu", contoh: "#9333EA" },
  { v: "jingga", label: "Jingga", contoh: "#EA580C" },
] as const;

const KUNCI = "bakeshop-brand";
const SAH = new Set(PALET.map((p) => p.v));

/**
 * Pasang paletnya. Nilai asing dibuang ke bawaan — `data-brand` berisi nama
 * yang tidak dikenal membuat semua variabel jatuh ke nilai @theme, yang
 * kebetulan benar, tapi menyembunyikan salah ketiknya.
 */
export function pasangBrand(nama: string | null | undefined) {
  const v = (nama || "").trim();
  const dipakai = SAH.has(v as never) ? v : "";
  const root = document.documentElement;
  if (dipakai) root.setAttribute("data-brand", dipakai);
  else root.removeAttribute("data-brand");

  // Diingat supaya pemuatan berikutnya memasangnya SEBELUM pengaturan
  // selesai diambil dari server. Tanpa ini kasir melihat kedipan merah muda
  // tiap kali membuka aplikasi.
  try {
    if (dipakai) localStorage.setItem(KUNCI, dipakai);
    else localStorage.removeItem(KUNCI);
  } catch {
    /* localStorage ditolak — warnanya tetap benar begitu pengaturan tiba */
  }
}

/** Pasang dari ingatan. Dipanggil sekali sebelum React menggambar. */
export function pasangBrandDariIngatan() {
  try {
    pasangBrand(localStorage.getItem(KUNCI));
  } catch {
    /* abaikan */
  }
}
