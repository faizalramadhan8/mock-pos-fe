import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Order, Product, PaymentTerms } from "@/types";
import JsBarcode from "jsbarcode";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function formatCurrency(n: number) { return "Rp " + n.toLocaleString("id-ID"); }
export function formatDate(d: string, lang: "en" | "id" = "en") {
  const locale = lang === "id" ? "id-ID" : "en";
  return new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short" });
}
export function formatTime(d: string, lang: "en" | "id" = "en") {
  const locale = lang === "id" ? "id-ID" : "en";
  return new Date(d).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
export function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function genBatchNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  return `B-${y}${m}${d}-${seq}`;
}

export function calcDueDate(baseDate: string, terms: PaymentTerms): string {
  if (terms === "COD") return baseDate;
  const days = parseInt(terms.replace("NET", ""));
  const dt = new Date(baseDate);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString();
}

export function compressImage(file: File, maxWidth = 400, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

function generateBarcodeSvg(value: string, opts?: { width?: number; height?: number; displayValue?: boolean; fontSize?: number }): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value, {
      format: "CODE128",
      width: opts?.width ?? 1.5,
      height: opts?.height ?? 40,
      displayValue: opts?.displayValue ?? true,
      fontSize: opts?.fontSize ?? 11,
      font: "Courier New",
      margin: 0,
    });
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return "";
  }
}

