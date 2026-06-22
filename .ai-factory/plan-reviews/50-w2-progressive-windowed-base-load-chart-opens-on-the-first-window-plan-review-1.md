# Plan Review: (W2) Progressive windowed base load

**Plan:** `50-w2-progressive-windowed-base-load-chart-opens-on-the-first-window.md`
**Files Reviewed:** 6 (`useBiometricWindows.ts`, `useBiometricChunks.ts`, `useBiometricAggregate.ts`, `useBiometricOverview.ts`, `deriveView.ts`, `SessionCharts.tsx`, `bucketPolicy.ts`)
**Risk Level:** 🔴 High

The plan is well-researched and most of its reasoning (bucket tiling, `+1 ms` interaction, effect declaration order, soft-instructions contract) is correct. However, one **critical** defect in the auto-enqueue effect will break the feature on its primary interaction (switching between sessions), and one **medium** regression in `deriveView` drops an existing render path. Both must be fixed before implementation.

---

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** PASS. All new/changed files stay inside `pages/SessionsPage/` (page-local feature sub-components owning their own data fetching), HTTP goes through `apiFetch`, no storage access, no shared-component data fetching. Fully aligned with the Feature-Based Modules rules.
- **Rules (`RULES.md`):** Not present. CLAUDE.md project rules (English, `apiFetch`-only HTTP, no raw `fetch`, `logger` facade) are all respected — Task 1 keeps the existing `logger.error` call. PASS.
- **Roadmap (`ROADMAP.md`):** WARN — the read roadmap (Phases 1–11) does not contain a W1/W2/M-series or Phase 49 entry, so milestone linkage for this work could not be confirmed from the file. The git log does show the `(W1)`, `(M3)`, `(M2)`, `(M1)` lineage this plan continues, so the sequencing is real; just not reflected in the reviewed ROADMAP section. Non-blocking.

---

## Critical Issues

### C1. Auto-enqueue effect never re-fires on session switch — new charts stay stuck on the skeleton (Task 2)

Task 2 specifies the auto-enqueue effect as:

```js
useEffect(() => {
  loader.requestWindows(Array.from({ length: loader.totalWindows }, (_, i) => i));
}, [loader.requestWindows, loader.totalWindows]);
```

and asserts: *"requestWindows is internally deduped and re-keyed on totalWindows, so this re-fires correctly on session switch and never double-enqueues."*

**This assumption is wrong, and it breaks the feature for almost every session switch.**

- In W1, `requestWindows` is `useCallback(..., [totalWindows])` (`useBiometricWindows.ts:92,111`). Its identity changes **only when `totalWindows` changes** — not on `session.id`.
- `totalWindows = Math.ceil(durationSeconds / windowSec)` (`useBiometricWindows.ts:74`), and Task 2 defines `windowSec` to target **~8 windows** (`windowSec ≈ ceil(durationSeconds / 8)` snapped to the bucket ladder). Working the math for many durations (30 s, 60 s, 480 s, 900 s, 3600 s, …) yields `totalWindows === 8` in essentially every case — the formula is constructed to produce 8.
- Therefore, across a session switch, both `loader.totalWindows` (8 → 8) and `loader.requestWindows` (same `useCallback` reference, since `8 === 8`) are **referentially unchanged**, so the effect's deps do not change and **the effect does not re-run**.
- Meanwhile the W1 reset effect (`useBiometricWindows.ts:179`, keyed on `session.id, totalWindows`) *does* re-run on the switch: it clears `samples`, `queue`, `attemptedCount`, and the dedup sets. So the new session is left with `samples = []`, `attemptedCount = 0`, nothing enqueued → `deriveView` sits in `loading` forever (`samples.length === 0 && !allAttempted`).

**Net effect:** the first session you open loads correctly; switching to any other session (the dominant case, since `totalWindows` is ~always 8) shows a skeleton that never resolves. This is the core user interaction of the SessionsPage split panel.

**Fix:** key the auto-enqueue effect on the session identity, e.g.

```js
useEffect(() => {
  loader.requestWindows(Array.from({ length: loader.totalWindows }, (_, i) => i));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [session.id, loader.totalWindows]);
```

