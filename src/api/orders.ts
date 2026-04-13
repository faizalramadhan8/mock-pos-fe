import { api } from './client';

export interface OrderItemRes {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_type: string;
  unit_price: number;
  regular_price?: number;
  discount_type?: string;
  discount_value?: number;
  discount_amount?: number;
}

export interface OrderRes {
  id: string;
  items: OrderItemRes[];
  subtotal: number;
  ppn_rate: number;
  ppn: number;
  total: number;
  payment: string;
  status: string;
  customer?: string;
  member_id?: string;
  member?: { id: string; name: string; phone: string };
  member_savings?: number;
  payment_proof?: string;
  order_discount_type?: string;
  order_discount_value?: number;
  order_discount?: number;
  created_by: string;
  created_at: string;
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
    }[];
    subtotal: number;
    ppn_rate: number;
    ppn: number;
    total: number;
    payment: string;
    customer?: string;
    member_id?: string;
    payment_proof?: string;
    order_discount_type?: string;
    order_discount_value?: number;
    order_discount?: number;
  }) => api.post<OrderRes>('/orders/', data),

  cancel: (id: string) => api.patch<OrderRes>(`/orders/${id}/cancel`),
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
