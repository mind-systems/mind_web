# W2 — Progressive windowed base load (chart opens on the first window)

**Date:** 2026-06-22
**Source:** conversation context — the regression: chart no longer opens until everything loads

## Key Findings

- **The regression, exactly:** `useBiometricOverview` (`src/pages/SessionsPage/useBiometricOverview.ts`) fetches the WHOLE session aggregate in ONE request, and `deriveView` (`deriveView.ts:43`) returns `{kind:'loading'}` while `overviewQuery.isPending`. `SessionCharts` renders `<SkeletonLoader/>` for `view.kind==='loading'` (`SessionCharts.tsx:249`). So the chart shows a skeleton until the entire session has loaded — the old "first 30 s appears immediately, fills as it streams" behavior is gone.
- The fix is to load the base **progressively in windows** (via W1's `useBiometricWindows`) and open the chart on the FIRST window, uniformly for every variant.

## Details

### Change
- Replace the single-request base. Configure `useBiometricWindows` (W1) for the aggregated base: `windowSec` sized to a handful of windows over the session (fast first paint without firing dozens of tiny requests — e.g. `max(durationSec/8, 60)`), `buildPath` = aggregate with `bucketSec = computeBucketSec(session.durationSeconds)`. **Auto-enqueue ALL windows on mount** (`requestWindows([0..totalWindows-1])`) so the full session streams in progressively.
- **Align aggregated window boundaries to bucket boundaries** via `quantizeWindow(fromMs, toMs, bucketSec)` so windows tile exactly on bucket edges (no seam, no split bucket). This pairs with mind_api Phase 49 (absolute bucket anchoring) — both are required for seamless windowed aggregation.
- **Rework `deriveView`** to key off the loader's progress instead of a single RQ query:
  - `loading` — instructions pending OR no window has resolved yet (`attemptedCount === 0 && samples.length === 0`).
  - `ready` — as soon as ANY samples exist; later windows merge in (note 30 incremental rebuild handles the progressive grid/series growth).
  - `empty` — all windows attempted (`allAttempted`) AND `gridCount === 0`.
  - `error` — all windows attempted AND every one failed AND `samples.length === 0` (distinct from empty).
- Update `SessionCharts.tsx`: feed the windowed base into `samples = detail ?? base`; the `detail ?? base` overlay logic (raw/agg on zoom) is unchanged. The "Loading…" header hint can track `isLoading` of the base loader.

### Guards / boundary
- The base is still the full-session result (just streamed) — keep `deriveView`'s "no `sessionHasData` flag" property: emptiness = all-attempted + zero grids.
- Uniform across variants: raw loads progressively via the same loader (W1 wrapper); the smoothed variant inherits this for free once its endpoint (`agg=avg|lttb`, handoff 02 / variant 3) exists — no further loader change.
- Do not reintroduce a wait-for-all gate anywhere; `loading` must end on the first window.

### Verify
- Open a 30 min session: chart appears within the first window's round-trip and fills progressively (no full-session wait). Single-request `useBiometricOverview` is gone/wrapped. Empty and error states still settle correctly.

## Open Questions

- Exact `windowSec` for the aggregated base — tune for first-paint latency vs request count against the 389k-motion session.
- Whether the zoom-driven overlay (`useBiometricAggregate`) should also route through `useBiometricWindows` for consistency, or stay a single windowed RQ fetch — defer; not required for the regression fix.
