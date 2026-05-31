# Plan: Harden module filter empty-state and badge fallback

## Context
Close two robustness gaps from the Phase 6 module-awareness review: make the filter empty-state message honest when more pages can still be loaded, and give `ModuleBadge` safe fallbacks for unknown activity types. Full spec: `.ai-factory/notes/12-module-ui-review-followup.md` (Fix 3 and Fix 4).

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Robustness fixes

- [x] **Task 1: Make filter empty-state message conditional on `hasNextPage`**
  Files: `src/pages/SessionsPage/index.tsx`
  Replace the current `emptyMessage` computation (lines 39–42). Extract the module label once and branch the wording on `hasNextPage`:
  ```ts
  const moduleLabel = filter === 'breath' ? 'Breath' : 'Meditation';
  const emptyMessage =
    filter !== 'all' && sessions.length > 0 && visibleSessions.length === 0
      ? (hasNextPage
          ? `No ${moduleLabel} sessions loaded yet — load more below`
          : `No ${moduleLabel} sessions`)
      : undefined;
  ```
  `hasNextPage` is already destructured from `useInfiniteQuery` and passed to `SessionList`, whose empty branch only renders the "Load more" button when `hasNextPage` is true — so the reworded message and the control now agree. No other logic changes.

- [x] **Task 2: Add fallbacks for unknown `activityType` in `ModuleBadge`**
  Files: `src/components/ModuleBadge.tsx`
  Inside the component, resolve label and style through nullish fallbacks instead of indexing `LABELS[type]` / `STYLES[type]` directly:
  ```tsx
  export function ModuleBadge({ type }: ModuleBadgeProps) {
    const label = LABELS[type] ?? type;
    const style = STYLES[type] ?? 'bg-gray-100 text-gray-600';
    return (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>
        {label}
      </span>
    );
  }
  ```
  An unknown runtime value now renders its raw string as the label with a neutral gray style, instead of `class="… undefined"` and an empty label. Keep the `LABELS`/`STYLES` maps and `ModuleBadgeProps` typed as-is (the `Record<ActivityType, …>` typing stays; the fallback handles runtime values outside the compile-time union). Both fallback class strings are literals so Tailwind's content scan keeps them.

## Out of scope
Only Fix 3 and Fix 4 from the note are part of this milestone. Fixes 1, 2, 5, and 6 (session-title helper, renderable empty-state, vertical centering, `complexity === 0` semantics) are not included.
