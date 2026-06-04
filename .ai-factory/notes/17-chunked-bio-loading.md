# Chunked Biometric Loading with Zoom-Driven Trigger

**Date:** 2026-06-04
**Source:** conversation context + empirical ECharts 6.1.0 measurement (prior failed run)

## Key Findings

- The single full-session fetch `GET /sessions/runs/:id/biometrics?from=startedAt&to=endedAt` returns **413** for real sessions (motion alone ≈ 250 samples/s).
- API is ready as-is: the `from`/`to` filter already works; 30 s of motion ≈ 7 500 samples — well under the API FLAT_CAP (50 000), so a single 30 s chunk never 413s.
- Load data in **30-second chunks sequentially** (one in-flight request at a time), triggered by ECharts `datazoom` events. Within one chunk all sampleTypes come back together (single API call), so no per-type parallelism is needed.
- **Critical rendering decision — use `notMerge: true` (full chart rebuild) on each chunk arrival.** A prior run measured ECharts 6.1.0 directly: both `notMerge: false` (normal merge) and `replaceMerge` **corrupt the layout** when a sampleType first appears in a later chunk. ECharts preserves each component's *creation-order* index across both merge modes, so the option's numeric `xAxisIndex`/`yAxisIndex` links (numbered by array position) resolve to the **wrong axes** — e.g. a `hr` series that arrives in chunk 1 gets plotted against the motion axis (off-screen at y ≈ −1710). `notMerge: true` reassigns indices fresh every render and binds every series to its correct axis. Do **not** use `notMerge: false` or `replaceMerge`.
- Zoom is preserved across a full rebuild by threading the current zoom window into the option's `dataZoom` `start`/`end`; the rebuild re-renders at that window. This is the only chart-side change actually needed for zoom preservation.

## Why the prior run failed

The earlier attempt chased "incremental merge" (`notMerge: false`, then `replaceMerge`, propped up with stable component `id`s) to avoid redrawing on each chunk. Measurement proved that whole direction wrong: id-based merge does not renumber the series→axis links, so an inserted higher-priority grid cross-wires the axes. The fix is to **drop incremental merge entirely** and rebuild. The stable `id`s become harmless no-ops under `notMerge: true` and may stay.

## Details

### Chunk math

```typescript
const CHUNK_SEC = 30;
const totalChunks = Math.ceil(session.durationSeconds / CHUNK_SEC);

// Half-open window: for idx > 0 add 1 ms so a sample exactly on a 30 s boundary
// is not returned by two adjacent chunks (timestamps are ms-resolution).
const fromMs = sessionStartMs + idx * CHUNK_SEC * 1000 + (idx > 0 ? 1 : 0);
const toMs   = Math.min(sessionStartMs + (idx + 1) * CHUNK_SEC * 1000, sessionEndMs);
```

### New hook: `src/pages/SessionsPage/useBiometricChunks.ts`

```typescript
export function useBiometricChunks(session: SessionRun): {
  biometrics: BioSampleDto[];      // accumulated across chunks (NOT sorted here — see toSeries)
  requestChunks: (idxs: number[]) => void;
  isLoading: boolean;
  totalChunks: number;             // single source of truth, exposed so the caller never recomputes
}
```

- Chunks arrive in **arbitrary order** (zoom-driven), so `biometrics` is not time-monotonic. Sorting happens in `toSeries` (see below), not here.
- Dedup lives entirely in **refs** so `requestChunks` is a stable `useCallback`: `loadedRef` (`Set<number>` of fetched OR permanently-attempted indices), `inFlightRef`, and a queued-set mirror. `loadedChunks` is **not** exposed (no consumer reads it).
- **Drain effect:** when `queue` is non-empty and `!isLoading`, pop the first index, mark in-flight + `isLoading`, build the half-open window, `apiFetch<BioSampleDto[]>(\`/sessions/runs/${session.id}/biometrics?from=${from}&to=${to}\`)` with both bounds `encodeURIComponent`-encoded. On success append + add to `loadedRef`; on error `console.error` + add to `loadedRef` (mark attempted so the drain never retry-storms). Always clear in-flight + `isLoading` and let the effect re-run.
- **Guard:** skip any chunk whose `fromMs >= sessionEndMs` (mark attempted) — avoids an inverted `from > to` request when `durationSeconds` overstates `endedAt − startedAt`.
- **Mount / session-switch reset:** effect keyed on `session.id` resets all state/refs and calls `requestChunks([0])`. Use a per-fetch `fetchId`/`ignore` flag so a late response from a previous session does not append.
- Intentionally bypasses React Query (re-selecting a session reloads chunks — accepted trade-off given the 413 constraint).

