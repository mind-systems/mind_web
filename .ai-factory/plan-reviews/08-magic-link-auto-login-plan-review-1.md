# Plan Review: Magic link auto-login

**Plan:** `08-magic-link-auto-login.md`
**Files Reviewed:** 1 plan + 6 codebase files
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** ✅ Aligned. The plan keeps the page self-contained under `pages/` and imports only from `core/api`, `core/auth`, `core/types` — exactly the allowed dependency direction (`pages/ → core/api, core/auth, core/types`). No raw `fetch`, no direct `localStorage` access, both delegated to `core/api/client` and `core/auth/AuthContext`. No violations.
- **Rules:** No standalone `.ai-factory/RULES.md`; project rules from `CLAUDE.md` (English-only, `mind_auth_token` untouched, all HTTP via `client.ts`, `localStorage` confined to auth/client) are all respected by the plan.
- **Roadmap (`.ai-factory/ROADMAP.md`):** ✅ Directly fulfills the Phase 2 task "Magic link auto-login". The plan matches the roadmap's described behavior (read `?code=`, use `pendingEmail`, fall back to email prompt, `clearPendingEmail()` after login). Good linkage. No skill-context file present.

## Verification Against Codebase

All assumptions in the plan were checked against the actual source and hold:

- ✅ `MagicLinkPage` is currently a stub (`src/pages/MagicLinkPage/index.tsx`) — replacement is correct.
- ✅ `/deeplink-auth` is already a public route in `src/router.tsx` — no router change needed, as stated.
- ✅ `AuthContext.login()` persists the token and `navigate('/sessions', { replace: true })`, and intentionally does **not** clear `pendingEmail` (comment confirms). The plan's explicit `clearPendingEmail()` → `login()` ordering is correct and mirrors `LoginPage.handleVerifyCode`.
- ✅ `useAuth()` exposes `pendingEmail`, `login`, `clearPendingEmail` as the plan uses them.
- ✅ The `apiFetch<AuthResponse>('/auth/verify-code', { method: 'POST', body: JSON.stringify({ email, code }) })` shape and `res.accessToken` field match `LoginPage` and `core/types` (`AuthResponse = { accessToken, user }`).
- ✅ `ApiError` exists and exposes `.message`; the inline-error extraction pattern (`err instanceof ApiError ? err.message : ...`) matches `LoginPage`.
- ✅ No migrations involved (frontend-only); no proto/API contract changes.

## Observations (non-blocking)

1. **StrictMode double-invocation** — The plan already calls for a `useEffect` "guarded so it runs the verification only once." This is the right instinct: React 18 StrictMode double-mounts in dev, and `verify-code` is single-use, so a second call would fail. Recommend implementing the guard with a `useRef` flag (not just an effect dependency array), since state updates inside the effect can re-trigger before the ref-style latch. Worth making explicit during implementation.

2. **Already-authenticated user** — `/deeplink-auth` is a public route (no `ProtectedRoute`). If a user who already has a valid token opens a magic link, the page will still attempt verification. Not harmful (worst case an error state), but the implementer may optionally short-circuit to `/sessions` when `token` is already present. Optional polish, not required by the roadmap.

3. **Code in URL / browser history** — The OTP arrives as a `?code=` query param, so it persists in browser history and referrer. This is inherent to the existing email-template design (`{APP_BASE_URL}/deeplink-auth?code=XXXXXX`) and out of scope for this frontend task, but the implementer could call `navigate('/sessions', { replace: true })` (already done by `login()`) to avoid leaving the code in the back-stack — which the current `login()` already handles via `replace: true`. No action needed; noting for awareness.

4. **Fallback form — `setPendingEmail`** — In the `need-email` path the user types their email and verifies directly; the plan does not call `setPendingEmail`, which is correct (login succeeds and clears state anyway). No issue.

## Positive Notes

- Tasks are correctly ordered with an explicit dependency (Task 2 depends on Task 1) and the shared `verify(email, code)` helper sensibly removes duplication between the auto path and the fallback form.
- Reuses `LoginPage` card layout, spinner, and error-handling conventions — keeps UI consistent and respects the architecture's "no new patterns" intent.
- Scope is precisely contained to a single file with no collateral changes, matching the roadmap's "no API/template changes needed" note.

## Conclusion

The plan is accurate, architecturally compliant, and free of incorrect codebase assumptions, missing steps, or security/migration gaps. The observations above are optional implementation refinements, not blockers.

PLAN_REVIEW_PASS
