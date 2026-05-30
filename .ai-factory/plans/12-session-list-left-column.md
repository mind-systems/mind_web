# Plan: Session list (left column)

## Context
Populate the left column of `SessionsPage` with a paginated, scrollable list of past sessions fetched from `GET /sessions/runs`, with selection highlighting, row-click navigation, skeleton loading, and an empty state.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Reconnaissance Notes
- **Endpoint:** `GET /sessions/runs?limit&offset` (JWT-guarded). Returns `{ items: { id: string; startedAt: string; endedAt: string; durationSeconds: number }[]; total: number }`. Ordered `startedAt DESC`, default `limit` 50 (max 200), offset-based pagination. Confirmed in `mind_api/src/sessions/sessions.service.ts` (`listRuns`) and `dto/list-runs-query.dto.ts`.
- **Host page:** `src/pages/SessionsPage/index.tsx` already renders the split-panel shell; the left column has a placeholder `{/* session list — next milestone */}` inside a `flex-1 overflow-y-auto` container. Selected id comes from `useParams<{ id?: string }>()`.
- **API access:** all HTTP goes through `apiFetch<T>` in `src/core/api/client.ts`. No date library is installed — format with small native helpers (no new dependency).
- **Architecture rules:** pages own `useQuery`; components are presentational and receive data via props (no fetch in components). Shared UI lives in `src/components/`. ARCHITECTURE.md already references a `components/SkeletonLoader.tsx`.

## Tasks

### Phase 1: Types & helpers

- [x] **Task 1: Add session-run response types**
  Files: `src/core/types/index.ts`
  Add `SessionRun` (`id: string; startedAt: string; endedAt: string; durationSeconds: number`) and `ListRunsResponse` (`items: SessionRun[]; total: number`) interfaces mirroring the `mind_api` `listRuns` response shape. Append to the existing exports.

- [x] **Task 2: Add date/duration format helper**
  Files: `src/pages/SessionsPage/format.ts`
  Create pure helpers using native `Date`/`Intl` (no new dependency):
  - `formatSessionDate(iso: string): string` → `DD MMM, HH:mm` (e.g. `30 May, 14:05`), 24-hour, zero-padded.
  - `formatDuration(seconds: number): string` → `mm:ss` (e.g. `07:32`), zero-padded; handles durations ≥ 60 minutes by allowing minutes to exceed 99.

- [x] **Task 3: Create SkeletonLoader component**
  Files: `src/components/SkeletonLoader.tsx`
  Stateless presentational component rendering placeholder rows with Tailwind `animate-pulse` (gray bars). Accept an optional `rows?: number` prop (default ~6) so the session list can render a list-shaped skeleton. Import only from `core/types` if needed.

### Phase 2: List component

- [x] **Task 4: Create SessionList presentational component** (depends on Task 1, 2, 3)
  Files: `src/pages/SessionsPage/SessionList.tsx`
  Stateless component, props: `{ sessions: SessionRun[]; selectedId?: string; isLoading: boolean; isFetchingNextPage: boolean; hasNextPage: boolean; onLoadMore: () => void }`. No data fetching inside.
  - While `isLoading` (initial load, no data yet): render `<SkeletonLoader rows={6} />`.
  - If not loading and `sessions.length === 0`: render centered "No sessions yet" empty state (muted gray text).
  - Otherwise render a vertical list of rows. Each row is a React Router `<Link to={`/sessions/${session.id}`}>` (client-side nav, no reload) showing `formatSessionDate(startedAt)` (primary line) and `formatDuration(durationSeconds)` (secondary, muted). Highlight the row when `session.id === selectedId` (e.g. `bg-gray-100`/accent left border); hover state on others.
  - Below the list, when `hasNextPage`: a full-width "Load more" button calling `onLoadMore`, disabled and showing "Loading…" while `isFetchingNextPage`.

### Phase 3: Wire into page

- [x] **Task 5: Fetch runs and mount SessionList in SessionsPage** (depends on Task 4)
  Files: `src/pages/SessionsPage/index.tsx`
  In the page, add a `useInfiniteQuery` (TanStack Query v5) with key `['session-runs']`, `queryFn` calling `apiFetch<ListRunsResponse>('/sessions/runs?limit=50&offset=' + pageParam)`, `initialPageParam: 0`, and `getNextPageParam` that sums loaded `items` across pages and returns the next offset only while `loadedCount < total` (else `undefined`). Flatten `data.pages.flatMap(p => p.items)` into the `sessions` array. Replace the left-column placeholder with `<SessionList ... />`, passing `selectedId={id}` (from existing `useParams`), `isLoading`, `isFetchingNextPage`, `hasNextPage`, and `onLoadMore={() => fetchNextPage()}`. Keep the existing header (title + logout) and the `flex-1 overflow-y-auto` scroll container.
