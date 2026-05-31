import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/core/api/client';
import { useAuth } from '@/core/auth/AuthContext';
import { consumeOAuthState } from '@/core/auth/oauthState';
import type { AuthResponse } from '@/core/types';

export function GoogleCallbackPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const didExchange = useRef(false);

  useEffect(() => {
    // Guard against React 18 StrictMode double-invocation.
    // The OAuth code is single-use, so a duplicate exchange call would fail.
    // State is also consumed here (one-time read) rather than outside the guard,
    // so the double-invoke in StrictMode does not consume it before the real call.
    if (didExchange.current) return;
    didExchange.current = true;

    // CSRF state validation: the value must match what was stored before the redirect.
    const returnedState = searchParams.get('state');
    const storedState = consumeOAuthState();
    if (!returnedState || !storedState || returnedState !== storedState) {
      navigate('/login?error=google', { replace: true });
      return;
    }

    const code = searchParams.get('googleCode');
    const error = searchParams.get('googleError');

    if (error || !code) {
      navigate('/login?error=google', { replace: true });
      return;
    }

    apiFetch<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        code,
        redirectUri: window.location.origin + '/auth/google/callback',
        state: returnedState,
      }),
    })
      .then(res => {
        auth.login(res.accessToken);
      })
      .catch(() => {
        navigate('/login?error=google', { replace: true });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-md">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm text-gray-600">Completing Google sign-in…</p>
      </div>
    </div>
  );
}
