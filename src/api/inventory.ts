import { api } from './client';

export interface MovementRes {
  id: string;
  product_id: string;
  type: string;
  quantity: number;
  unit_type: string;
  unit_price: number;
  note?: string;
  expiry_date?: string;
  supplier_id?: string;
  payment_terms?: string;
  due_date?: string;
  payment_status?: string;
  created_by: string;
  created_at: string;
}

export interface BatchRes {
  id: string;
  product_id: string;
  product?: { id: string; sku: string; name: string };
  quantity: number;
  expiry_date?: string;
  received_at: string;
  note?: string;
  batch_number: string;
}

export const movementApi = {
  getAll: (params?: { type?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.type) q.set('type', params.type);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api.get<MovementRes[]>(`/inventory/movements${qs ? '?' + qs : ''}`);
  },

  create: (data: {
    product_id: string;
    type: string;
    quantity: number;
    unit_type?: string;
    unit_price?: number;
    note?: string;
    expiry_date?: string;
    supplier_id?: string;
    payment_terms?: string;
    due_date?: string;
    payment_status?: string;
    batch_number?: string;
  }) => api.post<MovementRes>('/inventory/movements', data),

  updatePaymentStatus: (id: string, status: string) =>
    api.patch<MovementRes>(`/inventory/movements/${id}/payment-status`, { payment_status: status }),
};

export const batchApi = {
  getAll: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api.get<BatchRes[]>(`/inventory/batches${qs ? '?' + qs : ''}`);
  },

  getExpiring: (days?: number) =>
    api.get<BatchRes[]>(`/inventory/batches/expiring${days ? '?days=' + days : ''}`),

  consumeFifo: (productId: string, quantity: number) =>
    api.post('/inventory/batches/consume-fifo', { product_id: productId, quantity }),
};
