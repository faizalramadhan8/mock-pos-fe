import type { Order, Product, StockMovement } from "@/types";
import { formatCurrency } from "./index";

type ExportFormat = "csv" | "xlsx";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function sheetToFile(data: Record<string, unknown>[], sheetName: string, filename: string, format: ExportFormat) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
  } else {
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx`);
  }
}

export async function exportOrders(orders: Order[], format: ExportFormat) {
  const data = orders.map(o => ({
    "Order ID": o.id,
    "Date": new Date(o.createdAt).toLocaleString("id-ID"),
    "Customer": o.customer,
    "Status": o.status,
    "Payment": o.payment,
    "Items": o.items.map(i => `${i.name} x${i.quantity}`).join(", "),
    "Subtotal": o.subtotal,
    "PPN Rate": `${o.ppnRate}%`,
    "PPN": o.ppn,
    "Discount": o.orderDiscount || 0,
    "Total": o.total,
  }));
  await sheetToFile(data, "Orders", `orders-${new Date().toISOString().slice(0, 10)}`, format);
}

// Multi-sheet Excel report: Transaksi + Top Produk + Member.
// Hanya order completed yang masuk (cancelled/refunded di-skip dari agregat
// supaya angka revenue/qty bersih). dateLabel masuk ke filename.
export async function exportOrderReport(orders: Order[], dateLabel: string) {
  const completed = orders.filter(o => o.status === "completed");

  // Sheet 1 — Transaksi (sama dengan exportOrders tapi semua status)
  const transaksi = orders.map(o => ({
    "Order ID": o.id,
    "Tanggal": new Date(o.createdAt).toLocaleString("id-ID"),
    "Customer": o.customer || (o.member ? o.member.name : "-"),
    "Member": o.member ? o.member.name : "",
    "Status": o.status,
    "Pembayaran": o.payment,
    "Item": o.items.map(i => `${i.name} ×${i.quantity}`).join(", "),
    "Subtotal": o.subtotal,
    "Diskon": o.orderDiscount || 0,
    "PPN": o.ppn,
    "Total": o.total,
  }));

  // Sheet 2 — Top Produk (agregat dari completed, sort by qty desc)
  const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of completed) {
    for (const i of o.items) {
      const key = i.productId || i.name;
      const existing = productMap.get(key);
      const lineRevenue = i.unitPrice * i.quantity;
      if (existing) {
        existing.qty += i.quantity;
        existing.revenue += lineRevenue;
      } else {
        productMap.set(key, { name: i.name, qty: i.quantity, revenue: lineRevenue });
      }
    }
  }
  const topProduk = Array.from(productMap.values())
    .sort((a, b) => b.qty - a.qty)
    .map((p, idx) => ({
      "Peringkat": idx + 1,
      "Produk": p.name,
      "Qty Terjual": p.qty,
      "Total Pendapatan": p.revenue,
    }));

  // Sheet 3 — Member (agregat per member terdaftar yang transaksi di period)
  type MemberRow = { id: string; name: string; phone: string; orders: number; spend: number; savings: number; lastVisit: string };
  const memberMap = new Map<string, MemberRow>();
  for (const o of completed) {
    if (!o.member?.id) continue;
    const id = o.member.id;
    const savings = o.memberSavings || 0;
    const existing = memberMap.get(id);
    if (existing) {
      existing.orders += 1;
      existing.spend += o.total;
      existing.savings += savings;
      if (o.createdAt > existing.lastVisit) existing.lastVisit = o.createdAt;
    } else {
      memberMap.set(id, {
        id,
        name: o.member.name,
        phone: o.member.phone || "-",
        orders: 1,
        spend: o.total,
        savings,
        lastVisit: o.createdAt,
      });
    }
  }
  const member = Array.from(memberMap.values())
    .sort((a, b) => b.spend - a.spend)
    .map((m, idx) => ({
      "Peringkat": idx + 1,
      "Nama": m.name,
      "No. HP": m.phone,
      "Jumlah Order": m.orders,
      "Total Belanja": m.spend,
      "Hemat Member": m.savings,
      "Kunjungan Terakhir": new Date(m.lastVisit).toLocaleString("id-ID"),
    }));

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transaksi), "Transaksi");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topProduk), "Top Produk");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(member), "Member");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const safeLabel = dateLabel.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
  downloadBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `laporan-${safeLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

export async function exportProducts(products: Product[], format: ExportFormat) {
  const data = products.map(p => ({
    "SKU": p.sku,
    "Name (EN)": p.name,
    "Name (ID)": p.nameId,
    "Purchase Price": p.purchasePrice,
    "Selling Price": p.sellingPrice,
    "Margin": formatCurrency(p.sellingPrice - p.purchasePrice),
    "Stock": p.stock,
    "Min Stock": p.minStock,
    "Unit": p.unit,
    "Qty/Box": p.qtyPerBox,
    "Active": p.isActive ? "Yes" : "No",
  }));
  await sheetToFile(data, "Products", `products-${new Date().toISOString().slice(0, 10)}`, format);
}

export async function exportInventory(movements: StockMovement[], products: Product[], format: ExportFormat) {
  const data = movements.map(m => {
    const prod = products.find(p => p.id === m.productId);
    return {
      "Date": new Date(m.createdAt).toLocaleString("id-ID"),
      "Type": m.type === "in" ? "Stock In" : "Stock Out",
      "Product": prod ? prod.name : m.productId,
      "Quantity": m.quantity,
      "Unit Type": m.unitType,
      "Unit Price": m.unitPrice,
      "Total": m.unitPrice * m.quantity,
      "Note": m.note,
    };
  });
  await sheetToFile(data, "Inventory", `inventory-${new Date().toISOString().slice(0, 10)}`, format);
}
