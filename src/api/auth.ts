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

  deviceApprove: (token: string) =>
    api.get<{ status: 'approved' | 'rejected'; user_name: string }>(
      `/auth/devices/approve?t=${encodeURIComponent(token)}`,
    ),

  deviceReject: (token: string) =>
    api.get<{ status: 'approved' | 'rejected'; user_name: string }>(
      `/auth/devices/reject?t=${encodeURIComponent(token)}`,
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

  // Public customer register — force role='user' di BE. Auto-login setelah
  // register (BE return access_token). Bu Santi 21 Jul 2026.
  registerCustomer: (data: {
    fullname: string;
    email: string;
    phone: string;
    password: string;
  }) => api.post<LoginRes>('/auth/register-customer', data),

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

// Emergency device management (superadmin/admin). Dipakai saat WAHA down atau
// kasir tidak bisa akses link approve — Bu Santi setujui manual via Settings.
export interface DeviceRes {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  name?: string;
  user_agent?: string;
  approved_at?: string;
  last_used_at?: string;
  created_at: string;
}

export const deviceApi = {
  listByUser: (userId: string) => api.get<DeviceRes[]>(`/users/${userId}/devices`),
  emergencyApprove: (userId: string, deviceId: string) =>
    api.post(`/users/${userId}/devices/${deviceId}/approve`),
  revoke: (userId: string, deviceId: string) =>
    api.del(`/users/${userId}/devices/${deviceId}`),
};
