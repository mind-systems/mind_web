# Reconcile `ActivityType` with the API enum; never surface a root row

**Date:** 2026-07-02
**Source:** conversation context

## Key Findings

- The bio-timeline refactor (mind_api Phases 57–59, live & backward-compatible) added a third `activityType` value, `root`, for the per-app-open continuous bio axis. The web `ActivityType` union is still `'breath' | 'meditation'` — out of sync with the wire enum.
- `/sessions/runs` already excludes root server-side (`sessions.service.ts:91` — `.andWhere('ms.activityType != :root')`), so a root row does not reach the dashboard today. This task is **contract fidelity + a defensive guard**, not a visible behavior change.
- This is the ONLY read-side gap. Everything else the root/child model worried about is already correct in this codebase (see "Non-changes" below) — verified by reading the actual code, not assumed.
- Linked/continuous sessions are not implemented anywhere in the product yet, so the client does **not** need `rootSessionId` — and `/runs` does not project it. Do not add it.

## Details

### Problem today
`src/core/types/index.ts` declares `export type ActivityType = 'breath' | 'meditation'`. The API enum (`mind_api/src/realtime/enums/activity-type.enum.ts`) is `breath | meditation | root`. The dashboard cannot even *express* "exclude a root row" against its own types, and has no defensive guard if the server exclusion ever regresses. Requirement: keep the visual output byte-for-byte identical while making the type honest and guaranteeing root is never rendered.

### Exact change (one concern — reverts as a unit)
1. `src/core/types/index.ts`: widen to `export type ActivityType = 'breath' | 'meditation' | 'root'` (mirror `activity-type.enum.ts`). `SessionRun.activityType` stays `ActivityType`. Do **not** add `rootSessionId` or any other field — the `listRuns` projection is exactly `{id, startedAt, endedAt, durationSeconds, activityType, description, complexity}`, so `SessionRun` already matches field-for-field.
2. `src/components/moduleMeta.ts`: relax `MODULE_LABELS` and `MODULE_STYLES` from `Record<ActivityType, string>` to `Partial<Record<ActivityType, string>>`. Widening the union otherwise breaks compile (exhaustive `Record` demands a `root` key). Leave `root` intentionally absent — `moduleLabel` already falls back to `?? type` and `ModuleBadge` to `?? 'bg-gray-100 …'`. These maps stay keyed to the two renderable modules only.
3. `src/pages/SessionsPage/index.tsx`: after `const sessions = data?.pages.flatMap((p) => p.items) ?? [];` add `.filter((s) => s.activityType !== 'root')` (or a follow-on line) so a leaked root row is never rendered, selected, filtered, or counted in the empty-state logic. Belt-and-suspenders on the server-side exclusion.

### Non-changes (already contract-correct — do NOT touch)
- **Bio provenance**: `bio.moduleSessionId`/`rootSessionId` are read nowhere; `BioSampleDto` carries only `timestamp`/`sampleType`/`data`. Bio is consumed purely by `sampleType`+`timestamp` (`transforms.ts` `toSeries`). The "don't key UI on `moduleSessionId === runId`" warning is a non-issue here.
- **Overlapping runs**: the list is keyed by `session.id`, has no dedup and no next/previous-run assumption; selection is `sessions.find((s) => s.id === id)`. Overlapping child runs render as independent rows — already tolerated.
- **Legacy `rootSessionId = null`**: server-transparent; the web never reads it.
- **Root-cascade delete**: `useDeleteSession` invalidates `['session-runs']` + refetches and navigates away if the deleted id was selected; 409 is handled. Root cascade fires only when deleting the root's last child, so no sibling row goes stale. Surfacing the cascade further would be a *visual* change — out of scope.
- **`SessionRun.endedAt`**: stays non-null. `listRuns` enforces `endedAt IS NOT NULL`, so every `/runs` row is finalized.

### Guards
- Zero visual change: root does not arrive from `/runs` today, so the filter drops nothing currently; the type/`Partial` edits are compile-only; existing fallbacks are unchanged.
- Do **not** add a `root` tab to `ModuleFilter` (`FilterValue = 'all' | ActivityType` gains `'root'` structurally but no tab is rendered — leave `TABS` as All/Breath/Meditation).
- Do **not** widen `SessionRun.endedAt`, do **not** read/add `rootSessionId`.

### Verify
- `npm run typecheck` and `npm run build` pass clean.
- Existing breath/meditation session lists and detail panels render identically to before (no new rows, badges, labels, or empty-state text).

## Open Questions

None. Root grouping / continuous-timeline / connection-gap features are explicitly deferred (linked sessions not implemented product-wide; would require a new mind_api root read endpoint first).
