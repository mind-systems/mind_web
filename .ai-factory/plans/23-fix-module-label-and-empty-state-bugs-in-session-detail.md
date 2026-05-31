# Plan: Fix module label and empty-state bugs in session detail

## Context
Fix two confirmed correctness bugs on the meditation/breath session-detail path: a breath session with a null `description` showing the wrong title "Meditation", and a BCI-less meditation session rendering a blank ~90px chart instead of "No data". Spec: `.ai-factory/notes/12-module-ui-review-followup.md` (Fix 1 and Fix 2 only — Fixes 3–6 are separate Phase 7 milestones).

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Shared title fallback (Fix 1)

- [x] **Task 1: Extract `sessionTitle` helper**
  Files: `src/pages/SessionsPage/sessionTitle.ts`
  Create a new module-local helper that resolves the display title for a session:
  ```ts
  import type { SessionRun } from '@/core/types';

  export function sessionTitle(
    session: Pick<SessionRun, 'description' | 'activityType'>,
  ): string {
    return session.description ?? (session.activityType === 'breath' ? 'Breath' : 'Meditation');
  }
  ```
  This unifies the two divergent fallbacks: `SessionList` currently branches by module, while `SessionCharts` falls back unconditionally to `'Meditation'`. The file lives under `pages/SessionsPage/` so it respects the dependency rules (no `components/ → core` violation). Confirm `SessionRun` exposes `description` and `activityType` in `src/core/types`; adjust the `Pick` field names only if the type uses different names.

- [x] **Task 2: Use `sessionTitle` in both session views** (depends on Task 1)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`, `src/pages/SessionsPage/SessionList.tsx`
  - `SessionCharts.tsx`: replace `{session.description ?? 'Meditation'}` (the header title span, ~line 71) with `{sessionTitle(session)}`, importing the helper.
  - `SessionList.tsx`: replace the inline `{session.description ?? (session.activityType === 'breath' ? 'Breath' : 'Meditation')}` (~line 65) with `{sessionTitle(session)}`, importing the helper.

### Phase 2: Empty state from renderable grids (Fix 2)

- [x] **Task 3: Return `gridCount` from `buildSessionChartOption`**
  Files: `src/pages/SessionsPage/chartOption.ts`
  Add `totalGrids` to the builder's return value so callers can detect when nothing is renderable:
  - Change the return type to `{ option: EChartsOption; height: number; gridCount: number }`.
  - Change the final `return { option, height };` to `return { option, height, gridCount: totalGrids };` (`totalGrids` already exists, computed from the grid-index assignment).
  - Update the JSDoc above the function to mention the returned `gridCount`.

- [x] **Task 4: Derive `isEmpty` from `gridCount`** (depends on Task 3)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`
  The current `isEmpty` keys off raw `instructionsData.length`, but the server writes `session_event` instructions for every session, so a meditation session recorded without a BCI (instructions present, no `breath_phase`, no biometrics) yields `totalGrids === 0` yet `isEmpty === false` — rendering a blank ~90px chart with a `dataZoom` over zero axes.
  - Destructure `gridCount` from the `useMemo` call: `const { option, height, gridCount } = useMemo(...)`.
  - Replace the length-based `isEmpty` block with `const isEmpty = !isLoading && !isError && gridCount === 0;`.
  - The `!isLoading` guard still keeps the skeleton branch winning during fetch, so "No data" won't flash. Removing the zero-grid render also eliminates the stray dataZoom-over-empty-axes case.

## Notes
- Out of scope (separate milestones): filter empty-state wording (Fix 3), `ModuleBadge` fallback (Fix 4), empty-state centering (Fix 5), `complexity === 0` semantics (Fix 6).
- After changes, run `npm run typecheck` and `npm run lint` to confirm the new return shape and imports are clean.
