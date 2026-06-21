# M1 — Pure resolution policy (`bucketPolicy.ts`)

**Date:** 2026-06-21
**Source:** conversation context — Phase 20 decomposition (governing design: note 32)

## Key Findings

- The zoom→resolution policy is the one part of the slug-46 attempt that reviewed clean — pure, React-free, isolatable. Ship it first as its own unit-verifiable module; M2/M3 consume it.
- Prior implementation is in `git stash@{0}` (`src/pages/SessionsPage/bucketPolicy.ts`) and can be lifted almost as-is, plus the `quantizeWindow` helper M3's cache key needs.

## Details

`src/pages/SessionsPage/bucketPolicy.ts` (new) — pure, no React, no `fetch`, no UI. Exports:
- Constants (named, tunable): `TARGET_BUCKETS = 1200`, `BUCKET_LADDER = [1, 2, 5, 10, 15, 30, 60, 120, 300]`, `RAW_SPAN_LIMIT_ENTER = 90`, `RAW_SPAN_LIMIT_EXIT = 110`.
- `computeSpanSec(zoom: { start: number; end: number }, durationSec: number): number` → `((end - start) / 100) * durationSec` (same percentage→seconds math as the existing `requestWindowChunks`, so both paths share one zoom model).
- `snapUp(value: number, ladder = BUCKET_LADDER): number` → smallest ladder entry `≥ value`; floor at `ladder[0]` (1 s), cap at the last entry (300 s).
- `computeBucketSec(spanSec: number): number` → `snapUp(spanSec / TARGET_BUCKETS)`. Snapping keeps `bucketSec` constant across small zoom moves (no refetch per pixel; cache-friendly).
- `shouldUseRaw(spanSec: number, currentlyRaw: boolean): boolean` → hysteresis: when `currentlyRaw` return `spanSec <= RAW_SPAN_LIMIT_EXIT`, else `spanSec <= RAW_SPAN_LIMIT_ENTER`.
- `quantizeWindow(fromMs: number, toMs: number, bucketSec: number): [number, number]` → snap a window to `bucketSec` boundaries (`floor(from/step)*step`, `ceil(to/step)*step`, `step = bucketSec*1000`). This is the **request-identity unit** for M3's React-Query key, so small pans within one quantized window collapse to one cache entry.

Consumers: M2 uses `computeBucketSec(session.durationSeconds)` for the full-span overview; M3 uses everything else.

## Open Questions

- Constants are starting points — tune against the 389k-motion session once M2/M3 are live.
