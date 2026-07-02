# Plan: (B2) Zoom-driven tick density

## Context
Make the biometric X-axis re-granularize its tick spacing on zoom: with `type:'value'` ECharts fixes the tick `interval` from the full `[0,durationSec]` domain, so deep-zoom shows coarse ticks even after B1's duration formatter. This adds a zoom-derived, "nice" tick `interval` applied via a cheap targeted merge, so tick count stays ~6–10 at every zoom level.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Codebase Notes (read before implementing)

- **The spec's premise is partly stale.** `.ai-factory/notes/42-zoom-driven-tick-density.md` (2026-06-22) says to REUSE `computeSpanSec` from `bucketPolicy.ts`. Phase 22 **A2 removed `computeSpanSec`** (along with `shouldUseRaw`/`quantizeWindow`) when it retired the zoom-driven base⊕overlay switch. Today `bucketPolicy.ts` exports only `TARGET_BUCKETS`, `BUCKET_LADDER`, `snapUp`, `computeBucketSec`. So "reuse `computeSpanSec`" means **re-add the same pure helper to `bucketPolicy.ts`** — keep the identical signature `computeSpanSec(zoom, durationSec)` so it remains the single canonical span helper (the note's "do not re-derive" intent). Do NOT inline the span math in the handler.
- **Placement is post-Phase-22.** A1 shipped: `BiometricEChartBody` owns the option memo, `structureSignature`/`notMerge`, `prevSignatureRef`, and the `EChart` render. A2 shipped: the `datazoom` handler now lives in `makeWindowedVariant.tsx`'s `onDataZoom` (updates `zoomRef.current` only), and `zoomRef` is passed into `BiometricEChartBody` as a prop. Land the tick-density logic in `BiometricEChartBody` (it owns the chart + option and already receives `zoomRef`).
- **X-axes** are built in `chartOption.ts:207-222` (`type:'value'`, `min:0`, `max:durationSec`, one per grid; only the last grid shows `axisLabel`/`axisTick`). No `interval` is set today — ECharts auto-picks it.
- **`EChart`** (`src/components/EChart/index.tsx`) applies options via `setOption(option, notMerge ?? false)` and does not expose the instance. It has separate effects for option, events, and theme. A targeted axis-only merge needs a new effect here.
- **Preserve note-30 machinery:** `prevSignatureRef` + `notMerge` (full rebuild only on structure-signature delta) and `zoomRef` (zoom-window preservation across rebuilds) must stay intact. Phase custom series, Y-axes, and dataZoom `filterMode:'none'` must not change.
- **Interval-preservation mirrors zoom-preservation:** just as `buildSessionChartOption` takes `zoom` so rebuilds don't snap back to full range, it must take the current interval so a data-arrival rebuild doesn't reset the axis to auto. `BiometricEChartBody` reads the current interval from a ref at memo-build time (same pattern as `zoomRef.current`).

## Tasks

### Phase 1: Pure helpers

- [x] **Task 1: Add `computeSpanSec` + `niceTimeInterval` to `bucketPolicy.ts`**
  Files: `src/pages/SessionsPage/bucketPolicy.ts`
  Add two pure, React-free helpers (unit-testable, no fetch/UI):
  - `computeSpanSec(zoom: { start: number; end: number }, durationSec: number): number` — re-add the helper A2 removed. Visible span in seconds: `((zoom.end - zoom.start) / 100) * durationSec`. Guard against non-finite/`durationSec <= 0` (return `0`) and negative results (floor at `0`). Keep this exact signature — it is the canonical span helper the spec forbids re-deriving.
  - `niceTimeInterval(spanSec: number): number` — pick a step from a duration ladder `DURATION_LADDER = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]` so the resulting tick count (`spanSec / step`) targets ~6–10. Add `const TARGET_TICKS = 8;` and implement as `snapUp(spanSec / TARGET_TICKS, DURATION_LADDER)` — reuses the existing `snapUp` (smallest ladder entry ≥ value, floor `1`, cap `3600`). Guard: non-finite or `spanSec <= 0` → return `1` (floor). Export `DURATION_LADDER`, `TARGET_TICKS`, and both functions.

### Phase 2: Thread interval through the option builder

