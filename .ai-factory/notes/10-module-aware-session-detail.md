# Module-Aware Session Detail Panel

**Date:** 2026-05-31
**Source:** conversation context — UX review

## Key Findings

- The detail header (`SessionCharts.tsx`) shows only date + duration — no module, name, or difficulty.
- `chartOption.ts` always allocates the breath-phase instruction grid (grid index 0). Meditation sessions have **no `breath_phase` instructions** (they emit only biometrics — see `mind_api/.ai-factory/notes/11-activity-type-meditation-extension.md`), so they get an empty 80px band at the top of the chart.
- Both fixes key off `session.activityType` and the already-parsed `phases` array. `SessionRun` already carries `activityType`, `description`, `complexity` (see `notes/09`).

## Details

### Part 1 — Header metadata

In `SessionCharts.tsx`, the header currently renders `formatDate(session.startedAt)` + `formatDuration(session.durationSeconds)`. Add, in the same header row:

- `<ModuleBadge type={session.activityType} />` (the component from `notes/09`).
- The title: `session.description ?? 'Meditation'`.
- For breath: `· Difficulty {session.complexity.toFixed(1)}` when `complexity != null`.

Duration stays shown — it is the per-session total time.

### Part 2 — Conditional instruction grid in `chartOption.ts`

Today the instruction grid is unconditional: `INSTRUCTION_GRID` is always index 0, `gridHeights` always starts with `INSTRUCTION_HEIGHT`, and the phase custom-series is always pushed. Make it conditional on whether there are phases, mirroring the existing `hasHeartRate` / `hasEeg` / `hasEmotions` pattern.

Add a presence flag next to the others:

```ts
const phases = parsePhases(instructions, startedAt, endedAt);
const hasPhases = phases.length > 0;
```

Then thread `hasPhases` through every place that currently assumes the instruction grid exists:

1. **Grid index assignment** — make it optional like the rest:
   ```ts
   let nextIdx = 0;
   const INSTRUCTION_GRID = hasPhases ? nextIdx++ : undefined;
   const HR_GRID = hasHeartRate ? nextIdx++ : undefined;
   const EEG_GRID = hasEeg ? nextIdx++ : undefined;
   const EMOT_GRID = hasEmotions ? nextIdx++ : undefined;
   const totalGrids = nextIdx;
   ```

2. **`gridHeights`** — prepend the instruction height only when `hasPhases`:
   ```ts
   const gridHeights = [
     ...(hasPhases ? [INSTRUCTION_HEIGHT] : []),
     ...(hasHeartRate ? [DATA_HEIGHT] : []),
     ...(hasEeg ? [DATA_HEIGHT] : []),
     ...(hasEmotions ? [DATA_HEIGHT] : []),
   ];
   ```

3. **x-axes / y-axes / series** — the instruction x-axis, the hidden 0–1 instruction y-axis, and the phase custom-series must each be emitted only when `INSTRUCTION_GRID !== undefined`, using `INSTRUCTION_GRID` as their `gridIndex` / `xAxisIndex` / `yAxisIndex` (same conditional-spread style already used for HR/EEG/EMOT). The biometric grids already key off their own flags and need no change beyond getting their indices from the shared `nextIdx` counter.

4. **Height** — `const height = currentTop - GAP + 60;` already derives from `gridHeights`, so it adjusts automatically once `gridHeights` is conditional.

Result: a meditation session (biometrics only) starts directly with the heart-rate / EEG / emotion grids; a breath session is unchanged. A session with neither phases nor biometrics produces zero grids — the existing `isEmpty` branch in `SessionCharts` ("No data for this session") already covers that, so guard the `ReactECharts` render with the existing `isEmpty` check (no new empty-state needed).

### Guard already in place

`SessionCharts` computes `isEmpty` from instruction + biometric lengths and renders the empty state instead of the chart, so `buildSessionChartOption` returning a zero-grid option is never actually rendered. No crash path.

## Backs roadmap task

- "Module-aware session detail panel"
