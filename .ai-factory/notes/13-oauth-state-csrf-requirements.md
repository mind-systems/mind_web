# Requirements — OAuth `state` CSRF protection (SPA side)

**Date:** 2026-05-31
**Source:** cross-project code review of the Google sign-in flow (mind_api Phase 26)
**Status:** requirements only — pairs with mind_api roadmap Phase 26; both halves must ship together.

## Why

The Google sign-in is a relay flow with **no `state` parameter anywhere**, so it is open to login-CSRF: an attacker completes a Google auth for *their* account, then feeds the victim a callback URL carrying the attacker's `code`; the SPA exchanges it and silently logs the victim into the attacker's account.

The backend sets no cookies and holds no session — the **SPA is the OAuth client and owns the `state`**. So the correct split is: the SPA generates, stores, and validates `state`; the backend just relays it through. The backend half (relaying `state` through `GET /auth/google`, the callback, and accepting it unvalidated in `POST /auth/google`) is mind_api Phase 26. This note is the SPA half.

## Current SPA flow (for reference)

- `src/pages/LoginPage/index.tsx` — `window.location.href = ${API_BASE_URL}/auth/google` (no state).
- `src/pages/GoogleCallbackPage/index.tsx` — reads `googleCode` / `googleError` from the URL and `POST /auth/google` with `{ code, redirectUri }` (no state check).

## Required SPA changes

1. **Generate + store `state` before redirecting to login.** In the Google sign-in initiator (LoginPage), generate a cryptographically random, opaque token (e.g. `crypto.randomUUID()` or hex of `crypto.getRandomValues`), store it in `sessionStorage` under a fixed key (e.g. `oauth_state`), and redirect to `${API_BASE_URL}/auth/google?state=${encodeURIComponent(state)}`.

2. **Validate `state` on the callback before exchanging the code.** In GoogleCallbackPage, read `state` from the query params and compare it to the `sessionStorage` value **first**, before anything else:
   - If missing or mismatched → treat as a failed/forged login: clear the stored state, redirect to `/login?error=google`, and do NOT call `POST /auth/google`.
   - If it matches → remove the stored state (one-time use), then proceed with the existing `googleCode`/`googleError` handling and the code exchange.
   - Keep the existing single-exchange guard (the `didExchange` ref) so React strict-mode double-invoke doesn't double-POST.

3. **(Optional) include `state` in the exchange body.** The backend accepts an optional `state` field on `POST /auth/google` for logging only — it does not validate it. Sending it is harmless and aids debugging; validation stays client-side.

## Constraints / notes

- Use `sessionStorage` (tab-scoped, cleared on tab close) rather than `localStorage` to avoid cross-tab replay.
- `state` must be opaque and unguessable; do not derive it from anything predictable.
- The backend's `redirectUri` allow-list (already enforced in `POST /auth/google`) protects against rogue-redirect code interception but not CSRF — `state` is the missing control.
- Ship in lockstep with mind_api Phase 26: the backend relay-through is a no-op until the SPA generates/validates `state`, and the SPA can't validate until the backend forwards it.
