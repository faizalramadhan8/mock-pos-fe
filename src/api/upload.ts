import { api } from './client';

export const uploadApi = {
  uploadImage: (file: File, type: 'products' | 'payment-proof' = 'products') => {
    const formData = new FormData();
    formData.append('file', file);
    return api.upload<{ url: string; filename: string }>(`/upload/?type=${type}`, formData);
  },
};
