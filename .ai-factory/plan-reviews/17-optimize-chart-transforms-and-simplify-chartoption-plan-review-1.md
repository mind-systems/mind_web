# Plan Review: Optimize chart transforms and simplify chartOption

**Plan:** `.ai-factory/plans/17-optimize-chart-transforms-and-simplify-chartoption.md`
**Files Reviewed:** 4 target files + echarts type defs
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** PASS. The plan is a pure refactor of existing transform/option-building code inside the `SessionsPage` and `CalibrationPage` feature modules. No dependency-rule changes. Task 3 adds `useMemo` (not `useQuery`) inside `SessionCharts.tsx`, which lives in the page module — no violation of "no `useQuery` in shared components." No `localStorage`, `fetch`, or `core/` boundary touched.
- **Rules (`.ai-factory/RULES.md`):** WARN — file not present (optional). Project rules in `CLAUDE.md`/`ARCHITECTURE.md` are respected: all-English, no raw `fetch`, no proto edits.
- **Roadmap (`.ai-factory/ROADMAP.md`):** PASS. This is a `perf`/cleanup task derived from code review, aligned with Phase 5 (Bug Fixes & Cleanup). No new roadmap linkage strictly required; consider adding a Phase 5 entry for traceability (non-blocking).
- **Skill-context (`.ai-factory/skill-context/aif-review/SKILL.md`):** Not present — no project-specific overrides to apply.

## Verification Against Codebase

All file paths, function names, and counts in the plan match the actual code:

- `toSeries` is called **11 times** in `chartOption.ts` (1 cardio + 5 nfb + 5 emotions) — count is correct (lines 67–79).
- `toSeries` and `secFromStart` are imported/used **only** within `SessionsPage` (`transforms.ts` → `chartOption.ts`); no external callers, no tests. Signature change is safe to apply at all call sites in one place.
- `secFromStart` remains used by `parsePhases` after Task 1, so dropping it from `toSeries` does not create a dead export. ✔
- `BioSampleDto` is already imported in `chartOption.ts` (line 2), so the `Map<string, BioSampleDto[]>` partition needs **no new import**. ✔
- `s.sampleType` is the correct DTO field (`BioSampleDto.sampleType` at `core/types/index.ts:42`). ✔
- `groupByDevice` `orderMap`/sort is genuinely redundant — `groupMap` is populated in first-seen order and JS `Map` iteration is insertion-ordered, so `Array.from(groupMap.entries())` already yields first-seen order. The inner per-group `calibratedAt` sort is correctly retained. ✔

### Task 2 — `xAxisIndex: 'all'` validity (most likely failure point)

Confirmed against installed `echarts@6.1.0` types: `DataZoomOption.xAxisIndex?: ModelFinderIndexQuery`, and `ModelFinderIndexQuery = number | number[] | 'all' | 'none' | false | NullUndefined`. So `xAxisIndex: 'all'` both **typechecks** and is a supported runtime value for `inside`/`slider` dataZoom. Task 2 will not break `npm run typecheck`. ✔

### Behavior preservation (the plan's core invariant: "output charts must remain identical")

- New `toSeries` pair math `(new Date(s.timestamp).getTime() - startMs) / 1000` is algebraically identical to the old `secFromStart(s.timestamp, startedAt)` once `startMs = new Date(startedAt).getTime()`. ✔
- Hoisted `durationSec` using `startMs` is identical to the old expression. ✔
- Partitioning by `sampleType` first, then applying the `typeof s.data[field] === 'number'` guard inside `toSeries`, produces the same filtered set and the same sample ordering as the old two-stage filter. ✔
- `xAxisIndex: 'all'` is functionally equivalent to the explicit `[0..totalGrids-1]` array since every grid's x-axis is included. ✔

## Observations (non-blocking)

1. **Task 1 wording** — "Keep `secFromStart` and `parsePhases` unchanged — they are still used as-is by `parsePhases` callers" is slightly muddled (`secFromStart` is used *inside* `parsePhases`; `parsePhases` is used by `buildSessionChartOption`). Intent is clear and correct: leave both functions untouched.
2. **Task 3 memo effectiveness** — `instructions` and `biometrics` come from React Query, which returns referentially stable arrays between renders unless data changes, so the `useMemo` deps `[instructions, biometrics, session.startedAt, session.endedAt]` will actually memoize effectively. No action needed; just confirming the dependency choice is sound.
3. **Empty-bucket guard** — `toSeries(byType.get('<type>') ?? [], ...)` correctly handles missing sample types via the `?? []` fallback. The presence flags (`hasHeartRate`, `hasEeg`, `hasEmotions`) keep deriving grid layout from the resulting series lengths, so empty buckets still collapse grids exactly as before. ✔

## Positive Notes

- Tasks are correctly ordered with explicit dependencies (Task 2 and 3 depend on Task 1).
- Each task names exact files and includes a `npm run typecheck` verification gate for the signature change.
- The plan correctly identifies which sorts/guards are load-bearing vs. redundant (keeps the chronological calibration sort, removes only the no-op device reordering).
- Scope is tight, single-commit, no behavior change, no migrations — appropriate for a perf cleanup.

## Critical Issues

None.

PLAN_REVIEW_PASS