- [x] **Task 2: Accept an X-axis `interval` in `buildSessionChartOption`** (depends on Task 1)
  Files: `src/pages/SessionsPage/chartOption.ts`
  Add a trailing optional param `xAxisInterval?: number` to `buildSessionChartOption` (after the existing `zoom` param). When it is a finite number, set `interval: xAxisInterval` on **every** xAxis entry built at lines 208-222 (all axes share the `[0, durationSec]` domain; only the last renders labels, but set it on all for consistency). When `undefined`, omit `interval` so ECharts keeps its auto behavior (preserves current default). Update the function's JSDoc to note the new param mirrors `zoom`: it preserves the zoom-derived tick granularity across rebuilds/merges. Do NOT touch Y-axes, phase custom series, `dataZoom`, or `structureSignature`.

### Phase 3: Targeted merge path + wiring

- [x] **Task 3: Add a targeted X-axis-interval merge to `EChart`** (depends on Task 2)
  Files: `src/components/EChart/index.tsx`
  Add an optional prop `xAxisInterval?: number`. Add a dedicated effect keyed on `[xAxisInterval, isDark]` that, when `chartRef.current` exists and `xAxisInterval != null`, applies an axis-only merge: read the current xAxis count from `chart.getOption()` (`Array.isArray(opt.xAxis) ? opt.xAxis.length : 1`) and call `chart.setOption({ xAxis: Array.from({ length: count }, () => ({ interval: xAxisInterval })) }, false)`. This is a merge (`notMerge:false`) that touches only `xAxis.interval` — series/grids/yAxis/dataZoom stay untouched, so there is no full rebuild per wheel tick. Place it after the existing option effect so ordering is stable; keying on `isDark` re-applies after a theme-driven canvas recreate.

- [x] **Task 4: Compute and apply zoom-driven interval in `BiometricEChartBody`** (depends on Tasks 1-3)
  Files: `src/pages/SessionsPage/BiometricEChartBody.tsx`
  Wire the tick-density side effect into the datazoom flow while preserving `notMerge`/`prevSignatureRef`/`zoomRef`:
  - Compute `durationSec` from `startedAt`/`endedAt` (same as `chartOption.ts`).
  - Add `intervalRef = useRef(niceTimeInterval(computeSpanSec({ start: 0, end: 100 }, durationSec)))` — the full-range default (equivalent to `niceTimeInterval(durationSec)`).
  - Add `const [liveInterval, setLiveInterval] = useState(intervalRef.current)`.
  - In the option memo, read `intervalRef.current` (same `eslint-disable react-hooks/refs` pattern as `zoomRef.current`) and pass it as the new `xAxisInterval` arg to `buildSessionChartOption`. Do NOT add `liveInterval`/`intervalRef` to the memo deps — the memo must not rebuild on interval change; the interval is baked in only on rebuilds triggered by data/structure changes (mirrors how `zoom` is handled).
  - Replace the direct `handlers.datazoom = onDataZoom` binding with an internal `handleDataZoom(params)` (via `useCallback`) that: (1) calls `onDataZoom?.(params)` first so the parent updates `zoomRef.current`; (2) computes `next = niceTimeInterval(computeSpanSec(zoomRef.current, durationSec))`; (3) only when `next !== intervalRef.current`, sets `intervalRef.current = next` and calls `setLiveInterval(next)`. The change-guard means most wheel ticks (same snapped interval) do no React work. Always bind `handleDataZoom` for `datazoom` (the interval effect should run even when `onDataZoom` is absent).
  - Pass `xAxisInterval={liveInterval}` to `<EChart .../>`. On a `liveInterval` change the memo returns the cached option (deps unchanged) and only the `EChart` targeted merge fires; on a data-arrival rebuild the option already carries `intervalRef.current`, so the interval is preserved either way.
  - Leave `deriveView`, the loading/error/empty switch, `notMerge`, `prevSignatureRef`, and `zoomRef` untouched.

## Verification (manual, per spec note 42)
Long session: zoomed fully out → ticks on minute/multi-minute boundaries; zoom into a 20–30 s window → 2 s / 5 s steps; zoom to a few minutes → 30 s / 1 min steps; tick count stays ~6–10 throughout, all rendered via B1's `M:SS` / `H:MM:SS` formatter. No per-zoom flicker or full rebuild; biometric series and phase bars unaffected.
