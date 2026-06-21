# Plan: large + progressive render flags for dense line series

## Context
Add ECharts `large` + `progressive` render flags to the line series builder in the session biometric charts so dense, deep-zoomed signals paint without freezing the main thread, while short sessions stay below the thresholds and render unchanged.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Render flags

- [x] **Task 1: Add large/progressive flags to `buildLineSeriesEntry`**
  Files: `src/pages/SessionsPage/chartOption.ts`
  In `buildLineSeriesEntry` (lines 42-61), add the following keys to the returned line-series object:
  - `large: true`
  - `largeThreshold: 2000` — series with fewer points keep the normal (per-point) render path, so short sessions are unaffected.
  - `progressive: 4000` — points painted per frame once the series exceeds the progressive threshold.
  - `progressiveThreshold: 4000` — series below this paint in a single synchronous pass (no behavior change for short/medium sessions).
  These apply to every line series (heart rate, EEG, emotions, motion) because they all flow through this single builder. Do **not** add these flags to the phase custom series (`phaseSeries`, lines 303-361) — leave it exactly as-is. Line series already use `symbol: 'none'`, so large-mode's loss of per-point symbol interactivity has no visible effect; the `trigger: 'axis'` tooltip continues to work. This is complementary to the existing `sampling: 'minmax'` (which thins the zoomed-out view): the new flags handle the full-resolution deep-zoom window.

## Notes
- Single-task milestone — single commit at the end, no commit plan needed.
- Verify manually: deep-zoom into a ~30 s raw window of a dense signal in a long session — first paint must not freeze and the axis tooltip must still report values. Confirm a short session (point count below the thresholds) renders identically to before.
