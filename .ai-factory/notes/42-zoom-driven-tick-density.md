# Zoom-driven tick density on the biometric X-axis

**Date:** 2026-06-22
**Source:** conversation context

## Key Findings

- With `type: 'value'` (seconds from start) ECharts picks a fixed-ish tick `interval` from the full domain `[0, durationSec]` and does **not** re-granularize when the user zooms via `dataZoom`. So even after the adaptive *formatter* (note 41) lands, deep-zoom can still show too-coarse ticks (e.g. one label per minute while inspecting a 20 s window) — the labels read correctly but the *spacing/granularity* does not follow the zoom. This task closes the gap so the axis behaves like a native `type: 'time'` scale: seconds when zoomed in, minutes/hours when zoomed out.
- The fix: on each `datazoom` event compute the visible span and set the X-axis `interval` (or `minInterval`) to a "nice" duration step targeting ~6–10 ticks, then re-apply the option. **Reuse `computeSpanSec(zoom, durationSec)` from `bucketPolicy.ts`** (already pure, already used by the resolution policy) to get the visible span in seconds — do not re-derive it.
- **Placement depends on Phase 22.** Today the `datazoom` handler is `SessionCharts.handleDataZoom` (`SessionCharts.tsx`). Phase 22 A1 (note 38) extracts the chart body into `BiometricEChartBody` which owns the option memo + `onDataZoom`; A2 (note 39) retires the zoom-driven base⊕overlay resolution switch. This task's tick-density recompute is a **pure presentation concern** independent of loading, so it should live wherever the datazoom handler ends up: against `SessionCharts.handleDataZoom` if Phase 22 has not shipped, or inside `BiometricEChartBody` after A1. Order this **after note 41**, and prefer landing it after Phase 22 A1 so it isn't rewritten by the refactor.

## Details

### The change

1. Add a pure helper `niceTimeInterval(spanSec: number): number` picking a step from a duration ladder `[1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]` such that `spanSec / step` lands in ~6–10 ticks (smallest step whose tick count ≤ target; floor 1 s). Co-locate with `bucketPolicy.ts` or `chartOption.ts`; pure + unit-testable.
2. Thread an `interval` into the X-axis config in `buildSessionChartOption` so the axis can be rebuilt with a zoom-derived `interval`. The axis is `type: 'value'`, so `interval` is honored directly; combined with note 41's formatter the chosen step renders on nice duration boundaries (1s/5s/30s/1m/5m/…).
3. In the `datazoom` handler: `span = computeSpanSec(zoom, durationSec)` → `interval = niceTimeInterval(span)` → set the X-axis `interval` and re-apply. Avoid a full `notMerge` rebuild for this — set only the axis `interval` (a targeted `setOption` merge, or recompute the memoized option with the new interval). Keep the existing `zoomRef` / structure-signature `notMerge` logic (note 30) intact; the interval update must not trigger a full series rebuild per zoom tick.

### What exists today

- `bucketPolicy.ts` — exports `computeSpanSec(zoom, durationSec)` (visible span in seconds), plus `BUCKET_LADDER`, `snapUp`, hysteresis helpers. The span helper is exactly the input this task needs.
- `chartOption.ts:207-220` — X-axes; no `interval` set today (ECharts auto-picks from the full domain).
- `SessionCharts.tsx` — `handleDataZoom` currently drives the resolution switch via `computeSpanSec` already; this task adds the tick-density side effect alongside (or, post-Phase-22, inside `BiometricEChartBody`).

### Guards

- Depends on note 41 (the duration formatter) — density without readable labels is half a fix.
- `type: 'value'` stays; this is not a `type: 'time'` migration.
- Do NOT re-derive the visible span — reuse `computeSpanSec` from `bucketPolicy.ts`.
- The per-zoom interval update must be cheap: update only the X-axis `interval`, never a full `notMerge:true` series rebuild on every wheel tick. Preserve note 30's structure-signature merge and `zoomRef`.
- Phase custom series, Y-axes, dataZoom `filterMode:'none'` / phase `clip:true` (note 23 fix) untouched.

### How to verify

Long session: zoomed all the way out, ticks fall on minute/multi-minute boundaries; zoom into a 20–30 s span and ticks become 2 s / 5 s steps; zoom to a few minutes and they become 30 s / 1 min — tick count stays ~6–10 throughout, all rendered as `M:SS` / `H:MM:SS` (note 41). No per-zoom flicker/full rebuild; biometric series and phase bars unaffected.

## Open Questions

- Whether `minInterval` + ECharts auto is enough vs. an explicit `interval` — explicit `interval` from `niceTimeInterval` gives deterministic duration boundaries; `minInterval` alone leaves ECharts free to pick non-round steps. Prefer explicit `interval`.
- Exact target tick count (6 vs 8 vs 10) — tune against the 389k-motion long session and narrow grid widths.
