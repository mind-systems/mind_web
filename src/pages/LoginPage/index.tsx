import { type FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, ApiError } from '@/core/api/client';
import { useAuth } from '@/core/auth/AuthContext';
import { createOAuthState } from '@/core/auth/oauthState';
import { API_BASE_URL } from '@/core/config';
import type { AuthResponse } from '@/core/types';

type Step = 'email' | 'code';

export function LoginPage() {
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    searchParams.get('error') === 'google'
      ? 'Google sign-in failed. Please try again.'
      : null,
  );

  // Clear the ?error=google param from the URL once on mount
  useEffect(() => {
    if (searchParams.get('error') === 'google') {
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  function handleGoogleSignIn() {
    const state = createOAuthState();
    window.location.href = `${API_BASE_URL}/auth/google?state=${encodeURIComponent(state)}`;
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-[400px] rounded-2xl bg-white p-8 shadow-md">
        {step === 'email' ? (
          <>
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

            <div className="relative my-5 flex items-center">
              <div className="flex-grow border-t border-gray-200" />
              <span className="mx-3 text-xs text-gray-400">or</span>
              <div className="flex-grow border-t border-gray-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </>
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
