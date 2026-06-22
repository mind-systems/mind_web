# Calibration history chart: show individualFrequency + individualPeakFrequency

**Date:** 2026-06-23
**Source:** conversation context

## Key Findings

- The NFB calibration history chart currently plots the WRONG second parameter. It draws `individualFrequency` (Hz) and `individualPeakFrequencyPower` (alpha peak *power*). Product wants the two *frequencies* instead: `individualFrequency` and `individualPeakFrequency` (both in Hz).
- `individualPeakFrequency` is a real field on the API entity (`mind_api/src/nfb-calibration/entities/nfb-calibration-record.entity.ts:38` → `individualPeakFrequency: number | null`) and the REST endpoint `GET /nfb-calibrations` returns the raw entity with no projection (`nfb-calibration.service.ts:58` `repo.findAndCount` with no `select`; `nfb-calibration.rest.controller.ts` returns `{ records, total }` verbatim). So the value is already on the wire — **no API change needed**.
- The web type `NfbCalibrationRecord` (`src/core/types/index.ts:54-69`) omits `individualPeakFrequency` — it must be added (typed `number | null`, matching the entity).
- Both series are now in Hz, so the dual-axis design (second Y-axis named "Power") collapses to a single shared Hz axis.
- `individualPeakFrequency` is nullable — null records must render as a gap (`value: null`), not `0`, so the line doesn't dive to zero.

## Details

### Files to touch (web only)

1. **`src/core/types/index.ts`** — add `individualPeakFrequency: number | null;` to the `NfbCalibrationRecord` interface (place it next to `individualPeakFrequencyPower`). Leave the other `individual*` fields in place — they are still part of the response; we just stop charting power.

2. **`src/pages/CalibrationPage/chartOption.ts`** — `buildCalibrationChartOption`:
   - Replace `powerData` (built from `r.individualPeakFrequencyPower`) with `peakFreqData` built from `r.individualPeakFrequency`, mapping null → `value: null` (keep `...pointStyle(r)` spread for the valid/invalid dot styling).
   - Legend: `['Individual Frequency (Hz)', 'Peak Power']` → `['Individual Frequency (Hz)', 'Peak Frequency (Hz)']`.
   - Y-axis: collapse the two-entry `yAxis` array (currently `[{ name:'Hz' }, { name:'Power' }]`, `chartOption.ts:94-109`) to a **single** `Hz` value axis (`yAxis: { type:'value', name:'Hz', nameTextStyle, axisLabel, splitLine }` — keep the existing styling from the first entry); drop `yAxisIndex: 1` from the second series so both lines share the single axis 0. Decision pinned: one shared Hz axis — both series are the same unit (Hz) and comparable magnitude (peak frequency sits within the alpha band near individual frequency). No second axis.
   - Second series: rename `name` `'Peak Power'` → `'Peak Frequency (Hz)'`, keep the `#E89B2A` line color + `symbolSize: 8`, set `data: peakFreqData`.
   - Tooltip: unchanged logic — it iterates `paramsArr` and prints `seriesName: value.toFixed(2)`, so it picks up the renamed series automatically. Guard: `value` can be `null` for missing peak frequency; `null.toFixed` throws — the existing formatter does `item.value.toFixed(2)`, so add a null guard (`item.value == null ? '—' : item.value.toFixed(2)`) to avoid a tooltip crash on a null point.

3. Do NOT touch `transforms.ts` (grouping by device) or `CalibrationChart.tsx` (the EChart wrapper) — they are parameter-agnostic.

### Current state (what's wrong)

`chartOption.ts:42-45` builds `powerData` from `individualPeakFrequencyPower`; `chartOption.ts:102-108` defines a second "Power" Y-axis; `chartOption.ts:119-126` is the `'Peak Power'` series on `yAxisIndex: 1`.

### Verify

- Calibration page renders two lines both labelled in Hz; the second line tracks peak frequency (values in the alpha band ~8-13 Hz), not the much smaller/larger power magnitude.
- Invalid calibrations still show hollow red dots, valid show filled green, on both lines.
- A record with null `individualPeakFrequency` shows a gap on the peak line and the tooltip shows `—` (or omits) rather than crashing.
- Both lines share a single `Hz` Y-axis (no second axis on the chart).
- `npm run typecheck` + `npm run lint` clean.
