import { api, setToken, getDeviceFingerprint } from './client';

export interface LoginRes {
  access_token: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    fullname: string;
    phone?: string;
    role: string;
    nik?: string;
    date_of_birth?: string;
    is_active: boolean;
    initials: string;
    created_at: string;
  };
}

export interface DevicePendingRes {
  device_id: string;
  fingerprint: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface DeviceStatusRes {
  status: 'pending' | 'approved' | 'rejected' | 'unknown';
  fingerprint: string;
}

export interface UserRes {
  id: string;
  email: string;
  fullname: string;
  phone?: string;
  role: string;
  nik?: string;
  date_of_birth?: string;
  is_active: boolean;
  initials: string;
  created_at: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginRes | DevicePendingRes>('/auth/login', {
      email,
      password,
      device_fingerprint: getDeviceFingerprint(),
    }),

  deviceStatus: (email: string) =>
    api.get<DeviceStatusRes>(
      `/auth/devices/status?email=${encodeURIComponent(email)}&fingerprint=${encodeURIComponent(getDeviceFingerprint())}`,
    ),

  register: (data: {
    email: string;
    password: string;
    fullname: string;
    phone?: string;
    role?: string;
    nik?: string;
    date_of_birth?: string;
  }) => api.post<{ id: string }>('/auth/register', data),

  getSession: () => api.get<{ id: string; fullname: string; role: string; email: string; is_active: boolean }>('/auth/session'),

  logout: () => api.post('/auth/logout').finally(() => setToken(null)),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
};

export const userApi = {
  getAll: () => api.get<UserRes[]>('/users/'),

  create: (data: {
    email: string;
    password: string;
    fullname: string;
    phone?: string;
    role?: string;
    nik?: string;
    date_of_birth?: string;
  }) => api.post<UserRes>('/users/', data),

  update: (id: string, data: {
    fullname?: string;
    phone?: string;
    role?: string;
    nik?: string;
    date_of_birth?: string;
  }) => api.put<UserRes>(`/users/${id}`, data),

  toggleActive: (id: string) => api.patch<UserRes>(`/users/${id}/toggle-active`),

  resetPassword: (id: string, newPassword: string) =>
    api.post(`/users/${id}/reset-password`, { new_password: newPassword }),

  delete: (id: string) => api.del(`/users/${id}`),
};
