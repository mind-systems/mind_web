# Plan: (W1) Generalize the chunk loader into a variant-parameterized windowed loader

## Context
Extract the proven progressive-loading machinery in `useBiometricChunks` into a generic `useBiometricWindows(session, { windowSec, buildPath })` hook so aggregated chart variants can reuse the same drain queue, sorted merge-accumulation, and stale-guard. Re-express `useBiometricChunks` as a thin raw wrapper. Pure refactor — no behavior change.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Extract the generic windowed loader

- [x] **Task 1: Create `useBiometricWindows` generic hook**
  Files: `src/pages/SessionsPage/useBiometricWindows.ts` (new)
  Move the entire body of `useBiometricChunks` (`src/pages/SessionsPage/useBiometricChunks.ts`) into a new hook `useBiometricWindows(session: SessionRun, opts: UseBiometricWindowsOptions)`. Carry over **verbatim** (semantics unchanged):
  - `mergeSortedByTimestamp` helper (move it here; it stays private to this file).
  - The single-in-flight drain `useEffect` (queue pop → fetch → merge → mark loaded → `attemptedCount++`), including React-18-batching comment and the `eslint-disable` lines.
  - The dedup refs `loadedRef` / `inFlightRef` / `queuedSetRef` and the `fetchIdRef` stale-guard.
  - The half-open boundary: `fromMs = idx === 0 ? sessionStartMs : sessionStartMs + idx * windowSec * 1000 + 1` and `toMs = Math.min(sessionStartMs + (idx + 1) * windowSec * 1000, sessionEndMs)`, the degenerate-window skip (`fromMs >= toMs`), and the session-switch/unmount reset effect.
  - Soft-error logging via the `logger` facade from `@/core/observe`. Reword the message from "biometric chunk" to "biometric window" since the file is now generic; keep `session.id` embedded in it.
  - The "do NOT use ECharts `appendData`" invariant comment (currently `useBiometricChunks.ts:143-148`) — keep it intact on the merge call.

  Generalize exactly two things:
  - Replace the hard-coded `CHUNK_SEC` with `opts.windowSec` everywhere it is used (`totalWindows = Math.ceil(session.durationSeconds / windowSec)` and the `fromMs`/`toMs` math).
  - Replace the inline raw URL (`/sessions/runs/${session.id}/biometrics?from=${from}&to=${to}`) with `opts.buildPath(fromMs, toMs)`. `buildPath` receives **epoch-ms** numbers and is responsible for ISO-formatting + `encodeURIComponent` of its own query params.

  Define and export:
  ```ts
  export interface UseBiometricWindowsOptions {
    windowSec: number;
    buildPath: (fromMs: number, toMs: number) => string;
  }
  export interface UseBiometricWindowsResult {
    samples: BioSampleDto[];
    requestWindows: (idxs: number[]) => void;
    isLoading: boolean;
    totalWindows: number;
    attemptedCount: number;
    allAttempted: boolean;
  }
  ```
  Rename the internal identifiers accordingly (`biometrics`→`samples`, `requestChunks`→`requestWindows`, `totalChunks`→`totalWindows`).

  **Dependency arrays (explicit — additive, not substitutive):**
  - Drain effect: `[queue, isLoading, sessionStartMs, sessionEndMs, windowSec, buildPath, session.id]`. The body still reads `sessionStartMs`/`sessionEndMs` (the `fromMs`/`toMs` math) and `session.id` (the soft-error log), so those stay; `windowSec` and `buildPath` are **added** because the body now reads them too. Do **not** drop `sessionStartMs`/`sessionEndMs`/`session.id`, and do **not** silence `react-hooks/exhaustive-deps` with an `eslint-disable` — a missing window-bound dep is a latent stale-closure bug for future variants whose bounds change without a `session.id` change.
  - `requestWindows` `useCallback`: deps `[totalWindows]` (mirrors the original `[totalChunks]`).
  - Reset effect: deps `[session.id, totalWindows]` (mirrors the original `[session.id, totalChunks]`). Add a one-line comment noting that a future variant which changes `windowSec` mid-session without a `session.id` change would not re-key this reset — out of scope for W1, relevant to W2.

  Note in a comment that `buildPath` must be memoized by callers so `requestWindows` and the drain identity stay stable across renders (preserves the "no EChart re-bind per window" guarantee).

### Phase 2: Re-express the raw loader as a wrapper

- [x] **Task 2: Rewrite `useBiometricChunks` as a thin raw wrapper** (depends on Task 1)
  Files: `src/pages/SessionsPage/useBiometricChunks.ts`
  Replace the file contents with a thin wrapper that calls `useBiometricWindows` with `windowSec: 30` and a stable raw `buildPath`. Preserve the **exact existing public surface** so `SessionCharts.tsx` is untouched:
  - Keep `export const CHUNK_SEC = 30;` (it is imported by `SessionCharts.tsx:20`); pass it as `windowSec`.
  - Return shape must remain `{ biometrics, requestChunks, isLoading, totalChunks, allChunksAttempted }` — map from the generic result: `biometrics: samples`, `requestChunks: requestWindows`, `totalChunks: totalWindows`, `allChunksAttempted: allAttempted`.
  - The raw `buildPath` builds `/sessions/runs/${session.id}/biometrics?from=${iso(from)}&to=${iso(to)}` with `encodeURIComponent(new Date(ms).toISOString())`. Because it closes over `session.id`, wrap it in `useCallback(..., [session.id])` so identity is stable within a session and only changes on session switch (matching the prior behavior where the drain effect re-keyed on `session.id`).
  - Keep the existing doc comment describing the RQ-bypass / 413 rationale on the wrapper.

### Phase 3: Validate

- [x] **Task 3: Typecheck and lint** (depends on Task 2)
  Files: (no source changes)
  Run `npm run typecheck` and `npm run lint`. Confirm `SessionCharts.tsx` compiles unchanged against the wrapper and the new file is clean. Fix any type/lint issues introduced by the extraction (e.g. unused imports left in `useBiometricChunks.ts`). No behavior change is expected — raw biometrics still load lazily on zoom exactly as before.
