# Code Review: Fix auth state cleanup on logout and 401

**Review #:** 1
**Scope:** Code changes on branch `main` (uncommitted/staged)
**Files reviewed (source):**
- `src/core/auth/AuthContext.tsx` (modified)
- `src/core/api/client.ts` (modified)

(Plan/JSON/plan-review artifacts also added; non-code, not reviewed for correctness.)

## Summary

Both fixes are implemented exactly as specified and are correct. `npm run typecheck` and `npm run lint` both pass clean. No bugs, security issues, or correctness problems found.

## Verification

### Task 1 — `logout()` clears pending email (AuthContext.tsx:48–54)
- `localStorage.removeItem(PENDING_EMAIL_KEY)` and `setPendingEmailState(null)` are now executed inside `logout`, before `navigate('/login', ...)`. Confirmed.
- Dependency array stays `[navigate]`. This is correct: `setPendingEmailState` (a `useState` setter) and `PENDING_EMAIL_KEY` (a module constant) are stable references that ESLint's `react-hooks/exhaustive-deps` does not require as deps. Lint passes, confirming no warning.
- The stale-email bug is genuinely closed: `MagicLinkPage` gates on `pendingEmail`, so removing it on logout prevents a silent mismatch-verify on the next magic-link visit.
- `login()` is left untouched, including its explanatory comment — matches the plan instruction.

### Task 2 — `apiFetch` stops throwing after 401 redirect (client.ts:31–35)
- After `localStorage.removeItem(TOKEN_KEY)` and `window.location.assign('/login')`, the function now `return new Promise<T>(() => {})`, a never-resolving promise that neither resolves nor rejects. This prevents caller `catch` handlers from firing during the hard navigation. Confirmed.
- Generic type `T` is preserved, so the return type `Promise<T>` is satisfied — typecheck passes.
- The unconditional `throw new ApiError(res.status, msg)` correctly remains the path for all non-401 errors and for 401 responses where no token was present.

## Runtime considerations checked

- **Dangling promise / leak:** `window.location.assign('/login')` triggers a full document navigation; the JS context (including the never-resolving promise and any TanStack Query observers) is torn down. No memory leak in practice. Even when the request originates on `/login` itself, assigning the URL reloads the document, so the context is still destroyed.
- **Caller impact:** `apiFetch` consumers are either TanStack Query (`useQuery`/`useMutation`, which tolerate a perpetually-pending promise until unload) or auth-flow pages calling auth endpoints that do not 401-with-token. No caller relies on a `.finally()` running on the 401 path, and any that did would be moot under page unload.
- **Architecture rules:** Both edits stay within the only two modules permitted to access `localStorage` (`core/auth`, `core/api`). `mind_auth_token` key unchanged. No raw `fetch` introduced. Compliant.

## Findings

None.

REVIEW_PASS
