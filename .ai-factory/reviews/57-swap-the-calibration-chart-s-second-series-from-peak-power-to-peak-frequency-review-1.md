# Code Review: Swap calibration chart's second series from peak power to peak frequency

**Plan:** `57-swap-the-calibration-chart-s-second-series-from-peak-power-to-peak-frequency.md`
**Files reviewed:** `src/core/types/index.ts`, `src/pages/CalibrationPage/chartOption.ts`
**Build:** `npm run typecheck` clean · `npm run lint` clean

## Summary

The change swaps the calibration chart's second series from `individualPeakFrequencyPower` to `individualPeakFrequency`, collapses the dual Y-axis to a single shared `Hz` axis, renames the legend/series, adds the nullable field to `NfbCalibrationRecord`, and null-guards the tooltip formatter. All five plan tasks are implemented as specified.

## Correctness

- **Nullable type is accurate.** `individualPeakFrequency: number | null` matches the API entity and the spec note. No other consumer of `NfbCalibrationRecord` references this field, so no downstream breakage (grep-confirmed by the plan review).
- **Null → gap works.** `peakFreqData` passes `value: r.individualPeakFrequency` through unchanged, so a `null` becomes `{ value: null, ...pointStyle }`. ECharts renders this as a line gap rather than a 0-dive. Correct.
- **Single-axis binding is valid.** `yAxis` is now a single object. The first series keeps `yAxisIndex: 0` (valid against a non-array axis), and the second series omits `yAxisIndex` (defaults to 0). Both bind to the one `Hz` axis. Correct.
- **Tooltip guard is robust.** The cast type widened to `number | null`, and `item.value == null` catches both `null` and `undefined` before `.toFixed(2)` — so it also survives a backend that omits the field entirely. No crash path remains.
- **Legend/series alignment.** Legend `data` order (`['Individual Frequency (Hz)', 'Peak Frequency (Hz)']`) matches the series `name`s in order. Toggle behavior stays correct.

## Security

Nothing in scope. Tooltip HTML still routes user-controlled text (`failReason`) through the existing `escapeHtml`; the newly formatted `valueText` is either `'—'` or a numeric `.toFixed(2)` string — no injection surface.

## Runtime concerns considered

- No migration involved (read-only web dashboard; field already on the wire).
- On a `null` point, the `...pointStyle(r)` spread has no visible effect (ECharts draws no symbol for a null value) — expected, not a defect.
- No race conditions, no state, pure option-builder function.

No findings.

REVIEW_PASS
