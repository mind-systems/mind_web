# Plan: Gate the trash button on `session.endedAt` + handle the 409 response

## Context
Make the session delete control render only for finalized sessions (`endedAt` present) and ensure a backend 409 ("session still active") keeps the row with an inline error instead of optimistically removing it.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Gate the delete affordance

- [x] **Task 1: Render the trash button only for finalized sessions**
  Files: `src/pages/SessionsPage/SessionList.tsx`
  Wrap the existing hover-revealed trash `<button>` (currently lines ~111–136) in a `{session.endedAt != null && ( … )}` guard so it renders only when the session is finalized. Do not change the button markup, classes, or `onClick`. This gate is the single documented enforcement point for "live sessions are not deletable" per `.ai-factory/notes/26-hide-delete-on-live-session.md`.
  Note on typing: `SessionRun.endedAt` in `src/core/types/index.ts` is currently `string` (non-null) because `listRuns` guarantees it, so the gate is always true in the list today — keep it anyway to document the invariant. Do NOT widen the type now; only widen to `string | null` if/when a live-session row or detail view that can carry a null `endedAt` is added. If `@typescript-eslint/no-unnecessary-condition` flags the always-true comparison, leave the gate and silence it locally rather than removing it.

### Phase 2: Make the 409 delete path explicit

- [x] **Task 2: Distinguish the 409 response in the delete mutation** (depends on Task 1)
  Files: `src/pages/SessionsPage/useDeleteSession.ts`
  In the mutation's `onError`, explicitly distinguish `err instanceof ApiError && err.status === 409` ("Cannot delete a session that is still active") from 403/404/network errors. For 409, log via the `@/core/observe` `logger` that the deletion was rejected because the session is still active, and do NOT add any cache invalidation or row removal — invalidation must remain confined to `onSuccess` so the row stays put while the session is running. Keep the existing generic `logger.error` for the non-409 cases. Import `ApiError` from `@/core/api/client`.
  Verification of the existing wiring (no change expected, just confirm): the dialog already shows `deleteError` in `text-red-600` (`src/components/DeleteConfirmDialog.tsx`), `index.tsx` maps `ApiError.message` into `deleteError`, and `SessionList.handleConfirm` only calls `setConfirmId(null)` on success — so a rejected mutation (incl. 409) already keeps the dialog open with the inline message. Confirm these paths still hold after the change.

- [x] **Task 3: Verify gate + 409 behavior compiles and lints clean** (depends on Task 2)
  Files: (no source changes unless a check fails)
  Run `npm run typecheck` and `npm run lint`. Manually confirm against the spec's guards: a finalized row shows the trash button on hover; a row with `endedAt == null` shows no button; a delete returning 409 keeps the row and shows the inline `text-red-600` message in the confirm dialog instead of closing silently.
