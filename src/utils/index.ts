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
  const name = settings?.state?.storeName || "Toko Bahan Kue Santi";
  const addr = settings?.state?.storeAddress || "Jl. Sudirman No. 123, Jakarta";
  const phone = settings?.state?.storePhone || "+62 812-3456-7890";
  const barcodeSvg = generateBarcodeSvg(order.id, { width: 1.2, height: 35, fontSize: 10 });
  const customerName = order.member ? order.member.name : (order.customer || "Walk-in");
  const cashier = opts?.cashierName;
  const memberSavings = order.memberSavings || 0;
  const grossSubtotal = order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const itemDiscTotal = order.items.reduce((s, i) => s + (i.discountAmount || 0), 0);
  const orderDiscTotal = order.orderDiscount || 0;
  const hasDiscounts = itemDiscTotal > 0 || orderDiscTotal > 0 || memberSavings > 0;

  const html = `<!DOCTYPE html>
<html><head><title>Receipt ${order.id}</title>
<style>
  @page{size:80mm auto;margin:0}
  body{font-family:'Courier New',monospace;font-size:11px;width:72mm;margin:0 auto;padding:2mm 0;color:#222}
  .c{text-align:center} .b{font-weight:bold}
  .ln{border-top:1px dashed #999;margin:6px 0}
  .r{display:flex;justify-content:space-between;gap:4px}
  .r span:last-child{text-align:right;white-space:nowrap}
  h2{margin:0;font-size:14px} p{margin:2px 0}
  .bc{text-align:center;margin:6px 0} .bc svg{max-width:100%}
  @media print{body{width:72mm}}
</style></head><body>
  <div class="c"><h2>${escapeHtml(name)}</h2><p>${escapeHtml(addr)}</p><p>${escapeHtml(phone)}</p></div>
  <div class="ln"></div>
  <div class="r"><span>${escapeHtml(order.id)}</span><span>${new Date(order.createdAt).toLocaleString("id-ID")}</span></div>
  <div class="r"><span>Customer</span><span>${escapeHtml(customerName)}</span></div>
  ${cashier ? `<div class="r"><span>Kasir</span><span>${escapeHtml(cashier)}</span></div>` : ""}
  <div class="ln"></div>
  ${order.items.map(i => {
    const g = i.quantity * i.unitPrice;
    const d = i.discountAmount || 0;
    const memberLine = i.regularPrice && i.regularPrice > i.unitPrice
      ? `<div class="r" style="color:#A0673C;font-size:10px"><span>&nbsp;&nbsp;Member (was Rp ${i.regularPrice.toLocaleString("id-ID")})</span><span></span></div>`
      : "";
    return `<div><p>${escapeHtml(i.name)}</p><div class="r"><span>${i.quantity} x Rp ${i.unitPrice.toLocaleString("id-ID")}</span><span class="b">Rp ${g.toLocaleString("id-ID")}</span></div>${memberLine}${d > 0 ? `<div class="r" style="color:#B87333;font-size:11px"><span>&nbsp;&nbsp;Disc ${i.discountType === "percent" ? i.discountValue + "%" : ""}</span><span>-Rp ${d.toLocaleString("id-ID")}</span></div>` : ""}</div>`;
  }).join("")}
  <div class="ln"></div>
  ${hasDiscounts || order.ppnRate > 0 ? `<div class="r"><span>Subtotal</span><span>Rp ${(grossSubtotal + memberSavings).toLocaleString("id-ID")}</span></div>` : ""}
  ${memberSavings > 0 ? `<div class="r" style="color:#A0673C"><span>Hemat Member</span><span>-Rp ${memberSavings.toLocaleString("id-ID")}</span></div>` : ""}
  ${itemDiscTotal > 0 ? `<div class="r" style="color:#B87333"><span>Item Disc</span><span>-Rp ${itemDiscTotal.toLocaleString("id-ID")}</span></div>` : ""}
  ${orderDiscTotal > 0 ? `<div class="r" style="color:#B87333"><span>Order Disc${order.orderDiscountType === "percent" ? " " + order.orderDiscountValue + "%" : ""}</span><span>-Rp ${orderDiscTotal.toLocaleString("id-ID")}</span></div>` : ""}
  ${order.ppnRate > 0 ? `<div class="r"><span>PPN (${order.ppnRate}%)</span><span>Rp ${order.ppn.toLocaleString("id-ID")}</span></div>` : ""}
  <div class="r b"><span>TOTAL</span><span>Rp ${order.total.toLocaleString("id-ID")}</span></div>
  <div class="r"><span>Payment</span><span>${order.payment.toUpperCase()}</span></div>
  <div class="ln"></div>
  ${barcodeSvg ? `<div class="bc">${barcodeSvg}</div>` : ""}
  <p class="c">Thank you for your purchase!</p>
</body></html>`;

  // Use hidden iframe to bypass pop-up blockers
  printViaIframe(html);
}

function printViaIframe(html: string) {
  const id = "bakeshop-print-frame";
  let iframe = document.getElementById(id) as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = id;
    iframe.style.cssText = "position:fixed;width:0;height:0;border:none;left:-9999px;top:-9999px";
    document.body.appendChild(iframe);
  }
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  // Wait for content to render then trigger print dialog
  setTimeout(() => {
    iframe!.contentWindow?.focus();
    iframe!.contentWindow?.print();
  }, 300);
}

