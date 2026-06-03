# Plan: Add motion sensor grid to session chart

## Context
Render accelerometer (ax/ay/az) and gyroscope (gx/gy/gz) data — currently sent by the mobile app but ignored — as a new stacked grid below the emotions grid in the session detail chart.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Motion grid integration

All work is in a single file: `src/pages/SessionsPage/chartOption.ts`. `toSeries` already accepts any field key via `s.data[field]`, and `sampleType`/`data` are loosely typed (`string` / `Record<string, ...>`), so no changes to `transforms.ts` or `core/types` are needed. Follow the existing HR_GRID / EEG_GRID / EMOT_GRID conditional pattern exactly.

- [x] **Task 1: Extract motion series and presence flag**
  Files: `src/pages/SessionsPage/chartOption.ts`
  In the "Data transforms" section, after the `emotions` bucket and its `toSeries` calls, add `const motion = byType.get('motion') ?? [];` and six `toSeries` calls: `axSeries`, `aySeries`, `azSeries` (fields `'ax'`, `'ay'`, `'az'`) and `gxSeries`, `gySeries`, `gzSeries` (fields `'gx'`, `'gy'`, `'gz'`), all using `startMs`. In the "Presence flags" section, add `const hasMotion =` ORing `.length > 0` across all six series (mirror `hasEmotions`).

- [x] **Task 2: Assign MOTION_GRID index and thread layout arrays** (depends on Task 1)
  Files: `src/pages/SessionsPage/chartOption.ts`
  In "Dynamic grid index assignment", add `const MOTION_GRID = hasMotion ? nextIdx++ : undefined;` immediately after `EMOT_GRID` and before `const totalGrids = nextIdx;` (keep `totalGrids` reading `nextIdx`, so it counts the new grid automatically). In `gridHeights`, append `...(hasMotion ? [DATA_HEIGHT] : [])` after the emotions entry. `gridTops`, `grids`, and `xAxes` derive from `gridHeights`/`totalGrids` and need no further edits.

- [x] **Task 3: Add MOTION_GRID Y-axis** (depends on Task 2)
  Files: `src/pages/SessionsPage/chartOption.ts`
  In the `yAxes` array, after the `EMOT_GRID` block, add a conditional `...(MOTION_GRID !== undefined ? [ { ... } ] : [])` entry: `type: 'value'`, `gridIndex: MOTION_GRID`, `scale: true`, `name: 'm/s²·rad/s'`, with the same `nameTextStyle`, `axisLabel`, and `splitLine` styling as the BPM/μV/Score axes.

- [x] **Task 4: Add six motion line series** (depends on Task 3)
  Files: `src/pages/SessionsPage/chartOption.ts`
  In the `allSeries` array, after the `EMOT_GRID` block, add a conditional `...(MOTION_GRID !== undefined ? [ ... ] : [])` group with six `buildLineSeriesEntry(MOTION_GRID, <series>, '<name>', '<color>')` calls using these names/colors: `ax` `#60B4E8`, `ay` `#82C492`, `az` `#F0B060`, `gx` `#D4739A`, `gy` `#7BC7C7`, `gz` `#B8A4D8`.

- [x] **Task 5: Update the function doc comment** (depends on Task 4)
  Files: `src/pages/SessionsPage/chartOption.ts`
  Update the JSDoc above `buildSessionChartOption` so the "Up to four vertically-stacked grids" wording reflects the new motion grid (e.g. "Up to five ... heart rate, EEG bands, emotions, and motion sensors only when their sample data is non-empty"). `height` and `gridCount` logic are unchanged.
