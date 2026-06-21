# Plan Review: Gate the trash button on `session.endedAt` + handle the 409 response

**Plan:** `40-gate-the-trash-button-on-session-endedat-handle-the-409-response.md`
**Files Reviewed:** 7 (plan + 6 source/context files)
**Risk Level:** 🟢 Low

## Verdict

The plan is accurate, minimal, and correctly scoped. All file paths, line references, type claims, and wiring assumptions check out against the current codebase. No migrations, no security surface, no architectural concerns. Frontend-only presentational gate plus an error-branch in an existing mutation.

## Verification Against Codebase

**Task 1 — gate in `SessionList.tsx`**
- ✅ The hover-revealed trash `<button>` is at lines 111–136, exactly as stated.
- ✅ `SessionRun.endedAt` is typed `string` (non-null) in `src/core/types/index.ts` (line 18). The plan's claim that the gate is always-true today, and the instruction to keep it as an invariant marker without widening the type, is correct and well-reasoned.
- ✅ The `{session.endedAt != null && ( … )}` guard wraps the button cleanly — sibling to the `<Link>` and the text `<div>` inside the `group relative` container, so hover/focus behavior is unaffected.

**Task 2 — 409 branch in `useDeleteSession.ts`**
- ✅ `ApiError` is exported from `@/core/api/client` (line 7) with a `status` field — import path and `err instanceof ApiError && err.status === 409` check are valid.
- ✅ Invalidation is currently confined to `onSuccess` (lines 12–15); the plan correctly insists this stays put so the row is not removed on 409.
- ✅ The "no change expected, just confirm" wiring all holds:
  - `DeleteConfirmDialog` renders `errorMessage` in `text-red-600` (line 49).
  - `index.tsx` maps `ApiError.message` into the `deleteError` prop (lines 75–81); a 409 `ApiError` surfaces its backend message verbatim — including "Cannot delete a session that is still active".
  - `SessionList.handleConfirm` only calls `setConfirmId(null)` inside the `try` after a resolved `onDelete`, and swallows the throw to leave the dialog open (lines 39–47). A rejected mutation (incl. 409) keeps the dialog open with the inline message. Confirmed.

**Task 3 — typecheck + lint**
- ✅ `logger` is exported from `@/core/observe` (re-exported in `index.ts`), so the minimal 409 log instruction is consistent with the project's logging rule (no `console.*`).

## Context Gates

- **Architecture (ARCHITECTURE.md):** WARN-free. Changes stay within `pages/SessionsPage` and respect the dependency rules — components receive data via props (no `useQuery` added to `SessionList`), all HTTP stays in the existing mutation through `core/api/client`. No boundary violation.
- **Rules (CLAUDE.md project rules):** Compliant. English-only, no `mind_auth_token` touch, no raw `fetch`, logging via the `logger` facade. No storage access added.
- **Roadmap (ROADMAP.md):** This is a follow-up to web Phase 16 (delete control) and aligns with note `26-hide-delete-on-live-session.md` and `mind_api` note 56 (the 409 contract). Linkage is explicit in the plan. No missing roadmap entry of concern for a small fix.

## Observations (non-blocking)

1. **The eslint contingency in Task 1 is moot (in the project's favor).** `eslint.config.js` extends `tseslint.configs.recommended`, **not** `recommendedTypeChecked`/`strictTypeChecked`, so `@typescript-eslint/no-unnecessary-condition` is **not enabled**. The always-true `endedAt != null` gate will not be flagged, so no local disable comment will actually be needed — `npm run lint` (Task 3) will pass clean. The plan's "if it flags, silence locally" is a harmless conditional; just don't add a disable directive preemptively (an unused `eslint-disable` would itself be reported under `reportUnusedDisableDirectives` if configured).

2. **409 log level.** The plan says "log via the `logger`" for the rejected-while-active case without specifying a level. A 409 here is an expected, user-recoverable outcome (not a system failure), so `logger.warn` reads better than `logger.error` and avoids polluting error telemetry. Minor; the existing generic `logger.error` should remain for genuine 403/404/network failures as the plan states. Implementer's discretion.

3. **`onError` shape change.** The current `onError` is a concise expression-bodied arrow returning `logger.error(...)`. Branching on 409 requires converting it to a block body. Trivial and implied by the task, noted only so the implementer doesn't preserve the single-expression form.

## Positive Notes

- Line-level precision (111–136) and an explicit "no change expected, just confirm" verification list make this plan low-risk to execute.
- The decision to keep the always-true gate as a documented invariant rather than widening `endedAt` to `string | null` speculatively is the right call — it avoids forcing null-handling across every `endedAt` consumer for a view that doesn't exist yet.
- Keeping cache invalidation strictly in `onSuccess` is the correct mechanism to guarantee the row persists on 409.

PLAN_REVIEW_PASS
