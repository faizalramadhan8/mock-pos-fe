import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Order, Product, PaymentTerms } from "@/types";
import JsBarcode from "jsbarcode";
import { jsPDF } from "jspdf";
import { useSettingsStore } from "@/stores";

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
  // Read from the live Zustand store, not localStorage — avoids stale reads
  // right after Save in Settings (persist write is async).
  const s = useSettingsStore.getState();
  const name = s.storeName || "Toko Bahan Kue Santi";
  const addr = s.storeAddress || "";
  const phone = s.storePhone || "";
  const cashier = opts?.cashierName || "-";
  const customerName = order.member ? order.member.name : (order.customer || "");

  // Format Bu Santi: thermal 58mm, font tipis (regular weight, no bold global).
  // Header centered, body left/right kolom, footer centered. NO Diskon /
  // Biaya Tambahan / Biaya CC / Pembulatan baris (Bu Santi: tidak perlu).
  const PAPER_W = "58mm";
  const BODY_W = "54mm"; // 2mm margin sisi

  // No # format YYYY.MM.DD.NNNNN — tahun-bulan-tanggal + 5 char terakhir id.
  const created = new Date(order.createdAt);
  const yyyy = created.getFullYear();
  const mm = String(created.getMonth() + 1).padStart(2, "0");
  const dd = String(created.getDate()).padStart(2, "0");
  const hh = String(created.getHours()).padStart(2, "0");
  const mi = String(created.getMinutes()).padStart(2, "0");
  const idTail = (order.id.replace(/[^0-9]/g, "") || order.id).slice(-5).padStart(5, "0").toUpperCase();
  const orderNo = `${yyyy}.${mm}.${dd}.${idTail}`;
  const dateStr = `${dd}-${mm}-${yyyy}  ${hh}:${mi}`;

  // Subtotal pakai harga normal (regular_price kalau ada, fallback unit_price).
  // memberSavings = total selisih (regular - member) × qty. Subtotal − Hemat
  // Member = total. Konsisten dengan format struk WA.
  let subtotal = 0;
  let memberSavings = 0;
  for (const i of order.items) {
    const regular = i.regularPrice && i.regularPrice > i.unitPrice ? i.regularPrice : i.unitPrice;
    subtotal += regular * i.quantity;
    memberSavings += (regular - i.unitPrice) * i.quantity;
  }
  const fmt = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
  const barcodeSvg = generateBarcodeSvg(order.id, { width: 1.0, height: 30, fontSize: 8 });

  // Format mengikuti modal "Pesanan Selesai" di layar — single-line per item
  // (Nama xQty di kiri, harga di kanan), summary Subtotal/PPN/Total, barcode
  // di bawah, lalu disclaimer + terima kasih.
  const html = `<!DOCTYPE html>
<html><head><title>Struk ${orderNo}</title>
<style>
  @page{size:${PAPER_W} auto;margin:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.4;
       width:${BODY_W};margin:0 auto;padding:2mm 0;color:#000;font-weight:400;
       -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .c{text-align:center}
  .ln{border-top:1px dashed #000;margin:3px 0}
  .r{display:flex;justify-content:space-between;gap:4px;align-items:flex-start}
  .r .l{flex:1}
  .r .v{text-align:right;white-space:nowrap}
  .kv{display:flex;gap:4px}
  .kv .k{min-width:14mm}
  h2{margin:0;font-size:11px;font-weight:600;letter-spacing:.2px}
  p{margin:1px 0}
  .item{margin:2px 0}
  .total .l, .total .v{font-weight:700;font-size:12px}
  .bc{text-align:center;margin:3mm 0 1mm} .bc svg{max-width:100%;height:auto}
</style></head><body>
  <div class="c">
    <h2>${escapeHtml(name)}</h2>
    ${addr ? `<p>${escapeHtml(addr)}</p>` : ""}
    ${phone ? `<p>Telp. ${escapeHtml(phone)}</p>` : ""}
  </div>
  <div class="ln"></div>
  <div class="kv"><span class="k">No #</span><span>:</span><span>${orderNo}</span></div>
  <div class="kv"><span class="k">Kasir</span><span>:</span><span>${escapeHtml(cashier)}</span></div>
  <div class="kv"><span class="k">Tanggal</span><span>:</span><span>${dateStr}</span></div>
  ${customerName ? `<div class="kv"><span class="k">${order.member ? "Member" : "Pelanggan"}</span><span>:</span><span>${escapeHtml(customerName)}</span></div>` : ""}
  <div class="ln"></div>
  ${order.items.map(i => {
    const lineTotal = i.quantity * i.unitPrice;
    return `<div class="r item"><span class="l">${escapeHtml(i.name)} ×${i.quantity}</span><span class="v">${fmt(lineTotal)}</span></div>`;
  }).join("")}
  <div class="ln"></div>
  <div class="r"><span class="l">Subtotal</span><span class="v">${fmt(subtotal)}</span></div>
  ${memberSavings > 0 ? `<div class="r"><span class="l">Hemat Member</span><span class="v">-${fmt(memberSavings)}</span></div>` : ""}
  <div class="r total"><span class="l">Total</span><span class="v">${fmt(order.total)}</span></div>
  ${barcodeSvg ? `<div class="bc">${barcodeSvg}</div>` : ""}
  <div class="ln"></div>
  <p class="c" style="font-style:italic">Barang yang sudah dibeli tidak dapat ditukar atau dikembalikan.</p>
  <p class="c" style="margin-top:1.5mm">Terimakasih sudah berbelanja!</p>
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

// Render barcode ke canvas dataURL — jsPDF butuh image, bukan SVG.
function generateBarcodeDataUrl(value: string, widthMm: number, heightMm: number): string {
  const canvas = document.createElement("canvas");
  // Render at ~6× DPI mm→px (≈152 DPI) supaya barcode tajam saat dicetak thermal.
  const dpi = 6;
  canvas.width = Math.round(widthMm * dpi);
  canvas.height = Math.round(heightMm * dpi);
  try {
    JsBarcode(canvas, value, {
      format: "CODE128",
      width: 1.6,
      height: canvas.height,
      displayValue: false,
      margin: 0,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

// Bangun 1 page PDF untuk satu label. Page-size persis sama dengan label
// fisik → tidak mungkin overflow → tidak ada blank page.
function addLabelPageToPdf(pdf: jsPDF, product: Product, lang: "en" | "id", size: LabelSize, extras?: LabelExtras) {
  const pageW = Math.min(size.width, size.height);
  const pageH = Math.max(size.width, size.height);
  const name = (lang === "id" ? product.nameId : product.name).toUpperCase();
  const expDate = extras?.expiryDate ? formatExpiry(extras.expiryDate) : "";
  const storeName = getStoreNameForLabel();
  const hasFooter = !!(expDate || storeName);

  const footH = hasFooter ? 4 : 0;             // mm
  const sidePad = 1;                            // mm
  const topPad = 1;                             // mm
  const innerW = pageW - sidePad * 2;
  const contentH = pageH - footH - topPad - 1;  // -1mm bottom safety

  // Font sizes (pt)
  const nameFontPt = pageW <= 30 ? 7 : pageW <= 40 ? 8 : 10;
  const priceFontPt = pageW <= 30 ? 8 : pageW <= 40 ? 10 : 12;
  const footFontPt = pageW <= 30 ? 6 : 7;

  // Layout: name (top, max 2 line), barcode (middle), price (bottom of content area)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(nameFontPt);
  pdf.setTextColor(0, 0, 0);

  // Word-wrap name max 2 line
  const nameLines = pdf.splitTextToSize(name, innerW).slice(0, 2);
  const nameLineH = nameFontPt * 0.353;        // pt → mm approx
  const nameBlockH = nameLines.length * nameLineH * 1.05;

  let y = topPad + nameLineH;
  for (const line of nameLines) {
    pdf.text(line, pageW / 2, y, { align: "center" });
    y += nameLineH * 1.05;
  }

  // Barcode area — antara nama dan price baseline
  const priceH = priceFontPt * 0.353;
  const priceBaselineY = topPad + contentH - 0.5;
  const barcodeTop = topPad + nameBlockH + 0.5;
  const barcodeBottom = priceBaselineY - priceH - 0.8;
  const barcodeH = Math.max(4, barcodeBottom - barcodeTop);
  const barcodeW = innerW * 0.95;

  const barcodeImg = generateBarcodeDataUrl(product.sku, barcodeW, barcodeH);
  if (barcodeImg) {
    pdf.addImage(barcodeImg, "PNG", (pageW - barcodeW) / 2, barcodeTop, barcodeW, barcodeH);
  }

  // Price
  pdf.setFontSize(priceFontPt);
  pdf.text(`Rp ${product.sellingPrice.toLocaleString("id-ID")}`, pageW / 2, priceBaselineY, { align: "center" });

  // Footer (hitam dengan teks putih) — ED + nama toko
  if (hasFooter) {
    pdf.setFillColor(0, 0, 0);
    pdf.rect(0, pageH - footH, pageW, footH, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(footFontPt);
    const footY = pageH - footH / 2 + footFontPt * 0.353 / 2 - 0.3;
    if (expDate) pdf.text(`ED. ${expDate}`, sidePad, footY, { align: "left" });
    if (storeName) pdf.text(storeName, pageW - sidePad, footY, { align: "right" });
  }
}

function buildLabelsPdf(products: Product[], lang: "en" | "id", size: LabelSize, extras?: LabelExtras, copies = 1): jsPDF {
  const pageW = Math.min(size.width, size.height);
  const pageH = Math.max(size.width, size.height);
  const c = Math.max(1, Math.min(99, Math.floor(copies)));
  const pdf = new jsPDF({
    unit: "mm",
    format: [pageW, pageH],
    orientation: "portrait",
    compress: true,
  });
  let firstPage = true;
  for (const p of products) {
    for (let i = 0; i < c; i++) {
      if (!firstPage) pdf.addPage([pageW, pageH], "portrait");
      firstPage = false;
      addLabelPageToPdf(pdf, p, lang, size, extras);
    }
  }
  return pdf;
}

// Trigger print dari blob PDF lewat hidden iframe — sama pattern dengan
// printViaIframe tapi PDF blob URL. Browser akan tampilkan dialog print
// PDF viewer; kalau pakai Chrome `--kiosk-printing` flag, dialog skip.
function printPdfViaIframe(pdf: jsPDF) {
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const id = "bakeshop-pdf-print-frame";
  let iframe = document.getElementById(id) as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = id;
    iframe.style.cssText = "position:fixed;width:0;height:0;border:none;left:-9999px;top:-9999px";
    document.body.appendChild(iframe);
  }
  iframe.src = url;
  iframe.onload = () => {
    setTimeout(() => {
      iframe!.contentWindow?.focus();
      iframe!.contentWindow?.print();
      // Revoke setelah print dialog ditutup; aman setelah delay.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }, 250);
  };
}

export function printBarcodeLabel(product: Product, lang: "en" | "id", size?: LabelSize, extras?: LabelExtras, copies = 1) {
  const s = size || { width: 40, height: 30 };
  const pdf = buildLabelsPdf([product], lang, s, extras, copies);
  printPdfViaIframe(pdf);
}

export function printBarcodeLabels(products: Product[], lang: "en" | "id", size?: LabelSize, extras?: LabelExtras, copies = 1) {
  if (products.length === 0) return;
  const s = size || { width: 40, height: 30 };
  const pdf = buildLabelsPdf(products, lang, s, extras, copies);
  printPdfViaIframe(pdf);
}
