# Code Review: (M1) Pure resolution policy — `bucketPolicy.ts`

**Date:** 2026-06-21
**Scope:** `git diff HEAD` — only one source file changed: `src/pages/SessionsPage/bucketPolicy.ts` (new, 72 lines). The remaining staged changes are docs/plans/notes (`.ai-factory/**`), not code.

## Build verification
- `npm run typecheck` (`tsc --noEmit`) — **passes**, no errors.
- `npm run lint` (`eslint .`) — **passes**, no warnings (no unused exports despite all exports being unused so far — the file is `export`-only).

## Correctness analysis (each export)

- **`TARGET_BUCKETS`, `BUCKET_LADDER`, `RAW_SPAN_LIMIT_ENTER/EXIT`** — values match the spec (`notes/33-bucket-policy.md`) and the plan exactly. Ladder is sorted ascending, which `snapUp` relies on.

- **`computeSpanSec(zoom, durationSec)`** = `((zoom.end - zoom.start) / 100) * durationSec`. Verified consistent with the existing zoom model: `requestWindowChunks` (`SessionCharts.tsx:64-65`) computes `startSec = (start/100)*durationSec`, `endSec = (end/100)*durationSec`, so its span `endSec - startSec` is algebraically identical. The "shared zoom model" claim holds.

- **`snapUp(value, ladder)`** — returns the smallest ladder entry `≥ value`; falls through to the last entry (300) when `value` exceeds the ladder. For `value ≤ 1` (including 0 and negatives) it returns `ladder[0]` (1), satisfying the documented 1 s floor. Correct.

- **`computeBucketSec(spanSec)`** = `snapUp(spanSec / TARGET_BUCKETS)`. `spanSec = 0` → `snapUp(0)` → 1 (sane floor). Correct.

- **`shouldUseRaw(spanSec, currentlyRaw)`** — hysteresis is implemented in the right direction: aggregated→raw only at `spanSec ≤ 90`, raw→aggregated only at `spanSec > 110`. The 90–110 s band is sticky, preventing flapping. Matches spec.

- **`quantizeWindow(fromMs, toMs, bucketSec)`** — `step = bucketSec * 1000`; returns `[floor(fromMs/step)*step, ceil(toMs/step)*step]`. Formula matches the spec verbatim. Epoch-ms inputs (~1.7e12) divided by integer `step` and re-multiplied stay well within `Number.MAX_SAFE_INTEGER` (~9.0e15), so no floating-point precision loss for realistic windows. This gives the stable request-identity M3 needs (small pans inside one bucket window collapse to one key).

## Purity / architecture
- No imports at all — no React, React Query, `apiFetch`, `logger`, or UI. Satisfies the "pure, React-free" requirement and the architecture dependency rules (page-local module importing nothing from `core/` or `components/`). No side effects, no I/O.

## Non-blocking observations (no change required)
- **`quantizeWindow` with `bucketSec = 0`** would divide by zero (`step = 0` → `NaN` bounds). In practice the only producer is `computeBucketSec`, which floors at 1, so `bucketSec ≥ 1` always. As a standalone exported primitive consumed by M3, this is a latent edge only if a caller bypasses `computeBucketSec`; acceptable given the documented contract.
- **`snapUp` assumes an ascending `ladder`.** The default `BUCKET_LADDER` is sorted, so the "smallest entry ≥ value" guarantee holds; the floor-at-1 behavior is really "floor at `ladder[0]`". Both are contract assumptions, not defects.

These are informational only — the code is correct for its documented contract. The module faithfully reproduces the reviewed-clean stash implementation and adds `quantizeWindow` exactly as specified.

REVIEW_PASS
