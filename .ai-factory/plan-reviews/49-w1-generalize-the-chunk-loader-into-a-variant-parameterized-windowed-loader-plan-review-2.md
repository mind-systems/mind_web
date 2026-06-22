# Plan Review 2: (W1) Generalize the chunk loader into a variant-parameterized windowed loader

**Plan:** `49-w1-generalize-the-chunk-loader-into-a-variant-parameterized-windowed-loader.md`
**Risk Level:** 🟢 Low
**Verdict:** Pass — all review-1 findings resolved; no new blocking issues.

## Scope verification

- **Target file confirmed:** `src/pages/SessionsPage/useBiometricChunks.ts` matches the plan verbatim — `CHUNK_SEC = 30` (line 6), `mergeSortedByTimestamp` (14–35), drain `useEffect` (105–164), `loadedRef`/`inFlightRef`/`queuedSetRef` (70–72), `fetchIdRef` (75), half-open `+1 ms` boundary (119–123), degenerate-window skip (127–133), reset effect (168–185). The `appendData` invariant comment cited as `143-148` is accurate.
- **Public surface / consumers:** Sole source consumer is `SessionCharts.tsx:20` (`import { useBiometricChunks, CHUNK_SEC }`). It destructures only `requestChunks`, `biometrics`, `isLoading` (`:81`) and uses `CHUNK_SEC` (`:101-102`). `totalChunks` / `allChunksAttempted` are in the returned type but not destructured. Other files (`transforms.ts:41`, `useBiometricAggregate.ts:4`, `useBiometricOverview.ts:4`) reference `useBiometricChunks` in comments only — keeping the wrapper name preserves those references. The "preserve exact public surface + keep `CHUNK_SEC` export" requirement is correct and sufficient to leave `SessionCharts.tsx` untouched.
- **No behavior change:** In the wrapper, `buildPath` is memoized on `[session.id]`, so its identity changes exactly when `session.id` changes — a dep already present in the original drain effect. Adding `buildPath` (and the constant `windowSec`) to the drain deps therefore introduces zero additional effect runs. The session-switch sequence (reset clears state + bumps `fetchIdRef`; drain re-runs but returns early on empty queue) is identical to current behavior.

## Resolution of Review 1 findings

- **Important Issue 1 (additive drain dep array):** Resolved. Task 1 line 47 now states the explicit array `[queue, isLoading, sessionStartMs, sessionEndMs, windowSec, buildPath, session.id]`, marks it "additive, not substitutive," and explicitly forbids an `eslint-disable` workaround. Matches the actual body reads (`fromMs`/`toMs` math reads both bounds; soft-error log reads `session.id`).
- **Minor 1 (reset-effect mid-session `windowSec`):** Resolved. Line 49 requires a one-line comment that a future variant changing `windowSec` without a `session.id` change would not re-key the reset — flagged as W2 scope.
- **Minor 2 (log wording):** Resolved. Line 22 rewords "biometric chunk" → "biometric window" while keeping `session.id` embedded (consistent with retaining `session.id` in the drain deps).
- **Minor 3 (`requestWindows` deps):** Resolved. Line 48 specifies `[totalWindows]`, mirroring the original `[totalChunks]`.

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** WARN — none. Change stays within `pages/SessionsPage/`; depends only on `@/core/api` (`apiFetch`) and `@/core/types`. `buildPath` returns a path string and the single `apiFetch` call remains in the hook — no raw `fetch` introduced, feature-module boundary intact.
- **Rules (`rules/`):** WARN — none. New file `useBiometricWindows.ts` follows the hook camelCase convention; logging stays on the `@/core/observe` `logger` facade (no `console.*`); all HTTP via `apiFetch`; no `localStorage`/`sessionStorage` access; no proto changes.
- **Roadmap (`ROADMAP.md`):** Linked — Phase 21 / item (W1). Refactor prerequisite for W2; no drift.

## Correctness / consistency checks

- Generic result `{ samples, requestWindows, isLoading, totalWindows, attemptedCount, allAttempted }` maps cleanly to the wrapper's preserved `{ biometrics, requestChunks, isLoading, totalChunks, allChunksAttempted }` (`allChunksAttempted: allAttempted`, where `allAttempted = attemptedCount >= totalWindows` mirrors the original derivation). Exposing `attemptedCount` from the generic for future W2 progress use is harmless and not surfaced by the wrapper.
- `buildPath` receiving epoch-ms and owning ISO-formatting + `encodeURIComponent` reproduces the original `encodeURIComponent(new Date(ms).toISOString())` exactly when the wrapper builds `/sessions/runs/${session.id}/biometrics?from=...&to=...`.
- The two carried-over `eslint-disable react-hooks/set-state-in-effect` lines and the cleanup-only `react-hooks/exhaustive-deps` disable (line 182) are preserved; the "do not silence exhaustive-deps on the drain effect" instruction concerns a *new* disable and does not contradict carrying these over.
- Keeping the sample type fixed as `BioSampleDto` (rather than introducing a generic type parameter) is correct restraint for W1 — both raw and aggregate variants share this shape; no over-engineering.

## Positive Notes

- Minimal blast radius: only two things generalized (`windowSec`, `buildPath`), everything else carried over verbatim with line-referenced invariants — appropriate for a "no behavior change" refactor.
- Wrapper-over-migration choice is the lower-risk path given the single call site, and is justified explicitly.
- The subtle `buildPath` stability contract (memoize by callers; `useCallback([session.id])` in the wrapper) is called out in both tasks and tied correctly to the "no EChart re-bind per window" and drain-identity guarantees.
- Phasing (extract → re-express wrapper → typecheck/lint) with explicit dependencies is verifiable end-to-end.

PLAN_REVIEW_PASS
