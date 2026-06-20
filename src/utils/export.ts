import type { Order, Product, StockMovement } from "@/types";
import type { ProfitLossRes } from "@/api/expenses";
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

// Multi-sheet Excel report: Laba Rugi + Transaksi + Top Produk + Member.
// Hanya order completed yang masuk (cancelled/refunded di-skip dari agregat
// supaya angka revenue/qty bersih). dateLabel masuk ke filename.
// profitLoss optional — kalau tersedia (dari /expenses/profit-loss), sheet
// "Laba Rugi" ditambah di urutan pertama supaya owner lihat ringkasan dulu.
export async function exportOrderReport(orders: Order[], dateLabel: string, profitLoss?: ProfitLossRes | null) {
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
      "Hemat": m.savings,
      "Kunjungan Terakhir": new Date(m.lastVisit).toLocaleString("id-ID"),
    }));

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Sheet 0 — Laba Rugi (kalau tersedia). Pakai aoa_to_sheet supaya bisa
  // multi-section + judul section, bukan tabel datar.
  if (profitLoss) {
    const pl = profitLoss;
    const period = pl.from && pl.to ? `${pl.from} sampai ${pl.to}` : (dateLabel || "Semua periode");
    const rows: (string | number)[][] = [
      ["LAPORAN LABA RUGI"],
      ["Periode", period],
      ["Jumlah Transaksi", pl.total_orders],
      [],
      ["RINCIAN LABA RUGI"],
      ["Pendapatan (Omzet)", pl.revenue],
      ["Modal Barang Terjual", -pl.cogs],
      ["Laba Kotor", pl.gross_profit],
      ["Pengeluaran Operasional", -pl.expense_total],
    ];
    // Rincian per kategori pengeluaran
    for (const b of pl.expense_breakdown) {
      rows.push([`  - ${b.category_name}`, -b.total]);
    }
    rows.push(
      ["Untung Bersih", pl.net_profit],
      [],
      ["ARUS KAS PERIODE INI"],
      ["(Beda dari Laba Rugi — ini uang real masuk-keluar)"],
      ["Uang Masuk (Penjualan)", pl.revenue],
      ["Bayar Supplier (Faktur lunas)", -pl.supplier_paid],
      ["Pengeluaran Operasional", -pl.expense_total],
      ["Total Uang Keluar", -(pl.supplier_paid + pl.expense_total)],
      ["Selisih Kas", pl.cash_diff],
    );
    if (pl.supplier_unpaid > 0) {
      rows.push([], ["Faktur Tempo Belum Lunas (info)", pl.supplier_unpaid]);
    }
    const wsPL = XLSX.utils.aoa_to_sheet(rows);
    // Kasih lebar kolom yang readable
    wsPL["!cols"] = [{ wch: 36 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsPL, "Laba Rugi");
  }

  // Bundling sheet — 1 row per order_item dengan price_source ∈ tier_*.
  // Snapshot field paket_count + extra_count langsung dari order_items
  // (migration 000039), tidak perlu JOIN tier.
  const bundling = orders.flatMap(o =>
    o.items
      .filter(it => it.priceSource === "tier_all" || it.priceSource === "tier_member")
      .map(it => ({
        "Tanggal": new Date(o.createdAt).toLocaleString("id-ID"),
        "Order #": o.id.slice(-8).toUpperCase(),
        "Customer": o.member?.name || o.customer || "Walk-in",
        "Tipe": o.member?.id ? "Member" : "Walk-in",
        "No. HP": o.member?.phone || o.customerPhone || "",
        "Produk": it.name,
        "Tier": it.priceSource === "tier_member" ? "Member Tertentu" : "Semua Customer",
        "Tier ID": it.tierId || "(dihapus)",
        "Qty Total": it.quantity,
        "Paket": it.paketCount || 0,
        "Satuan Ekstra": it.extraCount || 0,
        "Harga/Unit (avg)": Math.round(it.unitPrice),
        "Harga Normal": it.regularPrice || 0,
        "Total Bayar": Math.round(it.unitPrice * it.quantity),
        "Hemat": Math.round(((it.regularPrice || 0) - it.unitPrice) * it.quantity),
      }))
  );

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transaksi), "Transaksi");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topProduk), "Top Produk");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(member), "Member");
  if (bundling.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bundling), "Bundling");
  }
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
