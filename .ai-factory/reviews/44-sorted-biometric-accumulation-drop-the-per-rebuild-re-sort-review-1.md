# Code Review: Sorted biometric accumulation — drop the per-rebuild re-sort

**Plan:** `44-sorted-biometric-accumulation-drop-the-per-rebuild-re-sort.md`
**Files changed (code):** `src/pages/SessionsPage/useBiometricChunks.ts`, `src/pages/SessionsPage/transforms.ts`
**Risk:** 🟢 Low

## Scope
Two code files changed (the rest of the diff is plan/metadata). Reviewed both in full plus the downstream consumers (`chartOption.ts`, `SessionCharts.tsx`) and the `BioSampleDto` type.

## Build & static checks
- `npm run typecheck` — clean.
- `npm run lint` — clean.

## Correctness analysis

### Sort invariant (inductive) — holds
- The session-switch/reset effect sets `biometrics = []` (trivially sorted).
- `mergeSortedByTimestamp` sorts `incoming` first, then two-pointer-merges it into the already-sorted `prev`, producing a sorted result. By induction every accumulated state stays globally time-sorted. There is no other writer to `biometrics`. ✅

### Merge implementation — correct
- `[...incoming].sort(...)` does not mutate the input array; the merge builds a fresh `result` array and never mutates `prev`. Returning a new reference is required so the `useMemo` in `SessionCharts.tsx:95-108` (keyed on `biometrics` identity) recomputes — satisfied. ✅
- Two-pointer loop with `<=` is a standard stable merge; both tails are drained. No off-by-one. ✅
- Equal timestamps (multiple sampleTypes share a tick) are handled — relative order among equal keys is irrelevant because `toSeries` filters to one field before plotting. ✅

### Downstream chain — dropping `toSeries` sort is safe
- `chartOption.ts:103-111` partitions `biometrics` with `for...of` + `bucket.push(s)`, which preserves global order within each `sampleType` bucket.
- `toSeries` now only `.filter().map()`s — both order-preserving. A filtered projection of a globally time-sorted source is itself time-sorted, so the removed `.sort()` was redundant. `toSeries` has no other callers. ✅

### Stale-guard / dedup refs — preserved
- The merge call sits inside the `fetchIdRef.current !== myFetchId` guard exactly as before; `loadedRef.current.add(idx)` still follows it in `.then`. `inFlightRef`, `queuedSetRef`, and the reset effect are untouched. Serialized in-flight fetches (one at a time via `isLoading`/`inFlightRef`) plus the functional updater mean concurrent batching cannot corrupt the invariant. ✅
- Half-open `+1 ms` chunk windows (`useBiometricChunks.ts:87-92`) keep samples from arriving in two adjacent chunks, so the merge never introduces duplicates. ✅

### Guard-rail note (Task 3) — present
- The in-code comment forbidding ECharts `appendData` (API-owner flag #2) is added at the merge call site as specified. ✅

## Non-blocking observations (optional, no action required)
- **Repeated `Date` parsing in the merge.** Comparisons call `new Date(s.timestamp).getTime()` on each step rather than precomputing keys (O(N) parses per chunk). This is still strictly cheaper than the prior per-memo re-sorts across ~20 series, so it's a net win; decorating each side with a precomputed key would be pure polish.
- **Helper placement.** `mergeSortedByTimestamp` lives in `useBiometricChunks.ts` rather than `transforms.ts` where the other pure transforms sit. It is tightly coupled to accumulation, so the hook file is a defensible home — soft style preference only.

## Conclusion
The implementation faithfully matches the plan and spec note 29, the sort invariant is sound, the downstream consumers preserve order, and typecheck/lint are clean. No bugs, security issues, or correctness problems found.

REVIEW_PASS
