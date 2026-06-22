# Code Review: (W2) Progressive windowed base load — chart opens on the first window

**Scope:** `git diff HEAD` — `SessionCharts.tsx`, `deriveView.ts`, `useBiometricWindowedBase.ts` (new), `useBiometricWindows.ts`, deletion of `useBiometricOverview.ts`.
**Build:** `npm run typecheck` ✅ clean · `npm run lint` ✅ clean.
**Risk Level:** 🟡 Low–Medium — one correctness defect on a degenerate input; the core feature is implemented correctly and matches the (re-reviewed) plan.

The implementation follows the plan faithfully: the C1 auto-enqueue fix is keyed on `session.id`, the M1 grids-without-samples ready path is restored, `failedCount` is additive and degenerate-skip-safe, and the floor-interior / ceil-last tiling is implemented exactly as specified. Verified `useBiometricOverview` has no remaining live references (only a doc-comment mention in the replacement hook).

---

## Findings

### F1 — Zero-duration session is misclassified as `error` instead of `empty` (Medium)

`useBiometricWindowedBase` computes, for `session.durationSeconds === 0`:
- `bucketSec = computeBucketSec(0) = 1`
- `rawWindowSec = ceil(0/8) = 0` → `windowSec = max(0, 1) = 1`
- `useBiometricWindows`: `totalWindows = Math.ceil(0 / 1) = 0`

With `totalWindows === 0`:
- the auto-enqueue effect calls `requestWindows([])` → nothing enqueued;
- `allAttempted = attemptedCount(0) >= totalWindows(0)` → **true** from first render;
- `failedCount` stays `0`.

`deriveView` then evaluates (instructions settled):
- loading → false (`!allAttempted`)
- **error → `allAttempted && samples.length === 0 && failedCount(0) === totalWindows(0)` → true**

So a zero-duration session renders **"Failed to load session data"**. The old `useBiometricOverview` path issued one request, got `[]`, and `deriveView` returned `empty` ("No data") — so this is a behavior regression for that degenerate input. The defect is the `failedCount === totalWindows` test giving a false positive when both are `0` (no windows ≠ all windows failed).

**Fix (pick one):**
- Guard the error branch on a non-empty window set: `base.allAttempted && base.samples.length === 0 && base.totalWindows > 0 && base.failedCount === base.totalWindows`, **or**
- Require at least one actual failure: `... && base.failedCount > 0 && base.failedCount === base.totalWindows`.

Either makes `totalWindows === 0` fall through to the `empty` terminal default, restoring the prior behavior. Severity is Medium rather than High only because zero-duration sessions are rare; the fix is trivial and the wrong state is user-visible.

---

## Non-blocking observations

- **O1 — Total-backend-failure shows the skeleton longer than before (by spec).** With a dead API, all 8 windows must fail before `error` shows; until then `samples.length === 0 && !allAttempted` keeps the skeleton. Because the drain is single-in-flight, the 8 failing requests run sequentially, so the error appears after ~8× the per-request failure latency (worst case: timeouts) instead of immediately as with the old single request. This is the intended consequence of "error only when all windows failed" (note 37), not a bug — flagging only so the latency trade-off is a conscious one.

- **O2 — Grids-without-samples sessions now reveal their timeline only after `allAttempted`.** A breath-without-BCI session (phase grid, zero biometric samples) stays on the skeleton until all windows have been attempted (path 4 requires `allAttempted`), whereas the old single-request path showed the timeline after one response. Correct per the progressive state machine; just a slightly later first paint for that class of session.

- **O3 — Header "Loading…" hint flickers per window.** `baseLoader.isLoading` toggles false→true between each drained window, so the indicator blinks during progressive fill rather than staying solid as the old `overviewQuery.isFetching` did. Cosmetic only.

- **O4 — Tiling gap edge is present and acknowledged.** When `sessionStartMs ≡ step − 1 (mod step)`, the `+1 ms` window lower bound floors into the next bucket, leaving a one-bucket gap at a single interior boundary (≈`1/step` probability, `step ≥ 1000`). Matches the plan's L2 note; no action needed. Correctness of seamless tiling also still depends on **mind_api Phase 49 (absolute bucket anchoring)** being deployed — confirm before merge, as the plan's Prerequisite states.

- **O5 — Effect ordering is correct.** The auto-enqueue effect is declared after the `useBiometricWindows()` call, so on a session switch the child's reset effect (clears queue/sets) commits before the parent re-enqueues `[0..totalWindows-1]`; `requestWindows` dedup prevents double-enqueue. The `react-hooks/exhaustive-deps` suppression for the omitted `loader.requestWindows` is justified (its identity is stable while `totalWindows` is unchanged, and `totalWindows` is already a dep).

---

## Verdict

One Medium correctness fix recommended (**F1** — zero-duration → `error`). Everything else is per-spec and clean. Address F1, then this is good to merge.
