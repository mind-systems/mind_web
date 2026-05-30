# Plan: Login page — email OTP flow

## Context
Implement the two-step passwordless email OTP login on `LoginPage`: request a code via `POST /auth/send-code`, then verify it via `POST /auth/verify-code` and log the user in.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Notes / Assumptions
- `core/api/client.ts` and `core/types/index.ts` are currently empty. The dedicated "API client with auth interceptor" milestone comes later in the roadmap, but the architecture rule (`ARCHITECTURE.md`) forbids raw `fetch` in pages — **all HTTP must go through `apiFetch`**. So this plan stands up a minimal `apiFetch` now; the later milestone refines it. Keep this version minimal and forward-compatible.
- `AuthContext` already exists with `login(token)`, `setPendingEmail(email)`, `clearPendingEmail()`. Use `useAuth()` — never touch `localStorage` directly from the page.
- The mind_api REST endpoints (`/auth/send-code`, `/auth/verify-code`) are delivered in mind_api Phase 21; the web side codes against the documented contract.

### Backend error contract (verified against mind_api auth endpoints)
The login error paths drive the `apiFetch` design — these are not hypothetical:
- **Wrong/expired code** → `verifyCode()` throws `UnauthorizedException('Invalid or expired code')` = **HTTP 401**. This is the *most common* login error and **must render inline**, not trigger a redirect.
- **Invalid email / non-6-digit code** → class-validator (`@IsEmail`, `@Matches(/^\d{6}$/)`) → **HTTP 400** with `message` as a **string array** (e.g. `["code must be exactly 6 digits"]`).
- **Resend too fast** → `sendCode()` 60s cooldown → **HTTP 429** `'Too Many Requests'`.
- Optional params `locale` (send-code) and `language` (verify-code) are intentionally **omitted** — both optional; backend defaults via `resolveLocale`. Email/new-user localization is deferred.

### Rule conflict to flag during implementation
`rules/base.md` states "401 responses: clear localStorage token and redirect to /login from the API client layer." Applied unconditionally this breaks login (a 401 from `/auth/verify-code` is a wrong-code error, not an expired session). The carve-out below resolves it: **redirect on 401 only when a token was actually present.** A logged-out user verifying an OTP has no token, so the failure falls through to the normal error branch that preserves `body.message`.

## Tasks

### Phase 1: Foundations

- [x] **Task 1: Add auth response types**
  Files: `src/core/types/index.ts`
  Add minimal types mirroring the mind_api auth response: `User` (a safe subset of `UserResponseDto` — at minimum `id: string` and `email: string`; the web app only needs `accessToken` for login, so keep `User` small) and `AuthResponse { accessToken: string; user: User }`. These mirror what `POST /auth/verify-code` returns (`AuthResponseDto`). Export both.

- [x] **Task 2: Minimal API client (`apiFetch`)** (depends on Task 1)
  Files: `src/core/api/client.ts`
  Create `ApiError` (`status: number`, extends `Error`) and `apiFetch<T>(path, options?)` based on the `ARCHITECTURE.md` skeleton, **with two deliberate deviations from that skeleton** (the literal skeleton breaks login — see the error-contract note above):
  1. **Conditional 401 redirect.** Read the token from `localStorage` (`mind_auth_token`) once at the top. Only run the "clear token + redirect to `/login`" branch **when a token was present** at call time. When no token was present (logged-out user hitting `/auth/verify-code`), do **not** redirect — let the response fall through to the normal non-2xx branch so a wrong/expired-code 401 surfaces as an inline error. Use `window.location.assign('/login')` (or equivalent) only in the token-present branch.
  2. **Always preserve the server message — never hardcode `'Unauthorized'`.** Both the token-present-401 branch and the generic non-2xx branch must read `body.message` from the parsed JSON and throw `new ApiError(status, message)`.
  - **Normalize array messages.** Nest's `ValidationPipe` returns `message` as a string array on 400. Normalize before constructing `ApiError`: `const m = body?.message; const msg = Array.isArray(m) ? m.join(', ') : (m ?? 'Request failed')`.
  - Standard behavior otherwise: prepend `API_BASE_URL` (from `@/core/config`), set `Content-Type: application/json`, inject `Authorization: Bearer <token>` when a token exists, parse and return `res.json()` as `Promise<T>` on success (guard `res.json()` with `.catch(() => ({}))` when reading an error body).

### Phase 2: Login page

- [x] **Task 3: Implement two-step email OTP `LoginPage`** (depends on Tasks 1, 2)
  Files: `src/pages/LoginPage/index.tsx`
  Replace the stub with the full flow:
  - Local UI state via `useState`: `step` (`'email' | 'code'`), `email`, `code`, `loading`, `error`. From `useAuth()`: `setPendingEmail`, `clearPendingEmail`, `login`.
  - **Step 1 (email):** email `<input type="email">` + "Send code" button. On submit: clear `error`, set `loading`, call `await apiFetch('/auth/send-code', { method: 'POST', body: JSON.stringify({ email }) })`. On success: `auth.setPendingEmail(email)` then advance `step` to `'code'`. On failure: catch `ApiError`, set `error` to `err.message` (covers the 429 cooldown case — the "Send code" error copy will show the server's "Too Many Requests" message; ensure the inline error styling reads sensibly for a rapid resend). Always clear `loading` in `finally`.
  - **Step 2 (code):** 6-digit code input (`inputMode="numeric"`, `maxLength={6}`) + "Verify" button, plus a back/"change email" affordance returning to step 1 (resetting `code` and `error`). On submit: clear `error`, set `loading`, call `await apiFetch<AuthResponse>('/auth/verify-code', { method: 'POST', body: JSON.stringify({ email, code }) })`. On success: `auth.clearPendingEmail()` (the in-page flow completes here; `AuthContext.login()` intentionally does not clear it), then `auth.login(res.accessToken)` (AuthContext handles navigation to `/sessions`). On failure (the wrong/expired-code 401 lands here as a normal `ApiError` thanks to Task 2's conditional redirect): set `error` from `err.message` — which will correctly read `'Invalid or expired code'`. Clear `loading` in `finally`.
  - **Loading spinner:** show an inline spinner (small Tailwind `animate-spin` element) on the active button while `loading`; disable the button during requests.
  - **Inline error:** render `error` text in red below the form when set; clear it at the start of each submit.
  - **Layout:** centered card, `max-width: 400px` (e.g. outer `flex h-screen items-center justify-center`, inner `w-full max-w-[400px]` card with padding, rounded, shadow). Submit via `<form onSubmit>` so Enter works; `preventDefault`.
  - Keep Google Sign-In out of scope — a separate milestone adds it.
