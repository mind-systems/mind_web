# Plan: Module filter tabs in the session list

## Context
Add an `All / Breath / Meditation` segmented control above the session list so users can focus the left-column list on one module, filtering the already-loaded `sessions` array client-side without changing the infinite query.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Assumptions
- The referenced `notes/09-module-aware-session-list.md` does not exist in the repo; the roadmap entry (ROADMAP.md line 53) is the authoritative spec for this milestone.
- The API already returns items in reverse-chronological order; `Array.prototype.filter` preserves that order, so no re-sorting is needed.
- `ActivityType` (`'breath' | 'meditation'`) already exists in `src/core/types/index.ts` and is reused for the filter value.

## Tasks

### Phase 1: Filter control

- [x] **Task 1: Add the `ModuleFilter` segmented control**
  Files: `src/pages/SessionsPage/ModuleFilter.tsx`
  Create a page-local, stateless segmented control (per ARCHITECTURE rule: page-local feature sub-components live under `pages/<Feature>/`). Define a local `FilterValue = 'all' | ActivityType` type (import `ActivityType` from `@/core/types`). Props: `{ value: FilterValue; onChange: (value: FilterValue) => void }`. Render three `button`s labelled `All`, `Breath`, `Meditation` in a horizontal segmented group. Style with Tailwind consistent with existing components (e.g. a rounded container with `border-b border-gray-200`, active segment `text-blue-600` / inactive `text-gray-500 hover:text-gray-900`, full-width buttons). No internal state — selection is driven entirely by the `value` prop.

### Phase 2: Wiring and empty state

- [x] **Task 2: Wire filter state and filtering into the page** (depends on Task 1)
  Files: `src/pages/SessionsPage/index.tsx`
  - Add `const [filter, setFilter] = useState<FilterValue>('all')` (import `useState` from `react`; reuse the `FilterValue` type exported from `ModuleFilter.tsx`).
  - Derive `const visibleSessions = filter === 'all' ? sessions : sessions.filter((s) => s.activityType === filter)`. Do not touch the `useInfiniteQuery`, `getNextPageParam`, or `selectedSession` logic — `selectedSession` must keep resolving against the full `sessions` array so a selected detail panel does not disappear when the filter hides its row.
  - Render `<ModuleFilter value={filter} onChange={setFilter} />` inside the left column, above the scroll container that wraps `<SessionList>` (between `<PageHeader />` and the `overflow-y-auto` div, or at the top of it).
  - Pass `visibleSessions` to `<SessionList sessions={...} />` instead of `sessions`.
  - Compute and pass an `emptyMessage`: when `filter !== 'all'` and `sessions.length > 0` but `visibleSessions.length === 0`, pass `` `No ${filter === 'breath' ? 'Breath' : 'Meditation'} sessions` ``; otherwise pass `undefined` so the default ("No sessions yet") is used.

- [x] **Task 3: Support a custom empty message in `SessionList`** (depends on Task 2)
  Files: `src/pages/SessionsPage/SessionList.tsx`
  - Add an optional `emptyMessage?: string` prop to `SessionListProps`.
  - In the `sessions.length === 0` branch, render `emptyMessage ?? 'No sessions yet'`.
  - Keep the existing `hasNextPage` "Load more" button reachable in the empty branch: when the filtered list is empty but `hasNextPage` is true, still render the Load-more button below the message so the user can load further pages that may contain the filtered module (preserves the existing `getNextPageParam`/"Load more" behaviour). Reuse the existing button markup.
