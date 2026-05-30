# Fix: Auth State Cleanup on Logout and 401

**Date:** 2026-05-30
**Source:** Code review — removed-behavior audit

## Key Findings

- `logout()` clears `mind_auth_token` but not `mind_pending_email` — a stale pending email can silently mismatch on the next magic-link visit
- `client.ts` throws `ApiError` after calling `window.location.assign('/login')`, causing callers' catch handlers to race with the hard navigation

## Fix 1 — logout() must clear pendingEmail

`src/core/auth/AuthContext.tsx`, `logout` callback (currently lines 48–52):

```typescript
// Before
const logout = useCallback(() => {
  localStorage.removeItem(TOKEN_KEY);
  setToken(null);
  navigate('/login', { replace: true });
}, [navigate]);

// After — inline both clears to avoid dependency ordering
const logout = useCallback(() => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PENDING_EMAIL_KEY);
  setToken(null);
  setPendingEmailState(null);
  navigate('/login', { replace: true });
}, [navigate]);
```

Inlining the two removals is simpler than adding `clearPendingEmail` as a dependency (which would require defining it before `logout`). The invariant: after any logout, both auth keys are gone from localStorage and React state.

**Why this matters:** If a user starts the OTP flow (`setPendingEmail('user@example.com')`) and then logs out without completing it, `mind_pending_email` stays in localStorage. The next visit to `/deeplink-auth?code=xxx` auto-verifies with the stale email → API returns an error → the user sees "Something went wrong" instead of the email input.

## Fix 2 — never throw after window.location.assign

`src/core/api/client.ts` (currently lines 31–36):

```typescript
// Before
if (res.status === 401 && token) {
  localStorage.removeItem(TOKEN_KEY);
  window.location.assign('/login');
}
throw new ApiError(res.status, msg);   // always thrown — callers' catch runs during navigation

// After
if (res.status === 401 && token) {
  localStorage.removeItem(TOKEN_KEY);
  window.location.assign('/login');
  return new Promise<T>(() => {});     // hangs the promise; page is navigating away
}
throw new ApiError(res.status, msg);
```

`return new Promise(() => {})` is the idiomatic way to abandon an async function without propagating an error — the pending promise is garbage-collected when the page unloads. Without this, `GoogleCallbackPage`'s `.catch(() => navigate('/login?error=google'))` fires while `window.location.assign('/login')` is also in progress: two racing navigations, with the `?error=google` parameter silently lost. In jsdom/test environments `window.location.assign` is a no-op, so without this fix the app is left with localStorage cleared but React `token` state still non-null.
