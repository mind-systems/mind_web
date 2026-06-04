# Plan: Chunked biometric loading with zoom-driven trigger

## Context
The single full-session biometrics fetch returns 413 for real sessions (motion alone ≈ 250 samples/s). Replace it with sequential 30 s chunk loading triggered by ECharts `datazoom`, and rebuild the chart with `notMerge: true` to keep series bound to their correct axes when a sampleType first appears in a later chunk.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Chunk loader hook

- [x] **Task 1: Create `useBiometricChunks(session)` hook**
  Files: `src/pages/SessionsPage/useBiometricChunks.ts`
  Export `CHUNK_SEC = 30` and a hook returning `{ biometrics, requestChunks, isLoading, totalChunks }`. Compute `sessionStartMs`/`sessionEndMs` from `session.startedAt`/`endedAt` and `totalChunks = Math.ceil(session.durationSeconds / CHUNK_SEC)`. State: `biometrics` (accumulated, NOT sorted here), `queue` (number[]), `isLoading`. Dedup lives entirely in refs so `requestChunks` stays stable: `loadedRef` (`Set<number>` of fetched OR permanently-attempted indices), `inFlightRef` (`number | null`), `queuedSetRef` (mirror of queue for O(1) dedup). Do NOT expose `loadedChunks` — no consumer reads it. Bypass React Query intentionally (re-selecting a session reloads chunks — accepted trade-off given the 413 constraint).

- [x] **Task 2: `requestChunks` enqueue + drain effect** (depends on Task 1)
  Files: `src/pages/SessionsPage/useBiometricChunks.ts`
  `requestChunks(idxs)` is a `useCallback` keyed only on `totalChunks`: for each idx in range `[0, totalChunks)` not in `loadedRef`/`inFlightRef`/`queuedSetRef`, push to a local enqueue list, add to `queuedSetRef`, then append to `queue`. Drain effect (deps `[queue, isLoading, session.id, sessionStartMs, sessionEndMs]`): when `!isLoading && queue.length > 0`, pop first index, clear it from `queuedSetRef`, set `inFlightRef` + `isLoading(true)` + `setQueue(rest)` (React 18 batching keeps a second drain from starting mid-flight). Build a half-open window: `fromMs = idx === 0 ? sessionStartMs : sessionStartMs + idx*CHUNK_SEC*1000 + 1`, `toMs = Math.min(sessionStartMs + (idx+1)*CHUNK_SEC*1000, sessionEndMs)`. Guard: if `fromMs >= toMs` (covers `fromMs >= sessionEndMs`), mark attempted in `loadedRef`, clear in-flight + `isLoading`, return — avoids an inverted request when `durationSeconds` overstates `endedAt − startedAt`. Otherwise `apiFetch<BioSampleDto[]>(\`/sessions/runs/${session.id}/biometrics?from=${from}&to=${to}\`)` with both bounds ISO + `encodeURIComponent`-encoded. On success append to `biometrics` + add to `loadedRef`; on error `console.error` + add to `loadedRef` (mark attempted so the drain never retry-storms); `finally` clears in-flight + `isLoading`.

- [x] **Task 3: Per-fetch ignore guard + session-switch reset** (depends on Task 2)
  Files: `src/pages/SessionsPage/useBiometricChunks.ts`
  Add `fetchIdRef` incremented per fetch; in `then`/`catch`/`finally` bail early when `fetchIdRef.current !== myFetchId` so a late response from a previous session does not append. Add an effect keyed on `session.id` that resets `biometrics`, `isLoading`, `loadedRef`, `inFlightRef`, `queuedSetRef`, bumps `fetchIdRef`, and enqueues chunk 0 (`queuedSetRef.add(0)` + `setQueue([0])`). Its cleanup bumps `fetchIdRef` again to invalidate any in-flight fetch on unmount/switch.

### Phase 2: Chart-side plumbing

