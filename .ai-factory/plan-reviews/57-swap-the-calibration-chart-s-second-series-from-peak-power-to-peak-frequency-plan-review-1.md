# Plan Review: Swap calibration chart's second series from peak power to peak frequency

**Plan:** `57-swap-the-calibration-chart-s-second-series-from-peak-power-to-peak-frequency.md`
**Files Reviewed:** 2 (`src/core/types/index.ts`, `src/pages/CalibrationPage/chartOption.ts`)
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture** (`ARCHITECTURE.md`): OK. Change is confined to `pages/CalibrationPage/` + `core/types/`. The parameter-agnostic wrapper (`CalibrationChart.tsx`) and `transforms.ts` are correctly left untouched, and no `useQuery` is introduced into components. No boundary violation.
- **Rules** (`CLAUDE.md`): OK. No renamed storage keys, no raw `fetch`, no proto edits, all-English content, minimal logging. Nothing in scope trips a project rule.
- **Roadmap**: Task-level chart tweak; no milestone linkage required.

## Verification Against Codebase

All plan claims check out against the actual source:

- **Line numbers accurate.** `NfbCalibrationRecord` spans lines 54–69 with `individualPeakFrequencyPower` at line 63 (Task 1). `powerData` is at lines 42–45 (Task 2). `yAxis` array is lines 94–109 (Task 3). Legend is line 49; second series lines 119–126 (Task 4). Tooltip `item.value.toFixed(2)` is line 71 (Task 5). Every reference matches.
- **No stray references.** A repo-wide grep for `individualPeakFrequencyPower` / `powerData` / `Peak Power` finds hits only in `chartOption.ts` and `core/types/index.ts`. Nothing else depends on the swapped series, so the change is fully contained.
- **API contract confirmed.** The spec note documents that `individualPeakFrequency` is a real entity field returned verbatim by `GET /nfb-calibrations` (no projection), so "no API change needed" is sound. No migration involved (read-only web dashboard).
- **Null handling is correct.** Mapping `null → value: null` yields an ECharts line gap (not a dive to 0), and Task 5's tooltip guard (`item.value == null ? '—' : item.value.toFixed(2)`) prevents the `null.toFixed` crash under `trigger: 'axis'`. Widening the `item.value` type to `number | null` is the right accompanying change.
- **Single-axis collapse is valid.** Both series become Hz, so dropping the `'Power'` axis and `yAxisIndex: 1` is correct. First series keeps `yAxisIndex: 0`, which remains valid against a single (non-array) `yAxis` object.

## Minor Notes (non-blocking)

- Task 4 leaves `yAxisIndex: 0` on the first series. That is harmless with a single axis, so no action required — just noting it need not be removed.
- On a null point, the `...pointStyle(r)` spread has no visible effect (ECharts renders no symbol for a null value). Expected behavior; the spread is still worth keeping for valid/invalid dot styling on non-null points.

## Positive Notes

- Plan mirrors the pinned spec note (`43-...`) exactly, including the "single shared Hz axis" decision and the null-gap rationale.
- Task dependencies are ordered correctly (type → data → axis → series/legend → tooltip) and confined to a single commit.
- Explicit "do not touch" guardrails for `transforms.ts` and `CalibrationChart.tsx` prevent scope creep.
- `npm run typecheck` + `npm run lint` verification step is appropriate for a no-test change of this size.

PLAN_REVIEW_PASS
