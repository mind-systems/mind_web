# Code Review: Chunked biometric loading with zoom-driven trigger

**Scope:** `mind_web` — replace the single full-session biometrics fetch (413) with 30 s `datazoom`-driven chunked loading, full chart rebuild (`notMerge: true`).
**Files reviewed (in full):** `src/pages/SessionsPage/useBiometricChunks.ts` (new), `src/pages/SessionsPage/SessionCharts.tsx`, `src/components/EChart/index.tsx`, `src/pages/SessionsPage/chartOption.ts`, `src/pages/SessionsPage/transforms.ts`, `src/pages/SessionsPage/index.tsx`.

**Build status:** `npm run typecheck` (tsc) passes clean. `npm run lint` cannot run in this environment (ESLint 10.4.1 + this Node crash on `util.styleText` in the stylish formatter — pre-existing, unrelated to this change). Running ESLint directly on the changed files surfaces the findings below.

---

## Findings

### 1. [Medium] Empty-state gate diverges from the spec — a session can be permanently trapped on "No data" with later chunks never loading

`SessionCharts.tsx`:

```ts
const isLoading = instructionsLoading || (biometrics.length === 0 && isChunkLoading);
const isError = instructionsError;
const isEmpty = !isLoading && !isError && gridCount === 0;
```

The spec (`.ai-factory/notes/17-chunked-bio-loading.md`, line 83) and Task 8 explicitly require **not** declaring "No data" until **all chunks have been attempted** (`loadedRef` covers `totalChunks`). The implementation gates `isEmpty` on `gridCount === 0` alone, with no "all attempted" condition.

Failure path — a session with **no breath-phase instructions** (so no instruction grid) whose biometric stream **starts after the first 30 s** (e.g. a BCI/sensor that locks after warm-up — the exact case the note's Verify step 5 calls out):

1. Mount enqueues only chunk 0. Chunk 0 returns `[]`.
2. `isChunkLoading` flips `false` (queue drained), `biometrics.length === 0`, no phases → `gridCount === 0`.
3. `isLoading === false`, `isError === false` → `isEmpty === true`.
4. The `<EChart>` branch never renders → no `datazoom` ever fires → chunks 1..N are never requested. The chart is stuck on "No data for this session" even though data exists later in the session.

This is precisely the trap the spec added the guard to prevent. The dominant breath-session case is unaffected (breath_phase instructions always produce an instruction grid, so `gridCount >= 1` and the chart renders), which is why this is Medium rather than High — but meditation/non-breath sessions with a late-locking device are reachable in production.

Compounding the gap: the hook does **not expose** any "all attempted" signal (`loadedRef` is intentionally private and `loadedChunks` was dropped), so `SessionCharts` currently has no way to implement the spec's condition. Fix requires exposing one, e.g. derive `allChunksAttempted` (or `pendingChunks`/`loadedCount`) from `loadedRef.current.size >= totalChunks` and gate `isEmpty` on `... && gridCount === 0 && allChunksAttempted`. Because `loadedRef` is a ref (no re-render on `.add`), the signal must be lifted into state or recomputed off an existing state change (e.g. set a `attemptedCount` state in the drain's `finally`/skip paths) so the empty-state re-evaluates when the last chunk completes.

### 2. [Low] New hook fails ESLint (`react-hooks/set-state-in-effect`, error severity ×2)

`useBiometricChunks.ts` trips the project's react-hooks rules:

- `react-hooks/set-state-in-effect` (severity **error**) at line 77 (`setIsLoading(true)` in the drain effect) and line 130 (`setBiometrics([])` in the reset effect).
- `react-hooks/exhaustive-deps` (severity warning) at line 141 — `fetchIdRef.current` read in the effect cleanup.

