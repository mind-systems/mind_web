# W1 — Generalize the chunk loader into a variant-parameterized windowed loader

**Date:** 2026-06-22
**Source:** conversation context — fix progressive loading uniformly across chart variants

## Key Findings

- `useBiometricChunks` (`src/pages/SessionsPage/useBiometricChunks.ts`) already implements the hard part of progressive loading: a single-in-flight drain queue, `mergeSortedByTimestamp` accumulation (keeps samples globally time-sorted across out-of-order arrivals), `loadedRef`/`queuedSetRef` dedup, and a `fetchIdRef` stale-guard. But it hard-codes `CHUNK_SEC = 30` and the raw `?from&to` URL, so the aggregated variants cannot reuse it.
- To make progressive loading work **identically across all variants** (raw / min-max / smoothed), this proven machinery must be generalized so the window size and the per-window endpoint are injected per variant. This task is a pure refactor — no behavior change.

## Details

### Change
- Extract `useBiometricWindows(session, opts)` (new file `src/pages/SessionsPage/useBiometricWindows.ts`) from `useBiometricChunks`. `opts`:
  - `windowSec: number` — window size (raw uses 30; aggregate uses larger, set by W2).
  - `buildPath(fromMs: number, toMs: number): string` — per-variant URL builder:
    - raw → `/sessions/runs/${id}/biometrics?from=${iso(from)}&to=${iso(to)}`
    - aggregate → `…&bucketSec=${n}` (+ `&agg=avg|lttb` once the smoothed endpoint lands).
  - returns `{ samples, requestWindows(idxs), isLoading, totalWindows, attemptedCount, allAttempted }`.
- Keep verbatim from `useBiometricChunks`: the half-open boundary (`+1 ms` for `idx>0` so a sample on a window edge isn't returned by two windows), `mergeSortedByTimestamp`, single-in-flight drain, `fetchIdRef` invalidation on session switch/unmount, soft-error logging via the `logger` facade.
- Re-express `useBiometricChunks` as a thin wrapper: `useBiometricWindows(session, { windowSec: 30, buildPath: rawPath })`, preserving its current signature (`biometrics`, `requestChunks`, `totalChunks`, `allChunksAttempted`) so existing raw call sites in `SessionCharts.tsx` are unchanged.

### Guards / boundary
- **Pure refactor** — raw still loads identically, on demand, via the wrapper. No deriveView/loading change here (that is W2). No new endpoint here.
- Preserve the "do NOT use ECharts `appendData`" invariant (the comment in `useBiometricChunks.ts:143-148`): out-of-order windows would zigzag; `mergeSortedByTimestamp` is the reason it's safe.
- `buildPath` must be a stable reference per variant (memoize) so `requestWindows`/drain identity stays stable across renders (preserves the "no EChart re-bind per chunk" guarantee).

### Verify
- Raw path behaves exactly as before (lazy on zoom). Lint/typecheck green. `useBiometricChunks` is now a 3-line wrapper.

## Open Questions

- Whether to keep the `useBiometricChunks` wrapper name or migrate call sites to `useBiometricWindows` directly — wrapper is lower-risk; decide at implementation.
