# Sorted biometric accumulation — drop the per-rebuild re-sort

**Date:** 2026-06-21
**Source:** conversation context (perf triage; API-owner flag on appendData)

## Key Findings

- `toSeries` (`src/pages/SessionsPage/transforms.ts:45-54`) sorts the projected `[sec, value]` pairs on **every** rebuild. `buildSessionChartOption` re-runs on each chunk arrival (the `useMemo` in `SessionCharts.tsx:95-108` is keyed on `biometrics` identity), so the whole accumulated array is re-sorted `O(N log N)` every 30 s of incoming data — a real per-chunk CPU cost that grows with session length.
- `useBiometricChunks` appends incoming chunks as `[...prev, ...data]` (`useBiometricChunks.ts:113`) with no ordering, and chunks arrive **out of order** under zoom-driven loading.

## Details

### Change
- Keep `biometrics` globally **time-sorted** in the hook: sort each incoming chunk by `timestamp` (bounded — ~`CHUNK_SEC` of samples) then merge-insert into the accumulated array at its position. Windows are contiguous and non-overlapping, so a single boundary splice works; a general merge is equally fine.
- Then **drop the `.sort()`** in `toSeries` (`transforms.ts:53`): per-field filtered projections of a globally time-sorted source are themselves sorted. Update the `toSeries` doc comment that currently justifies the sort.

### Guard / API-owner flag #2
- This sorted-accumulation guarantee is the **prerequisite** for any incremental chart update (note 30). Do **NOT** use naive ECharts `appendData`: it appends to the series tail without sorting, so out-of-order chunk arrival produces an X-axis zigzag. Merge-insert (this task) sidesteps that entirely.
- Preserve the `fetchIdRef` stale-guard and the `loadedRef`/`inFlightRef`/`queuedSetRef` dedup refs unchanged.

### Verify
- Jump-zoom to force a later chunk to load before an earlier one; with the `toSeries` sort removed, lines render monotonic in X (no backward "tie-back" strokes).

## Open Questions

- None.
