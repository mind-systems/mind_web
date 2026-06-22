# Plan Review 2: (W2) Progressive windowed base load — chart opens on the first window

**Plan:** `50-w2-progressive-windowed-base-load-chart-opens-on-the-first-window.md`
**Files Reviewed:** 7 (`useBiometricWindows.ts`, `useBiometricChunks.ts`, `useBiometricAggregate.ts`, `useBiometricOverview.ts`, `deriveView.ts`, `SessionCharts.tsx`, `bucketPolicy.ts`)
**Risk Level:** 🟢 Low

This is the second iteration. Every Critical / Medium / Low item raised in plan-review-1 has been folded into the plan text correctly. The remaining notes below are non-blocking observations only.

---

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** PASS. All new/changed files stay inside `pages/SessionsPage/` (page-local feature hooks owning their own fetching), HTTP routes through `apiFetch`, no `localStorage`/`sessionStorage` access, no `useQuery` pushed into shared components. The new `useBiometricWindowedBase` follows the established one-hook-per-concern pattern (`useBiometricOverview`/`useBiometricAggregate`/`useBiometricChunks`). Aligned with Feature-Based Modules.
- **Rules (`.ai-factory/rules/base.md` + CLAUDE.md):** PASS. English-only, `apiFetch`-only HTTP (no raw `fetch`), `logger` facade preserved (Task 1 keeps the existing `logger.error`), `mind_auth_token` untouched. No proto files involved.
- **Roadmap (`ROADMAP.md`):** WARN (non-blocking, unchanged from review-1). The reviewed ROADMAP does not contain an explicit W1/W2/M-series or Phase 49 entry, so milestone linkage is not reflected in the file. The W1→W2 lineage is real in the codebase (`useBiometricWindows` exists and is consumed by `useBiometricChunks`), so the sequencing is sound; the roadmap just doesn't track it.

---

## Resolution of plan-review-1 findings

- **C1 (auto-enqueue never re-fires on session switch) — RESOLVED.** Task 2 now keys the effect on `[session.id, loader.totalWindows]`, supplies the `eslint-disable` line, and explicitly retracts the wrong "re-keyed on totalWindows" justification ("session identity is the correct key"). I re-derived `totalWindows` for 30 s / 3600 s / 36000 s sessions — the `~8 windows` formula yields `totalWindows === 8` in every case, confirming that keying on `totalWindows` alone would never re-fire. The `session.id` key is the correct fix and declaration-order (reset-then-enqueue) still holds.
- **M1 (grids-without-samples ready path) — RESOLVED.** Task 3 step 4 restores `base.allAttempted && gridCount > 0 → ready`, with the breath-without-BCI rationale and `notes/10`/`notes/12` linkage spelled out.
- **M2 (Phase 49 absolute bucket anchoring) — RESOLVED.** Promoted to a dedicated `## Prerequisite (cross-repo)` block with an explicit "confirm Phase 49 is deployed before merging" instruction.
- **L1 (degenerate-skip must not count as failure) — RESOLVED.** Task 1 scopes the increment to the `.catch` path only, requires a code comment at the degenerate-skip path, and documents the benign `failedCount === totalWindows - 1` consequence.
- **L2 (off-grid `+1 ms` tiling edge) — RESOLVED.** Task 2 documents the `sessionStartMs ≡ step - 1 (mod step)` single-bucket-gap edge and instructs the implementer not to claim unconditional exact tiling.
- **m3 (deriveView ordering + exhaustive default) — RESOLVED.** Task 3 now specifies exact order, checks `error` before grid/empty, and mandates an explicit terminal `return { kind: 'empty', samples: [] }`.
- **m4 (baseBucketSec invariant) — RESOLVED.** Tasks 2 and 4 both pin `bucketSec`/`baseBucketSec` to `computeBucketSec(session.durationSeconds)` and forbid changing either, preserving the overlay "no finer than base" guard.

