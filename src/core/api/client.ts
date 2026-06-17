import { startSpan, inject, headersCarrier } from 'observe-js';
import { API_BASE_URL } from '@/core/config';
import { logToObserver } from '@/core/observe/config';

const TOKEN_KEY = 'mind_auth_token';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);

  const baseHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  };

  let headers: HeadersInit = baseHeaders;
  if (logToObserver) {
    const traced = new Headers(baseHeaders);
    inject(headersCarrier(traced), startSpan());
    headers = traced;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const m = body?.message;
    const msg = Array.isArray(m) ? m.join(', ') : (m ?? 'Request failed');

    if (res.status === 401 && token) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.assign('/login');
      return new Promise<T>(() => {});
    }

    throw new ApiError(res.status, msg);
  }

  return res.json() as Promise<T>;
}
