// dueRange — rentang tanggal untuk filter JATUH TEMPO faktur.
//
// Kenapa terpisah dari `getDateRange` (utils/dateRange.ts):
//
// `getDateRange` dipakai untuk data HISTORIS (penjualan, pergerakan stok) —
// di sana "Bulan Ini" berarti "tanggal 1 sampai hari ini", karena tidak ada
// penjualan di masa depan. Itu benar untuk konteksnya.
//
// Tapi faktur jatuh tempo itu FORWARD-LOOKING. Bu Santi 17 Sep 2026:
// "Saya masih kesulitan untuk melihat faktur jatuh tempo bulan ini."
// Penyebabnya persis ini — "Bulan Ini" berhenti di hari ini, jadi faktur
// yang jatuh tempo tanggal 30 tidak muncul kalau hari ini tanggal 9.
// Yang tampil cuma yang SUDAH telat, padahal yang belum jatuh tempo itu
// justru yang dia perlu untuk siapkan uang.
//
// Makanya rentang di sini sengaja dibuat berorientasi ke depan.

export type DueRange =
  | "overdue"    // sudah lewat tempo (belum lunas)
  | "next7"      // jatuh tempo dalam 7 hari ke depan
  | "thisMonth"  // tanggal 1 s/d AKHIR bulan ini (bukan s/d hari ini)
  | "nextMonth"  // bulan depan penuh
  | "all"
  | "custom";

export interface DueRangeResult {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  /** Kalau true, caller harus paksa status=unpaid — "Lewat Tempo" tidak
   *  masuk akal untuk faktur yang sudah lunas. */
  forceUnpaid?: boolean;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function getDueRange(
  range: DueRange,
  custom?: { from: string; to: string },
): DueRangeResult | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (range) {
    case "all":
      return {};

    case "overdue": {
      // Semua yang jatuh temponya sebelum hari ini. Tanpa batas bawah —
      // tunggakan lama tetap harus kelihatan.
      const yesterday = new Date(y, m, now.getDate() - 1);
      return { to: ymd(yesterday), forceUnpaid: true };
    }

    case "next7": {
      // Hari ini s/d 7 hari ke depan — termasuk yang jatuh tempo hari ini.
      const in7 = new Date(y, m, now.getDate() + 7);
      return { from: ymd(now), to: ymd(in7), forceUnpaid: true };
    }

    case "thisMonth": {
      // Tanggal 1 s/d akhir bulan. Hari ke-0 bulan berikutnya = hari
      // terakhir bulan ini, sekaligus menangani tahun kabisat.
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      return { from: ymd(first), to: ymd(last) };
    }

    case "nextMonth": {
      const first = new Date(y, m + 1, 1);
      const last = new Date(y, m + 2, 0);
      return { from: ymd(first), to: ymd(last) };
    }

    case "custom": {
      if (!custom?.from || !custom?.to) return null;
      if (new Date(custom.from) > new Date(custom.to)) return null;
      return { from: custom.from, to: custom.to };
    }
  }
}

export const DUE_RANGE_LABELS: Record<DueRange, string> = {
  overdue: "Lewat Tempo",
  next7: "7 Hari ke Depan",
  thisMonth: "Bulan Ini",
  nextMonth: "Bulan Depan",
  all: "Semua",
  custom: "Pilih Tanggal",
};
