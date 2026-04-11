import { useMemo } from "react";
import { useProductStore, useBatchStore, useInventoryStore, useCashSessionStore, useLangStore } from "@/stores";
import type { AppNotification } from "@/types";

export function useNotifications(): AppNotification[] {
  const products = useProductStore(s => s.products);
  const batches = useBatchStore(s => s.batches);
  const movements = useInventoryStore(s => s.movements);
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

    // Expiring soon (within 14 days)
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    batches.filter(b => b.quantity > 0 && b.expiryDate && new Date(b.expiryDate) > now && new Date(b.expiryDate) <= in14Days).forEach(b => {
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

    // Invoice due (unpaid movements with due date within 7 days)
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    movements.filter(m => m.paymentStatus === "unpaid" && m.dueDate && new Date(m.dueDate) <= in7Days).forEach(m => {
      const product = products.find(p => p.id === m.productId);
      const overdue = new Date(m.dueDate!) <= now;
      notifs.push({
        id: `invoice_due_${m.id}`,
        type: "invoice_due",
        priority: overdue ? "high" : "medium",
        title: overdue
          ? (lang === "id" ? "Invoice Terlambat" : "Invoice Overdue")
          : (lang === "id" ? "Invoice Jatuh Tempo" : "Invoice Due Soon"),
        message: `${product ? (lang === "id" ? product.nameId || product.name : product.name) : m.productId} — ${m.paymentTerms || ""}`,
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
  }, [products, batches, movements, activeSession, lang]);
}
