import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

const TOKEN_KEY = 'mind_auth_token';
const PENDING_EMAIL_KEY = 'mind_pending_email';

export interface AuthContextValue {
  token: string | null;
  login(token: string): void;
  logout(): void;
  pendingEmail: string | null;
  setPendingEmail(email: string): void;
  clearPendingEmail(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [pendingEmail, setPendingEmailState] = useState<string | null>(() =>
    localStorage.getItem(PENDING_EMAIL_KEY),
  );

  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY) setToken(event.newValue);
      if (event.key === PENDING_EMAIL_KEY) setPendingEmailState(event.newValue);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const login = useCallback(
    (tok: string) => {
      localStorage.setItem(TOKEN_KEY, tok);
      setToken(tok);
      // Do not clear pendingEmail here — magic-link flow clears it explicitly via clearPendingEmail().
      navigate('/sessions', { replace: true });
    },
    [navigate],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const setPendingEmail = useCallback((email: string) => {
    localStorage.setItem(PENDING_EMAIL_KEY, email);
    setPendingEmailState(email);
  }, []);

  const clearPendingEmail = useCallback(() => {
    localStorage.removeItem(PENDING_EMAIL_KEY);
    setPendingEmailState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ token, login, logout, pendingEmail, setPendingEmail, clearPendingEmail }),
    [token, pendingEmail, login, logout, setPendingEmail, clearPendingEmail],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
