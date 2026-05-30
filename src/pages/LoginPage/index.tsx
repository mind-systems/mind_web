import { type FormEvent, useState } from 'react';
import { apiFetch, ApiError } from '@/core/api/client';
import { useAuth } from '@/core/auth/AuthContext';
import type { AuthResponse } from '@/core/types';

type Step = 'email' | 'code';

export function LoginPage() {
  const auth = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      auth.setPendingEmail(email);
      setStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<AuthResponse>('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      auth.clearPendingEmail();
      auth.login(res.accessToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep('email');
    setCode('');
    setError(null);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-[400px] rounded-2xl bg-white p-8 shadow-md">
        {step === 'email' ? (
          <form onSubmit={handleSendCode} noValidate>
            <h1 className="mb-6 text-xl font-semibold text-gray-900">Sign in</h1>

            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              disabled={loading}
              placeholder="you@example.com"
            />

            {error && (
              <p className="mb-3 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              Send code
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} noValidate>
            <h1 className="mb-1 text-xl font-semibold text-gray-900">Check your email</h1>
            <p className="mb-6 text-sm text-gray-500">
              We sent a 6-digit code to <span className="font-medium text-gray-700">{email}</span>.
            </p>

            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="code">
              Code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              disabled={loading}
              placeholder="000000"
            />

            {error && (
              <p className="mb-3 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              Verify
            </button>

            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="mt-3 w-full text-center text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              Change email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
