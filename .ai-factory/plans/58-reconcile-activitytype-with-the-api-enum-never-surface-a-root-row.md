# Plan: Reconcile `ActivityType` with the API enum; never surface a root row

## Context
Make the web `ActivityType` union honest against the wire enum (`breath | meditation | root`) and add a defensive client-side guard so a `root` run is never rendered, even if the server-side exclusion in `/sessions/runs` ever regresses. Visual output stays byte-for-byte identical.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Reconcile types and guard the list

- [x] **Task 1: Widen `ActivityType` to include `'root'`**
  Files: `src/core/types/index.ts`
  Change `export type ActivityType = 'breath' | 'meditation'` to `export type ActivityType = 'breath' | 'meditation' | 'root'` to mirror `mind_api/src/realtime/enums/activity-type.enum.ts`. Leave `SessionRun` untouched — its projection already matches field-for-field. Do NOT add `rootSessionId`, do NOT widen `endedAt` (both intentionally out of scope).

- [x] **Task 2: Relax `MODULE_LABELS`/`MODULE_STYLES` to partial records** (depends on Task 1)
  Files: `src/components/moduleMeta.ts`
  Change `MODULE_LABELS` and `MODULE_STYLES` from `Record<ActivityType, string>` to `Partial<Record<ActivityType, string>>`. The exhaustive `Record` would otherwise fail to compile once the union gains `root`. Leave `root` intentionally absent from both maps: `moduleLabel` already falls back to `?? type` and `ModuleBadge` to the gray `?? 'bg-gray-100 …'` style — no new keys, no behavior change.

- [x] **Task 3: Filter out `root` rows in the session list** (depends on Task 1)
  Files: `src/pages/SessionsPage/index.tsx`
  After `const sessions = data?.pages.flatMap((p) => p.items) ?? [];` (line 37), append `.filter((s) => s.activityType !== 'root')` so any leaked root row is excluded before selection (`sessions.find`), module filtering, and the empty-state count. Do NOT add a `root` tab to `ModuleFilter` — leave `TABS` as All/Breath/Meditation. This is a belt-and-suspenders guard over the existing server-side exclusion; it drops nothing today.

## Verification
- `npm run typecheck` passes clean.
- `npm run build` passes clean.
- Existing breath/meditation lists and detail panels render identically (no new rows, badges, labels, or empty-state text).
