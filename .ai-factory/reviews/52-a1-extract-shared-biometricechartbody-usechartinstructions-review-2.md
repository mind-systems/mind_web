# Code Review (Round 2): (A1) Extract shared `BiometricEChartBody` + `useChartInstructions`

**Scope:** `git diff HEAD` — new `BiometricEChartBody.tsx`, new `useChartInstructions.ts`, modified `SessionCharts.tsx`.
**Verification:** `npm run typecheck` → clean. ESLint (JSON formatter, since the stylish formatter crashes on `util.styleText` — a Node/ESLint tooling bug, not a code defect) → `BiometricEChartBody.tsx`, `SessionCharts.tsx`, `useChartInstructions.ts` all **0 err / 0 warn**.

## Round-1 finding — resolved

The single Round-1 finding (new `react-hooks/exhaustive-deps` warning: `zoomRef` missing from the option memo's dependency array) is fixed. `BiometricEChartBody.tsx:62` now lists `zoomRef` in the deps `[instructions, samples, startedAt, endedAt, zoomRef]`, and the comment was updated to explain it is a stable ref identity (never retriggers the memo). Lint is back to zero warnings, restoring the spec's "lint green" bar. No behavior change — the `zoomRef` prop is the parent's stable `useRef` object.

## Re-verified correct

- **`zoomRef` ownership/threading:** declared in `SessionCharts` (`:75`), written by `handleDataZoom` (`:105`), passed as `zoomRef={zoomRef}` (`:195`), read via `zoomRef.current` in the child memo — same object, zoom-across-rebuild preserved.
- **Stable `instructions`:** module-level `EMPTY_INSTRUCTIONS` passed when `data` is undefined; prop identity stable while pending.
- **`prevSignatureRef` / `notMerge` / StrictMode write-effect:** moved verbatim into the child; child rendered unconditionally with no `key`, so its instance persists across session switches as the parent's did. Merge semantics unchanged.
- **`deriveView` wiring:** `baseProgress` drives loading/error/empty; `samples` (`detail ?? base`) drives the option; overlay failures stay soft. `InstructionsQueryLike` structurally compatible with `deriveView`.
- **`events` memo, soft instructions-error `logger.warn`, `useChartInstructions` query (key/path/options/offset-axis comment), imports:** all faithful to the original.

No new issues introduced by the fix. Extraction is a clean, behavior-preserving refactor.

REVIEW_PASS
