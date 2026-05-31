import { api } from './client';
import type { SupplierRes } from './products';

export type PaymentTermsValue = "COD" | "NET7" | "NET14" | "NET21" | "NET30" | "NET60" | "NET90";
export type PaymentStatusValue = "paid" | "unpaid";

export interface PurchaseInvoiceItemRes {
  id: string;
  purchase_invoice_id: string;
  product_id: string;
  product?: { id: string; sku: string; name: string };
  quantity: number;
  unit_type: string;
  unit_price: number;
  expiry_date?: string;
  batch_id?: string;
  movement_id?: string;
  note?: string;
}

export interface PurchaseInvoiceRes {
  id: string;
  invoice_number?: string;
  supplier_id: string;
  supplier?: SupplierRes;
  invoice_date: string;
  due_date?: string;
  payment_terms: PaymentTermsValue;
  payment_status: PaymentStatusValue;
  paid_at?: string;
  subtotal_amount: number;
  ppn_amount: number;
  total_amount: number;
  reminder_sent_at?: string;
  note?: string;
  created_by: string;
  created_at: string;
  items: PurchaseInvoiceItemRes[];
}

export interface CreatePurchaseInvoiceItem {
  product_id: string;
  quantity: number;
  unit_type?: "box" | "individual";
  unit_price: number; // per-individual unit
  expiry_date?: string; // YYYY-MM-DD
  note?: string;
}

export interface CreatePurchaseInvoiceBody {
  invoice_number?: string;
  supplier_id: string;
  invoice_date?: string; // YYYY-MM-DD
  payment_terms: PaymentTermsValue;
  due_date?: string;
  subtotal_amount: number;
  ppn_amount: number;
  total_amount: number;
  note?: string;
  items: CreatePurchaseInvoiceItem[];
}

export const purchaseInvoiceApi = {
  getAll: (params?: {
    status?: PaymentStatusValue | "all";
    supplier_id?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.status && params.status !== "all") q.set("status", params.status);
    if (params?.supplier_id) q.set("supplier_id", params.supplier_id);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return api.get<PurchaseInvoiceRes[]>(`/purchase-invoices/${qs ? "?" + qs : ""}`);
  },

  getById: (id: string) => api.get<PurchaseInvoiceRes>(`/purchase-invoices/${id}`),

  create: (data: CreatePurchaseInvoiceBody) =>
    api.post<PurchaseInvoiceRes>("/purchase-invoices/", data),

  // Full replace edit — body sama dengan create. BE handle: update header
  // + delete all old items + insert new items. Pure record, no stock impact.
  update: (id: string, data: CreatePurchaseInvoiceBody) =>
    api.put<PurchaseInvoiceRes>(`/purchase-invoices/${id}`, data),

  markPaid: (id: string) =>
    api.post<PurchaseInvoiceRes>(`/purchase-invoices/${id}/mark-paid`, {}),

  delete: (id: string) => api.del(`/purchase-invoices/${id}`),
};
