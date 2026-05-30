# Plan: Optimize chart transforms and simplify chartOption

## Context
Four independent, low-risk performance and readability improvements to the session and calibration chart-building code surfaced by code review. No behavior changes — output charts must remain identical.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Session chart transforms

- [x] **Task 1: Pre-partition biometrics and hoist `startMs`; rework `toSeries`**
  Files: `src/pages/SessionsPage/transforms.ts`, `src/pages/SessionsPage/chartOption.ts`
  Currently `buildSessionChartOption` calls `toSeries` 11 times, each performing a full `samples.filter((s) => s.sampleType === sampleType)` scan plus a `new Date(startedAt)` construction per sample — O(n×11) work.
  - In `transforms.ts`, change the `toSeries` signature to `toSeries(samples: BioSampleDto[], field: string, startMs: number): [number, number][]`. The `samples` argument is now assumed to be already filtered by `sampleType`, so drop the `.filter((s) => s.sampleType === sampleType)` step. Keep the `typeof s.data[field] === 'number'` guard. Compute each pair inline as `[(new Date(s.timestamp).getTime() - startMs) / 1000, s.data[field] as number]` (no longer call `secFromStart`, since it re-parses `startedAt` every call). Update the JSDoc to reflect the new contract (pre-filtered samples, `startMs` number).
  - Keep `secFromStart` and `parsePhases` unchanged — they are still used as-is by `parsePhases` callers.
  - In `chartOption.ts`, inside `buildSessionChartOption`, before any `toSeries` call:
    - Hoist `const startMs = new Date(startedAt).getTime();` and reuse it for the `durationSec` computation (`(new Date(endedAt).getTime() - startMs) / 1000`).
    - Partition `biometrics` by `sampleType` in a single pass into a `Map<string, BioSampleDto[]>` (e.g. `byType`). Iterate once, pushing each sample into its `sampleType` bucket.
    - Replace each `toSeries(biometrics, '<type>', '<field>', startedAt)` call with `toSeries(byType.get('<type>') ?? [], '<field>', startMs)`. Mapping: `'cardio'` → heartRate; `'nfb'` → delta/theta/alpha/smr/beta; `'emotions'` → attention/relaxation/cognitiveLoad/cognitiveControl/selfControl.
  - Verify with `npm run typecheck` that the new signature is applied at all 11 call sites.

- [x] **Task 2: Replace `allXAxisIndices` array with the `'all'` string** (depends on Task 1)
  Files: `src/pages/SessionsPage/chartOption.ts`
  Remove the `const allXAxisIndices = Array.from({ length: totalGrids }, (_, i) => i);` line. In both `dataZoom` entries (`inside` and `slider`), set `xAxisIndex: 'all'` (the ECharts built-in that links every x-axis). Keep the `height` computation line that currently follows the removed line.

### Phase 2: Memoization and calibration cleanup

- [x] **Task 3: Wrap `buildSessionChartOption` in `useMemo`** (depends on Task 1)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`
  Import `useMemo` from `react`. Wrap the `buildSessionChartOption(instructions, biometrics, session.startedAt, session.endedAt)` call in a `useMemo`, destructuring `{ option, height }` from its result. Dependency array: `[instructions, biometrics, session.startedAt, session.endedAt]`. The call must remain unconditional (above any early return) — the existing comment about always computing height still applies; preserve its intent.

- [x] **Task 4: Remove dead device sort and `orderMap` from `groupByDevice`**
  Files: `src/pages/CalibrationPage/transforms.ts`
  `Map` iteration is already insertion-ordered, so `orderMap` and the `Array.from(groupMap.entries()).sort(...)` that reorders devices by first-seen index are redundant.
  - Delete the `orderMap` declaration and all writes to it.
  - Replace the sorted `devices` expression with a direct `Array.from(groupMap.entries())` (already in first-seen order).
  - Keep the inner per-group `[...recs].sort((a, b) => calibratedAt asc)` — that chronological sort is real and required (API returns DESC order).
  - Update the leading JSDoc comment to drop the mention of preserving first-seen order via an explicit sort.

## Commit
Single commit after all tasks: "Optimize session chart transforms and simplify chart option building"
