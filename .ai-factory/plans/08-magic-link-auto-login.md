# Plan: Magic link auto-login

## Context
Implement `MagicLinkPage` at `/deeplink-auth` so the magic-link email code (`{APP_BASE_URL}/deeplink-auth?code=XXXXXX`) auto-verifies in the browser, logs the user in, and lands on `/sessions`. When the pending email is unknown, prompt the user to confirm it before verifying.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Magic link verification

- [x] **Task 1: Replace the MagicLinkPage stub with the auto-login flow**
  Files: `src/pages/MagicLinkPage/index.tsx`
  Replace the placeholder component. Read the `code` query param with `useSearchParams()` from `react-router-dom`. Read `pendingEmail`, `login`, `clearPendingEmail` via `useAuth()` (`@/core/auth/AuthContext`). On mount (in a `useEffect` guarded so it runs the verification only once), if `code` is present and `pendingEmail` is non-null, call `verify(pendingEmail, code)` (the shared helper from Task 2). Use the existing `apiFetch<AuthResponse>('/auth/verify-code', { method: 'POST', body: JSON.stringify({ email, code }) })` call shape from `LoginPage` (`@/core/api/client`, `@/core/types`). On success call `auth.clearPendingEmail()` then `auth.login(res.accessToken)` (which itself navigates to `/sessions`). Track local `status` state (`'verifying' | 'need-email' | 'error'`) and an `error` string. While verifying, render a centered spinner + "Verifying magic link…" using the same centered-card styling as `LoginPage`. If `code` is missing entirely, set status to `'error'` with a message and offer a link back to `/login`.

- [x] **Task 2: Add the email-confirmation fallback UI**
  Files: `src/pages/MagicLinkPage/index.tsx` (depends on Task 1)
  When `code` is present but `pendingEmail` is null, render status `'need-email'`: a short centered form (reuse the `LoginPage` card layout and Tailwind classes) with an email input and a "Continue" button. On submit, call the shared `verify(email, code)` helper using the entered email. Show a loading spinner on the button during the request and an inline red error message on failure (extract `message` from `ApiError`, matching `LoginPage`). On success the same `clearPendingEmail()` → `login(accessToken)` path runs. Factor the verify-and-login logic into a single `verify(email, code)` async function used by both the auto path (Task 1) and this form to avoid duplication. Keep the file self-contained under `pages/` per the architecture's dependency rules (import only from `core/api`, `core/auth`, `core/types`).

## Notes
- `/deeplink-auth` is already registered as a public route in `src/router.tsx` — no router changes needed.
- `AuthContext.login()` already navigates to `/sessions` and intentionally does not clear `pendingEmail`; this page must call `clearPendingEmail()` explicitly before `login()`.
- The `verify-code` endpoint returns `{ accessToken, user }` (`AuthResponse`); use `res.accessToken`.
