# Hide the delete affordance on a live (non-finalized) session

**Date:** 2026-06-21
**Source:** conversation context

## Key Findings

- The delete button (Phase 16) must **never render for a live/in-flight session** — only finalized runs are deletable. A live session cannot be deleted (it would corrupt the backend realtime state machine; the API rejects it with 409 — see mind_api note 56).
- "Finalized" on the client = **`endedAt` is present** (and/or a terminal status). The session list (`GET /sessions/runs`) already filters to ended sessions server-side, so list rows are always finalized — but the dashboard reads in-flight session data through endpoints that intentionally allow live reads, so a live session can appear in a live-session view; the gate makes the rule explicit and safe everywhere, not only in the already-filtered list.
- Belt-and-suspenders: also handle the backend **409** response (a session that finalized-then-resumed, or any race) by surfacing its message in the confirm dialog instead of optimistically removing the row.

## Details

### Scope — separate atomic milestone, depends on web Phase 16 + mind_api note 56

Pure presentational gate on the existing delete control plus a 409 error path. No new route, no data-fetching change.

### Gate — `src/pages/SessionsPage/SessionList.tsx` (+ any live-session view that grows a delete control)

Render the trash `<button>` only when the session is finalized:

```tsx
{session.endedAt != null && (
  <button …delete… />
)}
```

`SessionRun.endedAt` is currently typed non-null (`src/core/types/index.ts`) because `listRuns` guarantees it — so in the list the gate is always true today. Keep the gate anyway: it documents the invariant and is the single enforcement point if a live session ever reaches a row/detail view (where `endedAt` would be null/absent — widen the type to `string | null` there if such a view is added).

### 409 handling — the delete mutation (Phase 16)

In the mutation's error path, if `err instanceof ApiError && err.status === 409`, show the message ("Cannot delete a session that is still active") inline in the dialog (`text-red-600`) and do NOT invalidate/remove — the session is still running. Distinguish from 403/404/network (already handled in Phase 16).

### Guards / verify

- A finalized session row shows the button on hover (unchanged from Phase 16).
- A live session (endedAt null) shows no delete button.
- A delete that returns 409 keeps the row and shows the inline message rather than silently closing.

## Open Questions

None — gate predicate (`endedAt` present) and the 409 path are settled.
