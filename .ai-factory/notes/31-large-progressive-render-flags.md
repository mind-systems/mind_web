# large + progressive render flags for dense line series

**Date:** 2026-06-21
**Source:** conversation context (perf triage of 30-min sessions)

## Key Findings

- No `large`/`progressive` config today; every point is rasterized synchronously on each `setOption`.
- `large: true` + `largeThreshold` enables ECharts' optimized batch path for dense lines; `progressive` + `progressiveThreshold` spread first-paint across animation frames so a big series does not block the main thread.

## Details

### Change
- `src/pages/SessionsPage/chartOption.ts` — in `buildLineSeriesEntry` (lines 42-61) add `large: true`, `largeThreshold` (~2000), `progressive` (~4000), `progressiveThreshold` (~4000). Tune thresholds so short sessions (few points) are unaffected (below threshold → no behavior change).
- Line series use `symbol: 'none'`, so large-mode's loss of per-point symbol interactivity is irrelevant; the axis-trigger tooltip still works.
- Do **not** apply to the phase custom series.

### Interaction
- Complementary to note 28: `minmax` sampling cuts point count when zoomed out; `large`/`progressive` handle whatever remains at deep zoom-in (full-resolution window).

### Verify
- Deep-zoom into a raw 30 s window of a dense signal: first paint does not freeze; the axis tooltip still reports values.

## Open Questions

- None. Lowest-risk of the client tasks.
