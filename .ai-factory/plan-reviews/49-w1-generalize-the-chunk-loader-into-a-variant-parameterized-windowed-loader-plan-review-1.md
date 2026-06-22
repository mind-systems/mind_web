# Plan Review: (W1) Generalize the chunk loader into a variant-parameterized windowed loader

**Plan:** `49-w1-generalize-the-chunk-loader-into-a-variant-parameterized-windowed-loader.md`
**Risk Level:** 🟢 Low (one wording correction needed; design is sound)

## Scope verification

- **Target file confirmed:** `src/pages/SessionsPage/useBiometricChunks.ts` matches the plan's description verbatim (`CHUNK_SEC = 30`, `mergeSortedByTimestamp`, drain `useEffect`, `loadedRef`/`inFlightRef`/`queuedSetRef`, `fetchIdRef`, half-open `+1 ms` boundary, degenerate-window skip, reset effect). Line references in the plan (`143-148` for the appendData invariant) are accurate.
- **Public surface / consumers:** The only source consumer of the hook is `SessionCharts.tsx:20` (`import { useBiometricChunks, CHUNK_SEC }`). It destructures `requestChunks`, `biometrics`, `isLoading` (`SessionCharts.tsx:80-81`) and uses `CHUNK_SEC` in `requestWindowChunks` (`SessionCharts.tsx:101-102`). `totalChunks` / `allChunksAttempted` are part of the returned type but not currently destructured at the call site. The plan's "preserve exact public surface" requirement is therefore correct and sufficient to leave `SessionCharts.tsx` untouched. No other importers exist.
- **Spec alignment:** Plan matches `.ai-factory/notes/36-unified-windowed-loader.md` and ROADMAP Phase 21 / item W1. Generic result shape `{ samples, requestWindows, isLoading, totalWindows, attemptedCount, allAttempted }` matches the note. Forward-exposing `attemptedCount` (beyond the original derived `allChunksAttempted`) is a reasonable affordance for W2's progress-based `deriveView`.

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** WARN — none. The change stays entirely within `pages/SessionsPage/`, uses `@/core/api` (`apiFetch`) and `@/core/types` only, no new cross-layer dependency. Consistent with the feature-module boundary.
- **Rules (`rules/`):** WARN — none. New file `useBiometricWindows.ts` is `camelCase` (hook convention ✓); logging stays on the `logger` facade (no `console.*`); all HTTP via `apiFetch`. Compliant.
- **Roadmap (`ROADMAP.md`):** Linked — Phase 21, item **(W1)**. This is a `refactor` prerequisite for W2; no roadmap drift.

## Critical Issues

None blocking. One instruction needs correction before implementation.

## Important Issue

### 1. The drain-effect dependency-array instruction (Task 1, line 44) is imprecise and, taken literally, produces a lint error

The plan says:

> The drain effect dep array must reference `windowSec` and `buildPath` **where it previously referenced** `sessionStartMs`/`sessionEndMs`/`session.id`.

This reads as "remove `sessionStartMs`/`sessionEndMs`/`session.id`, add `windowSec`/`buildPath`." But after the extraction the drain effect body **still uses** `sessionStartMs` and `sessionEndMs` — the plan explicitly keeps the `fromMs`/`toMs` math (Task 1, "Carry over verbatim" + "Replace the hard-coded `CHUNK_SEC` with `opts.windowSec`"), and that math reads both `sessionStartMs` and `sessionEndMs`. Additionally, the soft-error log line (`Failed to load biometric chunk ${idx} for session ${session.id}`) still references `session.id`.

So the correct dep array is **additive, not substitutive**:

```ts
}, [queue, isLoading, sessionStartMs, sessionEndMs, windowSec, buildPath]);
```

(plus `session.id` if the log message retains it — see minor note 2).

Following the plan's wording literally drops `sessionStartMs`/`sessionEndMs` while they are still read, which trips `react-hooks/exhaustive-deps`. Task 3's lint pass would catch it, but the risk is that an implementer "fixes" lint by adding an `eslint-disable` instead of restoring the deps — introducing a latent stale-closure bug for any future variant whose window bounds change without a `session.id` change. Recommend rewording line 44 to state the dep array is **`[queue, isLoading, sessionStartMs, sessionEndMs, windowSec, buildPath]`** explicitly.

## Minor Notes

1. **Reset-effect deps.** The plan says carry the reset effect over verbatim with `totalChunks → totalWindows`, giving deps `[session.id, totalWindows]`. Correct and behavior-preserving for the raw wrapper (`windowSec` constant). Worth a one-line note that future variants which change `windowSec` mid-session would not re-key this reset — out of scope for W1, but a known edge for W2. Not a blocker.

2. **Log wording.** The carried-over soft-error message says "biometric chunk" and embeds `session.id`. Since the file is now generic, consider "biometric window" for accuracy; if kept verbatim, ensure `session.id` stays in the drain-effect deps (see Important Issue 1). Cosmetic.

3. **`requestWindows` deps.** Plan says "rename accordingly"; the implicit dep array is `[totalWindows]` (mirroring the original `[totalChunks]`). Correct — calling out explicitly would remove ambiguity.

## Positive Notes

- Correctly identifies that only two things need generalizing (`windowSec`, `buildPath`) and keeps everything else verbatim — minimal blast radius for a "no behavior change" refactor.
- Keeping `useBiometricChunks` as a wrapper with the unchanged return shape is the lower-risk choice over migrating the call site, and is justified against the single consumer.
- The `buildPath` stability requirement (module-level / `useCallback([session.id])`) is called out in both Task 1 and Task 2, correctly tying it to the "no EChart re-bind per window" guarantee and the drain identity. This is the subtle part and the plan handles it well.
- The half-open `+1 ms` boundary, degenerate-window skip, `fetchIdRef` stale-guard, and the do-NOT-use-`appendData` invariant are all explicitly preserved with line references.
- Phasing (extract → re-express wrapper → typecheck/lint) with explicit dependencies is correct and verifiable.

## Verdict

Solid, well-scoped, spec-aligned refactor plan. Address the dependency-array wording in Task 1 (line 44) — state the additive dep array explicitly — and the plan is ready to implement.
