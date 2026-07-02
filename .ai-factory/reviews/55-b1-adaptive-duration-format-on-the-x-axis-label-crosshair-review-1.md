# Code Review: (B1) Adaptive duration format on the X-axis label + crosshair

## Scope
Changed files:
- `src/core/format.ts` — new `formatAxisDuration(sec)` export
- `src/pages/SessionsPage/chartOption.ts` — X-axis `axisLabel.formatter` + per-axis `axisPointer.label.formatter`

## Verification
- `npm run typecheck` — passes
- `npm run lint` — passes

## Analysis

### `formatAxisDuration` correctness
- `30 → "0:30"`: hours 0, minutes 0, seconds 30 → `"0:30"` ✓
- `2030 → "33:50"`: hours 0, minutes `floor(2030/60)=33`, seconds `2030%60=50` → `"33:50"` ✓
- `7200 → "2:00:00"`: hours 2, minutes 0, seconds 0 → `"2:00:00"` ✓
- Fractional axis values (crosshair may report e.g. `342.7`) are handled by `Math.round(sec)`.
- The 3600s boundary uses `hours > 0`, matching the spec's "at/above 3600s → H:MM:SS" (3600 → `"1:00:00"`).
- `formatDuration` is left untouched; the new helper is a sibling export as required.
- Axis `min: 0` guarantees non-negative input, so no negative-duration edge case.

### Chart wiring
- `axisLabel.formatter` replaced cleanly; `type: 'value'`, tick config, and label `show` gating are unchanged.
- The per-axis `axisPointer.label.formatter` correctly complements the tooltip-level `axisPointer: { type: 'cross' }`; the crosshair type comes from the tooltip, the per-axis `label.formatter` only overrides the X readout text — standard ECharts merge behavior. Applying it to every X axis (not just the bottom one) is harmless and keeps the readout consistent across grids.
- The formatter param is typed `{ value: unknown }` and coerced with `Number(...)`, which is safe and type-clean.
- In-bar phase `· Ns` suffix, Y-axis labels, and `dataZoom` are untouched, matching the plan's guards. No tick-count/`interval` change.

## Findings
None.

REVIEW_PASS
