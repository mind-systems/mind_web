# Plan Review: (B2) Zoom-driven tick density

**Plan:** `.ai-factory/plans/56-b2-zoom-driven-tick-density.md`
**Files Reviewed:** 5 (plan + `bucketPolicy.ts`, `chartOption.ts`, `EChart/index.tsx`, `BiometricEChartBody.tsx`, `makeWindowedVariant.tsx`)
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** OK. `EChart` stays a presentational shared component receiving `xAxisInterval` as a prop (no `useQuery`, no storage access) — consistent with the "components receive data as props" rule. New pure helpers stay in `bucketPolicy.ts`. No dependency-boundary violations.
- **Rules (`RULES.md`):** Not present — WARN (optional file, no action).
- **Roadmap (`ROADMAP.md`):** OK. The plan maps 1:1 to Phase 23 **(B2) Zoom-driven tick density**, correctly depends on shipped B1 (`formatAxisDuration`), and honors the roadmap's explicit constraints (reuse `computeSpanSec` from `bucketPolicy.ts`, targeted update not `notMerge:true`, preserve note-30 merge + `zoomRef`, keep `type:'value'`). Linkage present.

## Verification of Plan's Codebase Claims

Every factual claim in the plan was checked against source and holds:

- `bucketPolicy.ts` currently exports only `TARGET_BUCKETS`, `BUCKET_LADDER`, `snapUp`, `computeBucketSec` — `computeSpanSec` is indeed absent (removed in Phase 22 A2). Re-adding it is safe: a repo-wide grep found **no** dangling `computeSpanSec` references, so the re-add collides with nothing.
- `snapUp(value, ladder = BUCKET_LADDER)` accepts a custom ladder, floors at `ladder[0]`, caps at the last entry — so `snapUp(spanSec / TARGET_TICKS, DURATION_LADDER)` behaves exactly as the plan describes (floor 1, cap 3600).
- X-axes are built at `chartOption.ts:208–222`, `type:'value'`, `min:0`, `max:durationSec`, no `interval` set, labels/ticks only on the last grid. (Plan says "207-222/208-222" — trivially imprecise, harmless.)
- `EChart` applies options via `setOption(option, notMerge ?? false)`, does not expose the instance, has separate effects for option / events / theme keyed on `isDark`. Adding a fourth `xAxisInterval` effect fits this structure.
- `BiometricEChartBody` owns the option memo, `structureSignature`/`notMerge`, `prevSignatureRef`, and receives `zoomRef` as a prop; the `datazoom` handler lives in `makeWindowedVariant.tsx`'s `onDataZoom` and updates `zoomRef.current` only. Confirmed.
- B1's `formatAxisDuration` (`M:SS` / `H:MM:SS`) exists in `src/core/format.ts` and is already wired to the X `axisLabel`/`axisPointer`. The interval feeds that formatter unchanged.

## Correctness / Architecture Assessment

The core mechanism is sound. With `type:'value'` + explicit `interval`, ECharts places ticks at multiples of `interval` within the current (zoomed) axis extent, so `visibleTicks ≈ spanSec / interval`; recomputing `interval` per zoom keeps that ratio near the target. This is precisely the approach note 42 resolved to (explicit `interval` over `minInterval`), and the existing zoom machinery already proves the axis zooms despite hard `min:0`/`max:durationSec`.

The React data-flow is also correct:
- Memo reads `intervalRef.current` at build time but excludes it from deps — so `liveInterval` changes do **not** rebuild the option (cached option returned), and the targeted `EChart` merge is the only work per boundary crossing. Data/structure rebuilds bake in the latest `intervalRef.current`, preserving granularity — the exact mirror of the `zoom` handling. No conflict with `notMerge`/`prevSignatureRef`.
- The change-guard (`next !== intervalRef.current` before `setLiveInterval`) keeps most wheel ticks free of React work and of `chart.getOption()` calls. Good.
- Effect ordering (init → option → events → new interval effect, all in definition order) guarantees `getOption()` sees an applied xAxis array before the targeted merge reads its length.

## Non-blocking Observations

These are refinements, not blockers — the plan can proceed as written.

1. **Tick-count claim is optimistic vs. the algorithm.** `snapUp(spanSec / TARGET_TICKS)` returns the smallest step whose count is **≤ 8**, so the actual count is bounded above by 8 and dips lower near ladder gaps (e.g. span 20 s → interval 5 → 4 ticks; span 125 s → interval 30 → ~4 ticks). The Context (line 4) and Verification (line 54) state "~6–10 at every zoom level," which the algorithm won't consistently hit on the low end. This is faithful to note 42's own formula, and the note explicitly lists "exact target tick count (6 vs 8 vs 10)" as an open tuning question — so no change is required, but the implementer/tester should expect ~4–8 ticks, not 6–10, and treat `TARGET_TICKS`/ladder granularity as tunable.

2. **`handleDataZoom` depends on `onDataZoom` having updated `zoomRef` first.** The plan correctly calls `onDataZoom?.(params)` before reading `zoomRef.current`. But it also says "always bind `handleDataZoom` … even when `onDataZoom` is absent." If `onDataZoom` is ever absent, nothing updates `zoomRef`, so `computeSpanSec` runs on a stale window and the interval is wrong. In the real wiring `makeWindowedVariant` always passes `onDataZoom`, so this is only a latent robustness gap. Cheap hardening: derive `start`/`end` directly from `params` inside `handleDataZoom` (same shape the parent parses) rather than round-tripping through the ref.

3. **`events` memo must add `handleDataZoom` to its deps** when it replaces the direct `onDataZoom` binding. `durationSec` (a primitive computed from `startedAt`/`endedAt`) is a stable-by-value `useCallback` dep, so `handleDataZoom` identity stays stable per mount — fine, just call it out so the memo/callback dep arrays are updated together and ESLint stays green.

4. **First-mount targeted merge is redundant** (the freshly built option already carries `intervalRef.current`), but it's idempotent and harmless — no action needed.

## Positive Notes

- Correctly catches and corrects the stale spec premise (`computeSpanSec` was removed in A2) and instructs re-adding it with the identical canonical signature rather than inlining span math — preserving the "single span helper" intent.
- Reuses `snapUp` with a custom ladder instead of writing a second snapping loop — genuine DRY.
- The interval-preservation-mirrors-zoom-preservation framing is the right mental model and keeps note-30's `notMerge`/`structureSignature`/`zoomRef` machinery fully intact.
- Explicit, well-reasoned guards against per-wheel-tick React work and full rebuilds; phase custom series, Y-axes, and `dataZoom filterMode:'none'` are all left untouched.
- Non-finite / `durationSec <= 0` / negative-span guards are specified at both `computeSpanSec` and `niceTimeInterval`, so the full chain is safe on degenerate sessions.

PLAN_REVIEW_PASS