### EChart: add `onEvents` prop, bound in a SEPARATE effect

`src/components/EChart/index.tsx` — add `onEvents?: Record<string, (params: unknown) => void>`.

- Do **not** bind in the init effect (the `echarts.init()` / `chart.dispose()` one keyed on `isDark`) — that would tear down the canvas whenever `onEvents` changes.
- Add a **separate** effect keyed on `[onEvents, isDark]`, running after the init effect, that for each `[event, handler]` calls `chart.off(event)` then `chart.on(event, handler)` (off-before-on prevents duplicate bindings). No dispose, no `setOption`.

### Sort biometric series by time

`src/pages/SessionsPage/transforms.ts` — in `toSeries`, append `.sort((a, b) => a[0] - b[0])` to the produced `[sec, value]` pairs. ECharts `type: 'line'` on a `value` x-axis connects points in array order; without the sort, out-of-order chunk arrival draws backward "tie-back" strokes. `parsePhases` is unaffected (instructions load once, in order).

### chartOption: zoom parameter

`src/pages/SessionsPage/chartOption.ts` — add optional `zoom: { start: number; end: number } = { start: 0, end: 100 }` to `buildSessionChartOption`; use `zoom.start`/`zoom.end` for `start`/`end` of **both** `dataZoom` entries (`inside` and `slider`) instead of hard-coded `0`/`100`. Default keeps first render at full range; a rebuild at `notMerge: true` then re-renders at the current window. (Stable role-based `id`s on grids/axes/series are harmless no-ops here — keep or drop.)

### SessionCharts.tsx wiring

`src/pages/SessionsPage/SessionCharts.tsx`:

- Keep the top-level `from`/`to` consts — they still feed the **instructions** `useQuery` (unchanged). Remove only the biometrics `useQuery`.
- `const { biometrics, requestChunks, isLoading: isChunkLoading, totalChunks } = useBiometricChunks(session);`
- `const zoomRef = useRef({ start: 0, end: 100 });`
- `handleDataZoom = useCallback(..., [session.durationSeconds, requestChunks, totalChunks])` — deps exclude per-chunk state so identity is stable. Read `start = p.batch?.[0]?.start ?? p.start ?? 0` / `end = p.batch?.[0]?.end ?? p.end ?? 100` (full optional chaining); update `zoomRef.current`; convert percent→seconds: `startSec = (start / 100) * durationSec`; enqueue every index in `[floor(startSec/CHUNK_SEC), floor(endSec/CHUNK_SEC)]` clamped `< totalChunks` via `requestChunks` (dedupes internally).
- `const events = useMemo(() => ({ datazoom: handleDataZoom }), [handleDataZoom]);`
- Option memo passes `biometrics` and `zoomRef.current` as the `zoom` arg into `buildSessionChartOption`. `zoomRef` is read at rebuild time without being a memo dep (latest window without retriggering on every zoom event) — annotate with `// eslint-disable-next-line react-hooks/refs`.
- Render: `<EChart option={option} style={{ height, width: '100%' }} notMerge onEvents={events} />`.
- **Per-session isolation:** `index.tsx` renders `<SessionCharts key={selectedSession.id} session={selectedSession} />` so accumulated state, `zoomRef`, and the chart instance reset per session.

### Loading / error / empty gating

- `isLoading = instructionsLoading || (biometrics.length === 0 && isChunkLoading)`.
- `isError = instructionsError` only (chunk errors are soft, must not block the panel).
- Subtle header indicator (`text-sm text-gray-400 dark:text-gray-500`) when `isChunkLoading && biometrics.length > 0` — does not replace the initial `SkeletonLoader`.
- **Empty-state guard:** do not declare "No data" until `loadedRef` covers all `totalChunks`. Otherwise a session whose chunk 0 has no biometrics and no phases (e.g. a sensor that begins streaming after the first 30 s) traps the chart in the empty state — the `<EChart>` never renders, no `datazoom` fires, no further chunks load.

## Verify

1. Open a session → first 30 s of all sampleTypes appear immediately, no 413.
2. Zoom/scroll past 30 s → network tab shows a second request with updated `from`/`to`; data appears **without the zoom window snapping back to full**.
3. Pan back to an already-loaded chunk → no new request (ref dedup).
4. A ~6-minute session completes across all chunks with no 413.
5. **Axis correctness (the prior run's failure):** open a session where a sensor connects late — its first sample lands in chunk 1+, not chunk 0 — and confirm when that chunk arrives every series stays on its correct axis/scale (no series plotted off-screen or against the wrong unit). This is what `notMerge: true` guarantees and incremental merge did not.
6. The accumulated line never draws backward "tie-back" strokes after panning left then right (confirms the sort).
