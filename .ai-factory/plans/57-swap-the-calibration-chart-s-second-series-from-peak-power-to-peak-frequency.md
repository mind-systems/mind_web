# Plan: Swap the calibration chart's second series from peak power to peak frequency

## Context
The NFB calibration history chart plots the wrong second parameter (alpha peak *power*); switch it to `individualPeakFrequency` so both lines are in Hz on a single shared axis.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Type

- [x] **Task 1: Add `individualPeakFrequency` to the calibration record type**
  Files: `src/core/types/index.ts`
  In the `NfbCalibrationRecord` interface (lines 54-69), add `individualPeakFrequency: number | null;` next to `individualPeakFrequencyPower` (line 63). Type is nullable to match the API entity. Leave all other `individual*` fields untouched.

### Phase 2: Chart

- [x] **Task 2: Swap the second series data source and null-map it** (depends on Task 1)
  Files: `src/pages/CalibrationPage/chartOption.ts`
  Replace `powerData` (built from `r.individualPeakFrequencyPower`, lines 42-45) with `peakFreqData` built from `r.individualPeakFrequency`, mapping null → `value: null` so missing points render as a gap (not `0`). Keep the `...pointStyle(r)` spread so valid-green / invalid-hollow-red dots stay.

- [x] **Task 3: Collapse to a single Hz Y-axis** (depends on Task 2)
  Files: `src/pages/CalibrationPage/chartOption.ts`
  Replace the two-entry `yAxis` array (lines 94-109) with a single `Hz` value axis, keeping the styling from the current first entry (`type:'value'`, `name:'Hz'`, `nameTextStyle`, `axisLabel`, `splitLine`). Drop the second `'Power'` axis entry entirely.

- [x] **Task 4: Rename legend and second series, drop `yAxisIndex:1`** (depends on Task 3)
  Files: `src/pages/CalibrationPage/chartOption.ts`
  Legend (line 49): `'Peak Power'` → `'Peak Frequency (Hz)'`. Second series (lines 119-126): set `name: 'Peak Frequency (Hz)'`, `data: peakFreqData`, remove `yAxisIndex: 1` so it shares axis 0. Keep line color `#E89B2A` and `symbolSize: 8`.

- [x] **Task 5: Null-guard the tooltip value formatter** (depends on Task 4)
  Files: `src/pages/CalibrationPage/chartOption.ts`
  In the tooltip formatter (line 71), guard against a null point value: change `item.value.toFixed(2)` to `item.value == null ? '—' : item.value.toFixed(2)` so a null peak frequency shows `—` instead of crashing. Type `item.value` as `number | null` accordingly.

## Notes
- Do NOT touch `transforms.ts` or `CalibrationChart.tsx` — both are parameter-agnostic.
- No API change: `individualPeakFrequency` is already returned by `GET /nfb-calibrations`.
- Verify with `npm run typecheck` + `npm run lint`.
- Spec: `.ai-factory/notes/43-calibration-chart-individual-peak-frequency.md`.

## Commit Plan
- **Commit 1** (after tasks 1-5): "Chart calibration peak frequency instead of peak power"
