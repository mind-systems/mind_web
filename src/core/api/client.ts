import { API_BASE_URL } from '@/core/config';

const TOKEN_KEY = 'mind_auth_token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const m = body?.message;
    const msg = Array.isArray(m) ? m.join(', ') : (m ?? 'Request failed');

    if (res.status === 401 && token) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.assign('/login');
    }

    throw new ApiError(res.status, msg);
  }

  return res.json() as Promise<T>;
}
