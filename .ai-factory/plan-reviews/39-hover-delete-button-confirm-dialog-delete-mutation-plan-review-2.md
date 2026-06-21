# Plan Review 2: Hover delete button + confirm dialog + delete mutation

**Plan:** `.ai-factory/plans/39-hover-delete-button-confirm-dialog-delete-mutation.md`
**Files Reviewed:** plan + `core/api/client.ts`, `pages/SessionsPage/{index,SessionList}.tsx`, `pages/LoginPage/index.tsx`, `core/observe/{index,logger}.ts`, `package.json`, prior review (`...-plan-review-1.md`)
**Risk Level:** 🟢 Low

This revision resolves every blocking item from review 1. The plan is now internally consistent and faithful to the existing code patterns. Remaining notes are non-blocking refinements.

## Review-1 follow-up

- **Critical #1 (backend dependency):** RESOLVED. The Context now carries an explicit "Backend prerequisite (blocking for verification)" section naming mind_api Phase 45, the 404-until-shipped runtime behavior, and the contract to confirm (`204` vs `200`, cascade of biometrics + instructions). ✅
- **Critical #2 (unused `ApiError` import breaks build):** RESOLVED. Task 2 now imports only `apiFetch` and spells out the `noUnusedLocals` rationale; `ApiError` formatting is correctly confined to Task 5's render site. ✅
- **Issue #3 (fragile auto-close effect):** RESOLVED. Close is now driven from the `mutateAsync` result via the `handleConfirm` try/catch — no prop-transition effect, no `exhaustive-deps` warning. ✅
- **Issue #4 (button nested in `<a>`):** RESOLVED. Row is restructured to a `group relative` container with a stretched-link `<Link absolute inset-0>` and the trash `<button>` as a sibling — valid HTML. ✅
- **Issue #5 (a11y):** RESOLVED. Dialog now specifies `role="dialog"`, `aria-modal="true"`, and Escape-to-cancel (gated on `!isPending`). ✅
- **Issue #6 (logging):** RESOLVED. Task 2 adds `logger.error` via `@/core/observe` on delete failure. ✅

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** PASS. Page-local `useDeleteSession` under `pages/SessionsPage/` is page-owned data (permitted). `DeleteConfirmDialog` in `src/components/` is props-only with no `useQuery`/`apiFetch`, conforming to the shared-component rule ("Components receive data as props from pages"). `apiFetch` stays the single HTTP path — no raw `fetch`, no separate delete helper. No `localStorage` access added.
- **Rules (project CLAUDE.md):** PASS. PascalCase component / camelCase hook, error handling via `ApiError` at the render site, logging through the `logger` facade (never `console`), no `mind_auth_token` rename, no new env vars, English throughout.
- **Roadmap:** WARN (informational). Maps to the Phase 16 milestone; remains blocked on mind_api Phase 45 for end-to-end verification, which the plan now states explicitly.

## Verified against the codebase

- `logger.error(msg)` exists in `core/observe/logger.ts` and is re-exported from `core/observe/index.ts`. ✅
- `@tanstack/react-query@^5` and `react-router-dom@^7` are installed; `useNavigate` is already used in `AuthContext.tsx` / `GoogleCallbackPage`. `useMutation`/`useQueryClient` import sources are correct. ✅
- The 204 guard placement (immediately before `return res.json()`) is correct, and `return undefined as T` is sound for `apiFetch<void>`. The `!res.ok`/401/tracing paths are untouched. ✅
- Invalidation key `['session-runs']` matches the real `useInfiniteQuery` key in `SessionsPage/index.tsx` exactly. ✅
- Navigate-away logic is correct: `selectedId` comes from `useParams().id`, detail route is `/sessions/:id`, escape is `navigate('/sessions')`. ✅
- LoginPage idioms reused verbatim (spinner span, `instanceof ApiError ? .message : 'Something went wrong'`, secondary-button classes) keep UX consistent. ✅

## Non-blocking notes

- **Stale `deleteError` when reopening on a different row.** If a delete fails and the user dismisses by clicking a *different* row's trash button (rather than Cancel), `resetDelete` isn't called, so the prior error briefly shows in the new dialog. Cancel resets it correctly; this only affects the trash-to-trash path. Minor — optionally also call `onDeleteErrorReset?.()` inside the trash button's `onClick`. Not required for an MVP.
- **Contract confirmation remains an implementation-time check**, not a plan defect: once Phase 45 ships, verify the `204` status and that the cascade truly removes biometrics + instructions (the dialog copy promises both).

## Positive Notes

- Close-on-success-only via `mutateAsync` + try/catch is the robust design recommended in review 1 — no inferred state sync.
- Stretched-link + sibling-button row restructure preserves the whole-card click target while keeping valid, accessible markup.
- Single reusable HTTP path preserved; the 204 guard benefits any future no-content endpoint.
- Sensible commit grouping (API+hook, then UI) and clear task dependencies.

## Verdict

All review-1 blockers are resolved and the plan's codebase assumptions check out. The sole runtime caveat (backend Phase 45) is now documented as an explicit, acknowledged prerequisite rather than a hidden wrong assumption. Ready to implement.

PLAN_REVIEW_PASS