- [x] **Task 4: Add `onEvents` prop to `EChart` in a separate effect**
  Files: `src/components/EChart/index.tsx`
  Add `onEvents?: Record<string, (params: unknown) => void>` to props. Bind it in a NEW effect keyed on `[onEvents, isDark]` that runs after the init effect — for each `[event, handler]` call `chart.off(event)` then `chart.on(event, handler)` (off-before-on prevents duplicate bindings). Never bind inside the `echarts.init()`/`chart.dispose()` effect — that would tear down the canvas whenever `onEvents` changes. No dispose, no `setOption` in this effect.

- [x] **Task 5: Sort biometric pairs in `toSeries`**
  Files: `src/pages/SessionsPage/transforms.ts`
  Append `.sort((a, b) => a[0] - b[0])` to the `[sec, value]` pairs produced in `toSeries`. Chunks arrive out of order (zoom-driven), and ECharts `type: 'line'` on a `value` x-axis connects points in array order — without the sort, out-of-order arrival draws backward "tie-back" strokes. `parsePhases` is unaffected (instructions load once, in order).

- [x] **Task 6: Thread `zoom` param into `buildSessionChartOption`**
  Files: `src/pages/SessionsPage/chartOption.ts`
  Add optional `zoom: { start: number; end: number } = { start: 0, end: 100 }` parameter. Use `zoom.start`/`zoom.end` for `start`/`end` of BOTH `dataZoom` entries (`inside` and `slider`) instead of hard-coded `0`/`100`. Default keeps the first render at full range; a `notMerge: true` rebuild then re-renders at the current window. Stable role-based `id`s on grids/axes/series are harmless no-ops under full rebuild — keep them.

### Phase 3: Wiring & gating

- [x] **Task 7: Wire chunked loading into `SessionCharts`** (depends on Tasks 1-6)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`
  Remove the biometrics `useQuery`; keep the top-level `from`/`to` consts feeding the unchanged instructions `useQuery`. Call `const { biometrics, requestChunks, isLoading: isChunkLoading, totalChunks } = useBiometricChunks(session);`. Add `const zoomRef = useRef({ start: 0, end: 100 })`. Add `handleDataZoom = useCallback(..., [session.durationSeconds, requestChunks, totalChunks])` (deps exclude per-chunk state so identity stays stable): read `start = p.batch?.[0]?.start ?? p.start ?? 0` / `end = p.batch?.[0]?.end ?? p.end ?? 100`, update `zoomRef.current`, convert percent→seconds against `session.durationSeconds`, and `requestChunks` every index in `[floor(startSec/CHUNK_SEC), floor(endSec/CHUNK_SEC)]` clamped `< totalChunks`. Add `const events = useMemo(() => ({ datazoom: handleDataZoom }), [handleDataZoom])`. In the option memo, pass `biometrics` and `zoomRef.current` (read at rebuild time, not a memo dep — annotate `// eslint-disable-next-line react-hooks/refs`) into `buildSessionChartOption`. Render `<EChart option={option} style={{ height, width: '100%' }} notMerge onEvents={events} />`.

- [x] **Task 8: Loading / error / empty gating + per-session key** (depends on Task 7)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`, `src/pages/SessionsPage/index.tsx`
  Gate: `isLoading = instructionsLoading || (biometrics.length === 0 && isChunkLoading)`; `isError = instructionsError` only (chunk errors stay soft). Add a subtle header indicator (`text-sm text-gray-400 dark:text-gray-500`) shown only when `isChunkLoading && biometrics.length > 0` — it must not replace the initial `SkeletonLoader`. Empty-state guard: do not declare "No data" until all chunks have been attempted (drive the empty check off `gridCount === 0` after load completes, not raw array lengths) so a session whose chunk 0 has no biometrics/phases still renders the chart and lets `datazoom` load later chunks. In `index.tsx`, render `<SessionCharts key={selectedSession.id} session={selectedSession} />` so accumulated state, `zoomRef`, and the chart instance reset per session.

## Commit Plan
- **Commit 1** (after tasks 1-3): "Add chunked biometric loader hook"
- **Commit 2** (after tasks 4-6): "Add EChart onEvents, series sort, and zoom-preserving chart option"
- **Commit 3** (after tasks 7-8): "Wire zoom-driven chunk loading into session charts"
