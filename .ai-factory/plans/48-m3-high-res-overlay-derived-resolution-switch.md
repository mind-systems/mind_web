# Plan: (M3) High-res overlay + derived resolution switch

## Context
Layer a transient, window-scoped high-res **detail** over the immutable coarse **base** from M2: render `detail ?? base` so the chart never blanks, with resolution **derived** from the zoom span on each `datazoom` (finer aggregate via React Query mid-zoom, lazy raw chunks deep-zoom). Completes Phase 20 (server-side LOD client consumer).

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Background (verified state)

- `SessionCharts.tsx` (M2) renders a single coarse base from `useBiometricOverview(session)`; `samples = overviewQuery.data ?? []` feeds `buildSessionChartOption`. There is **no** chunk loader wired in and **no** mount `requestWindowChunks` effect anymore (M2 removed it). `zoomRef` + the `prevSignatureRef`/`structureSignature` `notMerge` merge (note 30) are already in place; `handleDataZoom` currently only persists the zoom window.
- `deriveView(overviewQuery, instructionsQuery, gridCount)` decides `loading`/`error`/`empty`/`ready` purely from the **base** query state + `gridCount` of the rendered option. It must stay base-driven.
- `bucketPolicy.ts` (M1) exposes `computeSpanSec`, `computeBucketSec`, `shouldUseRaw(spanSec, currentlyRaw)` (hysteresis), `quantizeWindow(fromMs, toMs, bucketSec)`.
- `useBiometricChunks(session)` still exists but is **not imported anywhere in `src/`** today. It eagerly enqueues chunk 0 in its session-reset effect (lines ~178-181). Its 413-avoidance rationale and chunk-index dedup (`loadedRef`/`inFlightRef`/`queuedSetRef`/`fetchIdRef`) must be preserved.
- TanStack Query v5 is in use — `keepPreviousData` (the placeholder sentinel) is importable from `@tanstack/react-query`.

## Tasks

### Phase 1: Lazy raw loader

- [x] **Task 1: Make `useBiometricChunks` load lazily (remove the eager mount load)**
  Files: `src/pages/SessionsPage/useBiometricChunks.ts`
  In the session-switch/unmount reset effect (≈lines 165-188), stop enqueuing chunk 0: remove the `if (totalChunks > 0) { queuedSetRef.current.add(0); setQueue([0]); }` block so the hook starts with an empty queue and only fetches chunks that a later `requestChunks` call enqueues. Keep everything else in the reset (clear `biometrics`, `isLoading`, `attemptedCount`, the three dedup refs, bump `fetchIdRef`). Update the hook's doc comment: it no longer auto-loads chunk 0; chunks load only on demand. Do NOT touch the drain effect, the merge-insert sort, the 413 per-chunk windowing, or the dedup/`fetchIdRef` machinery. This removes the only remaining eager mount load (the `SessionCharts` mount `requestWindowChunks` effect was already removed in M2 and must not be reintroduced).

### Phase 2: High-res overlay + derived resolution