`eslint .` would exit non-zero on these (a CI gate concern once the formatter crash above is resolved / on CI's Node). The synchronous `setState` in the drain effect is an intentional, correct part of the queue-drain design (the top-of-effect `if (isLoading || queue.length === 0) return;` guard plus `inFlightRef` make the cascading-render concern moot here), and the reset effect's resets are likewise deliberate. The right resolution is a scoped, commented `// eslint-disable-next-line react-hooks/set-state-in-effect` on the intentional lines (and similar for the cleanup-ref warning), rather than leaving the rule failing. Confirm whether CI runs `eslint` before merge.

### 3. [Low] Brief "No data" flash on revisiting a previously-viewed session

Same root cause as Finding 1, milder. `index.tsx` uses `key={selectedSession.id}`, so revisiting a session **remounts** `SessionCharts`, but React Query keeps `['session-instructions', id]` cached — so `instructionsData` can resolve synchronously on the first render while `useBiometricChunks` state is still at its initial `biometrics: []`, `isLoading: false` (the reset/drain effects run after paint). For a session with no phases, that first commit computes `isLoading === false` and `gridCount === 0` → a one-frame "No data" flash before chunk 0 starts. Fixing Finding 1 (gating empty on all-attempted) also removes this flash. Sessions with phases are unaffected.

### 4. [Nit] Stale plan/comment reference to "incremental merge"

A few comments still describe the kept `id`s as preserving zoom "across incremental merges" (`chartOption.ts` builder docblock: "preserves the current zoom window across incremental merges") and `zoomRef`'s comment ("so each incremental merge re-applies it"). The design deliberately uses `notMerge: true` (full rebuild), not incremental merge — the wording is a leftover from the abandoned approach and could mislead a future maintainer into thinking merge is in play. Reword to "across each full rebuild". Cosmetic only.

---

## Verified correct (no action needed)

- **`notMerge: true` rebuild + zoom threading.** `chartOption.ts` applies `zoom.start/end` to both `dataZoom` entries; `SessionCharts` reads `zoomRef.current` at rebuild time (not a memo dep) and persists the window in `handleDataZoom`. ECharts emits `datazoom` from user interaction (not from `setOption`), so the view is already at the new window during interaction, and the next chunk-driven rebuild re-applies it — zoom is preserved without an extra render loop. Correct.
- **`onEvents` isolation.** The handler binding lives in a separate effect keyed `[onEvents, isDark]` with off-before-on, never in the init/dispose effect — so it re-binds after a theme-driven canvas recreate and never tears down the canvas on handler changes. `events` is memoized and `handleDataZoom`'s deps exclude per-chunk state, so the binding effect does not re-run as chunks arrive. Correct and matches Task 4.
- **Concurrency / dedup.** Single in-flight via `inFlightRef` + the `isLoading` gate; `requestChunks` dedups against `loadedRef`/`inFlightRef`/`queuedSetRef` and is stable (keyed on `totalChunks` only); `fetchIdRef` correctly discards stale responses, and the reset effect's cleanup bumps it to invalidate in-flight fetches on switch/unmount. The `key={session.id}` remount plus the `session.id` reset effect give redundant-but-safe isolation. No retry-storm (errors mark `loadedRef`), no obvious race.
- **Index math.** `lastChunk` is clamped to `totalChunks - 1`; `firstChunk` can momentarily equal `totalChunks` at 100% zoom but the loop then doesn't execute, and `requestChunks` independently clamps `i < totalChunks`. No out-of-range request.
- **Half-open window + degenerate guard.** `+1 ms` for `idx > 0` prevents a boundary sample being returned by two adjacent chunks; the `fromMs >= toMs` guard (covers `fromMs >= sessionEndMs`) marks the chunk attempted and skips the inverted request when `durationSeconds` overstates `endedAt − startedAt`. Both bounds `encodeURIComponent`-encoded. Matches Task 2/3.
- **`toSeries` sort.** `.sort((a, b) => a[0] - b[0])` correctly prevents "tie-back" strokes from out-of-order chunk arrival; `parsePhases` left untouched (instructions load once, in order).
- **EChart null-guard.** The added `if (!chartRef.current) return;` before `setOption` is a safe tightening over the prior optional-chaining call.
- **No security regression.** `session.id` is interpolated into the URL path unencoded, identical to the existing (unchanged) instructions query; from/to are encoded. No new `localStorage`/`fetch` access — all HTTP still flows through `apiFetch`. Architecture boundaries respected.

---

## Recommendation

Address **Finding 1** before shipping — it reintroduces the specific bug the spec's empty-state guard was written to prevent, and the hook needs a small API addition (an "all attempted" signal) to fix it properly. Findings 2–4 are low/cosmetic and can ride along. The core chunking, concurrency, and rendering logic is otherwise solid and matches the plan.
