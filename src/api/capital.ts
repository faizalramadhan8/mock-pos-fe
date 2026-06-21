import { api } from './client';

export interface CapitalInjectionRes {
  id: string;
  amount: number;
  source?: string;
  note?: string;
  injected_at: string;
  created_by?: string | null;
  created_at: string;
}

export const capitalApi = {
  list: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return api.get<CapitalInjectionRes[]>(`/capital-injections/${qs ? '?' + qs : ''}`);
  },
  create: (data: { amount: number; source?: string; note?: string; injected_at: string }) =>
    api.post<CapitalInjectionRes>('/capital-injections/', data),
  update: (id: string, data: { amount: number; source?: string; note?: string; injected_at: string }) =>
    api.put<CapitalInjectionRes>(`/capital-injections/${id}`, data),
  delete: (id: string) => api.del(`/capital-injections/${id}`),
};
