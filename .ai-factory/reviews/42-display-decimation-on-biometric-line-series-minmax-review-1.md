# Code Review: Display decimation on biometric line series (`minmax`)

**Plan:** `.ai-factory/plans/42-display-decimation-on-biometric-line-series-minmax.md`
**Reviewed diff:** `git diff HEAD`

## Scope of changes

Single source change in `src/pages/SessionsPage/chartOption.ts`:

```diff
     smooth: false,
     symbol: 'none',
+    sampling: 'minmax' as const,
     name,
```

`sampling: 'minmax' as const` added to the object returned by `buildLineSeriesEntry` (lines 49-61). All other staged changes are docs/notes/plan artifacts, not code.

## Correctness analysis

- **Scope is correct.** `sampling` is added only inside `buildLineSeriesEntry`, which builds every `type: 'line'` entry (heart rate, 5 EEG bands, 5 emotion scores, 6 motion axes). The phase custom series (`chartOption.ts:302-360`) is constructed separately and is untouched — as the plan requires. No risk of `sampling` leaking onto the range-bar custom series.
- **Type safety.** `npm run typecheck` (`tsc --noEmit`) passes — ECharts 6.1.0's `LineSeriesOption` accepts the `'minmax'` literal, and `as const` narrows it to the expected union member rather than widening to `string`.
- **Lint.** `npm run lint` passes with no warnings.
- **Sampling precondition (x-monotonic data) is satisfied.** `minmax` decimation buckets points along the x-axis and assumes ascending x order; `toSeries` (`transforms.ts:45-54`) sorts every series ascending by time before it reaches the chart, so bucketing is well-defined. No risk of scrambled decimation from out-of-order chunk arrival.
- **Spike preservation.** `minmax` (not `lttb`) keeps each bucket's min and max, so single-sample EEG/HR spikes survive decimation — matching the stated clinical requirement.
- **Zoom-in detail.** Only the drawn point set is decimated; the full `data` array is unchanged, so zoom-in continues to restore full per-sample detail. The existing `dataZoom` with `filterMode: 'none'` is unaffected by `sampling`.

## Out-of-scope (correctly not attempted)

The flag reduces only rasterized points, not retained samples — memory/network footprint of a long session is unchanged. The plan explicitly defers that to the server-side LOD milestone, and the diff does not touch accumulation logic. Correct.

## Findings

None. The change is minimal, correctly scoped, type- and lint-clean, and its runtime precondition (sorted series data) is met by existing code.

REVIEW_PASS