- [x] **Task 2: Add `useBiometricAggregate` overlay hook (finer aggregate via React Query, quantized cache key)**
  Files: `src/pages/SessionsPage/useBiometricAggregate.ts` (new)
  Mirror `useBiometricOverview.ts`. Signature `useBiometricAggregate(session, overlay)` where `overlay` is the active aggregate descriptor `{ fromMs: number; toMs: number; bucketSec: number } | null`. Implement with `useQuery`:
  - `queryKey: ['bio-agg', session.id, overlay?.fromMs, overlay?.toMs, overlay?.bucketSec]` — the **quantized** window (from `quantizeWindow`, computed by the caller) is the request identity, giving free dedup + cache (small pans within one quantized window = one request; zoom-back to a visited window is instant). No `lastAggSignatureRef`, no manual dedup.
  - `queryFn`: `apiFetch<BioSampleDto[]>` against `/sessions/runs/${session.id}/biometrics?from=&to=&bucketSec=` with `from`/`to` as `encodeURIComponent(new Date(fromMs).toISOString())` and `bucketSec=overlay.bucketSec`.
  - `enabled: overlay != null` so the query is inert when no aggregate overlay is active.
  - `placeholderData: keepPreviousData` (import from `@tanstack/react-query`) so the previous overlay stays visible while the next quantized window loads (smoother; base bridges either way per note 35's open question).
  Document the same RQ-vs-413 divergence comment as `useBiometricOverview` (aggregate payload is small, so RQ cache/dedup/cancellation apply; the raw chunk hook still bypasses RQ for the 413 reason).

- [x] **Task 3: Wire derived resolution + `detail ?? base` overlay into `SessionCharts`** (depends on Task 1, Task 2)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`
  Introduce the overlay state machine and layered render. No stored `mode`/`useRawRef` — the overlay descriptor is the single source of truth and resolution is recomputed per `datazoom`.

  1. **Overlay state (single source).** Add `const [overlay, setOverlay] = useState<Overlay>(null)` where
     `type Overlay = { kind: 'raw' } | { kind: 'agg'; fromMs: number; toMs: number; bucketSec: number } | null`.
     Mirror it into `overlayRef` via an effect (`useEffect(() => { overlayRef.current = overlay }, [overlay])`) so `handleDataZoom` can read the current overlay for hysteresis without becoming a dependency (same pattern as `zoomRef`). Reset `overlay` to `null` on session change (effect keyed on `session.id`) so a new session starts on the base.

  2. **Lazy raw chunks.** Call `const chunks = useBiometricChunks(session)`. Add a window→chunk-indices helper (e.g. `requestWindowChunks(start, end)`) that converts the zoom percentages to `[fromMs, toMs]` (`startMs + (pct/100) * durationMs`), maps to chunk indices `floor((ms - startMs) / (CHUNK_SEC * 1000))` for the from/to bounds, and calls `chunks.requestChunks(idxs)`. Call it **only** on the raw path inside `handleDataZoom` — never on mount. `requestChunks` is internally deduped, so re-calling per raw `datazoom` is safe.

  3. **Aggregate overlay query.** `const aggQuery = useBiometricAggregate(session, overlay?.kind === 'agg' ? overlay : null)`.

  4. **Derived resolution in `handleDataZoom`.** After persisting `zoomRef.current = { start, end }`:
     - `const spanSec = computeSpanSec({ start, end }, durationSec)`.
     - `const currentlyRaw = overlayRef.current?.kind === 'raw'` (hysteresis input — derived from the current overlay, not a separate flag).
     - `const useRaw = shouldUseRaw(spanSec, currentlyRaw)`.
     - If `useRaw`: call `requestWindowChunks(start, end)` and `setOverlay(prev => prev?.kind === 'raw' ? prev : { kind: 'raw' })`.
     - Else compute `bucketSec = computeBucketSec(spanSec)`. If `bucketSec >= baseBucketSec` (where `baseBucketSec = computeBucketSec(durationSec)` — same value the base uses) the overlay would be no finer than the base, so `setOverlay(null)` (base only — avoids a redundant fetch identical to the base). Otherwise compute `[qFrom, qTo] = quantizeWindow(fromMs, toMs, bucketSec)` and `setOverlay(prev => sameAgg(prev, qFrom, qTo, bucketSec) ? prev : { kind: 'agg', fromMs: qFrom, toMs: qTo, bucketSec })`.
     Use the functional `setOverlay(prev => …)` form returning `prev` unchanged when the descriptor is identical, so micro-pans within one quantized window do not re-render — **no storm**. Keep `handleDataZoom` stable: read live values from refs (`overlayRef`, and session scalars `startMs`/`durationSec`/`baseBucketSec` either as refs or as deps — they change only on session switch). `requestChunks` is already stable.

  5. **`detail ?? base` render.** Compute:
     - `const base = overviewQuery.data ?? []`.
     - `const detail = overlay?.kind === 'raw' && chunks.biometrics.length > 0 ? chunks.biometrics : overlay?.kind === 'agg' && (aggQuery.data?.length ?? 0) > 0 ? aggQuery.data! : null`.
     - `const samples = detail ?? base`.
     Feed `samples` to `buildSessionChartOption` (replacing the M2 `samples = overviewQuery.data ?? []`). **Guard:** `detail` must be `null` whenever it has no renderable samples (the `.length > 0` checks above). This is what preserves the M2/architecture guarantee — when `detail` is null the chart shows `base` (never blanks during in-flight raw chunk fill or aggregate refetch), and `gridCount === 0` can only occur when the base itself is empty, so `deriveView`'s `empty` branch still reflects the whole session, never a sparse sub-window.

  6. **Keep `deriveView` base-driven (no change to its logic).** Continue passing `gridCount` from the built (`detail ?? base`) option; `loading`/`error` stay tied to `overviewQuery`/`instructionsQuery` only. Overlay query/chunk failures are soft — the base keeps rendering. Keep note 30's `prevSignatureRef`/`structureSignature` `notMerge` merge exactly as-is: a present-grids delta between an overlay window and the base (or during raw fill) correctly forces `notMerge: true`; matching grids stay `notMerge: false`. It already derives from the displayed option.

  7. **In-flight indicator (minimal).** Extend the header `Loading…` condition from `overviewQuery.isFetching` to also include `aggQuery.isFetching || chunks.isLoading` so overlay loads are visible. Render-only.

  **Guards / non-goals:**
  - Do NOT reintroduce a `mode` state, `useRawRef`, `lastAggSignatureRef`, `sessionHasData`, a skeleton-suppression bridge, or an unmount-on-empty-window path — all are dissolved by construction here.
  - `motion` ≈95% of volume → Phase 19 `sampling:'minmax'` + `large`/`progressive` on the raw line path stays mandatory; do not weaken it (it lives in `buildLineSeriesEntry`, untouched).
  - Raw `biometrics` accumulated during a deep zoom is cleared on `session.id` change only (existing hook reset); reclaiming on deep→coarse is explicitly out of scope.
