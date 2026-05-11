import { api } from './client';

export interface ExpenseCategoryRes {
  id: string;
  name: string;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface ExpenseRes {
  id: string;
  category_id: string;
  category?: ExpenseCategoryRes;
  expense_date: string;
  description: string;
  amount: number;
  employee_name?: string;
  payment_method: string;
  note?: string;
  created_by: string;
  created_at: string;
}

export interface CreateExpenseBody {
  category_id: string;
  expense_date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  employee_name?: string;
  payment_method?: 'cash' | 'transfer' | 'qris';
  note?: string;
}

export interface ExpenseCategoryBreakdownRes {
  category_id: string;
  category_name: string;
  total: number;
  count: number;
}

export interface ProfitLossRes {
  from: string;
  to: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  expense_total: number;
  expense_breakdown: ExpenseCategoryBreakdownRes[];
  net_profit: number;
  total_orders: number;
  // Cash flow (view cash basis, beda dari net_profit yang accrual).
  supplier_paid: number;     // faktur yang lunas di periode
  supplier_unpaid: number;   // faktur tempo blm lunas (info)
  cash_out_total: number;    // supplier_paid + expense_total
  cash_diff: number;         // revenue - cash_out_total
}

export const expenseApi = {
  list: (params?: { from?: string; to?: string; category_id?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.category_id) q.set('category_id', params.category_id);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api.get<ExpenseRes[]>(`/expenses/${qs ? '?' + qs : ''}`);
  },

  create: (data: CreateExpenseBody) => api.post<ExpenseRes>('/expenses/', data),

  update: (id: string, data: CreateExpenseBody) => api.put<ExpenseRes>(`/expenses/${id}`, data),

  delete: (id: string) => api.del<null>(`/expenses/${id}`),

  listCategories: (includeInactive = false) =>
    api.get<ExpenseCategoryRes[]>(`/expenses/categories${includeInactive ? '?include_inactive=true' : ''}`),

  createCategory: (name: string) => api.post<ExpenseCategoryRes>('/expenses/categories', { name }),

  updateCategory: (id: string, data: { name: string; is_active?: boolean }) =>
    api.put<ExpenseCategoryRes>(`/expenses/categories/${id}`, data),

  profitLoss: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const qs = q.toString();
    return api.get<ProfitLossRes>(`/expenses/profit-loss${qs ? '?' + qs : ''}`);
  },
};
