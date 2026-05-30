# Plan Review: Login page — email OTP flow

**Plan:** `07-login-page-email-otp-flow.md`
**Files Reviewed:** plan + `core/api/client.ts` (empty), `core/types/index.ts` (empty), `core/config.ts`, `core/auth/AuthContext.tsx`, `router.tsx`, `main.tsx`, `pages/LoginPage/index.tsx`, `ARCHITECTURE.md`, `rules/base.md`, `ROADMAP.md`, and the real `mind_api` auth endpoints (`auth.rest.controller.ts`, `auth-code.service.ts`, `auth-response.dto.ts`, `verify-code.dto.ts`).
**Risk Level:** 🟡 Medium — the contract and structure are right, but the planned 401 handling breaks the primary error path (wrong/expired OTP).

---

## Context Gates

- **Architecture (`ARCHITECTURE.md`)** — ✅ Aligned in structure: single fetch point in `core/api/client.ts`, page uses `useAuth()` and never touches `localStorage` directly, types in `core/types`. ⚠️ **WARN** — the `apiFetch` skeleton the plan copies verbatim has a 401 behavior that is wrong for the login page (see Critical #1). Following the skeleton literally produces a bug.
- **Rules (`rules/base.md`)** — ⚠️ **WARN** — the rule *"401 responses: clear localStorage token and redirect to /login from the API client layer"* is exactly what breaks login. The rule needs a carve-out for unauthenticated/login requests. The plan should note this conflict rather than silently inherit it.
- **Roadmap (`ROADMAP.md`)** — ✅ Milestone present and matches (line 17: "Login page: email OTP flow"). Plan correctly defers Google Sign-In (line 21) and the full API-client milestone (line 23). Forward-compatibility note in the plan is accurate.

---

## Critical Issues

### 1. The global 401 interceptor breaks invalid/expired-code handling (primary failure path)

I verified the real backend: `AuthCodeService.verifyCode()` throws `UnauthorizedException('Invalid or expired code')` for a wrong or expired code — that is **HTTP 401**.

The `apiFetch` skeleton the plan adopts (Task 2, mirroring `ARCHITECTURE.md` lines 102–106) does this on *any* 401:

```typescript
if (res.status === 401) {
  localStorage.removeItem('mind_auth_token');
  window.location.href = '/login';            // full page reload
  throw new ApiError(401, 'Unauthorized');     // hardcoded message
}
```

Consequences when a user mistypes the OTP on `LoginPage`:
- `window.location.href = '/login'` triggers a **full page reload**, blowing away the React tree. The Task 3 `catch (err) { setError(err.message) }` block effectively never renders — the user is bounced back to step 1 with no explanation instead of seeing an inline error.
- Even if the redirect were removed, the 401 branch hardcodes `'Unauthorized'` and discards the server's `body.message` (`'Invalid or expired code'`). So the inline error the plan promises in Task 3 ("set `error` from `ApiError.message`") would show the wrong text.

This directly contradicts the plan's own Step-2 requirement: *"On failure: set `error` from `ApiError.message`."* As written, the two tasks are mutually inconsistent.

**Required fix (pick one, state it in the plan):**
- Preferred: only redirect on 401 **when a token was actually present** — a logged-out user calling `/auth/verify-code` has no token, so login failures fall through to the normal `!res.ok` branch (which *does* preserve `body.message`). This cleanly distinguishes "session expired" from "login failed."
- Or: bypass the 401 redirect for `/auth/*` paths.
- Either way, the 401 branch should carry the server `body.message`, not a hardcoded string.

---

## Non-Blocking Issues

### 2. Validation errors (400) return `message` as an **array**, not a string — WARN
`mind_api` uses class-validator (`@IsEmail`, `@Matches(/^\d{6}$/)`). A bad email or non-6-digit code returns **HTTP 400** with `message` as a **string array** (e.g. `["code must be exactly 6 digits"]`), per Nest's default `ValidationPipe`. The planned `body.message ?? 'Request failed'` will put an array into `ApiError`, and `error` becomes an array. Rendering it inline mostly "works" (React joins it, `Error` coerces to a comma-joined string), but the result is ugly. The plan should specify normalizing `message` when it's an array (e.g. `Array.isArray(m) ? m.join(', ') : m`).

### 3. `429 Too Many Requests` on resend — note it, don't break it — WARN
`sendCode()` enforces a 60-second cooldown and throws `HttpException('Too Many Requests', 429)`. This path is fine with the planned non-2xx handling (message displays), but Task 3 should explicitly acknowledge the 429 case so the "Send code" error copy reads sensibly (e.g. user hitting resend quickly).

### 4. `pendingEmail` is never cleared after a successful OTP login on `LoginPage` — WARN
`AuthContext.login()` deliberately does **not** clear `pendingEmail` (comment: magic-link flow clears it explicitly). The OTP flow on `LoginPage` calls `setPendingEmail(email)` in step 1 but never calls `clearPendingEmail()` after `login()`. So `mind_pending_email` lingers in `localStorage` after a normal in-page login. Not breaking (magic-link is a separate route), but stale. Recommend calling `auth.clearPendingEmail()` after a successful verify on `LoginPage`, mirroring the roadmap's magic-link milestone.

### 5. Optional `locale` / `language` params omitted — LOW
`POST /auth/send-code` accepts optional `locale`; `POST /auth/verify-code` accepts optional `language` (used to set the language of a *newly registered* user). The plan omits both. Acceptable for scope (both optional; backend defaults via `resolveLocale`), but worth a one-line note that email/new-user localization is intentionally deferred.

---

## Positive Notes

- **Contract is correct.** `POST /auth/send-code` and `POST /auth/verify-code` exist exactly as planned, and `verify-code` returns `{ accessToken, user }` (`AuthResponseDto`). The minimal `User` type (`id`, `email`) is a safe subset of the real `UserResponseDto` (`id, email, name, role, language`).
- **Architectural placement is right.** Standing up a minimal `apiFetch` now (rather than raw `fetch` in the page) respects the no-raw-fetch rule, and the plan correctly flags that the later "API client" milestone refines rather than recreates it.
- **Auth integration is accurate.** `useAuth()` exposes `login`, `setPendingEmail`, `clearPendingEmail` as the plan assumes; `login()` already navigates to `/sessions`, so the page correctly avoids its own navigation.
- **Paths and aliases check out.** `@/core/config` → `API_BASE_URL`, `src/pages/LoginPage/index.tsx`, and the `@/*` tsconfig path mapping are all valid.

---

## Verdict

The plan targets the right files with a correct API contract, but Task 2 + Task 3 are internally inconsistent: the inherited 401 interceptor makes the wrong-code error path (the single most common login error) impossible to display, and would full-reload the page instead. This must be resolved before implementation. Address Critical #1 (and ideally WARNs #2–#4), then this is ready.