---

## Verification against the codebase

- **Task 1** matches `useBiometricWindows.ts`: the `.catch` soft-error path (lines 161-166), the degenerate-skip path (141-147), the reset effect (179-189), and the result interface (47-54) are all where the plan says they are. The addition is purely additive; `useBiometricChunks` destructures a subset and ignores `failedCount` (verified lines 37-46) — safe.
- **Task 2 tiling math checks out.** Since `windowSec` is snapped to a multiple of `bucketSec`, `(idx+1)·windowSec·1000` is an exact multiple of `step`, so `qTo_i === qFrom_{i+1}` for interior windows except the documented `step-1` remainder edge. The last-window `toMs` is clamped to `sessionEndMs` by the W1 loader (line 137), so `toMs >= sessionEndMs` correctly selects the `ceil` branch. `buildPath` memo key `[session.id, bucketSec, sessionEndMs]` preserves the stable-identity requirement of the drain effect (deps at line 173) and `requestWindows`.
- **Task 3** signature change is internally consistent and the state machine is exhaustive.
- **Task 4** line references are accurate against the current `SessionCharts.tsx`: `useBiometricOverview` at line 55, `base = overviewQuery.data ?? []` at 174, `deriveView(...)` at 212, the `overviewQuery.isFetching` header hint at 242, the M2 comment block at 53-54. `baseLoader`'s return surface (`samples`, `isLoading`, `attemptedCount`, `allAttempted`, `failedCount`, `totalWindows`) covers every field Task 4 consumes.
- **Task 5** deletion is clean. Grep confirms `useBiometricOverview` and `deriveView` are imported **only** by `SessionCharts.tsx` (plus their own definition files); no test/spec files reference them.

---

## Non-blocking observations

- **N1 (Task 4, minor UX):** The header "Loading…" hint will toggle on/off up to ~8 times as the loader drains windows one at a time (`isLoading` flips false between each window in the single-in-flight drain). This is consistent with the existing `chunksLoading`/`aggQuery.isFetching` flicker behavior already present in that same hint, so it is not a regression — just worth knowing the hint is choppy rather than a steady "Loading…" during initial fill. No change required.
- **N2 (Task 3, informational):** When `instructionsQuery.isPending` is true but the first base window has already resolved with samples, the view stays `loading` (skeleton) until instructions settle. This matches the prior behavior (old `loading` also OR-ed `instructionsQuery.isPending`), so the chart-opens-on-first-window promise is bounded by instructions latency — acceptable and unchanged.
- **N3 (cross-repo, carry-over of M2):** The tiling correctness is a genuine runtime dependency on mind_api Phase 49 that cannot be verified from `mind_web`. The plan flags it correctly; just ensure the merge gate actually confirms Phase 49 is live in the target API environment rather than treating the note as satisfied by its presence.

---

## Positive Notes

- The revision did not merely patch the two blocking issues — it integrated every low-severity note (degenerate-skip asymmetry, off-grid tiling edge, exhaustive default return) directly into the task text with rationale, which makes the plan self-documenting for the implementer.
- The non-obvious `quantizeWindow` trap (floor-from / ceil-**to** on every window would duplicate the shared boundary bucket after `mergeSortedByTimestamp`) is correctly called out, with the floor-interior / ceil-last rule prescribed instead.
- Effect declaration-order reasoning (child reset effect registered before the parent auto-enqueue effect → reset-then-enqueue) is correct and explicitly justified.
- The `detail ?? base` overlay machinery, `zoomRef`, datazoom handler, and note-30 `notMerge` structure-signature rebuild are correctly left untouched; the windowed base streams into the same `base` slot so progressive fill rides the existing incremental-rebuild path.

---

## Verdict

The plan resolves all blocking and minor issues from plan-review-1, the file/line references and API usage match the current codebase, and the remaining observations are non-blocking. Safe to implement.

PLAN_REVIEW_PASS
