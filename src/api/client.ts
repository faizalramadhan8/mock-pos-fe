const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:7889' : '');
const BASE = `${API_URL}/api/v1`;

const TOKEN_KEY = 'bakeshop-token';
const DEVICE_ID_KEY = 'bakeshop-device-id';
const LEGACY_REFRESH_KEY = 'bakeshop-refresh-token';

localStorage.removeItem(LEGACY_REFRESH_KEY);

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// Device fingerprint: random UUID generated once per browser profile,
// persisted in localStorage. Falls back to Math.random when crypto API
// is unavailable (very old browsers). Clearing localStorage → new id →
// owner must re-approve once.
export function getDeviceFingerprint(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export interface ApiRes<T = any> {
  code: number;
  message: string;
  body?: T;
  error?: any;
  meta?: { total: number; page: number; limit: number };
}

async function request<T = any>(method: string, path: string, body?: any, isFormData?: boolean): Promise<ApiRes<T>> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const data: ApiRes<T> = await res.json();

  if (!res.ok || data.code >= 400) {
    const msg = typeof data.error === 'string' ? data.error : data.message || 'Request failed';
    throw new Error(msg);
  }

  return data;
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body?: any) => request<T>('POST', path, body),
  put: <T = any>(path: string, body?: any) => request<T>('PUT', path, body),
  patch: <T = any>(path: string, body?: any) => request<T>('PATCH', path, body),
  del: <T = any>(path: string) => request<T>('DELETE', path),
  upload: <T = any>(path: string, formData: FormData) => request<T>('POST', path, formData, true),
};
