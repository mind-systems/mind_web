# Code Review: Login page — Google Sign-In (Review 1)

**Plan:** `.ai-factory/plans/09-login-page-google-sign-in.md`
**Changed files (code):** `src/pages/GoogleCallbackPage/index.tsx`, `src/pages/LoginPage/index.tsx`
**Verification run:** `tsc --noEmit` (passes — but see note), `tsc -b` / `npm run build` (FAILS), `eslint` (crashes — Node/ESLint env issue, unrelated to this change)
**Risk Level:** 🔴 High — the change does not build.

## Critical Issues

### 1. 🔴 Unused `ApiError` import breaks the production build

`src/pages/GoogleCallbackPage/index.tsx:3`

```ts
import { apiFetch, ApiError } from '@/core/api/client';
```

`ApiError` is imported but never referenced anywhere in the file (the `.catch((err: unknown) => { void err; … })` block discards the error and does not narrow it with `instanceof ApiError`). With `noUnusedLocals: true` in `tsconfig.app.json`, `tsc -b` rejects this:

```
src/pages/GoogleCallbackPage/index.tsx(3,20): error TS6133: 'ApiError' is declared but its value is never read.
```

`npm run build` runs `tsc -b && vite build`, so **the build fails** and the app cannot be produced. This is introduced by this change.

**Fix:** drop `ApiError` from the import — `import { apiFetch } from '@/core/api/client';`. (The plan referenced `ApiError`/`apiFetch` as the import pattern, but the implementation never uses it; removing it is correct since the catch handler intentionally ignores the error detail and just redirects.)

> Note: the `void err;` is then the only consumer of the catch param, which is fine. Alternatively, drop the unused param entirely: `.catch(() => navigate('/login?error=google', { replace: true }))`.

## Non-blocking notes

### A. Pre-existing build breakage in `core/api/client.ts` (not introduced here, but blocks the same build)

`tsc -b` also reports:

```
src/core/api/client.ts(7,5): error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
```

This is the `constructor(public status: number, …)` parameter-property in `ApiError`, incompatible with `erasableSyntaxOnly: true`. `client.ts` is **not** part of this diff (confirmed via `git status`/`git show HEAD`), so it is a pre-existing problem — but it means the build is red independent of Issue 1, and fixing only Issue 1 will not turn the build green. Worth flagging to whoever owns the auth client (convert to an explicit field assignment in the constructor body). Out of scope for this task, but the milestone's "build passes" bar cannot be met until both are resolved.

### B. `npm run typecheck` gives false confidence

`tsc --noEmit` (the `typecheck` script) exits 0 here because, in solution/`-b` project layouts, plain `tsc --noEmit` against the root `tsconfig.json` checks essentially nothing — only `tsc -b` (used by `build`) actually type-checks `src`. Reviewers/implementers should rely on `npm run build`, not `npm run typecheck`, to gate this repo. Not a code bug; calling it out so the unused-import error is not missed in future passes.

### C. `setSearchParams({}, { replace: true })` clears *all* query params

`src/pages/LoginPage/index.tsx:27` — wiping the whole query string is fine today (only `error` is ever present on `/login`), and matches the plan intent. No action needed; noted for awareness if `/login` ever gains other params.

## Correctness items verified (no issues)

- **Callback param names** are the standard OAuth `code`/`error` (lines 19–20), matching the verified direct-to-web API contract — not the relay-only `googleCode`/`googleError`. ✅
- **`redirectUri`** = `window.location.origin + '/auth/google/callback'` (line 31) matches the API's strict `WEB_REDIRECT_URI` equality check. ✅
- **StrictMode guard**: `didExchange` ref set synchronously before the async call (lines 16–17) correctly prevents a duplicate single-use-code exchange. ✅
- **Failure paths**: missing `code` or present `error` → `/login?error=google`; exchange rejection → same redirect; no stored token means `apiFetch`'s 401 auto-redirect cannot fire. ✅
- **LoginPage error surfacing**: lazy `useState` initializer seeds the message (no render-time side effect); one-shot `useEffect` clears the param. Matches the `MagicLinkPage` pattern and the plan. ✅
- **Google button**: full-page navigation via `window.location.href` (not `apiFetch`), disabled while `loading`, only on the `email` step. ✅

## Verdict

One change-introduced blocker (Issue 1) prevents the build. Fix the unused import; be aware the pre-existing `client.ts` error (Note A) must also be resolved before the build is actually green. Not approved as written.
