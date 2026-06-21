# Plan Review: Display decimation on biometric line series (`minmax`)

**Plan:** `42-display-decimation-on-biometric-line-series-minmax.md`
**Files Reviewed:** 1 plan + targeted source (`chartOption.ts`), ROADMAP, note 28
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture (ARCHITECTURE.md):** No boundary violation. The change is a single literal added inside an existing chart-option factory in `pages/SessionsPage/` — no cross-layer dependency, no storage/api access. ✅
- **Rules (`.ai-factory/rules/base.md`, CLAUDE.md):** No rule touched. No new `fetch`, no `localStorage`, no `console.*`, no proto edits. English-only respected. ✅
- **Roadmap (ROADMAP.md):** Strong linkage. The task maps 1:1 to the Phase 19 milestone *"Display decimation on biometric line series (`minmax`)"* (ROADMAP line 141), including the same file/line anchors and the same API-owner `minmax`-over-`lttb` rationale. The out-of-scope memory note correctly defers to Phase 20 / server LOD (line 149+). ✅

## Verification of Plan Claims

Every concrete claim in the plan was checked against the codebase and holds:

- **File path** `src/pages/SessionsPage/chartOption.ts` — exists (not `SessionPage/`, which does not exist; `SessionsPage` is correct). ✅
- **`buildLineSeriesEntry` at lines 42–61** — exact match; returns the line-series object with `smooth`, `symbol`, `lineStyle`, `itemStyle`. `sampling` slots in cleanly alongside. ✅
- **Single factory feeds all line series** — confirmed: HR, the five EEG bands, emotion scores, and motion axes all flow through `buildLineSeriesEntry` (lines 362–379+). One edit covers them all. ✅
- **Phase custom series at lines 302–360** — confirmed `type: 'custom'`, `[startSec, endSec]` range bars, `clip: true`, rendered under `dataZoom` `filterMode: 'none'` (lines 421/428). Correctly excluded from the change. ✅
- **ECharts `^6.1.0`** — confirmed in `package.json`. `sampling: 'minmax'` was added in 5.5.0, so 6.1.0 supports it both at runtime and in the `LineSeriesOption` type union. Typecheck (Task 2) should pass. ✅
- **`minmax` vs `lttb` rationale** — matches note 28 and the API-owner decision: min/max bucketing preserves single-sample EEG/HR spikes. ✅

## Notes (non-blocking)

- **`sampling` + `filterMode: 'none'` interaction:** This is the correct and intended combination. With `filterMode: 'none'` the full `data` stays in the draw set and ECharts samples it to the rendered width per the current zoom extent, re-running on zoom — exactly the behavior the plan describes (freeze removed when zoomed out, full detail restored when zoomed in). No conflict.
- **Task 2's `as const`:** Since `allSeries` is cast via `as EChartsOption['series']` at line 411, a plain `sampling: 'minmax'` string would also compile. The `as const` is harmless and slightly cleaner — fine as written. No action needed.
- **Manual verification** is correctly marked optional and matches note 28's verify steps. Given "Testing: no", this is appropriate for a one-line render flag.

## Critical Issues

None.

## Positive Notes

- Tightly scoped: one literal, one well-isolated factory, explicit guard against touching the phase custom series.
- Excellent traceability — file/line anchors, echarts version, algorithm rationale, and out-of-scope boundary all match the spec note and ROADMAP.
- The out-of-scope section preempts the most likely misunderstanding (that this reduces memory) and correctly routes it to Phase 20.

PLAN_REVIEW_PASS
