# Module-Aware Session List — Enriched Cell + Module Filter

**Date:** 2026-05-31
**Source:** conversation context — UX review

## Key Findings

- `GET /sessions/runs` items carry `activityType: 'breath' | 'meditation'`, `description: string | null`, and `complexity: number | null` (breath difficulty). The web does not yet consume them.
- The session row in `SessionList.tsx` shows only `formatDate` + `formatDuration` — bare, and gives no hint of which module produced the session.
- Two independent changes: (1) enrich each row, (2) let the user filter by module. Both read the same new fields.

## Details

### Step 0 — Extend the shared type

`src/core/types/index.ts` — `SessionRun` gains three fields, plus an `ActivityType` alias reused by the badge and the detail panel:

```ts
export type ActivityType = 'breath' | 'meditation';

export interface SessionRun {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  activityType: ActivityType;
  description: string | null;
  complexity: number | null;
}
```

### Step 1 — `ModuleBadge` shared component

`src/components/ModuleBadge.tsx` — a small pill rendered from `activityType`. Pure presentation, receives the type as a prop (no data fetching — it lives in `src/components/`, so per ARCHITECTURE.md it takes everything as props).

```tsx
import type { ActivityType } from '@/core/types';

const LABELS: Record<ActivityType, string> = {
  breath: 'Breath',
  meditation: 'Meditation',
};

const STYLES: Record<ActivityType, string> = {
  breath: 'bg-sky-50 text-sky-700',
  meditation: 'bg-violet-50 text-violet-700',
};

export function ModuleBadge({ type }: { type: ActivityType }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLES[type]}`}>
      {LABELS[type]}
    </span>
  );
}
```

### Step 2 — Enriched row in `SessionList.tsx`

Current row: date (top) + `mm:ss` (bottom). New row, top-to-bottom:

- **Line 1:** session title + `ModuleBadge`. Title = `description` for breath; for meditation (`description` is `null`) fall back to `'Meditation'`. Truncate long titles with `truncate` (descriptions are free text and can be long).
- **Line 2:** date · duration · complexity. Duration stays prominent (it is the "total time" the cell should always show). Complexity only for breath: render e.g. `· Difficulty {complexity.toFixed(1)}` when `activityType === 'breath' && complexity != null`; omit for meditation.

Sketch (inside the existing `<Link>`):

```tsx
<span className="flex items-center gap-2">
  <span className="truncate text-sm font-medium text-gray-900">
    {session.description ?? 'Meditation'}
  </span>
  <ModuleBadge type={session.activityType} />
</span>
<span className="mt-0.5 text-xs text-gray-400">
  {formatDate(session.startedAt)} · {formatDuration(session.durationSeconds)}
  {session.activityType === 'breath' && session.complexity != null &&
    ` · Difficulty ${session.complexity.toFixed(1)}`}
</span>
```

Keep the existing selected/hover border-left styling.

### Step 3 — Module filter (segmented control)

The list mixes both modules. Add an `All / Breath / Meditation` segmented control above the list (in `SessionsPage/index.tsx`, inside the left column above `<SessionList>`), filtering the already-loaded `sessions` array — no query change.

- Filter state: `const [moduleFilter, setModuleFilter] = useState<'all' | ActivityType>('all')` in `SessionsPage`.
- Apply: `const visible = moduleFilter === 'all' ? sessions : sessions.filter(s => s.activityType === moduleFilter)`. Pass `visible` to `<SessionList>`.
- Order preserved (filtering keeps reverse-chronological order).
- Edge case: pagination counts loaded items, not filtered items — "Load more" stays driven by the full `sessions`/`hasNextPage`, independent of the active filter. Keep the existing `getNextPageParam` logic unchanged.
- Empty filtered view: when `visible.length === 0` but `sessions.length > 0`, `SessionList` should show a "No {module} sessions" message rather than the generic "No sessions yet" (pass the active filter or an empty-message prop).

This satisfies "split into sections by module" while preserving the single chronological list (segmented filter, not two separate scroll regions, so chronology and "load more" stay intact).

## Backs roadmap tasks

- "Extend SessionRun type and enrich the session cell" (Steps 0–2)
- "Module filter tabs in the session list" (Step 3)
