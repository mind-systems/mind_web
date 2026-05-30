# Code Review: Login page — email OTP flow

**Plan:** `07-login-page-email-otp-flow.md`
**Changed source files:** `src/core/types/index.ts` (new), `src/core/api/client.ts` (new), `src/pages/LoginPage/index.tsx` (rewritten)
**Verification:** `npm run typecheck` ✅ clean, `npm run lint` ✅ clean.
**Risk Level:** 🟢 Low — implementation matches the plan, the reviewed 401 carve-out is correctly applied, no correctness or security bugs found.

---

## Scope checked

Read each changed file in full plus the surrounding code they depend on: `core/auth/AuthContext.tsx` (login/setPendingEmail/clearPendingEmail signatures + navigation), `core/config.ts` (`API_BASE_URL`), `router.tsx` (named `LoginPage` import, `/login` route), and the `@/*` alias resolution. All consistent.

---

## Correctness

- **Conditional 401 redirect is implemented correctly** (`client.ts:31-34`). The redirect+token-clear runs only when `res.status === 401 && token`. A logged-out user submitting a wrong OTP has no token, so the 401 falls through to `throw new ApiError(res.status, msg)` and surfaces inline in `LoginPage`. This is exactly the carve-out the plan reviews required, and Task 2/Task 3 are now internally consistent.
- **Server message is preserved, not hardcoded** (`client.ts:28-30`). `body.message` is read for every non-2xx, including the 401 branch. The `'Invalid or expired code'` 401 message will render in the inline error as intended.
- **Array-message normalization works** (`client.ts:29`). `Array.isArray(m) ? m.join(', ') : (m ?? 'Request failed')` handles the Nest `ValidationPipe` 400 string-array shape and the 429 `'Too Many Requests'` string. The `.catch(() => ({}))` on `res.json()` guards non-JSON error bodies (`body?.message` → `undefined` → `'Request failed'`).
- **Auth integration is exact.** `handleVerifyCode` calls `auth.clearPendingEmail()` then `auth.login(res.accessToken)`; `login()` persists the token and navigates to `/sessions`, so the page correctly avoids duplicate navigation. `setPendingEmail` is set only after `send-code` succeeds.
- **Form behavior is sound.** Both steps submit via `<form onSubmit>` with `preventDefault`; buttons are disabled during `loading` and gated (`!email.trim()`, `code.length !== 6`); the code input strips non-digits (`replace(/\D/g, '')`) and caps at 6; spinner + disabled state shown during requests; error cleared at the start of each submit and on "Change email". Catch blocks degrade gracefully for non-`ApiError` throws.
- **Types are a safe subset.** `User { id, email }` and `AuthResponse { accessToken, user }` mirror the backend `AuthResponseDto` contract used by the page.

## Security

- No new exposure. Token continues to live in `localStorage` under `mind_auth_token` (existing design), read/written only in `client.ts` and `AuthContext.tsx` per the architecture rule. No token logging, no secrets in the diff. `noValidate` only disables native browser validation; server-side validation is authoritative.

## Runtime-break checks

- No migrations or backend coupling on the web side. `@/core/types` and `@/core/config` resolve (typecheck passes). `res.json()` on the success path is safe given both endpoints return JSON bodies (`{ message }` / `{ accessToken, user }`). `setLoading(false)` in `finally` runs on the still-mounted component before React commits the post-`login()` navigation render — no unmounted-setState warning in practice.

---

## Non-blocking observations (optional, not bugs)

1. **Email is sent and stored untrimmed** (`LoginPage` `handleSendCode`). The submit button gates on `email.trim()`, but the value passed to `apiFetch('/auth/send-code', { body: { email } })` and to `auth.setPendingEmail(email)` is the raw input. Backend `@IsEmail()` rejects leading/trailing whitespace, so an email with an accidental trailing space would yield a confusing 400 despite the button being enabled, and the untrimmed value would be persisted under `mind_pending_email` (later consumed by the magic-link flow). Low impact; a single `email.trim()` at submit would tighten it. Out of the plan's explicit scope.
2. **Step-2 success leaves `loading` true through navigation (intentional).** After a successful verify, `auth.login()` navigates away while the button stays in its disabled/spinner state — correct UX (prevents a flash of re-enabled button before route change). Noted only for clarity.

---

## Verdict

The implementation faithfully realizes the plan, correctly applies the reviewed 401 carve-out and message normalization, and passes typecheck + lint. No correctness, security, or runtime-break findings. The two observations above are optional polish, not defects.

REVIEW_PASS
