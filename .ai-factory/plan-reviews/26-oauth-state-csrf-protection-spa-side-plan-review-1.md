# Plan Review: OAuth `state` CSRF protection (SPA side)

**Plan:** `26-oauth-state-csrf-protection-spa-side.md`
**Files Reviewed:** 4 plan tasks against `LoginPage`, `GoogleCallbackPage`, `router.tsx`, `config.ts`, `ARCHITECTURE.md`, `ROADMAP.md`
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** WARN-free / aligned. Placing `oauthState.ts` under `src/core/auth/` keeps browser-storage access inside the architecturally sanctioned storage layer — ARCHITECTURE.md states "`core/auth` is the only place that reads/writes `localStorage`" (lines 60, 163). A `sessionStorage` helper in the same folder honors that boundary, so ARCHITECTURE.md needs no edit. Pages importing `@/core/auth/oauthState` is a legal `pages/ → core/auth` dependency. The helper imports nothing from `src/`, so it respects "`core/auth` — no imports from other `src/` folders."
- **Rules (`.ai-factory/RULES.md`):** WARN — file absent (optional). The relevant convention lives in `mind_web/CLAUDE.md`'s `## Rules` section, which Task 4 correctly updates.
- **Roadmap (`.ai-factory/ROADMAP.md`):** Aligned. This is Phase 8 — Security, the sole open milestone (line 69). The plan matches the roadmap item verbatim, including the lockstep dependency on mind_api Phase 26.

## Critical Issues

None. The plan is correct, the file paths exist, the API usage matches the current code, and the ordering reasoning (consume state *after* the `didExchange` StrictMode guard) is sound — without it, React 18's double-invoke would read-and-remove the one-time token twice and break the legit flow.

## Minor Notes (non-blocking)

1. **`CLAUDE.md` path ambiguity (Task 4).** The task lists `Files: CLAUDE.md`. There are two: the root orchestrator `CLAUDE.md` and `mind_web/CLAUDE.md`. The `## Rules` line being edited (`localStorage` access only in `core/auth/AuthContext.tsx` and `core/api/client.ts`) lives in **`mind_web/CLAUDE.md`** — the implementer should edit that one, not the root. Worth making explicit so the edit doesn't land in the wrong file.

2. **`state` on the error-redirect path.** Task 3 reads and validates `state` *before* inspecting `googleError`. If the backend (mind_api Phase 26) does **not** relay `state` on its failure redirect (e.g. user denies consent at Google → `?googleError=...` with no `state`), the validation fails first and the user is sent to `/login?error=google`. The end-user outcome is identical (both paths land on `/login?error=google`), so this is harmless — but the implementer/reviewer should confirm the backend relays `state` on *both* success and error callbacks so the error message stays accurate and no legitimate flow is misattributed. Non-blocking because the redirect target is the same either way.

3. **`crypto.randomUUID()` secure-context requirement.** `crypto.randomUUID()` is only defined in secure contexts (HTTPS or `localhost`). Dev (`localhost:5173`) and production (HTTPS) both qualify, so this is fine — noted only so it isn't a surprise if the app is ever served over plain HTTP on a non-localhost host. 122 bits of randomness is adequate CSRF-token entropy.

4. **Optional `state` in `POST /auth/google` body.** Task 3 leaves this optional and notes the backend logs but does not validate it. Consistent with the lockstep contract — no objection. The existing `code` + `redirectUri` fields are preserved correctly.

## Positive Notes

- Correct StrictMode reasoning — consuming the one-time token after the `didExchange` ref guard is the right call and is the kind of detail that's easy to get wrong.
- Single-responsibility storage helper (`createOAuthState` / `consumeOAuthState`) with a module-level key constant and read-and-remove semantics is a clean, testable design that keeps `sessionStorage` access in exactly one place.
- `sessionStorage` (tab-scoped) over `localStorage` is the right choice for a transient per-redirect token.
- `encodeURIComponent(state)` on the redirect URL is correct.
- Honest scoping: the plan explicitly states neither half changes behavior until both the SPA and mind_api Phase 26 ship, preventing a half-deployed broken sign-in.

PLAN_REVIEW_PASS
