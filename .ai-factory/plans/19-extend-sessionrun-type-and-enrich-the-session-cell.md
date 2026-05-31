# Plan: Extend SessionRun type and enrich the session cell

## Context
Make the session history list module-aware by carrying `activityType`, `description`, and `complexity` on `SessionRun`, adding a reusable `ModuleBadge`, and redesigning the list row into a two-line cell with title, badge, and metadata.

Authoritative spec: `.ai-factory/notes/09-module-aware-session-list.md` (Steps 0–2; Step 3 is the separate "Module filter tabs" roadmap task and is out of scope here). The API contract is confirmed against `mind_api/src/sessions/sessions.service.ts` (`listRuns` returns `activityType`, `description: string | null`, `complexity: number | null`) and `mind_api/src/realtime/enums/activity-type.enum.ts` (`breath` / `meditation`).

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Types

- [x] **Task 1: Extend `SessionRun` and add `ActivityType` alias**
  Files: `src/core/types/index.ts`
  Add an exported alias `export type ActivityType = 'breath' | 'meditation';`. Extend the existing `SessionRun` interface (currently `id`, `startedAt`, `endedAt`, `durationSeconds`) with three new fields returned by `GET /sessions/runs` items: `activityType: ActivityType`, `description: string | null`, and `complexity: number | null`. Keep existing fields and ordering; do not touch `ListRunsResponse` (the page's `flatMap(p => p.items)` passes items through untouched, so extending `SessionRun` alone surfaces the fields) or other interfaces.

### Phase 2: Shared UI

- [x] **Task 2: Add `ModuleBadge` component** (depends on Task 1)
  Files: `src/components/ModuleBadge.tsx`
  Create a stateless presentational pill component matching the spec signature `{ type: ActivityType }` (prop name `type`, not `activityType` — `ModuleBadge` is reused by the later "Module-aware session detail panel" task, so keep the signature stable). Import `ActivityType` from `@/core/types`. Use label/style lookup maps keyed by activity type:
  - Labels: `breath → 'Breath'`, `meditation → 'Meditation'`.
  - Styles: `breath → 'bg-sky-50 text-sky-700'`, `meditation → 'bg-violet-50 text-violet-700'`.
  - Render a `<span>` with `rounded-full px-2 py-0.5 text-[11px] font-medium` plus the per-type style class.
  No data fetching, no `useQuery`, no `localStorage` (per ARCHITECTURE.md — components in `src/components/` import from `core/types` only and receive everything as props).

### Phase 3: Session list row

- [x] **Task 3: Redesign the `SessionList` row** (depends on Task 1, Task 2)
  Files: `src/pages/SessionsPage/SessionList.tsx`
  Replace the current two-`span` row (`formatDate` + `formatDuration`) inside the `sessions.map(...)` `<Link>` with a two-line layout per the spec sketch:
  - **Line 1:** a `flex items-center gap-2` wrapper containing the session title (`<span className="truncate text-sm font-medium text-gray-900">{session.description ?? 'Meditation'}</span>`) followed by `<ModuleBadge type={session.activityType} />`. The `truncate` keeps long free-text breath descriptions to a single line while the badge stays visible.
  - **Line 2:** `<span className="mt-0.5 text-xs text-gray-400">` rendering `{formatDate(session.startedAt)} · {formatDuration(session.durationSeconds)}` and, for breath sessions only, appending `` · Difficulty ${session.complexity.toFixed(1)} `` when `session.activityType === 'breath' && session.complexity != null` (use `.toFixed(1)` for one-decimal consistency with the detail-panel header; omit entirely for meditation or null complexity).
  Preserve the existing `<Link>` wrapper, `key`, selected-state border-left/hover highlight classes, "Load more" button, loading skeleton, and empty state. Import `ModuleBadge` from `@/components/ModuleBadge`.
