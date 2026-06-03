# Plan: Phase text labels in instruction grid

## Context
Add readable white labels on top of each colored phase bar in the session-detail instruction grid, so users can identify phases ("Inhale", "Hold", "Exhale", "Rest") without a separate legend. The label also shows the planned phase duration (`Inhale · 4s`) when available.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Notes for implementer
- The note-18 fix (InstructionDto field names) is already landed: `InstructionDto` uses `instructionType`/`data`, and `parsePhases` already filters by `i.instructionType === 'breath_phase'` and reads `event.data.phase`. No dependency work remains.
- Spec reference: `.ai-factory/notes/19-phase-text-labels.md`.
- Keep the change minimal — only the instruction phase series. Do not touch the line/biometric series.
- **Label-source mechanism (load-bearing — do not regress):** `renderItem`'s `params` object does NOT carry a `name` field at runtime. Verified against ECharts 6.1.0 runtime source (`node_modules/echarts/lib/chart/custom/CustomView.js`) and types (`CustomSeriesRenderItemParams`): `params` exposes `dataIndex`, `dataIndexInside`, `seriesIndex`, etc. — never `name`. Adding `name: p.phase` to the data item stores it on the data item, NOT on `params`, so it would stay invisible to `renderItem` and every bar would render an empty string (and typecheck/lint would still pass green). This plan therefore resolves the label by indexing the in-scope `phases` array with `params.dataIndex` — fully typed, no `as`-cast, no risk of `undefined` labels.
- **`durationMs` is consumed, not dead:** the milestone requires plumbing `durationMs` through `PhaseBar`/`parsePhases`. Task 4 renders it in the label (`Inhale · 4s`) rather than threading an unread field. `durationMs` is optional — guard for `undefined` and fall back to the bare phase word.

## Tasks

### Phase 1: Types & data

- [x] **Task 1: Extend `PhaseBar` with optional `durationMs`**
  Files: `src/core/types/index.ts`
  In the `PhaseBar` interface (lines 30-34, right after `phase: BreathPhase;` on line 33) add `durationMs?: number;`. Leave `BreathPhase` and `InstructionDto` unchanged.

- [x] **Task 2: Populate `durationMs` in `parsePhases`** (depends on Task 1)
  Files: `src/pages/SessionsPage/transforms.ts`
  In the object returned from the `breathEvents.map(...)` callback (the `satisfies PhaseBar` literal, lines 27-31), add `durationMs: event.data.durationMs,` alongside the existing `startSec`/`endSec`/`phase` fields. `event.data.durationMs` is typed `number | undefined` and `PhaseBar.durationMs?` is optional, so the `satisfies PhaseBar` literal still type-checks.

### Phase 2: Rendering

- [x] **Task 3: Add `PHASE_LABELS` map**
  Files: `src/pages/SessionsPage/chartOption.ts`
  Directly below the existing `PHASE_COLORS` constant (lines 5-10), export a parallel map:
  ```typescript
  export const PHASE_LABELS: Record<string, string> = {
    inhale: 'Inhale',
    hold: 'Hold',
    exhale: 'Exhale',
    rest: 'Rest',
  };
  ```

- [x] **Task 4: Render rect + text group in the phase custom series** (depends on Tasks 1-3)
  Files: `src/pages/SessionsPage/chartOption.ts`
  Modify the `phaseSeries` custom series (lines 221-254). Leave its `data` mapping as-is (`value` + `itemStyle` only) — do NOT add a `name` field; it would be unreadable from `renderItem` (see implementer notes). The label is sourced from `phases[params.dataIndex]` instead.

  Rewrite `renderItem`:
  - Type the first argument as `(params: { dataIndex: number }, api: RenderItemAPI)` (replacing the current `_params: unknown`). `dataIndex` is a documented, typed field on the custom-series renderItem params — no `as`-cast needed.
  - Compute `barWidth` and `barHeight` once and reuse them:
    ```typescript
    const startSec = api.value(0);
    const endSec = api.value(1);
    const topLeft = api.coord([startSec, 1]);
    const bottomRight = api.coord([endSec, 0]);
    const barWidth = Math.max(bottomRight[0] - topLeft[0], 1);
    const barHeight = Math.max(bottomRight[1] - topLeft[1], 1);
    ```
  - Build the existing `rect` from these (`shape: { x: topLeft[0], y: topLeft[1], width: barWidth, height: barHeight }`, `style: api.style()`, `z2: 0`) — preserving current bar behavior.
  - When `barWidth < 40`, return the `rect` alone (unchanged behavior for narrow bars — avoids clipped, unreadable text).
  - Otherwise resolve the label from the in-scope `phases` array and return a group:
    ```typescript
    const bar = phases[params.dataIndex];
    const phaseLabel = PHASE_LABELS[bar.phase] ?? bar.phase;
    const label =
      bar.durationMs !== undefined
        ? `${phaseLabel} · ${Math.round(bar.durationMs / 1000)}s`
        : phaseLabel;
    const text = {
      type: 'text' as const,
      style: {
        text: label,
        x: topLeft[0] + 6,
        y: topLeft[1] + barHeight / 2,
        fill: '#fff',
        font: 'bold 11px sans-serif',
        textBaseline: 'middle',
      },
      z2: 1,
    };
    return { type: 'group', children: [rect, text] };
    ```
  - The mixed return type (rect for narrow bars, group otherwise) is accepted by the custom series — both are valid root elements, and the existing `allSeries as EChartsOption['series']` cast already erases the renderItem signature.

### Phase 3: Verify build

- [x] **Task 5: Typecheck and lint** (depends on Task 4)
  Files: (no source changes)
  Run `npm run typecheck` and `npm run lint`; fix any issues the changes introduce (most likely an unused-variable warning if a binding is left over from the rewrite). Note: these gates confirm compilation only — they cannot confirm labels render, since the label-source mechanism is runtime behavior. Correctness of the label source is guaranteed by construction (indexing `phases` by the typed `dataIndex`), per the implementer notes.
