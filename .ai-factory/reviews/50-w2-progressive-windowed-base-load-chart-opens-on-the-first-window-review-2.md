# Code Review 2: (W2) Progressive windowed base load — chart opens on the first window

**Scope:** `git diff HEAD` — `SessionCharts.tsx`, `deriveView.ts`, `useBiometricWindowedBase.ts` (new), `useBiometricWindows.ts`, deletion of `useBiometricOverview.ts`. All changed/new files read in full.
**Build:** `npm run typecheck` ✅ · `npm run lint` ✅ · no live references to the deleted `useBiometricOverview` (only a doc-comment mention).
**Risk Level:** 🟢 Low — no blocking defects. The review-1 finding is fixed; remaining items are a pre-existing transient and minor nits.

---

## Status of prior review (review-1)

- **F1 (zero-duration session misclassified as `error`) — RESOLVED.** `deriveView` now guards the error branch with `base.totalWindows > 0`:
  ```ts
  if (base.allAttempted && base.samples.length === 0 && base.totalWindows > 0 && base.failedCount === base.totalWindows)
  ```
  A zero-duration session (`totalWindows === 0`) no longer vacuously satisfies `failedCount(0) === totalWindows(0)`; it falls through to the `empty` terminal default, matching the old single-request behavior. Confirmed correct.

---

## Findings

### F2 — Transient stale frame on session switch when instructions are cached (Low, pre-existing class)

`useBiometricWindows` keeps `samples`/`overlay`/`attemptedCount` in local `useState` and clears them in a session-`id`-keyed **effect**, not synchronously during render (and not via a React-Query session key). On switching session A→B, the first committed render of `SessionCharts({session: B})` still sees A's `baseLoader.samples` (the reset effect has not run yet), so:

- if B's instructions are **not** cached → `instructionsQuery.isPending` is true → `deriveView` returns `loading` → skeleton, no glitch (the common first-visit case);
- if B's instructions **are** cached (revisiting within React-Query's gc window — common when clicking around the session list) → `isPending` is false, `base.samples.length > 0` (A's data) → `deriveView` returns `ready`, and `EChart` renders A's biometric series against B's `startedAt/endedAt` axis for one paint before the reset effect fires and drops back to the skeleton.

In practice the visible artifact is small: A's absolute timestamps fall outside B's offset axis range, so the stale points are mostly clipped — the flash reads as a brief empty/old chart frame rather than obviously-wrong data. It is also **not new to W2**: M3 already had the same one-frame lag through the `overlay`/`detail` path (`overlay` is local state reset in an effect), so `detail ?? base` could already show a stale overlay for one frame. W2 extends the same characteristic to the base layer.

- Impact: cosmetic, one frame, only on cached-instructions revisits.
- If a fix is wanted later (out of scope for this milestone): reset the windowed-loader state during render on `session.id` change (the React "store prev prop, reset on change" pattern) instead of in an effect, so the stale render never commits. This belongs in the shared W1 hook and would also fix the pre-existing overlay flash. Not required to ship W2.

### F3 — `attemptedCount` plumbed through but unused (Nit)

`useBiometricWindowedBase` returns `attemptedCount` and `UseBiometricWindowedBaseResult` declares it, but no consumer reads it (`SessionCharts` passes `samples`/`allAttempted`/`failedCount`/`totalWindows` to `deriveView`, and uses `isLoading` for the header). Harmless dead surface; drop it or keep for symmetry with the underlying loader. No action required.

---

## Verified correct

- **Auto-enqueue / C1 fix.** The enqueue effect is keyed on `[session.id, loader.totalWindows]` and declared after `useBiometricWindows()`, so the child reset effect commits before re-enqueue; `requestWindows` dedup prevents double-enqueue, and because `totalWindows` is ~always 8 the session-`id` key is what actually drives the re-fire on switch. Stuck-skeleton-on-switch bug is avoided.
- **`failedCount` is additive and degenerate-safe.** Incremented only in the `.catch` path (stale-guarded), reset alongside `attemptedCount`; the degenerate-window skip deliberately does not increment it (commented). `useBiometricChunks` destructures only the fields it uses, so the new field is non-breaking.
- **Tiling.** `buildPath` floors interior boundaries and ceils only the final window (`toMs >= sessionEndMs`), giving contiguous non-overlapping `[from, to)` tiles with no duplicate same-timestamp buckets; the single-bucket-gap edge at `sessionStartMs ≡ step−1 (mod step)` is acknowledged and negligible. `buildPath` is `useCallback`-memoized on `[session.id, bucketSec, sessionEndMs]`, preserving W1's stable-identity requirement. (Still depends on mind_api Phase 49 absolute anchoring per the plan Prerequisite — confirm deployed before merge.)
- **`deriveView` state machine.** Order loading → error → ready(samples) → ready(grids) → empty is exhaustive with an explicit terminal return; the grids-without-samples path (M1 fix) restores the breath-without-BCI timeline; `baseBucketSec` in `SessionCharts` is unchanged so the overlay "no finer than base" guard is preserved.

---

## Verdict

No blocking issues. F1 is fixed; F2 is a pre-existing cosmetic transient (optional future cleanup in the shared hook) and F3 is a nit. Good to merge once the cross-repo mind_api Phase 49 prerequisite is confirmed deployed.

REVIEW_PASS
