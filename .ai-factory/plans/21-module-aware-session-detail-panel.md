# Plan: Module-aware session detail panel

## Context
Make the session detail panel module-aware: enrich the `SessionCharts` header with module badge / title / breath difficulty, and make `chartOption.ts` allocate the breath-phase instruction grid conditionally so meditation sessions (biometrics only) no longer render an empty 80px band.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Header metadata

- [x] **Task 1: Enrich the SessionCharts header with module metadata**
  Files: `src/pages/SessionsPage/SessionCharts.tsx`
  In the header row (currently lines 67–72: date + duration), add module-aware metadata. Import `ModuleBadge` from `@/components/ModuleBadge` (already exists from milestone 09; `SessionRun` already carries `activityType`, `description`, `complexity`).
  - Render `<ModuleBadge type={session.activityType} />` in the same header row.
  - Render the title `session.description ?? 'Meditation'` as the prominent header text. Keep the existing `formatDate(session.startedAt)` and `formatDuration(session.durationSeconds)` visible — duration is the per-session total time.
  - For breath only, append `· Difficulty {session.complexity.toFixed(1)}` when `session.activityType === 'breath' && session.complexity != null`; omit entirely for meditation.
  - Keep the existing Tailwind layout style (`flex shrink-0 items-center gap-3 border-b ...`); use `truncate` on the title since descriptions are free text and can be long.

### Phase 2: Conditional instruction grid

- [x] **Task 2: Make the breath-phase instruction grid conditional in chartOption.ts**
  Files: `src/pages/SessionsPage/chartOption.ts`
  Add a `hasPhases = phases.length > 0` presence flag next to the existing `hasHeartRate` / `hasEeg` / `hasEmotions` flags (after `const phases = parsePhases(...)`, line 65). Thread it through every place that currently assumes the instruction grid always exists, mirroring the existing optional-grid pattern:
  - **Grid index assignment (lines 114–119):** make `INSTRUCTION_GRID` optional — `const INSTRUCTION_GRID = hasPhases ? nextIdx++ : undefined;` (it must come first so it stays index 0 when present). HR/EEG/EMOT indices continue from the shared `nextIdx` counter unchanged.
  - **`gridHeights` (lines 122–127):** prepend `INSTRUCTION_HEIGHT` only when `hasPhases` — `...(hasPhases ? [INSTRUCTION_HEIGHT] : [])`.
  - **Y-axes (lines 160–168):** emit the hidden 0–1 instruction y-axis only when `INSTRUCTION_GRID !== undefined`, using `INSTRUCTION_GRID` as its `gridIndex` (conditional-spread style like HR/EEG/EMOT).
  - **Phase custom-series (lines 213–243 + the `allSeries` array, lines 245–268):** emit the phase custom-series only when `INSTRUCTION_GRID !== undefined`, using `INSTRUCTION_GRID` for `xAxisIndex` / `yAxisIndex`. Spread it conditionally into `allSeries` instead of unconditionally as the first element.
  - **x-axes / grids / height:** `xAxes`, `grids`, and `height` already derive from `totalGrids` / `gridHeights` / `currentTop`, so they adjust automatically once the above are conditional — no further change needed.
  - Update the JSDoc on `buildSessionChartOption` (lines 47–54): the instruction grid is no longer "always" present — note it is included only when phase instructions exist.
  - No empty-state change needed: `SessionCharts` already computes `isEmpty` and renders the "No data for this session" placeholder instead of the chart, so a zero-grid option is never rendered.
