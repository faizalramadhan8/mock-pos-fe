import { api } from './client';

export type CapitalType = 'injection' | 'drawing';

export interface CapitalInjectionRes {
  id: string;
  amount: number;
  type: CapitalType;
  source?: string;
  note?: string;
  injected_at: string;
  created_by?: string | null;
  created_at: string;
}

interface CapitalBody {
  amount: number;
  type?: CapitalType;
  source?: string;
  note?: string;
  injected_at: string;
}

export const capitalApi = {
  list: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return api.get<CapitalInjectionRes[]>(`/capital-injections/${qs ? '?' + qs : ''}`);
  },
  create: (data: CapitalBody) => api.post<CapitalInjectionRes>('/capital-injections/', data),
  update: (id: string, data: CapitalBody) => api.put<CapitalInjectionRes>(`/capital-injections/${id}`, data),
  delete: (id: string) => api.del(`/capital-injections/${id}`),
};
