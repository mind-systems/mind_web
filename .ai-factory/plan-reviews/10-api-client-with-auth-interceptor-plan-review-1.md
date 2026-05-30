# Plan Review: API client with auth interceptor

**Plan:** `10-api-client-with-auth-interceptor.md`
**Files Reviewed:** plan + `src/core/api/client.ts`, `src/core/config.ts`, three auth pages, `ARCHITECTURE.md`, `ROADMAP.md`
**Risk Level:** 🟢 Low

## Summary

This is a verification/reconciliation plan, not a build-from-scratch plan — `src/core/api/client.ts` already exists and the milestone work is largely done. The plan correctly recognizes this and frames the milestone as auditing the existing implementation against the spec rather than rewriting it. Every factual claim the plan makes about the codebase was confirmed accurate.

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** ✅ Aligned. The plan's Task 2 dependency rules match the architecture document exactly: `core/api` is the only `fetch` site, `client.ts` is an explicitly-sanctioned `localStorage` accessor (anti-pattern list, line 163, names both `AuthContext.tsx` and `client.ts`), and no component calls `apiFetch`. Verified: only the three auth pages import `apiFetch`; no component does.
- **Rules (`.ai-factory/rules/base.md`):** ✅ No conflict. (No project `skill-context/aif-review/SKILL.md` present — nothing to override defaults.)
- **Roadmap (`ROADMAP.md`):** ✅ The milestone "API client with auth interceptor" is the current `[ ]` Phase 2 item; the plan maps to it directly. Note the roadmap line states only "On 401: clear token, navigate to /login" with no token-present guard, while the implementation guards on `token` being present. The plan explicitly calls this out and justifies preserving the guard — a correct and well-argued reconciliation rather than a silent divergence.

## Verification of plan claims against `client.ts`

All clauses in Task 1 hold against the actual code:

- Prepends `API_BASE_URL` from `@/core/config` — ✅ (line 17)
- `Content-Type: application/json` + `Authorization: Bearer <token>`; caller `options.headers` override defaults — ✅ (`...options?.headers` spread last, line 22, wins over defaults)
- 401 handling guarded on `token` present before clear+redirect — ✅ (line 31); uses `window.location.assign('/login')`, correct since the client has no React Router context
- Non-2xx → `ApiError(status, message)`; non-JSON tolerated via `.catch(() => ({}))`; array `message` joined; fallback `'Request failed'` — ✅ (lines 27–36)
- `ApiError` extends `Error`, numeric `status` — ✅ (lines 5–12)

File paths in all three tasks are correct and the consuming pages exist as stated.

## Critical Issues

None. The plan introduces no new code, no migrations are relevant (frontend-only), and no security regression is possible from a verification pass. The token-clear-on-401 and the inline-error auth flow are correctly preserved.

## Minor Observations (non-blocking, optional)

1. **Empty-body success responses.** `apiFetch` ends with `return res.json()`. A 2xx response with an empty body (e.g. a NestJS endpoint returning `void` / `204`) would make `res.json()` throw a `SyntaxError`, surfacing in pages as the generic "Something went wrong" rather than success. `LoginPage`'s `POST /auth/send-code` is the realistic candidate. This is **outside the milestone spec** (the spec only addresses non-2xx and base-URL/header/401 behavior), so it is not a deviation the plan must fix — but if Task 1's audit wants to be thorough, it is worth a one-line note on whether `send-code` returns a body. Defer unless it actually breaks at runtime.

2. **`message` fallback on explicit `null`.** `m ?? 'Request failed'` falls back when `body.message` is `null`/`undefined`. This matches the spec's intent; no action needed — noted only for completeness.

## Positive Notes

- The plan resists over-engineering: it explicitly forbids rewriting working code or adding scope, which is the correct posture for a milestone whose code already exists.
- The 401-guard rationale is documented in-plan, preventing a future agent from "fixing" the intentional guard into an unconditional redirect that would break the login inline-error UX.
- Task 3 (typecheck + lint + build) is an appropriate and sufficient acceptance gate for a verification milestone.

PLAN_REVIEW_PASS
