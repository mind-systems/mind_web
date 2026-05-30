# Code Review: Login page — Google Sign-In (Review 2)

**Plan:** `.ai-factory/plans/09-login-page-google-sign-in.md`
**Changed files (code):** `src/core/api/client.ts`, `src/pages/GoogleCallbackPage/index.tsx`, `src/pages/LoginPage/index.tsx`
**Verification run:** `tsc -b` → **exit 0 (clean)**. `vite build` fails locally on Node 18 (`Vite requires Node 20.19+`; `CustomEvent is not defined`) — an **environment** issue, not attributable to this change.
**Risk Level:** 🟢 Low

## Review-1 findings — all resolved

1. **🔴 → ✅ Unused `ApiError` import broke the build.** `GoogleCallbackPage/index.tsx:3` now imports only `apiFetch`; the `.catch(() => …)` discards the error without referencing `ApiError`. `tsc -b` no longer emits `TS6133`.
2. **Note A → ✅ Pre-existing `client.ts` `TS1294`.** `ApiError` was rewritten from a parameter-property (`constructor(public status…)`) to an explicit field + assignment, satisfying `erasableSyntaxOnly`. Behavior is identical — `status` is still a public instance field, so `err instanceof ApiError ? err.message` in `LoginPage` and any `err.status` access remain valid.

With both fixed, `tsc -b` (the real type-check gate for this repo — `tsc --noEmit` checks nothing in this solution-style layout) passes cleanly.

## Correctness / security pass (no issues found)

**GoogleCallbackPage**
- Standard OAuth params `code` / `error` read from the callback URL (lines 19–20), matching the verified direct-to-web API contract. ✅
- `redirectUri = window.location.origin + '/auth/google/callback'` (line 31) equals `WEB_REDIRECT_URI`, satisfying the API's strict equality check. ✅
- StrictMode double-invocation guard: `didExchange` ref set synchronously before the async call (lines 16–17) prevents a duplicate single-use-code exchange. ✅
- Failure handling: `error` present or `code` absent → `/login?error=google`; exchange rejection → same redirect; success → `auth.login()` (token persistence + `/sessions` nav handled in AuthContext). ✅
- No injection/open-redirect surface: the redirect target is a fixed internal path, and `code` travels in the JSON body — never rendered into the DOM. ✅

**LoginPage**
- Lazy `useState` initializer seeds the error message from `?error=google` with no render-time side effect; the one-shot `useEffect` clears the param (`replace: true`). Matches the `MagicLinkPage` pattern and the plan. ✅
- Google button: full-page `window.location.href` navigation (not `apiFetch`), disabled while `loading`, rendered only on the `email` step. ✅
- Error state intentionally persists after the param is cleared, so the message survives the URL cleanup. ✅

**client.ts**
- Field-assignment refactor is behavior-preserving; 401-with-token branch and message extraction unchanged. ✅

## Notes (non-blocking, no action required for this task)

- **Local Node version.** `vite build` cannot run under Node 18 in this environment. This does not reflect a defect in the change — the TypeScript compile (`tsc -b`) is green. Building/deploying requires Node 20.19+ / 22.12+ per Vite. Out of scope for this milestone.
- **`setSearchParams({}, …)` clears all query params** on `/login`; harmless today (only `error` is ever present there). Carried over from Review 1 as awareness only.

## Verdict

Both Review-1 blockers are fixed, the type-check is clean, and the OAuth flow logic is correct and free of injection/redirect concerns. Approved.

REVIEW_PASS
