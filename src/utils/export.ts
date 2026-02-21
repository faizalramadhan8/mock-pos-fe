import * as XLSX from "xlsx";
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

function sheetToFile(data: Record<string, unknown>[], sheetName: string, filename: string, format: ExportFormat) {
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

export function exportOrders(orders: Order[], format: ExportFormat) {
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
  sheetToFile(data, "Orders", `orders-${new Date().toISOString().slice(0, 10)}`, format);
}

export function exportProducts(products: Product[], format: ExportFormat) {
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
  sheetToFile(data, "Products", `products-${new Date().toISOString().slice(0, 10)}`, format);
}

export function exportInventory(movements: StockMovement[], products: Product[], format: ExportFormat) {
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
  sheetToFile(data, "Inventory", `inventory-${new Date().toISOString().slice(0, 10)}`, format);
}
