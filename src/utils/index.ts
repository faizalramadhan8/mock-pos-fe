import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Order } from "@/types";

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

export function printReceipt(order: Order) {
  const settings = JSON.parse(localStorage.getItem("bakeshop-settings") || "{}");
  const name = settings?.state?.storeName || "BakeShop";
  const addr = settings?.state?.storeAddress || "";
  const phone = settings?.state?.storePhone || "";

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
  @media print{body{width:100%}}
</style></head><body>
  <div class="c"><h2>${name}</h2>${addr ? `<p>${addr}</p>` : ""}${phone ? `<p>${phone}</p>` : ""}</div>
  <div class="ln"></div>
  <div class="r"><span>${order.id}</span><span>${new Date(order.createdAt).toLocaleString("id-ID")}</span></div>
  <div class="r"><span>Customer</span><span>${order.customer}</span></div>
  <div class="ln"></div>
  ${order.items.map(i => `<div><p>${i.name}</p><div class="r"><span>${i.quantity} x Rp ${i.unitPrice.toLocaleString("id-ID")}</span><span class="b">Rp ${(i.quantity * i.unitPrice).toLocaleString("id-ID")}</span></div></div>`).join("")}
  <div class="ln"></div>
  <div class="r b"><span>TOTAL</span><span>Rp ${order.total.toLocaleString("id-ID")}</span></div>
  <div class="r"><span>Payment</span><span>${order.payment.toUpperCase()}</span></div>
  <div class="ln"></div>
  <p class="c">Thank you for your purchase!</p>
</body></html>`;

  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}
