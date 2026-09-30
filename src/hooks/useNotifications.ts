import { useMemo } from "react";
import { useProductStore, useBatchStore, useCashSessionStore, useLangStore, usePurchaseInvoiceStore } from "@/stores";
import { formatCurrency as fmtRp } from "@/utils";
import type { AppNotification } from "@/types";

export function useNotifications(): AppNotification[] {
  const products = useProductStore(s => s.products);
  const batches = useBatchStore(s => s.batches);
  // Sengaja pakai dueSoonInvoices, bukan `invoices` — yang itu mengikuti
  // filter tab Faktur, jadi isinya berubah tergantung filter yang dipilih.
  const invoices = usePurchaseInvoiceStore(s => s.dueSoonInvoices);
  const activeSession = useCashSessionStore(s => s.activeSession);
  const { lang } = useLangStore();

  return useMemo(() => {
    const notifs: AppNotification[] = [];
    const now = new Date();

    // Stock out
    products.filter(p => p.isActive && p.stock === 0).forEach(p => {
      notifs.push({
        id: `stock_out_${p.id}`,
        type: "stock_out",
        priority: "critical",
        title: lang === "id" ? "Stok Habis" : "Out of Stock",
        message: `${lang === "id" ? p.nameId || p.name : p.name} — 0 ${p.unit}`,
        productId: p.id,
        createdAt: now.toISOString(),
      });
    });

    // Stock low
    products.filter(p => p.isActive && p.stock > 0 && p.stock <= p.minStock).forEach(p => {
      notifs.push({
        id: `stock_low_${p.id}`,
        type: "stock_low",
        priority: "high",
        title: lang === "id" ? "Stok Rendah" : "Low Stock",
        message: `${lang === "id" ? p.nameId || p.name : p.name} — ${p.stock} ${p.unit} (min: ${p.minStock})`,
        productId: p.id,
        createdAt: now.toISOString(),
      });
    });

    // Expired batches
    batches.filter(b => b.quantity > 0 && b.expiryDate && new Date(b.expiryDate) <= now).forEach(b => {
      const product = products.find(p => p.id === b.productId);
      notifs.push({
        id: `expired_${b.id}`,
        type: "expired",
        priority: "critical",
        title: lang === "id" ? "Bahan Kadaluarsa" : "Expired",
        message: `${product ? (lang === "id" ? product.nameId || product.name : product.name) : b.productId} — Batch ${b.batchNumber}`,
        productId: b.productId,
        createdAt: now.toISOString(),
      });
    });

    // Expiring soon (within 30 days — owner request: notifikasi 1 bulan
    // sebelum tanggal kadaluarsa, misal ED 18 Juni → notif mulai 18 Mei).
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    batches.filter(b => b.quantity > 0 && b.expiryDate && new Date(b.expiryDate) > now && new Date(b.expiryDate) <= in30Days).forEach(b => {
      const product = products.find(p => p.id === b.productId);
      const daysLeft = Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      notifs.push({
        id: `expiry_soon_${b.id}`,
        type: "expiry_soon",
        priority: "high",
        title: lang === "id" ? "Segera Kadaluarsa" : "Expiring Soon",
        message: `${product ? (lang === "id" ? product.nameId || product.name : product.name) : b.productId} — ${daysLeft} ${lang === "id" ? "hari lagi" : "days left"}`,
        productId: b.productId,
        createdAt: now.toISOString(),
      });
    });

    // Faktur jatuh tempo — baca `purchase_invoices`, BUKAN `stock_movements`.
    //
    // Sampai 29 Sep 2026 blok ini membaca `movements` (kolom due_date lama).
    // Tapi alur faktur sekarang TIDAK menulis stock_movement sama sekali
    // (lihat "Faktur Barang Masuk — pure record only"), jadi praktis tidak
    // ada satu pun faktur yang pernah memunculkan notifikasi. Bu Santi
    // 17 Sep 2026: "jatuh tempo bulan ini terkadang tidak update" —
    // sebagian karena memang tidak pernah ada peringatannya.
    //
    // Bandingkan per HARI: due_date datang sebagai UTC midnight, kalau
    // dibanding jam-jaman maka faktur hari-H sudah dianggap telat sejak
    // 07:00 WIB.
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in7Days = startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000;
    invoices
      .filter(inv => inv.paymentStatus === "unpaid" && inv.dueDate)
      .forEach(inv => {
        const d = new Date(inv.dueDate!);
        const dueDay = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime();
        if (dueDay > in7Days) return;

        const overdue = dueDay < startOfToday.getTime();
        const daysLeft = Math.round((dueDay - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
        const when = overdue
          ? (lang === "id" ? `telat ${Math.abs(daysLeft)} hari` : `${Math.abs(daysLeft)} days late`)
          : daysLeft === 0
            ? (lang === "id" ? "hari ini" : "today")
            : (lang === "id" ? `${daysLeft} hari lagi` : `in ${daysLeft} days`);

        notifs.push({
          id: `invoice_due_${inv.id}`,
          type: "invoice_due",
          priority: overdue ? "critical" : daysLeft <= 2 ? "high" : "medium",
          title: overdue
            ? (lang === "id" ? "Faktur Lewat Tempo" : "Invoice Overdue")
            : (lang === "id" ? "Faktur Jatuh Tempo" : "Invoice Due Soon"),
          message: `${inv.supplierName || "Pemasok"}${inv.invoiceNumber ? ` #${inv.invoiceNumber}` : ""} — ${fmtRp(inv.totalAmount)} · ${when}`,
          createdAt: now.toISOString(),
        });
      });

    // Register open too long (> 12 hours)
    if (activeSession && activeSession.openedAt) {
      const openedAt = new Date(activeSession.openedAt);
      const hoursOpen = (now.getTime() - openedAt.getTime()) / (1000 * 60 * 60);
      if (hoursOpen > 12) {
        notifs.push({
          id: `register_open_${activeSession.id}`,
          type: "register_open",
          priority: "low",
          title: lang === "id" ? "Register Masih Terbuka" : "Register Still Open",
          message: lang === "id"
            ? `Sudah ${Math.floor(hoursOpen)} jam — jangan lupa tutup register`
            : `Open for ${Math.floor(hoursOpen)}h — remember to close`,
          createdAt: now.toISOString(),
        });
      }
    }

    // Sort: critical first, then high, medium, low
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    notifs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return notifs;
  }, [products, batches, invoices, activeSession, lang]);
}