export function printReceipt(order: Order, opts?: { cashierName?: string }) {
  const settings = JSON.parse(localStorage.getItem("bakeshop-settings") || "{}");
  const name = settings?.state?.storeName || "BakeShop";
  const addr = settings?.state?.storeAddress || "Jl. Sudirman No. 123, Jakarta";
  const phone = settings?.state?.storePhone || "+62 812-3456-7890";
  const barcodeSvg = generateBarcodeSvg(order.id, { width: 1.2, height: 35, fontSize: 10 });
  const customerName = order.customer || "Walk-in";
  const cashier = opts?.cashierName;

  const win = window.open("", "_blank", "width=360,height=600");
  if (!win) return;

  const html = `<!DOCTYPE html>
<html><head><title>Receipt ${order.id}</title>
<style>
  body{font-family:'Courier New',monospace;font-size:12px;width:280px;margin:0 auto;padding:20px 0;color:#222}
  .c{text-align:center} .b{font-weight:bold}
  .ln{border-top:1px dashed #999;margin:8px 0}
  .r{display:flex;justify-content:space-between}
  h2{margin:0;font-size:16px} p{margin:2px 0}
  .bc{text-align:center;margin:8px 0} .bc svg{max-width:100%}
  @media print{body{width:100%}}
</style></head><body>
  <div class="c"><h2>${escapeHtml(name)}</h2><p>${escapeHtml(addr)}</p><p>${escapeHtml(phone)}</p></div>
  <div class="ln"></div>
  <div class="r"><span>${escapeHtml(order.id)}</span><span>${new Date(order.createdAt).toLocaleString("id-ID")}</span></div>
  <div class="r"><span>Customer</span><span>${escapeHtml(customerName)}</span></div>
  ${cashier ? `<div class="r"><span>Kasir</span><span>${escapeHtml(cashier)}</span></div>` : ""}
  <div class="ln"></div>
  ${order.items.map(i => `<div><p>${escapeHtml(i.name)}</p><div class="r"><span>${i.quantity} x Rp ${i.unitPrice.toLocaleString("id-ID")}</span><span class="b">Rp ${(i.quantity * i.unitPrice).toLocaleString("id-ID")}</span></div></div>`).join("")}
  <div class="ln"></div>
  ${order.ppnRate > 0 ? `<div class="r"><span>Subtotal</span><span>Rp ${order.subtotal.toLocaleString("id-ID")}</span></div>
  <div class="r"><span>PPN (${order.ppnRate}%)</span><span>Rp ${order.ppn.toLocaleString("id-ID")}</span></div>` : ""}
  <div class="r b"><span>TOTAL</span><span>Rp ${order.total.toLocaleString("id-ID")}</span></div>
  <div class="r"><span>Payment</span><span>${order.payment.toUpperCase()}</span></div>
  <div class="ln"></div>
  ${barcodeSvg ? `<div class="bc">${barcodeSvg}</div>` : ""}
  <p class="c">Thank you for your purchase!</p>
</body></html>`;

  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

export function printReport(orders: Order[], dateLabel: string) {
  const settings = JSON.parse(localStorage.getItem("bakeshop-settings") || "{}");
  const storeName = settings?.state?.storeName || "BakeShop";
  const completed = orders.filter(o => o.status === "completed");
  const cancelled = orders.filter(o => o.status === "cancelled");
  const revenue = completed.reduce((s, o) => s + o.total, 0);
  const avg = completed.length > 0 ? Math.round(revenue / completed.length) : 0;

  const win = window.open("", "_blank", "width=420,height=700");
  if (!win) return;

  const html = `<!DOCTYPE html>
<html><head><title>Report - ${escapeHtml(storeName)}</title>
<style>
  body{font-family:'Courier New',monospace;font-size:12px;width:360px;margin:0 auto;padding:20px 0;color:#222}
  .c{text-align:center} .b{font-weight:bold}
  .ln{border-top:1px dashed #999;margin:8px 0}
  .r{display:flex;justify-content:space-between}
  h2{margin:0;font-size:16px} p{margin:2px 0}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{text-align:left;padding:3px 4px;border-bottom:1px solid #ddd}
  th{font-weight:bold} .right{text-align:right}
  @media print{body{width:100%}}
</style></head><body>
  <div class="c"><h2>${escapeHtml(storeName)}</h2><p>Transaction Report</p><p class="b">${escapeHtml(dateLabel)}</p></div>
  <div class="ln"></div>
  <div class="r"><span>Total Revenue</span><span class="b">Rp ${revenue.toLocaleString("id-ID")}</span></div>
  <div class="r"><span>Completed Orders</span><span class="b">${completed.length}</span></div>
  <div class="r"><span>Avg Order Value</span><span>Rp ${avg.toLocaleString("id-ID")}</span></div>
  <div class="r"><span>Cancelled</span><span>${cancelled.length}</span></div>
  <div class="ln"></div>
  <table>
    <tr><th>ID</th><th>Customer</th><th>Payment</th><th>Status</th><th class="right">Total</th></tr>
    ${orders.map(o => `<tr><td>${escapeHtml(o.id)}</td><td>${escapeHtml(o.customer)}</td><td>${o.payment.toUpperCase()}</td><td>${o.status}</td><td class="right">Rp ${o.total.toLocaleString("id-ID")}</td></tr>`).join("")}
  </table>
  <div class="ln"></div>
  <p class="c" style="font-size:10px">Generated ${new Date().toLocaleString("id-ID")}</p>
</body></html>`;

  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

export function printBarcodeLabel(product: Product, lang: "en" | "id") {
  const name = lang === "id" ? product.nameId : product.name;
  const barcodeSvg = generateBarcodeSvg(product.sku, { width: 2, height: 50, fontSize: 13 });
  if (!barcodeSvg) return;

  const win = window.open("", "_blank", "width=360,height=300");
  if (!win) return;

  const html = `<!DOCTYPE html>
<html><head><title>Label ${product.sku}</title>
<style>
  body{font-family:'DM Sans',sans-serif;margin:0;padding:16px;color:#222}
  .label{border:1px dashed #ccc;padding:16px;width:240px;text-align:center}
  .name{font-size:13px;font-weight:700;margin-bottom:4px}
  .price{font-size:11px;color:#666;margin-bottom:10px}
  .bc svg{max-width:100%}
  @media print{body{padding:0}.label{border:none;width:100%}}
</style></head><body>
  <div class="label">
    <div class="name">${escapeHtml(name)}</div>
    <div class="price">Rp ${product.sellingPrice.toLocaleString("id-ID")} / ${escapeHtml(product.unit)}</div>
    <div class="bc">${barcodeSvg}</div>
  </div>
</body></html>`;

  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}
