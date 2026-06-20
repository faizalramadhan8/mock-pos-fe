import { api } from './client';

export interface ProductRes {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  name_id: string;
  category_id: string;
  category?: { id: string; name: string; name_id: string; icon?: string; color?: string };
  supplier_id?: string | null;
  supplier?: { id: string; name: string; phone?: string; email?: string; address?: string };
  purchase_price: number;
  selling_price: number;
  member_price?: number;
  qty_per_box: number;
  stock: number;
  unit: string;
  image?: string;
  min_stock: number;
  is_active: boolean;
  is_redeemable?: boolean;
  price_tiers?: ProductPriceTierRes[];
  created_at: string;
}

export interface ProductPriceTierMemberRefRes {
  id: string;
  name: string;
  phone: string;
}

export interface ProductPriceTierRes {
  id: string;
  product_id: string;
  min_qty: number;
  price: number;
  target_type: 'all_customers' | 'member_specific';
  members?: ProductPriceTierMemberRefRes[];
  note?: string;
  created_at: string;
}

export interface CategoryRes {
  id: string;
  name: string;
  name_id: string;
  icon?: string;
  color?: string;
}

export interface SupplierRes {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  created_at: string;
}

export interface ProductPriceTierHistoryRes {
  id: string;
  tier_id: string;
  product_id: string;
  min_qty: number;
  price: number;
  target_type: 'all_customers' | 'member_specific';
  member_ids?: string[];
  note?: string;
  status: 'active' | 'inactive';
  action: 'create' | 'update' | 'delete';
  start_date: string;
  end_date?: string | null;
  changed_by?: string | null;
  created_at: string;
}

export interface ProductPriceHistoryRes {
  id: string;
  product_id: string;
  price_type: 'regular' | 'member' | 'purchase';
  price: number;
  status: 'active' | 'inactive';
  start_date: string;
  end_date?: string | null;
  changed_by?: string | null;
  note?: string;
  created_at: string;
}

export const productApi = {
  getAll: (params?: { search?: string; category_id?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.category_id) q.set('category_id', params.category_id);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api.get<ProductRes[]>(`/products/${qs ? '?' + qs : ''}`);
  },

  getById: (id: string) => api.get<ProductRes>(`/products/${id}`),

  getBySku: (sku: string) => api.get<ProductRes>(`/products/sku/${sku}`),

  getLowStock: () => api.get<ProductRes[]>('/products/low-stock'),

  // Auto-gen SKU next number untuk prefix tertentu. BE aware soft-deleted
  // SKUs supaya tidak collide dengan tombstone rows.
  getNextSku: (prefix: string) =>
    api.get<{ sku: string }>(`/products/next-sku?prefix=${encodeURIComponent(prefix)}`),

  create: (data: {
    sku: string;
    barcode?: string;
    name: string;
    name_id?: string;
    category_id: string;
    supplier_id?: string | null;
    purchase_price: number;
    selling_price: number;
    member_price?: number | null;
    qty_per_box?: number;
    stock?: number;
    unit: string;
    image?: string;
    min_stock?: number;
  }) => api.post<ProductRes>('/products/', data),

  update: (id: string, data: Partial<{
    name: string;
    name_id: string;
    sku: string;
    barcode: string;
    category_id: string;
    supplier_id: string;
    purchase_price: number;
    selling_price: number;
    member_price: number | null;
    qty_per_box: number;
    unit: string;
    image: string;
    min_stock: number;
    stock: number;
  }>) => api.put<ProductRes>(`/products/${id}`, data),

  adjustStock: (id: string, delta: number) =>
    api.patch<ProductRes>(`/products/${id}/stock`, { delta }),

  toggleActive: (id: string) => api.patch<ProductRes>(`/products/${id}/toggle-active`),

  setRedeemable: (id: string, redeemable: boolean) =>
    api.patch<ProductRes>(`/products/${id}/redeemable`, { is_redeemable: redeemable }),

  // Price tiers — admin curate per produk.
  listTiers: (productId: string) =>
    api.get<ProductPriceTierRes[]>(`/products/${productId}/tiers`),

  createTier: (productId: string, data: {
    min_qty: number;
    price: number;
    target_type: 'all_customers' | 'member_specific';
    member_ids?: string[];
    note?: string;
  }) => api.post<ProductPriceTierRes>(`/products/${productId}/tiers`, data),

  updateTier: (productId: string, tierId: string, data: {
    min_qty: number;
    price: number;
    target_type: 'all_customers' | 'member_specific';
    member_ids?: string[];
    note?: string;
  }) => api.put<ProductPriceTierRes>(`/products/${productId}/tiers/${tierId}`, data),

  deleteTier: (productId: string, tierId: string) =>
    api.del(`/products/${productId}/tiers/${tierId}`),

  // Audit trail untuk tier CRUD (create/update/delete). Admin-only di BE.
  getTierHistory: (productId: string) =>
    api.get<ProductPriceTierHistoryRes[]>(`/products/${productId}/tier-history`),

  delete: (id: string) => api.del(`/products/${id}`),

  getPriceHistory: (id: string, priceType?: 'regular' | 'member' | 'purchase') => {
    const qs = priceType ? `?price_type=${priceType}` : '';
    return api.get<ProductPriceHistoryRes[]>(`/products/${id}/price-history${qs}`);
  },
};

export const categoryApi = {
  getAll: () => api.get<CategoryRes[]>('/categories/'),

  create: (data: { name: string; name_id?: string; icon?: string; color?: string }) =>
    api.post<CategoryRes>('/categories/', data),

  update: (id: string, data: { name?: string; name_id?: string; icon?: string; color?: string }) =>
    api.put<CategoryRes>(`/categories/${id}`, data),

  delete: (id: string) => api.del(`/categories/${id}`),
};

export const supplierApi = {
  getAll: (params?: { search?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api.get<SupplierRes[]>(`/suppliers/${qs ? '?' + qs : ''}`);
  },

  getById: (id: string) => api.get<SupplierRes>(`/suppliers/${id}`),

  create: (data: { name: string; phone?: string; email?: string; address?: string }) =>
    api.post<SupplierRes>('/suppliers/', data),

  update: (id: string, data: { name?: string; phone?: string; email?: string; address?: string }) =>
    api.put<SupplierRes>(`/suppliers/${id}`, data),

  delete: (id: string) => api.del(`/suppliers/${id}`),
};
