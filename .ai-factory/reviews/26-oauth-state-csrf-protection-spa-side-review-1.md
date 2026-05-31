# Code Review: OAuth `state` CSRF protection (SPA side)

**Plan:** `26-oauth-state-csrf-protection-spa-side.md`
**Changed files reviewed (in full):**
- `src/core/auth/oauthState.ts` (new)
- `src/pages/LoginPage/index.tsx`
- `src/pages/GoogleCallbackPage/index.tsx`
- `CLAUDE.md`

**Build gates:** `npm run typecheck` ✓ clean · `npm run lint` ✓ clean

**Risk Level:** 🟢 Low

## Summary

The implementation matches the plan precisely and is correct. A one-time `state` token is generated and stored in `sessionStorage` before the redirect, then read-and-removed and compared in the callback before any code exchange. No blocking defects found.

## Correctness analysis

- **StrictMode double-invoke is handled correctly.** The state consume (`consumeOAuthState()`) is placed *after* the `didExchange` ref guard. Invoke 1 sets the ref, consumes state, validates, and exchanges the code; invoke 2 returns at the guard. Both the one-time `state` and the single-use `googleCode` are therefore consumed exactly once. This was the highest-risk detail and it is right.
- **`sessionStorage` persistence across the redirect chain.** `sessionStorage` is tab-scoped and survives top-level navigations within the same tab, so the token set in `LoginPage` survives the full `/auth/google` → Google → backend callback → SPA callback redirect sequence. Correct choice over `localStorage` for a transient per-redirect token.
- **Validation ordering and short-circuit.** `if (!returnedState || !storedState || returnedState !== storedState)` covers all three failure cases (missing returned state, no stored state, mismatch) and `return`s before `apiFetch`, so `POST /auth/google` is never called on a failed/forged callback. ✓
- **Read-and-remove semantics.** `consumeOAuthState` removes the key unconditionally even on a failed validation; a retry from `LoginPage` mints a fresh token via `createOAuthState`. No stale-token reuse. ✓
- **`encodeURIComponent(state)`** on the redirect URL is correct (UUIDs are URL-safe regardless, but the encoding is harmless and defensive).
- **`CLAUDE.md` storage rule** updated to include `sessionStorage` and `core/auth/oauthState.ts` in the allow-list — the edit landed in the correct `mind_web/CLAUDE.md`, honoring the rule's intent (storage confined to dedicated modules).

## Non-blocking observations

1. **Deployment ordering (coordination, not a code defect).** The plan note says "neither half changes behavior until both ship," but from the SPA's side this is asymmetric: once this SPA ships, the callback *requires* `state` to be relayed back. If mind_api Phase 26 is **not** yet deployed, the backend will not relay `state`, `returnedState` will be `null`, validation will fail, and **every** Google sign-in will break. The backend half must ship first (or simultaneously). This is the documented lockstep requirement, not a bug in this code, but worth flagging explicitly for the deploy: deploy/verify mind_api Phase 26 before (or with) this SPA change.

2. **`state` validated before `googleError` is inspected.** If the user denies consent at Google and the backend redirects with `googleError` and no `state`, state validation fails first and the user lands on `/login?error=google`. The end-user outcome is identical to the explicit-error path, so this is harmless — assuming mind_api relays `state` on its success callback (the only path where a non-error code exchange occurs). No change needed.

3. **`crypto.randomUUID()` secure-context requirement.** Defined only in secure contexts (HTTPS / `localhost`). Dev (`localhost:5173`) and production (HTTPS) both qualify. 122 bits of entropy is adequate CSRF-token strength. Noted only so it isn't a surprise if the app is ever served over plain HTTP on a non-localhost host.

4. **String comparison is not constant-time.** Acceptable and conventional for CSRF state-token matching — there is no meaningful timing oracle to exploit here (the token is sent by the client and is single-use).

No changes required.

REVIEW_PASS