Declaration order still holds (the child hook's reset effect is registered during the `useBiometricWindows()` call, before this effect), so reset-then-enqueue ordering is preserved. The plan's "re-keyed on totalWindows" justification should be removed.

---

## Medium Issues

### M1. New `deriveView` drops the "render when grids exist but biometric samples are empty" path — regression for breath sessions without a BCI (Task 3)

The current `deriveView` (`deriveView.ts:51-55`) reaches `ready` whenever `gridCount > 0`, carrying `overviewQuery.data ?? []` — so a session with **zero biometric samples but a non-empty grid set** (e.g. a breath session recorded without a BCI: `breath_phase` instructions present → `hasPhases` grid, but no `cardio`/`nfb`/`emotions` data) renders the phase timeline. This is exactly the behavior hardened in Phases 6–7 (`notes/10` and `notes/12`).

Task 3's new machine gates `ready` on `base.samples.length > 0` only:

- `loading` — false (`allAttempted` true)
- `ready` — false (`samples.length === 0`)
- `error` — false (`failedCount !== totalWindows`; windows succeeded-empty)
- `empty` — `allAttempted && gridCount === 0` is **false** because `gridCount ≥ 1` (phase grid present)

→ no branch matches; the result depends on whatever the (unspecified) default return is. If it defaults to `empty`, a breath-without-BCI session that previously showed its phase timeline now shows "No data" — a regression. `deriveView` is also fed `gridCount` but no longer uses it for `ready`, only for `empty`.

**Fix:** restore a grid-driven ready path once windows are settled, e.g. add before `empty`:

```js
if (base.samples.length > 0) return { kind: 'ready', samples: base.samples };
if (base.allAttempted && gridCount > 0) return { kind: 'ready', samples: base.samples };
```

and define an explicit exhaustive final return (see m3 below).

### M2. Tiling correctness depends on mind_api Phase 49 (absolute bucket anchoring) being deployed (Task 2/Task 4)

The plan's seamless-tiling argument (floor-interior / ceil-last `qTo`, half-open `[from, to)` server semantics, no duplicate same-timestamp samples) is **correct only if the server anchors buckets on an absolute epoch grid** (multiples of `bucketSec` from epoch), as the plan notes ("pairs with mind_api Phase 49 absolute bucket anchoring"). If the deployed API still anchors each bucket window relative to that request's `from`, adjacent windows will produce misaligned and/or duplicate bucket timestamps, and the windowed base will no longer equal the old single-request base. This is a cross-repo runtime dependency that is not verifiable from `mind_web` alone — **confirm Phase 49 is shipped in the target API environment before merging W2**, and consider noting it as an explicit prerequisite in the plan.

---

## Low / Minor Issues

- **L1 (Task 1 + Task 3 interaction):** the degenerate-window skip path (`useBiometricWindows.ts:141-147`) increments `attemptedCount` but is *not* a failure, so it must not increment `failedCount` (the plan correctly scopes the increment to the `.catch` block — good). But note the consequence for Task 3's `error` condition `failedCount === totalWindows`: a session where one window is degenerate-skipped and all others fail yields `failedCount === totalWindows - 1`, so it falls to `empty` rather than `error`. Acceptable (showing "No data" instead of "Failed" on a fully-failed-but-partly-degenerate session is benign), but worth a one-line code comment so it is not mistaken for a bug later.

- **L2 (Task 2, negligible):** the `+1 ms` lower bound for windows `i > 0` combined with `qFrom = floor(fromMs / step) * step` tiles correctly in general (the `+1` is floored away, so `qFrom_{i+1} === qTo_i`), **except** the deterministic edge where `sessionStartMs ≡ step - 1 (mod step)`, where `floor((toMs + 1)/step)` advances one bucket and leaves a single-bucket gap between windows. Probability ~`1/step` (step ≥ 1000), impact = one missing coarse bucket at one boundary. Negligible; no action required, but acknowledge it rather than claiming exact tiling unconditionally.

- **m3 (Task 3):** the "e.g." signature leaves the state ordering and the default return implicit. The implementer should (a) place `ready` checks before `empty`, (b) keep `loading` first, and (c) add an explicit exhaustive final `return` (after the M1 fix, `empty` is the natural terminal default) so no input falls through to `undefined`. Call this out in the task to avoid an ambiguous implementation.

- **m4 (Task 4):** confirm `baseBucketSec = computeBucketSec(durationSec)` (SessionCharts line 77, used by the overlay "no finer than base" guard) stays equal to the windowed base's `bucketSec` — it does, since both call `computeBucketSec(session.durationSeconds)`. No change needed, but the overlay-vs-base resolution invariant should be preserved exactly (the plan does preserve it).

---

## Positive Notes

- Correctly identifies that `quantizeWindow` (floor-from / **ceil-to** on every window, `bucketPolicy.ts:69-72`) would double-count the shared boundary bucket, and prescribes the right floor-interior / ceil-last rule instead. Strong, non-obvious analysis.
- Task 1 is genuinely additive: `failedCount` is reset alongside `attemptedCount`, guarded by the existing `fetchIdRef` stale check, and `useBiometricChunks` (which ignores the new field) keeps working. Verified against `useBiometricChunks.ts` — it destructures only the fields it uses, so the interface addition is safe.
- Grep-confirmed: `useBiometricOverview` and `deriveView` are imported **only** by `SessionCharts.tsx`, and there are no `*.test.*`/`*.spec.*` files — so Task 5's deletion and the `deriveView` signature change have no other call sites to break.
- The `detail ?? base` overlay/zoom machinery, `zoomRef`, and the note-30 structure-signature `notMerge` rebuild are correctly left untouched; the windowed base streams into the same `base` slot, so progressive fill flows through the existing incremental-rebuild path.
- Memoizing `buildPath` with `useCallback` keyed on `[session.id, bucketSec, sessionEndMs]` correctly preserves W1's stable-identity requirement for `requestWindows` and the drain effect.

---

## Verdict

Do not implement as written. Resolve **C1** (auto-enqueue session-switch dep — feature-breaking) and **M1** (grids-without-samples ready path regression), confirm **M2** (Phase 49 deployed), and tighten the `deriveView` ordering/default per **m3**. The remaining items are low-severity polish.
