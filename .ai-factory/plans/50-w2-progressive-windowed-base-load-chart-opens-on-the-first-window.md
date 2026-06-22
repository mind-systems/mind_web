# Plan: (W2) Progressive windowed base load — chart opens on the first window

## Context
Replace the single-request full-session aggregate base (`useBiometricOverview`) with a progressive windowed loader (W1's `useBiometricWindows`) that auto-enqueues all windows on mount, so the biometric chart opens on the FIRST resolved window and fills in progressively instead of holding a skeleton until the whole session loads.

## Prerequisite (cross-repo)
Seamless windowed tiling requires **mind_api Phase 49 (absolute bucket anchoring)** — the server must anchor buckets on an absolute epoch grid (multiples of `bucketSec` from epoch), NOT relative to each request's `from`. The floor-interior / ceil-last tiling in Task 2 is correct only under absolute anchoring; without it, adjacent windows produce misaligned or duplicate bucket timestamps and the windowed base no longer equals the old single-request base. This is not verifiable from `mind_web` alone — **confirm Phase 49 is deployed in the target API environment before merging W2.**

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Windowed aggregated base loader

- [x] **Task 1: Expose per-window failure tracking from `useBiometricWindows`**
  Files: `src/pages/SessionsPage/useBiometricWindows.ts`
  `deriveView` must distinguish `error` (all windows failed) from `empty` (all windows succeeded but the session has no data). The loader currently collapses both into `attemptedCount` and only logs failures (`.catch` at lines 161-166). Add a failure counter so callers can tell them apart:
  - Add `const [failedCount, setFailedCount] = useState(0);` and increment it inside the `.catch` block (the soft-error path) ONLY, guarded by the same `fetchIdRef.current !== myFetchId` stale check already used there.
  - **Do NOT increment `failedCount` in the degenerate-window skip path** (`useBiometricWindows.ts:141-147`): a degenerate window is not a failure, it has no data to fetch. Add a one-line code comment there noting this, so the asymmetry vs. `attemptedCount` is not later mistaken for a bug. Consequence (intentional, benign): a session where one window is degenerate-skipped and every other window fails yields `failedCount === totalWindows - 1`, so Task 3 classifies it `empty` ("No data") rather than `error` ("Failed"). Acceptable.
  - Reset `failedCount` to `0` in the session-switch/unmount reset effect (alongside `setAttemptedCount(0)`).
  - Add `failedCount: number` to the `UseBiometricWindowsResult` interface and return it.
  This is a purely additive change — `useBiometricChunks` (the raw wrapper from W1) keeps working unchanged; it destructures only the fields it uses and ignores the new one. Do NOT alter the `+1 ms` boundary, the sorted merge-accumulation, the single-in-flight drain, or the `fetchIdRef` stale guard.

- [x] **Task 2: Add `useBiometricWindowedBase(session)` — the aggregated base configured over `useBiometricWindows`**
  Files: `src/pages/SessionsPage/useBiometricWindowedBase.ts` (new), depends on Task 1
  New page-local hook that configures the generic W1 loader for the full-session aggregated base and auto-enqueues every window on mount. Follows the existing one-hook-per-concern pattern (`useBiometricOverview`, `useBiometricAggregate`, `useBiometricChunks`).
  - `bucketSec = computeBucketSec(session.durationSeconds)` (from `bucketPolicy.ts`) — same coarse resolution the single-request base used. Keep this exactly equal to `SessionCharts`' `baseBucketSec` (also `computeBucketSec(session.durationSeconds)`), which the overlay "no finer than base" guard depends on — do not change either call.
  - `windowSec`: a *handful* of windows over the session (fast first paint, not dozens of tiny requests). Target ~8 windows: `windowSec = max(round-up-to-multiple-of(bucketSec, ceil(durationSeconds / 8)), bucketSec)`. Snapping to a multiple of `bucketSec` (and flooring at `bucketSec`) keeps window edges on the bucket ladder so no window is narrower than one bucket.
  - **Seamless bucket tiling in `buildPath`** (this is the "aligned to bucket edges" requirement; pairs with mind_api Phase 49 absolute bucket anchoring — see Prerequisite): the generic loader hands `buildPath(fromMs, toMs)` raw, session-relative ranges that do NOT sit on the absolute bucket grid, and clamps the last window's `toMs` to `sessionEndMs`. Quantize inside `buildPath` so adjacent windows tile with no overlapping or split bucket:
    - `step = bucketSec * 1000`
    - `qFrom = Math.floor(fromMs / step) * step`
    - `qTo = toMs >= sessionEndMs ? Math.ceil(toMs / step) * step : Math.floor(toMs / step) * step` — floor interior boundaries so window *i*'s `qTo` equals window *i+1*'s `qFrom` (contiguous, non-overlapping under the server's half-open `[from, to)` semantics); ceil only the final window so the session's last partial bucket is not dropped.
    - Note: do NOT use `quantizeWindow` verbatim here — its floor-from / **ceil-to** on every window makes adjacent windows share one bucket when the raw boundary is off-grid, producing duplicate same-timestamp samples after `mergeSortedByTimestamp`. The floor-interior / ceil-last rule above is the correct tiling. `sessionEndMs = new Date(session.endedAt).getTime()`.
    - Tiling is exact in general (the W1 `+1 ms` lower bound for windows `i > 0` is floored away, so `qFrom_{i+1} === qTo_i`), with one negligible deterministic edge: when `sessionStartMs ≡ step - 1 (mod step)`, the `+1 ms` advances `floor` by one bucket and leaves a single-bucket gap at that one boundary (probability ~`1/step`, `step ≥ 1000`; impact = one missing coarse bucket). No mitigation required — just do not claim unconditional exact tiling.
    - URL shape mirrors `useBiometricOverview` / `useBiometricAggregate`: `/sessions/runs/${session.id}/biometrics?from=${enc(ISO(qFrom))}&to=${enc(ISO(qTo))}&bucketSec=${bucketSec}`. Build it with `encodeURIComponent(new Date(qFrom).toISOString())`.
  - **Memoize `buildPath` with `useCallback`** keyed on `[session.id, bucketSec, sessionEndMs]` — W1 requires a stable `buildPath` identity so `requestWindows` and the drain effect stay stable (preserves the "no EChart re-bind per window" guarantee).
  - Call `const loader = useBiometricWindows(session, { windowSec, buildPath });`.
  - **Auto-enqueue ALL windows on mount / session switch:** declare an effect AFTER the `useBiometricWindows` call so it runs after that hook's internal reset effect (effects fire in declaration order; the reset clears the queue first, then this enqueues). **Key the effect on `session.id` (NOT on `loader.requestWindows`)** — `requestWindows` is `useCallback(..., [totalWindows])` and `totalWindows` is ~always 8 by construction, so keying on its identity would make the effect skip re-running on a session switch (same 8 → 8), leaving the new session stuck on the skeleton forever. Use:
    ```js
    useEffect(() => {
      loader.requestWindows(Array.from({ length: loader.totalWindows }, (_, i) => i));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session.id, loader.totalWindows]);
    ```
    `requestWindows` is internally deduped, so re-firing on the switch never double-enqueues. (Do not justify this with "re-keyed on totalWindows" — that reasoning is wrong; session identity is the correct key.)
  - Return the loader surface the page needs: `{ samples, isLoading, attemptedCount, allAttempted, failedCount, totalWindows }`.

### Phase 2: Progressive view-state

- [x] **Task 3: Rework `deriveView` to key off loader progress instead of a single RQ query**
  Files: `src/pages/SessionsPage/deriveView.ts`, depends on Task 2
  Replace the `OverviewQueryLike` (single-request) input with a loader-progress input. New signature:
  `deriveView(base: BaseProgressLike, instructionsQuery: InstructionsQueryLike, gridCount: number): ViewState`
  where `BaseProgressLike = { samples: BioSampleDto[]; allAttempted: boolean; failedCount: number; totalWindows: number }`.
  State machine — **exact order, with an explicit exhaustive final return** (open the chart on the FIRST window, never wait for all):
  1. **loading** — `instructionsQuery.isPending` OR (`base.samples.length === 0 && !base.allAttempted`). The skeleton holds only until the first window with data resolves (or until everything has been attempted). This extends note 37's "no window resolved yet" transition to also cover the gap where an early window resolved empty while later windows are still pending — it keeps the skeleton rather than briefly flashing an empty chart. Document this refinement in the doc comment.
  2. **error** — `base.allAttempted && base.samples.length === 0 && base.failedCount === base.totalWindows`. Every window failed and nothing loaded — kept distinct from empty. (Checked before the grid/empty paths.)
  3. **ready (samples)** — `base.samples.length > 0` → `{ kind: 'ready', samples: base.samples }`. As soon as any samples exist the chart renders; later windows merge in via the note-30 structure-signature rebuild already in `SessionCharts`.
  4. **ready (grids-without-samples)** — `base.allAttempted && gridCount > 0` → `{ kind: 'ready', samples: base.samples }`. **Restores the existing render path** for a session with a non-empty grid set but zero biometric samples — e.g. a breath session recorded without a BCI: `breath_phase` instructions create the `hasPhases` grid while `cardio`/`nfb`/`emotions` data is absent. This must still show its phase timeline (behavior hardened in Phases 6–7, `notes/10`/`notes/12`); gating `ready` on `samples.length > 0` alone would regress it to "No data".
  5. **empty** — explicit terminal default `return { kind: 'empty', samples: [] }`. Reached only when settled with no error, no samples, and no grids (`allAttempted && gridCount === 0`). No input may fall through to `undefined`.
  Keep the soft-instructions-error contract: instructions failure is NOT surfaced as `error` here; the caller logs it and renders biometrics without the timeline. Keep the module React-free and side-effect-free. Update the doc comment to describe the progressive (loader-progress) state machine and drop the stale "base is always the full-session result, never sub-windowed" wording — it is now sub-windowed but still represents the full session once `allAttempted`.

### Phase 3: Wire the windowed base into the chart

- [x] **Task 4: Switch `SessionCharts` from `useBiometricOverview` to the windowed base**
  Files: `src/pages/SessionsPage/SessionCharts.tsx`, depends on Task 3
  - Replace `const overviewQuery = useBiometricOverview(session);` (line ~55) with `const baseLoader = useBiometricWindowedBase(session);` and update the import.
  - `base` becomes `baseLoader.samples` (was `overviewQuery.data ?? []` at line 174). The `detail ?? base` overlay logic (raw chunks / agg overlay on zoom) and `samples = detail ?? base` are UNCHANGED — the windowed base just streams into the same slot.
  - Leave `baseBucketSec = computeBucketSec(durationSec)` (line 77) untouched — it must stay equal to the windowed base's `bucketSec` so the overlay "no finer than base" guard (line ~138) behaves identically.
  - Update the `deriveView` call (line 212) to the new signature: pass `{ samples: baseLoader.samples, allAttempted: baseLoader.allAttempted, failedCount: baseLoader.failedCount, totalWindows: baseLoader.totalWindows }`, `instructionsQuery`, `gridCount`.
  - Update the header "Loading…" hint (line ~242): replace `overviewQuery.isFetching` with `baseLoader.isLoading` (keep `aggQuery.isFetching || chunksLoading`). The hint now tracks the windowed base draining.
  - Remove the now-unused `useBiometricOverview` import and the obsolete M2 "single full-session request" comment block (lines ~53-54).
  - Leave the `zoomRef`, structure-signature `notMerge` rebuild, overlay state, and datazoom handler untouched — progressive base fill flows through the existing note-30 incremental rebuild.

- [x] **Task 5: Delete the obsolete single-request base hook**
  Files: `src/pages/SessionsPage/useBiometricOverview.ts` (delete), depends on Task 4
  After Task 4, `SessionCharts` is its only consumer. Delete `useBiometricOverview.ts`. Confirm no remaining imports reference it (grep `useBiometricOverview` across `src/`). Run `npm run typecheck` and `npm run lint` to confirm the removal is clean.

## Commit Plan
- **Commit 1** (after tasks 1-2): "Add progressive windowed aggregated base loader"
- **Commit 2** (after tasks 3-5): "Open biometric chart on first window via progressive base"
