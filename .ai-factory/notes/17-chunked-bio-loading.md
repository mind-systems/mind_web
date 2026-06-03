# Chunked Biometric Loading with Zoom-Driven Trigger

**Date:** 2026-06-03
**Source:** conversation context

## Key Findings

- Current single-fetch `GET /sessions/runs/:id/biometrics?from=startedAt&to=endedAt` returns 413 for real sessions (motion alone is ~250 samples/sec).
- API is ready as-is: the `from`/`to` filter already works; 30s of motion ≈ 7 500 samples — well within FLAT_CAP (50 000).
- Load data in 30-second chunks sequentially (one in-flight request at a time); trigger the next chunk from ECharts `datazoom` events.
- Within one chunk all sampleTypes come back together (single API call), so no per-type parallelism is needed.

## Details

### Chunk math

```typescript
const CHUNK_SEC = 30;
const totalChunks = Math.ceil(session.durationSeconds / CHUNK_SEC);

function chunkFromTo(idx: number, sessionStartMs: number, sessionEndMs: number) {
  const from = new Date(sessionStartMs + idx * CHUNK_SEC * 1000).toISOString();
  const to   = new Date(Math.min(sessionStartMs + (idx + 1) * CHUNK_SEC * 1000, sessionEndMs)).toISOString();
  return { from, to };
}
```

### New hook: `src/pages/SessionsPage/useBiometricChunks.ts`

```typescript
export function useBiometricChunks(session: SessionRun): {
  biometrics: BioSampleDto[];
  requestChunks: (idxs: number[]) => void;
  loadedChunks: Set<number>;
  isLoading: boolean;
}
```

Internal state:
- `biometrics: BioSampleDto[]` — accumulated, grows as chunks arrive (append-only; chunks load in order so no sort needed)
- `loadedChunks: Set<number>` — indices already fetched (skip re-fetch)
- `queue: number[]` — indices waiting to load
- `isLoading: boolean` — one in-flight request at a time

Effect: whenever `queue` is non-empty and `!isLoading`, pop the first index, call `apiFetch`, append results to `biometrics`, mark chunk as loaded, repeat.

On mount call `requestChunks([0])` to load the first chunk immediately.

### EChart: add `onEvents` prop

`src/components/EChart/index.tsx` — add optional prop:
```typescript
onEvents?: Record<string, (params: unknown) => void>;
```

In the init `useEffect`, after `echarts.init()`:
```typescript
if (onEvents) {
  for (const [event, handler] of Object.entries(onEvents)) {
    chart.on(event, handler);
  }
}
```

Include `onEvents` in the effect dependency array (object ref is stable when defined inline with `useMemo` or `useCallback` in the caller).

### SessionCharts.tsx wiring

Replace the single biometrics `useQuery` with `useBiometricChunks`. Pass `onEvents` to `<EChart>`:

```typescript
const { biometrics, requestChunks, loadedChunks } = useBiometricChunks(session);

const handleDataZoom = useCallback((params: unknown) => {
  const p = params as { start?: number; end?: number; batch?: { start: number; end: number }[] };
  const start = p.batch?.[0].start ?? p.start ?? 0;
  const end   = p.batch?.[0].end   ?? p.end   ?? 100;
  const durationSec = session.durationSeconds;
  const startSec = (start / 100) * durationSec;
  const endSec   = (end   / 100) * durationSec;
  const needed: number[] = [];
  for (let i = Math.floor(startSec / CHUNK_SEC); i <= Math.floor(endSec / CHUNK_SEC); i++) {
    if (i < totalChunks && !loadedChunks.has(i)) needed.push(i);
  }
  if (needed.length) requestChunks(needed);
}, [session.durationSeconds, loadedChunks, requestChunks, totalChunks]);

const events = useMemo(() => ({ datazoom: handleDataZoom }), [handleDataZoom]);

// ...
<EChart option={option} style={{ height, width: '100%' }} notMerge={false} onEvents={events} />
```

Switch `notMerge` from `true` to `false` (or remove it) so ECharts merges new series data incrementally instead of wiping and redrawing from scratch on every chunk append.

### isLoading / isError in SessionCharts

- `isLoading`: true while `instructionsLoading || (biometrics.length === 0 && isChunkLoading)`
- `isError`: `instructionsError` only (chunk errors are soft — log and skip the chunk rather than blocking the whole panel)

### Loading indicator

While additional chunks are loading (after the first chunk), show a subtle progress bar or spinner in the chart header (`isChunkLoading && biometrics.length > 0`). Does not replace the skeleton — only appears after initial data is shown.

### Verify

1. Open a session → first 30 s of all sampleTypes appear immediately, no 413.
2. Zoom/scroll past the 30 s mark → network tab shows a second request with updated `from`/`to`; data appears.
3. Scrolling back to an already-loaded chunk fires no request.
4. A 6-minute session completes with no 413 across all chunks.
