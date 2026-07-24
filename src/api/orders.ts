import { api } from './client';

export interface OrderItemRes {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_type: string;
  unit_price: number;
  purchase_price?: number;
  regular_price?: number;
  discount_type?: string;
  discount_value?: number;
  discount_amount?: number;
  redeemed_with_points?: boolean;
}

export interface OrderPaymentRes {
  id: string;
  method: string;
  amount: number;
}

export interface OrderRes {
  id: string;
  items: OrderItemRes[];
  payments?: OrderPaymentRes[];
  subtotal: number;
  ppn_rate: number;
  ppn: number;
  total: number;
  payment: string;
  status: string;
  customer?: string;
  customer_phone?: string;
  member_id?: string;
  member?: { id: string; name: string; phone: string };
  member_savings?: number;
  payment_proof?: string;
  order_discount_type?: string;
  order_discount_value?: number;
  order_discount?: number;
  points_used?: number;
  points_earned?: number;
  created_by: string;
  created_at: string;
  // Payment edit audit (migration 000045). NULL = never edited.
  payments_edited_at?: string;
  payments_edited_by?: string;
  payments_edited_reason?: string;
  // Order source (migration 000047): 'pos' (default) or 'ecom'.
  order_source?: string;
}

export interface AggregateTopProduct {
  product_id: string;
  name: string;
  qty: number;
  revenue: number;
  avg_price: number;
}

export interface AggregateMember {
  member_id: string;
  name: string;
  phone?: string;
  orders: number;
  spend: number;
  savings: number;
  last_visit?: string;
}

export interface AggregatePaymentBreakdown {
  method: string;
  count: number;
  total: number;
}

export interface AggregateCashier {
  cashier_id: string;
  name: string;
  orders: number;
  revenue: number;
  payment_breakdown: AggregatePaymentBreakdown[];
}

export interface OrderAggregateResponse {
  from: string;
  to: string;
  total_orders: number;
  total_revenue: number;
  total_qty: number;
  total_member_saving: number;
  top_products: AggregateTopProduct[];
  members: AggregateMember[];
  payment_breakdown: AggregatePaymentBreakdown[];
  per_cashier: AggregateCashier[];
}

export interface RefundItemReq {
  product_id: string;
  name: string;
  quantity: number;
  unit_type?: string;
  unit_price: number;
  refund_amount: number;
}

export interface RefundRes {
  id: string;
  order_id: string;
  items: { id: string; product_id: string; name: string; quantity: number; unit_type: string; unit_price: number; refund_amount: number }[];
  amount: number;
  reason?: string;
  created_by: string;
  created_at: string;
}

export const orderApi = {
  getAll: (params?: { status?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api.get<OrderRes[]>(`/orders/${qs ? '?' + qs : ''}`);
  },

  getById: (id: string) => api.get<OrderRes>(`/orders/${id}`),

  getStats: () => api.get<{ revenue: number; order_count: number }>('/orders/stats'),

  aggregate: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const qs = q.toString();
    return api.get<OrderAggregateResponse>(`/orders/aggregate${qs ? '?' + qs : ''}`);
  },

  create: (data: {
    items: {
      product_id: string;
      name: string;
      quantity: number;
      unit_type?: string;
      unit_price: number;
      regular_price?: number;
      discount_type?: string;
      discount_value?: number;
      discount_amount?: number;
      redeem_with_points?: boolean;
    }[];
    subtotal: number;
    ppn_rate: number;
    ppn: number;
    total: number;
    payment: string;
    payments?: { method: string; amount: number }[];
    customer?: string;
    customer_phone?: string;
    member_id?: string;
    payment_proof?: string;
    order_discount_type?: string;
    order_discount_value?: number;
    order_discount?: number;
    /** Idempotency key — UUID per checkout attempt. BE cache 5 menit. */
    client_request_id?: string;
  }) => api.post<OrderRes>('/orders/', data),

  cancel: (id: string) => api.patch<OrderRes>(`/orders/${id}/cancel`),

  resendWA: (id: string) => api.post<null>(`/orders/${id}/send-wa`, {}),

  // Pending order flow — customer pesan online, bayar belakangan.
  createPending: (data: {
    items: {
      product_id: string; name: string; quantity: number; unit_type?: string;
      unit_price: number; regular_price?: number;
      discount_type?: string; discount_value?: number; discount_amount?: number;
      redeem_with_points?: boolean;
    }[];
    subtotal: number;
    ppn_rate: number;
    ppn: number;
    total: number;
    customer?: string;
    customer_phone: string;
    member_id?: string;
    order_discount_type?: string;
    order_discount_value?: number;
    order_discount?: number;
    bank_account_id?: string;
  }) => api.post<OrderRes>('/orders/pending', data),

  markAsPaid: (id: string, payments: { method: string; amount: number }[]) =>
    api.post<OrderRes>(`/orders/${id}/mark-paid`, { payments }),

  cancelPending: (id: string) => api.post<null>(`/orders/${id}/cancel-pending`, {}),

  resendInvoice: (id: string, bankAccountId?: string) => {
    const q = bankAccountId ? `?bank_account_id=${encodeURIComponent(bankAccountId)}` : "";
    return api.post<null>(`/orders/${id}/resend-invoice${q}`, {});
  },

  // Admin/superadmin ubah metode pembayaran order completed (Bu Santi 12 Jul 2026).
  // Sum(payments.amount) HARUS = order.total. Reason mandatory untuk audit.
  editPayments: (id: string, payments: { method: string; amount: number }[], reason: string) =>
    api.patch<OrderRes>(`/orders/${id}/payments`, { payments, reason }),
};

export const refundApi = {
  create: (data: {
    order_id: string;
    items: RefundItemReq[];
    amount: number;
    reason?: string;
  }) => api.post<RefundRes>('/refunds/', data),

  getByOrderId: (orderId: string) => api.get<RefundRes[]>(`/refunds/order/${orderId}`),
};
