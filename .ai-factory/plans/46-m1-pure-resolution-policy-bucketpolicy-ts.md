# Plan: (M1) Pure resolution policy — `bucketPolicy.ts`

## Context
Extract the zoom→resolution policy as a pure, React-free, unit-verifiable module that derives bucket size and raw/aggregated mode from a zoom span, and snaps request windows to bucket boundaries — the shared resolution primitive consumed by M2 (`computeBucketSec` for full span) and M3 (everything else).

## Settings
- Testing: no
- Logging: none
- Docs: no

## Notes for the implementer
- **Source to lift:** the clean prior implementation already exists in `git stash@{0}` at `src/pages/SessionsPage/bucketPolicy.ts`. Recover its content with `git show 'stash@{0}:src/pages/SessionsPage/bucketPolicy.ts'`. Do **not** `git stash pop` (the stash also carries superseded M2/M3 band-aid code — lift only this one file's content).
- **Spec:** `.ai-factory/notes/33-bucket-policy.md`.
- **Purity is the whole point:** no `import` of React, React Query, `apiFetch`, the `logger` facade, or any UI. Only named exports of pure functions and `const`s. No side effects, no I/O. The zoom model `((end - start) / 100) * durationSec` must match the existing `requestWindowChunks` math so both paths agree on what a zoom window means.
- **Architecture fit:** page-local feature module under `pages/SessionsPage/` (allowed by the Feature-Based Modules pattern); it imports nothing from `core/` or `components/`.
- **Constants are tunable starting points** (named exports) — to be re-tuned against the 389k-motion session once M2/M3 are live (open question in the spec, out of scope here).

## Tasks

### Phase 1: Module

- [x] **Task 1: Create `bucketPolicy.ts` with the resolution policy (lifted from stash)**
  Files: `src/pages/SessionsPage/bucketPolicy.ts`
  Recreate the module from `git show 'stash@{0}:src/pages/SessionsPage/bucketPolicy.ts'`. It must export, with the existing doc comments preserved:
  - Named constants: `TARGET_BUCKETS = 1200`, `BUCKET_LADDER = [1, 2, 5, 10, 15, 30, 60, 120, 300]`, `RAW_SPAN_LIMIT_ENTER = 90`, `RAW_SPAN_LIMIT_EXIT = 110`.
  - `computeSpanSec(zoom: { start: number; end: number }, durationSec: number): number` → `((zoom.end - zoom.start) / 100) * durationSec`.
  - `snapUp(value: number, ladder = BUCKET_LADDER): number` → smallest ladder entry `≥ value`; returns the last entry (300) when `value` exceeds the ladder; values `≤ 1` snap to `ladder[0]` (floor 1 s).
  - `computeBucketSec(spanSec: number): number` → `snapUp(spanSec / TARGET_BUCKETS)`.
  - `shouldUseRaw(spanSec: number, currentlyRaw: boolean): boolean` → hysteresis: `currentlyRaw ? spanSec <= RAW_SPAN_LIMIT_EXIT : spanSec <= RAW_SPAN_LIMIT_ENTER`.

- [x] **Task 2: Add `quantizeWindow` request-identity helper** (depends on Task 1)
  Files: `src/pages/SessionsPage/bucketPolicy.ts`
  Add the new pure helper that did not exist in the stash — it is the request-identity unit for M3's React-Query cache key, so small pans inside one quantized window collapse to a single cache entry:
  - `quantizeWindow(fromMs: number, toMs: number, bucketSec: number): [number, number]` → with `step = bucketSec * 1000`, return `[Math.floor(fromMs / step) * step, Math.ceil(toMs / step) * step]` (snap `from` down and `to` up to bucket boundaries).
  - Add a short doc comment stating it snaps a window to `bucketSec` boundaries and is the request-identity unit for M3's cache key.
  After both tasks, run `npm run typecheck` and `npm run lint` to confirm the module compiles clean and has no unused-export or lint violations.

## Verification
- `npm run typecheck` passes.
- `npm run lint` passes.
- The module imports nothing from React, React Query, `core/`, `components/`, or the `logger` facade (pure module).
