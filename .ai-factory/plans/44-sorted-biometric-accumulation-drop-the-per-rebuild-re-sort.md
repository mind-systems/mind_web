# Plan: Sorted biometric accumulation — drop the per-rebuild re-sort

## Context
Keep the accumulated `biometrics` array globally time-sorted by merge-inserting each incoming (sorted) chunk in `useBiometricChunks`, then remove the now-redundant `.sort()` from `toSeries`, eliminating the `O(N log N)` re-sort that runs on every chunk arrival.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Sorted accumulation

- [x] **Task 1: Merge-insert each incoming chunk in time order**
  Files: `src/pages/SessionsPage/useBiometricChunks.ts`
  Replace the unordered append at line 113 (`setBiometrics((prev) => [...prev, ...data])`) with a merge that keeps `biometrics` globally sorted ascending by `timestamp`.
  - Add a module-level pure helper (above the hook), e.g. `mergeSortedByTimestamp(prev: BioSampleDto[], incoming: BioSampleDto[]): BioSampleDto[]`:
    - Compute a sort key per sample via `new Date(s.timestamp).getTime()` (note `BioSampleDto.timestamp` is an ISO **string**, see `src/core/types/index.ts:48-52`).
    - First sort the `incoming` chunk by timestamp (it is bounded to ~`CHUNK_SEC` of samples, so this is cheap and independent of total session length).
    - Then merge the two already-sorted arrays into a new array in a single linear pass (standard two-pointer merge). Windows are contiguous and non-overlapping, so a boundary splice is sufficient, but a general two-pointer merge is equally correct and simpler to reason about — use the general merge.
    - Return a new array (do not mutate `prev`) so React state identity changes and the `SessionCharts` memo keyed on `biometrics` rebuilds.
  - Call it inside the existing `.then((data) => { ... })` callback: `setBiometrics((prev) => mergeSortedByTimestamp(prev, data))`. Keep this call inside the `fetchIdRef.current !== myFetchId` stale-guard exactly as now.
  - Do **not** change `fetchIdRef`, `loadedRef`, `inFlightRef`, or `queuedSetRef` — all dedup/stale-guard refs stay byte-for-byte unchanged.
  - Update the hook's behavior so the sorted guarantee holds even when chunks arrive out of order under zoom-driven loading.

- [x] **Task 2: Drop the redundant sort in `toSeries`** (depends on Task 1)
  Files: `src/pages/SessionsPage/transforms.ts`
  Remove the trailing `.sort((a, b) => a[0] - b[0])` at line 53 in `toSeries`. A per-field filtered projection of a globally time-sorted source array is itself time-sorted, so the sort is now redundant.
  - Update the `toSeries` doc comment (lines 41-44) that currently justifies the sort: replace the "Sorting is required because chunks may arrive out of order..." paragraph with a note that the input `samples` are already globally time-sorted (the accumulated `biometrics` is kept sorted in `useBiometricChunks` via merge-insert), so this function only projects/filters and preserves order.
  - Leave `secFromStart` and `parsePhases` untouched.

### Phase 2: Guard rail note

- [x] **Task 3: Document the incremental-update prerequisite** (depends on Task 1)
  Files: `src/pages/SessionsPage/useBiometricChunks.ts`
  Add a short comment near the new merge call stating that this sorted-accumulation guarantee is the prerequisite for any future incremental chart update, and that naive ECharts `appendData` must NOT be used: it tail-appends without sorting, so out-of-order chunk arrival would produce an X-axis zigzag. Merge-insert sidesteps that. (No code change beyond the comment — this is the API-owner flag #2 guard.)

## Notes
- Verification (manual, by implementer): jump-zoom to force a later chunk to load before an earlier one; with the `toSeries` sort removed, lines must render monotonic in X (no backward "tie-back" strokes).
- Single commit (fewer than 5 tasks): "Keep accumulated biometrics time-sorted and drop the per-rebuild re-sort".
