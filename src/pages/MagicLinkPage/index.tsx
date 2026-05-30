import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch, ApiError } from '@/core/api/client';
import { useAuth } from '@/core/auth/AuthContext';
import type { AuthResponse } from '@/core/types';

type Status = 'verifying' | 'need-email' | 'error';

export function MagicLinkPage() {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  const [status, setStatus] = useState<Status>(() => {
    if (!code) return 'error';
    if (auth.pendingEmail) return 'verifying';
    return 'need-email';
  });
  const [error, setError] = useState<string | null>(
    !code ? 'Invalid or missing magic link.' : null,
  );
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);

  const verify = useCallback(
    async (email: string, verifyCode: string) => {
      const res = await apiFetch<AuthResponse>('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ email, code: verifyCode }),
      });
      auth.clearPendingEmail();
      auth.login(res.accessToken);
    },
    [auth],
  );

  const didVerify = useRef(false);

  // Auto-verify on mount when both code and pendingEmail are available.
  useEffect(() => {
    if (didVerify.current || !code || !auth.pendingEmail) return;
    didVerify.current = true;
    verify(auth.pendingEmail, code).catch(err => {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setStatus('error');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code) return;
    setError(null);
    setLoading(true);
    try {
      await verify(emailInput.trim(), code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'verifying') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
        <div className="flex w-full max-w-[400px] flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-md">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-600">Verifying magic link…</p>
        </div>
      </div>
    );
  }

  if (status === 'need-email') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-[400px] rounded-2xl bg-white p-8 shadow-md">
          <form onSubmit={handleSubmit} noValidate>
            <h1 className="mb-2 text-xl font-semibold text-gray-900">Confirm your email</h1>
            <p className="mb-6 text-sm text-gray-500">
              Enter the email address you used to request this magic link.
            </p>

            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              disabled={loading}
              placeholder="you@example.com"
            />

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || !emailInput.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-[400px] rounded-2xl bg-white p-8 shadow-md text-center">
        <p className="mb-4 text-sm text-red-600">{error ?? 'Something went wrong.'}</p>
        <Link to="/login" className="text-sm text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
