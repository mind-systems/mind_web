# Plan Review: Extend SessionRun type and enrich the session cell

**Plan:** `.ai-factory/plans/19-extend-sessionrun-type-and-enrich-the-session-cell.md`
**Risk Level:** 🟡 Medium (technically sound; one wrong assumption and two divergences from the authoritative spec)

## Verification Summary

I verified the plan against the live codebase and the upstream API contract:

- **API contract confirmed.** `mind_api/src/sessions/sessions.service.ts` (`listRuns`) returns each run item with exactly `activityType`, `description: string | null`, and `complexity: number | null` (lines 49–95). `complexity` is coerced to a `number` (`Number(r.bs_complexity)`), so `complexity: number | null` in the type is correct.
- **`ActivityType` values confirmed.** `mind_api/src/realtime/enums/activity-type.enum.ts` defines `BREATH = 'breath'` and `MEDITATION = 'meditation'`. The proposed `'breath' | 'meditation'` alias matches exactly.
- **Data flow confirmed.** `SessionsPage/index.tsx` fetches `ListRunsResponse` and does `data.pages.flatMap(p => p.items)` with no `select` transform that strips fields — extending the `SessionRun` interface is sufficient to surface the new fields in `SessionList`. No change to `ListRunsResponse` needed, as the plan correctly states.
- **File paths confirmed.** `src/core/types/index.ts`, `src/components/`, and `src/pages/SessionsPage/SessionList.tsx` all exist and match the plan's targets. No migration is involved (read-only web client).

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** PASS. Placing `ModuleBadge` in `src/components/` and importing only from `@/core/types` with no data fetching honors the "Components import from `core/types` only" dependency rule. The page-owns-data / component-renders-props split is respected.
- **Rules (`rules/`):** PASS. PascalCase component file, camelCase fields, Tailwind-only styling — all consistent.
- **Roadmap (`ROADMAP.md`):** PASS. This plan maps directly to the first Phase 6 task and correctly scopes itself to the cell enrichment, leaving the module filter (`'No {module} sessions'` empty state, segmented control) to the next roadmap task.

## Critical Issues

None. The plan is implementable as written and will produce correct, type-safe code.

## Findings

### 1. Wrong assumption — the referenced spec file DOES exist (WARN)
The plan's "Assumption" block (line 6) states:
> The referenced `notes/09-module-aware-session-list.md` spec file does not exist in the repository.

This is incorrect. `.ai-factory/notes/09-module-aware-session-list.md` exists and is the authoritative spec for this task (it is even cited by name in the ROADMAP entry). The plan happened to re-derive matching tasks, so no functional harm resulted — but the planner should have consumed the spec rather than declaring it missing. The two divergences below stem directly from not reading it.

### 2. `ModuleBadge` prop name diverges from the spec (WARN)
The plan defines the prop as `{ activityType: ActivityType }` and uses `<ModuleBadge activityType={session.activityType} />`. The spec (note 09, Step 1) defines it as `{ type: ActivityType }` with usage `<ModuleBadge type={...} />`. Both work and the plan is internally consistent, but `ModuleBadge` is reused by a later Phase 6 task ("Module-aware session detail panel", note 10). Pick one prop name now and keep it consistent so the detail-panel task doesn't have to refactor the signature. Recommend matching the spec (`type`) unless there's a reason to prefer the more explicit `activityType`.

### 3. Difficulty formatting diverges from the spec (WARN)
Task 3 renders `Difficulty {complexity}` (raw number → e.g. "Difficulty 3.5" or "Difficulty 3"). The spec specifies `Difficulty ${complexity.toFixed(1)}` (always one decimal → "Difficulty 3.0"). The detail-panel task (note 10) also expects the `.toFixed(1)` form. Align on `.toFixed(1)` for visual consistency across the list cell and the detail header. Minor/cosmetic.

## Positive Notes

- Correctly identifies that only the `SessionRun` interface needs extending — no `ListRunsResponse` or query change — because the existing `flatMap` passes items through untouched.
- Respects the architecture's component boundary (badge is pure presentation, props-only, no fetch/localStorage).
- Properly scopes complexity display to `breath` sessions with a `complexity != null` guard, and handles the null-`description` fallback for meditation.
- Sensible task dependency ordering (types → badge → row) with explicit `depends on` annotations.
- Correctly defers the module filter and its empty-state copy to the separate roadmap task rather than scope-creeping.

## Recommendation

The plan is technically correct and safe to implement. Before implementing, apply three small corrections for spec alignment: (1) remove/fix the false "spec does not exist" assumption and reconcile with `notes/09-module-aware-session-list.md`; (2) settle the `ModuleBadge` prop name to match what the Phase 6 detail-panel task will reuse; (3) use `complexity.toFixed(1)` for the Difficulty label. None are blocking.
