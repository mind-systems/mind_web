# Code Review: Hover delete button + confirm dialog + delete mutation

**Plan:** `.ai-factory/plans/39-hover-delete-button-confirm-dialog-delete-mutation.md`
**Files reviewed (in full):** `src/core/api/client.ts`, `src/pages/SessionsPage/useDeleteSession.ts`, `src/components/DeleteConfirmDialog.tsx`, `src/pages/SessionsPage/SessionList.tsx`, `src/pages/SessionsPage/index.tsx`, plus `src/core/observe/index.ts` (export check).
**Build gates:** `npm run typecheck` ✅ clean · `npm run lint` ✅ clean.

## Summary

The implementation matches the (revised) plan faithfully and is correct. All five tasks landed as specified: the 204 guard sits in the right place, the mutation hook imports only `apiFetch` + `logger` (no unused `ApiError`, so `noUnusedLocals` is satisfied), the dialog is props-only, the row is restructured so the trash `<button>` is a valid sibling of the stretched `<Link>` (no interactive-in-interactive nesting), and the close mechanism is driven by `mutateAsync`'s resolve/reject rather than a fragile effect. No bugs, security issues, or correctness problems found.

## Correctness verification

- **204 guard** (`client.ts:48`) — placed after the `!res.ok` block and before `res.json()`, so error bodies are still parsed and only genuinely empty success responses short-circuit. `undefined as T` is correct for the `apiFetch<void>` call site.
- **Navigate-away** (`useDeleteSession.ts:12-15`) — `onSuccess` invalidates `['session-runs']` (key matches the real `useInfiniteQuery` key) and navigates to `/sessions` only when the deleted id equals the open route id. `SessionList` stays mounted across that navigation, so the subsequent `setConfirmId(null)` runs harmlessly.
- **Error surfacing** — `mutateAsync` rejects on failure and is caught in `handleConfirm` (`SessionList.tsx:39-47`), leaving the dialog open; the rejection is also handled by the hook's `onError` logger, so there is no unhandled promise rejection. The `deleteError` string is only ever displayed while the dialog is open, and every cancel path (`Cancel`, overlay click, Escape) calls `resetDelete()`, so a failed-then-cancelled delete cannot leak a stale error into a later dialog.
- **Click isolation** — trash `onClick` calls `preventDefault()` + `stopPropagation()` and sits at `z-10` above the `z-0` stretched link; the text block is `pointer-events-none` so card clicks fall through to the `<Link>`. Verified no transform/filter/`will-change` ancestor exists between the dialog and the viewport, so the dialog's `fixed inset-0` correctly overlays the full screen (and the overlay covers the row trash buttons, preventing concurrent deletes while pending).
- **Pending lockout** — Delete/Cancel buttons, overlay click, and Escape are all gated on `!isPending`, so a single in-flight delete cannot be double-submitted or dismissed mid-flight.

## Non-blocking observations (optional polish, no action required)

1. **Backend dependency still open (expected).** `DELETE /sessions/runs/:id` does not yet exist in `mind_api` (Phase 45). This is already documented as a blocking prerequisite in the plan's Context section; the frontend is correct in isolation but will 404 at runtime until the endpoint ships. Confirm the `204` vs `200` status and the biometrics+instructions cascade once it lands. Not a code defect.
2. **Escape listener re-subscribes each render** (`DeleteConfirmDialog.tsx:18-25`) — `onCancel` is an inline arrow recreated by `SessionList` every render, so the effect tears down/re-adds the `keydown` listener on each render while open. Purely a micro-inefficiency, not a bug.
3. **Dialog a11y could go further** — has `role="dialog"` + `aria-modal` and Escape-to-close, but no `aria-labelledby` pointing at the heading and no focus trap / autofocus on a button. Acceptable for this MVP per the plan.

## Verdict

No blocking findings. Implementation is correct, type-safe, lint-clean, and faithful to the plan.

REVIEW_PASS
