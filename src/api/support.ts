import { api } from './client';

export interface MemberRes {
  id: string;
  name: string;
  phone: string;
  address?: string;
  member_number?: string;
  created_at: string;
}

export interface CashSessionRes {
  id: string;
  date: string;
  opening_cash: number;
  opened_by: string;
  opened_at: string;
  expected_cash: number;
  actual_cash: number;
  difference: number;
  notes?: string;
  closed_by?: string;
  closed_at?: string;
}

export interface AuditRes {
  id: string;
  action: string;
  user_id: string;
  user_name: string;
  details?: string;
  created_at: string;
}

export interface SettingsRes {
  id: string;
  store_name: string;
  store_address?: string;
  store_phone?: string;
  ppn_rate: number;
  label_width: number;
  label_height: number;
  bank_accounts: { id: string; bank_name: string; account_number: string; account_holder: string }[];
}

export interface DashboardRes {
  revenue: number;
  order_count: number;
  product_count: number;
  low_stock_count: number;
  recent_orders?: any[];
  low_stock_items?: any[];
  expiring_batches?: any[];
}

export interface MemberStatsRes {
  member_id: string;
  from: string;
  to: string;
  total_spend: number;
  order_count: number;
  avg_basket: number;
  total_savings: number;
  last_visit?: string;
  lifetime_spend: number;
  lifetime_orders: number;
  monthly_breakdown: { month: string; spend: number; orders: number; savings: number }[];
  top_products: { product_id: string; name: string; quantity: number; spend: number }[];
}

export const memberApi = {
  getAll: (params?: { search?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api.get<MemberRes[]>(`/members/${qs ? '?' + qs : ''}`);
  },

  searchByPhone: (phone: string) => api.get<MemberRes>(`/members/search?phone=${phone}`),

  getStats: (id: string, params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const qs = q.toString();
    return api.get<MemberStatsRes>(`/members/${id}/stats${qs ? '?' + qs : ''}`);
  },

  create: (data: { name: string; phone: string; address?: string; member_number?: string }) =>
    api.post<MemberRes>('/members/', data),

  update: (id: string, data: { name?: string; phone?: string; address?: string; member_number?: string }) =>
    api.put<MemberRes>(`/members/${id}`, data),

  delete: (id: string) => api.del(`/members/${id}`),
};

export const cashSessionApi = {
  getAll: () => api.get<CashSessionRes[]>('/cash-sessions/'),

  getOpen: () => api.get<CashSessionRes>('/cash-sessions/open'),

  open: (data: { date: string; opening_cash: number; opened_by: string }) =>
    api.post<CashSessionRes>('/cash-sessions/', data),

  close: (id: string, data: {
    expected_cash: number;
    actual_cash: number;
    difference: number;
    notes?: string;
    closed_by: string;
  }) => api.patch<CashSessionRes>(`/cash-sessions/${id}/close`, data),
};

export const auditApi = {
  getAll: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api.get<AuditRes[]>(`/audit/${qs ? '?' + qs : ''}`);
  },

  create: (data: { action: string; user_id: string; user_name: string; details?: string }) =>
    api.post('/audit/', data),
};

export const settingsApi = {
  get: () => api.get<SettingsRes>('/settings/'),

  update: (data: { store_name?: string; store_address?: string; store_phone?: string; ppn_rate?: number; label_width?: number; label_height?: number }) =>
    api.put<SettingsRes>('/settings/', data),

  addBankAccount: (data: { bank_name: string; account_number: string; account_holder: string }) =>
    api.post<SettingsRes>('/settings/bank-accounts', data),

  deleteBankAccount: (id: string) => api.del<SettingsRes>(`/settings/bank-accounts/${id}`),
};

export const dashboardApi = {
  get: () => api.get<DashboardRes>('/dashboard/'),
};

export const pushApi = {
  getVapidKey: () => api.get<{ public_key: string }>('/push/vapid-key'),

  subscribe: (subscription: { endpoint: string; p256dh: string; auth: string }) =>
    api.post('/push/subscribe', subscription),

  unsubscribe: (endpoint: string) =>
    api.post('/push/unsubscribe', { endpoint }),
};
