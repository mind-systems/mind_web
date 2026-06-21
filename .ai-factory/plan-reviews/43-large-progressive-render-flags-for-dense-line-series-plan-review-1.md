# Plan Review: large + progressive render flags for dense line series

**Plan:** `43-large-progressive-render-flags-for-dense-line-series.md`
**Files Reviewed:** 1 plan + target source (`src/pages/SessionsPage/chartOption.ts`, `SessionCharts.tsx`)
**Risk Level:** 🟢 Low

## Verification against the codebase

- **File path correct.** `src/pages/SessionsPage/chartOption.ts` exists. (Note: the session-detail charts live in `SessionsPage/`, not a `SessionPage/` — the project CLAUDE.md architecture sketch lists a `SessionPage`, but the actual directory the plan targets is correct.)
- **Function + line numbers correct.** `buildLineSeriesEntry` is the single line-series builder (declared line 42; returned object 49–61). All four line groups — heart rate, EEG, emotions, motion — flow through it via `buildLineSeriesEntry(...)` calls (lines 366–394), so adding the flags once covers every line series exactly as the plan claims.
- **Scope exclusion correct.** `phaseSeries` (lines 303–361) is a `type: 'custom'` series; large/progressive flags do not apply to custom series and the plan correctly leaves it untouched.
- **`symbol: 'none'` confirmed** (line 56) — the plan's reasoning that large-mode's loss of per-point symbol interactivity is invisible holds.
- **`sampling: 'minmax'` confirmed** (line 57) — the "complementary to sampling" framing is plausible but see WARN below.
- **ECharts version OK.** `package.json` pins `echarts@^6.1.0`. `large`, `largeThreshold`, `progressive`, and `progressiveThreshold` are all valid line-series options in ECharts 5/6.
- **No security, migration, or auth surface.** Pure client-side chart-config change.
- **Logging "minimal" is appropriate** — a static config change needs no `logger` calls; no `console.*` introduced (rules/base.md compliant).

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** PASS. Change is contained to a page-local helper; no dependency-boundary or storage-access rules touched.
- **Rules (`.ai-factory/rules/base.md`):** PASS. No `console.log`, no raw `fetch`, no storage access added.
- **Roadmap (`.ai-factory/ROADMAP.md`):** WARN (non-blocking). This is a perf change with no linked roadmap milestone. The roadmap tracks the chart panel (lines 33, 45) but has no entry for progressive-render tuning. Consider adding a one-line roadmap entry for traceability — not a blocker for a single-task milestone.

## Critical Issues

None. The plan is technically sound and implementable as written.

## Non-blocking Notes (verify during the manual test)

1. **`sampling` + `large` interaction (WARN).** The plan frames `large`/`progressive` as complementary to `sampling: 'minmax'` — large/progressive handling the full-resolution deep-zoom window, sampling thinning the zoomed-out view. ECharts has historically had cases where `large` line mode changes how `sampling` is honored. Make the manual verify explicitly include the **zoomed-out** full-session view of a dense signal (not only the deep-zoom window) to confirm the minmax thinning still applies and zoomed-out perf did not regress. If sampling stops thinning under large mode, the threshold values may need revisiting.

2. **Progressive restart during streaming (WARN, cosmetic).** `SessionCharts.tsx` rebuilds the option with `notMerge` on every chunk arrival (line 164, `useMemo` deps include `biometrics`). Progressive rendering animates across frames, so each chunk that lands mid-render restarts the progressive paint. During active streaming of a long session you may see repeated progressive repaints while the "Loading…" indicator is shown. This is expected given the existing full-rebuild architecture and does not affect the deep-zoom-after-load scenario the plan targets — just be aware it is not a bug if observed.

3. **Threshold gap is intentional.** `largeThreshold: 2000` < `progressiveThreshold: 4000` means series of 2000–4000 points get large-mode batched drawing but not progressive chunking. This is a reasonable, deliberate band and matches the plan's stated intent.

## Positive Notes

- Single, well-scoped change through the one shared builder — minimal blast radius, no duplicated edits.
- Correctly identifies and excludes the custom phase series, with sound justification.
- Thresholds are explained per-key with rationale, and the plan explicitly preserves "no behavior change for short/medium sessions."
- Manual verification steps are concrete (deep-zoom a ~30 s dense window; confirm axis tooltip still reports values; confirm a short session renders identically).

PLAN_REVIEW_PASS
