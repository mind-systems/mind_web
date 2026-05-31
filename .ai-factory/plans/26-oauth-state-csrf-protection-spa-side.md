# Plan: OAuth `state` CSRF protection (SPA side)

## Context
The Google sign-in flow carries no `state`, leaving it open to login-CSRF where an attacker's `code` silently logs the victim into the attacker's account. The SPA is the OAuth client, so it owns `state`: generate a one-time token before redirecting to `/auth/google`, and validate it in the callback before exchanging the code.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: State helper

- [x] **Task 1: Add `oauthState` helper module**
  Files: `src/core/auth/oauthState.ts`
  Create a new module with two exported functions, the only place in the app that touches `sessionStorage`:
  - `createOAuthState(): string` — generate an opaque token via `crypto.randomUUID()`, store it under the `sessionStorage` key `oauth_state`, and return it.
  - `consumeOAuthState(): string | null` — read the value at key `oauth_state`, remove it from `sessionStorage` (one-time, read-and-remove), and return the value (or `null` if absent).
  Use a module-level constant for the `'oauth_state'` key. Use `sessionStorage` (tab-scoped), NOT `localStorage`. No React dependency — plain functions.

### Phase 2: Wire state into the flow

- [x] **Task 2: Attach `state` on Google sign-in redirect** (depends on Task 1)
  Files: `src/pages/LoginPage/index.tsx`
  Import `createOAuthState` from `@/core/auth/oauthState`. In `handleGoogleSignIn`, generate the state and append it to the redirect URL:
  ```ts
  function handleGoogleSignIn() {
    const state = createOAuthState();
    window.location.href = `${API_BASE_URL}/auth/google?state=${encodeURIComponent(state)}`;
  }
  ```

- [x] **Task 3: Validate `state` before code exchange in the callback** (depends on Task 1)
  Files: `src/pages/GoogleCallbackPage/index.tsx`
  Import `consumeOAuthState` from `@/core/auth/oauthState`. Inside the existing `useEffect`, AFTER the `didExchange` ref guard (so StrictMode's double-invoke does not consume the one-time state twice), and BEFORE reading `googleCode`/`googleError` or calling the API:
  - Read `state` from the query (`searchParams.get('state')`).
  - Compare it to `consumeOAuthState()`.
  - If `state` is missing, the stored value is `null`, or the two do not match → `navigate('/login?error=google', { replace: true })` and `return` WITHOUT calling `POST /auth/google`.
  - If it matches, proceed with the existing `googleCode`/`googleError` handling and code exchange unchanged.
  Optionally include `state` in the `POST /auth/google` body (backend logs it, does not validate) — keep the existing `code` and `redirectUri` fields.

### Phase 3: Honor the storage rule

- [x] **Task 4: Update the project storage rule for `sessionStorage`** (depends on Task 1)
  Files: `CLAUDE.md`
  In the `## Rules` section, extend the `localStorage` allow-list rule so the new helper is the sanctioned location for tab-scoped storage. Update the line:
  - `localStorage` access only in `core/auth/AuthContext.tsx` and `core/api/client.ts`
  to also cover `sessionStorage` access in `src/core/auth/oauthState.ts` (e.g. clarify that browser storage — `localStorage`/`sessionStorage` — is confined to `core/auth/AuthContext.tsx`, `core/api/client.ts`, and `core/auth/oauthState.ts`). This keeps storage access centralized in dedicated modules per the rule's intent.

## Notes
- This ships in lockstep with mind_api Phase 26 (backend relays `state` through `GET /auth/google` and the callback, and accepts it unvalidated on `POST /auth/google`). Neither half changes behavior until both ship.
