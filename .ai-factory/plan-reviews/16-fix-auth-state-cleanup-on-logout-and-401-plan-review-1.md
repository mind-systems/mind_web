# Plan Review: Fix auth state cleanup on logout and 401

**Plan:** `16-fix-auth-state-cleanup-on-logout-and-401.md`
**Files Reviewed:** 2 source targets (`src/core/auth/AuthContext.tsx`, `src/core/api/client.ts`) + ROADMAP + ARCHITECTURE
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** PASS. Both edits stay inside the only two modules permitted to touch `localStorage` (`core/auth` and `core/api`). No new cross-layer dependencies, no raw `fetch` introduced. Fully compliant with the dependency rules.
- **Rules:** No `.ai-factory/RULES.md` present — WARN (optional file absent, non-blocking). The CLAUDE.md rules that do apply are honored: `mind_auth_token` key is not renamed, `localStorage` access stays confined to `core/auth` and `core/api`, all edits in English.
- **Roadmap (`.ai-factory/ROADMAP.md`):** PASS. This plan maps exactly to the open Phase 5 item "Fix auth state cleanup on logout and 401". The plan's two tasks mirror the milestone's two described fixes verbatim. Linkage is explicit.
- **Skill-context (`.ai-factory/skill-context/aif-review/SKILL.md`):** Not present — no project-specific overrides to apply.

## Verification Against Source

Both bug claims and both proposed fixes were checked against the current code:

- **Bug 1 confirmed.** `logout()` (AuthContext.tsx:48–52) removes `TOKEN_KEY` and nulls `token` but never touches `PENDING_EMAIL_KEY`. A stale `mind_pending_email` survives logout. `MagicLinkPage` (index.tsx:16) gates its flow on `auth.pendingEmail` being truthy and auto-verifies, so a stale value would drive a silent mismatch verify on the next magic-link visit — exactly as described.
- **Bug 2 confirmed.** `apiFetch` (client.ts:31–36) calls `window.location.assign('/login')` and then unconditionally falls through to `throw new ApiError(...)`, so a rejected promise races the hard navigation and reaches caller catch handlers. The fix is sound.

## Findings

No blocking issues. The plan is correct, minimal, and its file paths / API usage all match the codebase. Notes below are confirmations, not required changes:

- **Task 1 — inline rather than calling `clearPendingEmail`:** Correct call. `clearPendingEmail` is declared (line 59) *after* `logout` (line 48). Reusing it inside `logout` would require adding it to `logout`'s dependency array, which `react-hooks/exhaustive-deps` would flag and which also creates an awkward forward reference. Inlining `localStorage.removeItem(PENDING_EMAIL_KEY)` + `setPendingEmailState(null)` keeps the existing `[navigate]` dep array valid. Both identifiers are in scope inside `logout`. Sound.
- **Task 2 — never-resolving promise:** `return new Promise<T>(() => {})` correctly suppresses both resolve and reject during the unload window. The generic `T` is preserved, so typing is unaffected. The dangling promise is intentional and harmless because `window.location.assign` triggers a full document unload; the React Query observer is torn down with the page. The unconditional `throw` correctly remains the path for all non-401 (and 401-without-token) cases.

## Minor Observations (non-blocking)

- The plan notes the referenced spec `notes/06-auth-state-cleanup.md` does not exist and proceeds from the self-contained milestone text. This is the right handling; the milestone description is complete enough to implement against.
- `login()` still intentionally does not clear `pendingEmail` (it is cleared explicitly by the magic-link/OTP flows). The plan leaves this untouched, consistent with the existing inline comment at AuthContext.tsx:42. No change needed.
- Validation step (`npm run lint` + `npm run typecheck`) is appropriate for a no-test, two-file change.

## Positive Notes

- Both fixes are surgical, localized to the correct modules, and respect the architecture's single-fetch-point / single-localStorage-owner principles.
- The plan anticipates the ESLint dependency-array pitfall and prescribes the inlined form proactively.
- Bug descriptions are precise and match the actual runtime behavior in the source.

PLAN_REVIEW_PASS
