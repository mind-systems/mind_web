# Plan Review: Fix Google OAuth callback parameter names

**Plan:** `15-fix-google-oauth-callback-parameter-names.md`
**Files Reviewed:** 1 plan + 4 supporting source files (mind_web + mind_api)
**Risk Level:** 🟢 Low

## Verdict

The plan is correct, minimal, and well-scoped. Its central assumption was verified end-to-end against the actual API source — not just the plan's own claim.

## Verification of the Core Assumption

The plan claims the API relays `googleCode`/`googleError` while the page reads `code`/`error`. Confirmed against the authoritative source (`mind_api/src/users/controller/google-callback.controller.ts`):

- Success path → `res.redirect(.../auth/google/callback?googleCode=<code>)` (line 46)
- Error path → `res.redirect(.../auth/google/callback?googleError=<error>)` (line 41)

The current `GoogleCallbackPage` (`src/pages/GoogleCallbackPage/index.tsx:19-20`) reads `searchParams.get('code')` and `searchParams.get('error')`, which are never present → the guard at line 22 (`if (error || !code)`) always fails → redirect to `/login?error=google`. The diagnosis is exactly right.

## Accuracy Checks

- **Line numbers** — accurate. `searchParams.get` calls at 19-20, guard at 22, `code` field in the POST body at 30. All match the file.
- **Keep-local-names approach** — correct. Renaming only the query-string keys while keeping local `code`/`error` variables means the guard (line 22) and the POST body field `code` (line 30) need no changes. The body field must stay `code` because `GoogleCodeExchangeDto` expects `code` (controller line 76, `dto.code`), and `ValidationPipe` runs `forbidNonWhitelisted` — sending `googleCode` in the body would 400. Plan correctly preserves this.
- **No collateral damage** — the plan's explicit instruction to leave `LoginPage`'s `?error=google` round-trip and `MagicLinkPage`'s `?code=` untouched is verified sound. `LoginPage` (lines 18-19, 26) uses its own `error=google` convention set by the callback's failure redirect — independent of the API relay keys. They must not be touched.
- **Route path** — `redirectUri` built as `window.location.origin + '/auth/google/callback'` matches the registered route in `router.tsx:36`. Unchanged by this plan; no impact.

## Context Gates

- **Architecture** (`.ai-factory/ARCHITECTURE.md`) — WARN: none. Change is confined to a page component, reads query params, and dispatches via `apiFetch` (the mandated `core/api/client.ts` wrapper). No `core/auth` or `localStorage` boundary touched. Compliant with the Feature-Based Modules pattern.
- **Rules** (root + mind_web `CLAUDE.md`) — pass. All HTTP still flows through `apiFetch`; no raw `fetch`; no `localStorage` access added; English-only. No `mind_auth_token` rename.
- **Roadmap** (`.ai-factory/ROADMAP.md`) — WARN (non-blocking): this is a `fix`-type change with no explicit milestone linkage noted in the plan. Optional to record; does not block.
- **Skill-context** (`.ai-factory/skill-context/aif-review/SKILL.md`) — not present; no project-specific overrides apply.

## Observations (non-blocking)

- **Operational dependency (out of scope, worth knowing).** Even after this fix, the subsequent `POST /auth/google` will 400 (`Invalid redirectUri`) unless `WEB_REDIRECT_URI` in the API env exactly equals `window.location.origin + '/auth/google/callback'` — byte-identical, trailing-slash-sensitive (controller lines 70-74). The plan correctly does not own this, but the person testing the fix should confirm the env match, otherwise the flow will still fail one step later for an unrelated reason.
- **Testing: no** is reasonable for a two-key rename, consistent with the plan's stated settings.

## Positive Notes

- Diagnosis traced to the real root cause, verified against the upstream contract.
- Surgical, single-file, single-commit change with explicit "do not touch" guardrails that prevent breaking the two adjacent flows that legitimately use `code`/`error`.
- Correctly recognizes the missing `notes/05-google-callback-fix.md` spec and falls back to the milestone description rather than inventing scope.

PLAN_REVIEW_PASS
