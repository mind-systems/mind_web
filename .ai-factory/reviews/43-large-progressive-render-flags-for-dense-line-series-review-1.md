# Code Review: large + progressive render flags for dense line series

**Plan:** `.ai-factory/plans/43-large-progressive-render-flags-for-dense-line-series.md`
**Reviewed:** `git diff HEAD` / `git status`

## Scope of changes

Only one source file changed: `src/pages/SessionsPage/chartOption.ts`. The diff adds four keys to the object returned by `buildLineSeriesEntry` (lines 58-61):

```ts
large: true,
largeThreshold: 2000,
progressive: 4000,
progressiveThreshold: 4000,
```

(The other staged files are plan/plan-review artifacts, not code.)

## Verification performed

- **Typecheck:** `npx tsc --noEmit` → exit 0, no errors. All four keys are valid on ECharts' `LineSeriesOption` (`large`/`largeThreshold`) and the shared `SeriesOption` base (`progressive`/`progressiveThreshold`); the array is additionally cast `as EChartsOption['series']` at line 412.
- **Lint:** `npx eslint src/pages/SessionsPage/chartOption.ts` → exit 0, clean.

## Correctness assessment

- **Scope is exactly right.** The flags are added inside `buildLineSeriesEntry`, which is the single builder feeding all line series (heart rate, EEG, emotions, motion). The phase custom series (`phaseSeries`, lines 303-361) is built separately and is untouched — matching the plan's explicit guard.
- **No behavior change for short sessions.** `largeThreshold: 2000` and `progressiveThreshold: 4000` gate the optimized/chunked paths; series below those point counts render via the existing synchronous path unchanged.
- **Lost per-point interactivity is irrelevant.** Line series already set `symbol: 'none'`, and the chart tooltip is `trigger: 'axis'` (lines 402-408), which uses the axis pointer rather than per-item hit-testing, so large mode does not degrade the tooltip.
- **Compatible with `sampling: 'minmax'`.** Sampling is applied in the data-processing stage and is independent of the draw path; the two coexist as the plan intends (sampling thins the zoomed-out view, large/progressive handle the full-resolution deep-zoom window).
- **Data ordering is fine for large line mode.** Series come from `toSeries(...)` producing time-ordered `[offsetSec, value]` pairs ascending in x, which is what large-line rendering expects.

## Security

No security surface touched — no user input, no storage access, no network calls, no auth. N/A.

## Runtime risk

None identified. No migrations, no new types, no async/race concerns. The change is a static literal-property addition; rebuild semantics (`notMerge: true`) are unaffected.

REVIEW_PASS
