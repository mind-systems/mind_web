# Plan: Login page: Google Sign-In

## Context
Add a "Continue with Google" button to `LoginPage` that hands the browser off to the API's Google OAuth flow, and implement `GoogleCallbackPage` to exchange the returned code for a JWT (or surface the OAuth error back on the login page).

## API contract (verified against mind_api)
The flow is **direct-to-web**, confirmed in `mind_api/src/auth/.../google-callback.controller.ts` + `mind_api/.env`:

- `GET /auth/google` (`startGoogleOAuth`) redirects the browser to Google with `redirect_uri = WEB_REDIRECT_URI`, which equals the **web app** origin (`http://localhost:5173/auth/google/callback` in dev; `web.dev.mind-awake.life` / `web.mind-awake.life` in deployed envs).
- After consent, **Google redirects the browser straight back to the web app** at `/auth/google/callback` with **standard OAuth params** `?code=<authcode>` (success) or `?error=<err>` (failure). The web client must read `code` / `error` — **not** `googleCode` / `googleError`.
- `googleCode` / `googleError` exist only inside the API's `GET /auth/google/callback` relay handler, which rewrites params and redirects to `APP_BASE_URL` (the **mobile deeplink** host). That relay is not part of the web flow — Google never hits the API callback for the web client.
- `POST /auth/google` strictly validates `dto.redirectUri === WEB_REDIRECT_URI` and 400s otherwise. `window.location.origin + '/auth/google/callback'` resolves to exactly `WEB_REDIRECT_URI`, so it matches. Returns `200` + `{ accessToken, user }`.

> **Coupled contract — do not split.** The param names (`code`/`error`) and the `redirectUri` value both assume the live direct-to-web topology. If `WEB_REDIRECT_URI` is ever repointed at the API host (reintroducing the relay), *both* would have to change together — the param names would become `googleCode`/`googleError` and the `redirectUri` would mismatch. Treat them as one contract.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Login page button + error surfacing

- [x] **Task 1: Add "Continue with Google" button to LoginPage**
  Files: `src/pages/LoginPage/index.tsx`
  In the email step of `LoginPage`, below the existing "Send code" form, add a visual divider ("or") and a full-width "Continue with Google" button with a Google `g` glyph (inline SVG) styled consistently with the existing card (white button, gray border, `rounded-lg`, matching padding/typography of the blue button).
  On click, redirect the browser to the API OAuth entry point: `window.location.href = \`${API_BASE_URL}/auth/google\`;` — import `API_BASE_URL` from `@/core/config`. This is a full-page navigation (the API responds with a redirect to Google), not an `apiFetch` call, so do not route it through the client wrapper — this is a deliberate, documented exception to the "single fetch point" rule (it is navigation, not `fetch`).
  Disable the Google button while the OTP request `loading` flag is active to avoid concurrent flows. Keep the button visible only on the `email` step (not the `code` step).

- [x] **Task 2: Surface `?error=google` on LoginPage**
  Files: `src/pages/LoginPage/index.tsx`
  Read the `error` query param using `useSearchParams` from `react-router-dom`. When it equals `google`, seed the `error` state with a user-facing message (e.g. "Google sign-in failed. Please try again.") via a **lazy `useState` initializer** (it may read `searchParams`, but must not call `setSearchParams` — no side effects during render).
  Clear the param from the URL in a **one-shot `useEffect`** (guarded so it runs once): `setSearchParams({}, { replace: true })`. Mirror the `MagicLinkPage` pattern (lazy init for state + effect for the side effect) so the message shows on mount without clobbering errors produced by later OTP submissions and without lingering `error=google` in the URL on retry.

### Phase 2: Google OAuth callback

- [x] **Task 3: Implement GoogleCallbackPage** (depends on Task 1)
  Files: `src/pages/GoogleCallbackPage/index.tsx`
  Replace the static stub with the OAuth callback handler. The route `/auth/google/callback` is already registered in `src/router.tsx` and is public, so no router change is needed.
  On mount (single-run `useEffect`, guarded against React 18 StrictMode double-invocation with a `useRef` flag set **synchronously before** the async call — the OAuth `code` is single-use, so a duplicate exchange would fail):
  - Read **`code`** and **`error`** from the URL via `useSearchParams` (standard OAuth param names — see API contract above; **not** `googleCode`/`googleError`).
  - If `error` is present (or `code` is absent): `navigate('/login?error=google', { replace: true })`.
  - If `code` is present: call
    `apiFetch<AuthResponse>('/auth/google', { method: 'POST', body: JSON.stringify({ code, redirectUri: window.location.origin + '/auth/google/callback' }) })`.
    On success: `auth.login(res.accessToken)` (AuthContext handles token persistence + navigation to `/sessions`).
    On failure (`ApiError` or otherwise): `navigate('/login?error=google', { replace: true })`. (A failed exchange has no stored token, so `apiFetch`'s 401 auto-redirect does not fire — the error falls through to this `catch`.)
  Use `apiFetch`/`ApiError` from `@/core/api/client`, `useAuth` from `@/core/auth/AuthContext`, and `AuthResponse` from `@/core/types` — mirror the import/usage patterns already in `LoginPage`/`MagicLinkPage`. (`AuthResponse.user` omits some fields the API returns, but only `accessToken` is consumed here, so no type change is needed.)
  Render a centered "Completing Google sign-in…" loading state with a spinner (reuse the spinner markup pattern from `LoginPage`) while the exchange is in flight.
