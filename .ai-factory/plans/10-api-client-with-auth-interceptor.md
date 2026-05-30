# Plan: API client with auth interceptor

## Context
Provide a single typed HTTP entry point (`apiFetch<T>` + `ApiError`) that prepends the API base URL, injects auth headers, handles 401 by clearing the token and redirecting to `/login`, and surfaces non-2xx errors with a server message. The client must be consumed by at least one page.

> **Current state:** `src/core/api/client.ts` already exists and implements the full spec, and it is already imported and used by `LoginPage`, `MagicLinkPage`, and `GoogleCallbackPage` (the Phase 2 auth pages depend on it). This milestone is therefore primarily a **verification and reconciliation** pass: confirm the existing implementation satisfies every clause of the milestone spec and the project architecture rules, fix any gap, and confirm the build is clean. Do not rewrite working code or add functionality beyond the spec.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Verify and reconcile the client against spec

- [x] **Task 1: Audit `client.ts` against the milestone spec**
  Files: `src/core/api/client.ts`
  Confirm each clause holds; fix only genuine deviations:
  - `apiFetch<T>(path, options?)` prepends `API_BASE_URL` (imported from `@/core/config`).
  - Sets `Content-Type: application/json` and `Authorization: Bearer <token>` (token read from `localStorage` key `mind_auth_token`); caller-supplied `options.headers` override defaults.
  - On 401: clears the token and redirects to `/login`. **Keep the existing guard that only clears/redirects when a token was present** — this is intentional and must be preserved: auth endpoints (`/auth/verify-code`, `/auth/google`) legitimately return 401 for a wrong code, and an unconditional redirect would interrupt the `LoginPage`/`MagicLinkPage` inline-error flow. Note this rationale; do not "fix" it into an unconditional redirect.
  - On non-2xx: throws `ApiError(status, message)` with `message` extracted from the response JSON (`body.message`), tolerating non-JSON bodies (`.catch(() => ({}))`) and array-valued `message` (NestJS validation errors → joined string), falling back to `'Request failed'`.
  - `ApiError` exposes a numeric `status` field and extends `Error`.
  Make no change if all clauses already hold.

- [x] **Task 2: Confirm architecture compliance and page usage**
  Files: `src/core/api/client.ts`, `src/pages/LoginPage/index.tsx`, `src/pages/MagicLinkPage/index.tsx`, `src/pages/GoogleCallbackPage/index.tsx`
  Verify the dependency rules from `.ai-factory/ARCHITECTURE.md`: `client.ts` is the only place that calls `fetch`; the only `localStorage` access here is the read of `mind_auth_token` for the header (writes/clears of auth keys otherwise belong to `AuthContext`, but the 401 token-clear inside the interceptor is the documented exception); no component (only pages) calls `apiFetch`. Confirm at least one page imports and calls `apiFetch` (already satisfied by the three auth pages) — the milestone's acceptance criterion. No new page or call site needs to be created.

- [x] **Task 3: Validate the build** (depends on Task 1, Task 2)
  Files: (none — verification only)
  Run `npm run typecheck`, `npm run lint`, and `npm run build`. All must pass with no errors. If Task 1 introduced any change, re-run after the edit. Report a clean result.
