# Code Review: API client with auth interceptor

**Plan:** `10-api-client-with-auth-interceptor.md`
**Scope reviewed:** `git diff HEAD` + `git status` (full), `src/core/api/client.ts`, the three consuming auth pages, `src/core/config.ts`.

## What changed

`git diff HEAD` contains **only three `.ai-factory/` files** — the plan (`.md`), its run metadata (`.json`), and the plan review (`plan-review-1.md`). **No source code was modified, added, or deleted** by this milestone.

This is expected and correct: the deliverable (`src/core/api/client.ts`) and its consumers (`LoginPage`, `MagicLinkPage`, `GoogleCallbackPage`) were implemented and committed during earlier Phase 2 milestones. The milestone was scoped as a verification/reconciliation pass, and the audit's conclusion — "no change needed, all spec clauses already hold" — is accurate. I independently re-verified each clause of the spec against the committed `client.ts` and found no deviation.

Because there are no code changes, there is no new bug, security regression, type mismatch, or race condition that this milestone could have introduced.

## Independent verification

- **Spec clauses (Task 1):** all hold against the committed `client.ts` — base-URL prepend from `@/core/config`, `Content-Type` + `Authorization` headers with caller-`options.headers` overriding (spread last), token-guarded 401 clear+`window.location.assign('/login')`, non-2xx → `ApiError(status, message)` with array-`message` join / non-JSON tolerance / `'Request failed'` fallback, and `ApiError extends Error` with numeric `status`. Confirmed.
- **Architecture (Task 2):** `client.ts` is the only `fetch` call site in `src/`; only the three auth pages import `apiFetch`; no shared component calls it. Confirmed — matches `ARCHITECTURE.md` dependency rules and the milestone's "used by at least one page" acceptance criterion.
- **Build (Task 3):** `npm run typecheck` (`tsc --noEmit`) passes clean; `npm run lint` (`eslint .`) passes clean. See environment note below regarding `npm run build`.

## Observations (non-blocking)

1. **`npm run build` fails in this environment for a non-code reason.** `vite build` crashes with `ReferenceError: CustomEvent is not defined` because the local runtime is Node.js 18.15.0 while Vite requires Node 20.19+ / 22.12+. The TypeScript half of the build (`tsc -b`) and standalone `tsc --noEmit` both succeed, so the code compiles cleanly — this is purely a Node-version mismatch in the dev environment, not a defect in any reviewed file and not attributable to this milestone. Worth flagging to the team to pin/upgrade the local Node version so the build gate is meaningful, but it is not a code finding.

2. **Empty-body 2xx responses (pre-existing, outside milestone scope).** `apiFetch` ends with `return res.json()`. A successful response with an empty body (e.g. a `204`/`void` endpoint such as a possible `POST /auth/send-code`) would make `res.json()` throw `SyntaxError`, which callers surface as the generic "Something went wrong" despite success. This already exists in committed code, is outside this milestone's spec (which only governs base-URL/headers/401/non-2xx), and was already noted in the plan review. Not introduced or touched here — recorded only so it isn't lost. Defer unless it actually manifests at runtime against the real API.

## Verdict

No findings against the code changes in this milestone — there are none, and the verification conclusion the milestone reached is correct and independently confirmed. The two observations above are non-blocking and concern pre-existing code / the dev environment, not this change.

REVIEW_PASS
