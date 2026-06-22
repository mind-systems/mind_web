# A3 — Shared period (`bucketSec`) control for aggregated variants

**Date:** 2026-06-22
**Source:** conversation context — TradingView-style manual period; period ⟂ algorithm

## Key Findings

- A2's `makeWindowedVariant` auto-sizes `bucketSec = computeBucketSec(duration)` per aggregated variant. The user wants a **TradingView-style manual period**: a single free seconds input next to the radio group that sets `bucketSec` for ALL aggregated variants (min/max, avg, lttb); Raw ignores it. "Average over N seconds" = `agg=avg` with a user-chosen `bucketSec` — **no new server algorithm** (C1 already computes the average per bucket), API unchanged (`bucketSec` is already a query param).
- Period is **orthogonal to algorithm**: one knob, applied to whichever aggregated radio is active. Default **Auto** = `computeBucketSec(duration)` (preserves current behavior).

## Details

### Change
- **Extend the A2 variant contract**: `ChartVariant.Component` props become `{ session: SessionRun; bucketSec: number | null }` (`null` = Auto). The Raw variant ignores `bucketSec`. Add `aggregated: boolean` (or `kind: 'raw' | 'aggregated'`) to the `makeWindowedVariant` config so the shell knows whether to enable the period control and pass a `bucketSec`.
- **`makeWindowedVariant` (aggregated)**: compute the effective bucket **inside** the component from the prop — `eff = bucketSec ?? computeBucketSec(session.durationSeconds)` — then derive `windowSec` (~8 windows snapped to the `eff` bucket grid, as `useBiometricWindowedBase`) and `buildPath` (`?from&to&bucketSec=${eff}[&agg=…]`) from it. The config is now a function of the prop, not fixed at registry-construction time.
- **Shell (`SessionCharts`)**: own `periodSec` state (`number | null`, `null` = Auto). Render a free numeric **seconds** input next to `VariantSelector` (label e.g. "Period, s", placeholder "Auto"). Validate: positive integer ≥ 1; empty ⇒ Auto (`null`); optional clamp ≤ `durationSeconds`. Debounce or apply on blur + Enter (do NOT refetch per keystroke). Disable/hide the input when the active variant is raw (`aggregated === false`).
- Pass `bucketSec={periodSec}` into the active variant. Remount `key = `${session.id}:${selectedId}:${periodSec ?? 'auto'}`` so a period change cleanly reloads the windowed loader (`useBiometricWindows` resets on `session.id`/`totalWindows`; the key guarantees a reload even when two periods yield the same `totalWindows`).

### Guards / boundary
- **Free input, seconds, NO snap** to `BUCKET_LADDER` (user asked for free). The server buckets by any `bucketSec`; absolute alignment (Phase 49) holds for arbitrary values. **API unchanged.**
- `avg` over a large period flattens spikes — accepted; Min/max and LTTB radios remain the spike-preserving choices.
- Period applies **only** to aggregated variants; Raw is full-resolution and ignores it. `deriveView` unchanged. No `localStorage` for the period (storage rule) — `useState` only.
- Web-only — **no API milestone** (the algorithm is C1's `avg`; the period is just `bucketSec`). Depends on A2.

### Verify
- Select Min/max, type `5` → 5 s buckets; type `60` → 1-min buckets, far fewer points; clear → Auto. Switching algorithm keeps the period. Raw disables the field.

## Open Questions
- Default stays **Auto** (preserves current behavior) vs a fixed default like 5 s — recommend Auto.
- Quick presets (5s/15s/1m/5m) could be added later — out of scope; free input now.
</content>
