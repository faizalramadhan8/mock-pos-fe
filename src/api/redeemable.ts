import { api } from './client';

export interface RedeemableItemRes {
  id: string;
  name: string;
  description?: string;
  image?: string;
  points_cost: number;
  stock: number;
  redeemed: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const redeemableApi = {
  getAll: () => api.get<RedeemableItemRes[]>('/redeemable-items/'),
  getActive: () => api.get<RedeemableItemRes[]>('/redeemable-items/active'),
  create: (data: {
    name: string;
    description?: string;
    image?: string;
    points_cost: number;
    stock: number;
    is_active?: boolean;
  }) => api.post<RedeemableItemRes>('/redeemable-items/', data),
  update: (id: string, data: {
    name: string;
    description?: string;
    image?: string;
    points_cost: number;
    stock: number;
    is_active?: boolean;
  }) => api.put<RedeemableItemRes>(`/redeemable-items/${id}`, data),
  delete: (id: string) => api.del(`/redeemable-items/${id}`),
};
