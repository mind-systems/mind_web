# Plan: Display decimation on biometric line series (`minmax`)

## Context
Long (30 min+) sessions freeze because every raw sample (~450k/series at 250 Hz) is rasterized each frame onto a ~1500 px grid. Enabling ECharts `sampling: 'minmax'` on the line series decimates only the *drawn* points per the current zoom span/width while keeping the full `data` intact, removing the freeze without losing EEG/HR spikes.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Enable display decimation

- [x] **Task 1: Add `sampling: 'minmax'` to the line series config**
  Files: `src/pages/SessionsPage/chartOption.ts`
  In `buildLineSeriesEntry` (lines 42-61), add `sampling: 'minmax' as const` to the returned object (alongside `smooth`, `symbol`, etc.). This applies decimation to every `type: 'line'` entry built by this helper — heart rate, the five EEG bands, the five emotion scores, and the six motion axes — since they all flow through this single factory. `minmax` (not `lttb`) keeps each bucket's min and max so single-sample EEG/HR spikes survive; echarts ^6.1.0 supports it. Do NOT touch the phase custom series (`chartOption.ts:302-360`) — those are `[startSec, endSec]` range bars, not a sampled line, and already clip to the grid via `filterMode: 'none'` + `clip: true`. The full `data` array is unchanged, so zoom-in still restores full per-sample detail.

- [x] **Task 2: Verify typecheck and lint pass** (depends on Task 1)
  Files: (no file changes)
  Run `npm run typecheck` and `npm run lint` to confirm the `sampling` literal is accepted by the ECharts `LineSeriesOption` type and no lint rule is violated. Fix any type mismatch (e.g. ensure the `as const` narrows the string to the expected union member) without altering series behavior.

## Notes

- **Out of scope (do NOT implement):** this flag reduces only what is *drawn*. The accumulated `biometrics` array and per-field `toSeries` outputs still hold every raw sample, so the raw memory/network footprint of a long session is unchanged. Memory reduction is the server-side LOD milestone (Phase 20 / `mind_api`), not this task.
- Spec reference: `.ai-factory/notes/28-display-decimation-minmax.md`.
- Manual verification (post-implement, optional): a 30-min session at 0–100% zoom should not freeze and a known HR/EEG spike should remain visible; zooming into a ~30 s window should restore full per-sample detail.