export function printReport(orders: Order[], dateLabel: string) {
  const settings = JSON.parse(localStorage.getItem("bakeshop-settings") || "{}");
  const storeName = settings?.state?.storeName || "Toko Bahan Kue Santi";
  const completed = orders.filter(o => o.status === "completed");
  const cancelled = orders.filter(o => o.status === "cancelled");
  const revenue = completed.reduce((s, o) => s + o.total, 0);
  const avg = completed.length > 0 ? Math.round(revenue / completed.length) : 0;

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

  printViaIframe(html);
}

export interface LabelSize {
  width: number;  // mm
  height: number; // mm
}

export const LABEL_PRESETS: Record<string, LabelSize> = {
  "40x30": { width: 40, height: 30 },
  "50x30": { width: 50, height: 30 },
  "60x40": { width: 60, height: 40 },
  "70x50": { width: 70, height: 50 },
  "80x50": { width: 80, height: 50 },
};

export interface LabelExtras {
  expiryDate?: string; // YYYY-MM-DD or any formatted string
}

function formatExpiry(d: string) {
  // Accept YYYY-MM-DD → DD-MM-YYYY for readability on sticker
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, dd] = d.split("-");
    return `${dd}-${m}-${y}`;
  }
  return d;
}

function getStoreNameForLabel(): string {
  try {
    const raw = localStorage.getItem("bakeshop-settings");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    const n = parsed?.state?.storeName || "";
    return String(n).toUpperCase();
  } catch {
    return "";
  }
}

function buildLabelHtml(product: Product, lang: "en" | "id", size: LabelSize, extras?: LabelExtras) {
  const name = lang === "id" ? product.nameId : product.name;
  // Barcode sizing — bigger bars so it scans reliably and looks prominent
  const barcodeW = size.width <= 40 ? 2.0 : size.width <= 50 ? 2.4 : 2.8;
  const barcodeH = Math.round(Math.min(size.width, size.height) * 0.95);
  const barcodeSvg = generateBarcodeSvg(product.sku, { width: barcodeW, height: barcodeH, fontSize: 0, displayValue: false });
  if (!barcodeSvg) return "";
  const expDate = extras?.expiryDate ? formatExpiry(extras.expiryDate) : "";
  const storeName = getStoreNameForLabel();
  const hasFooter = expDate || storeName;
  const footer = hasFooter
    ? `<div class="foot"><span>${expDate ? "ED. " + escapeHtml(expDate) : ""}</span><span>${escapeHtml(storeName)}</span></div>`
    : "";
  return `<div class="label">
    <div class="top">
      <div class="name">${escapeHtml(name.toUpperCase())}</div>
      <div class="bc">${barcodeSvg}</div>
      <div class="price">Rp ${product.sellingPrice.toLocaleString("id-ID")}</div>
    </div>
    ${footer}
  </div>`;
}

function labelCss(size: LabelSize) {
  // Scale font based on label size. Sized to match target design (big & readable)
  const nameFont = size.width <= 40 ? 10 : size.width <= 50 ? 12 : 14;
  const priceFont = size.width <= 40 ? 11 : size.width <= 50 ? 13 : 15;
  const footFont = size.width <= 40 ? 9 : 10;
  // Use the SHORTER side as page width so the output stays portrait-oriented
  // (label exits the printer with content reading top-to-bottom).
  const pageW = Math.min(size.width, size.height);
  const pageH = Math.max(size.width, size.height);
  return `
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:${pageW}mm ${pageH}mm;margin:0}
  html,body{width:${pageW}mm;height:${pageH}mm}
  body{font-family:Arial,sans-serif;color:#000;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .label{width:${pageW}mm;height:${pageH}mm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;overflow:hidden}
  .label:last-child{page-break-after:auto}
  .top{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0.8mm 1mm 0.5mm;gap:0.8mm}
  .name{font-size:${nameFont}px;font-weight:800;line-height:1.1;letter-spacing:-0.2px;max-height:${nameFont * 2.3}px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;text-align:center}
  .bc{width:100%;display:flex;justify-content:center}
  .bc svg{max-width:95%;height:auto;display:block}
  .price{font-size:${priceFont}px;font-weight:900;letter-spacing:-0.2px}
  .foot{background:#000;color:#fff;font-size:${footFont}px;font-weight:700;display:flex;justify-content:space-between;padding:0.8mm 1.8mm;letter-spacing:0.3px}`;
}

export function printBarcodeLabel(product: Product, lang: "en" | "id", size?: LabelSize, extras?: LabelExtras) {
  const s = size || { width: 40, height: 30 };
  const content = buildLabelHtml(product, lang, s, extras);
  if (!content) return;
  const html = `<!DOCTYPE html>
<html><head><title>Label ${product.sku}</title>
<style>${labelCss(s)}</style></head><body>${content}</body></html>`;
  printViaIframe(html);
}

export function printBarcodeLabels(products: Product[], lang: "en" | "id", size?: LabelSize, extras?: LabelExtras) {
  if (products.length === 0) return;
  const s = size || { width: 40, height: 30 };
  const labels = products.map(p => buildLabelHtml(p, lang, s, extras)).filter(Boolean).join("\n");
  if (!labels) return;
  const html = `<!DOCTYPE html>
<html><head><title>Batch Labels (${products.length})</title>
<style>${labelCss(s)}</style></head><body>${labels}</body></html>`;
  printViaIframe(html);
}
