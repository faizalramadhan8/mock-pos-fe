import { api } from './client';

export interface OpeningBalanceRes {
  id: string;
  year: number;
  month: number;
  balance: number;
  note?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const cashbookApi = {
  // GET — body bisa null kalau belum di-set untuk periode ini (FE treat → 0)
  getOpening: (year: number, month: number) =>
    api.get<OpeningBalanceRes | null>(`/cashbook/opening?year=${year}&month=${month}`),

  setOpening: (data: { year: number; month: number; balance: number; note?: string }) =>
    api.post<OpeningBalanceRes>('/cashbook/opening', data),

  listOpening: () => api.get<OpeningBalanceRes[]>('/cashbook/opening/all'),
};
