const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7889';
const BASE = `${API_URL}/api/v1`;

const TOKEN_KEY = 'bakeshop-token';
const REFRESH_KEY = 'bakeshop-refresh-token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null, refreshToken?: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
  if (refreshToken !== undefined) {
    if (refreshToken) {
      localStorage.setItem(REFRESH_KEY, refreshToken);
    } else {
      localStorage.removeItem(REFRESH_KEY);
    }
  }
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
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
