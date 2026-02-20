import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Order, Product } from "@/types";
import JsBarcode from "jsbarcode";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function formatCurrency(n: number) { return "Rp " + n.toLocaleString("id-ID"); }
export function formatDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en", { day: "numeric", month: "short" });
}
export function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
}
export function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

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

export function printReceipt(order: Order) {
  const settings = JSON.parse(localStorage.getItem("bakeshop-settings") || "{}");
  const name = settings?.state?.storeName || "BakeShop";
  const addr = settings?.state?.storeAddress || "";
  const phone = settings?.state?.storePhone || "";
  const barcodeSvg = generateBarcodeSvg(order.id, { width: 1.2, height: 35, fontSize: 10 });

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
  <div class="c"><h2>${name}</h2>${addr ? `<p>${addr}</p>` : ""}${phone ? `<p>${phone}</p>` : ""}</div>
  <div class="ln"></div>
  <div class="r"><span>${order.id}</span><span>${new Date(order.createdAt).toLocaleString("id-ID")}</span></div>
  <div class="r"><span>Customer</span><span>${order.customer}</span></div>
  <div class="ln"></div>
  ${order.items.map(i => `<div><p>${i.name}</p><div class="r"><span>${i.quantity} x Rp ${i.unitPrice.toLocaleString("id-ID")}</span><span class="b">Rp ${(i.quantity * i.unitPrice).toLocaleString("id-ID")}</span></div></div>`).join("")}
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
    <div class="name">${name}</div>
    <div class="price">Rp ${product.priceIndividual.toLocaleString("id-ID")} / ${product.unit}</div>
    <div class="bc">${barcodeSvg}</div>
  </div>
</body></html>`;

  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}
