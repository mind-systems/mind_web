# Server-LOD client architecture — layered base ⊕ overlay (governing design for Phase 20)

**Date:** 2026-06-21
**Source:** conversation context — Phase 20 re-architecture after the slug-46 band-aid failure

## Key Findings

- mind_api Phase 48 is **live and verifiable**: `GET /sessions/runs/:id/biometrics?bucketSec=<n>` → per-bucket per-field **min+max** as **synthetic `BioSampleDto[]`** (2 samples/bucket/sampleType, distinct in-bucket timestamps min<max), contract (i). Renders through the existing `byType → toSeries(field) → buildLineSeriesEntry` pipeline unchanged — purely a *data-source* concern, not a render-path one.
- A first attempt (**slug 46**, now rolled back; impl preserved in `git stash@{0}`) bundled the whole feature into one 4-task milestone and failed code review after 3 rounds. Every finding was a band-aid — `sessionHasData` flag, `&& overview.length===0` skeleton suppression + a "bridge", `useState mode` + `useRawRef` dual-write, hand-rolled quantized fetch dedup — and ALL trace to **one** root cause:
  - the design **conflates two different things in one mutable array**: "the session's dataset" (a property of the whole session, known at mount) vs "what's in the current zoom window" (a property of the view). `fetchAggregated` overwrote the array per sub-window, so an empty window looked like an empty session, a swap to raw blanked the chart, and so on.
  - compounded by **derived state stored imperatively** (`mode` is a pure function of the zoom span) and **fetch identity hand-rolled** (`fetchIdRef`/`lastAggSignatureRef`) where the aggregate is small and cacheable.
- The layered model below dissolves every band-aid **by construction**.

## Details

### Architecture — four pillars
1. **Two layers, not one array.** An immutable coarse **base** (full-session envelope, fetched once at mount, never sub-windowed, never emptied — answers "shape" + "has data") and a transient **overlay** (high-res for the *current* window — finer aggregate or raw). **Render = `detail ?? base`**; the base is always the floor, so the chart never blanks.
2. **Resolution is derived, not stored.** `resolution = shouldUseRaw(computeSpanSec(zoom))` — a pure function of the window, recomputed each `datazoom`. No `mode` state, no `useRawRef`, no dual-write.
3. **Aggregated fetches via React Query, keyed by `(window, bucketSec)`.** The aggregate is small and cacheable, so the 413 reason `useBiometricChunks` bypasses RQ does **not** apply here. Keys `['bio-overview', sessionId]` and `['bio-agg', sessionId, qWindow, bucketSec]` give dedup (no storm), cache (zoom-back is instant), and cancellation — replacing `fetchIdRef`, `lastAggSignatureRef`, and the manual quantization-dedup. Raw deep-zoom keeps the existing chunk loader (413 applies; its chunk-index dedup is already correct).
4. **One discriminated-union view-state.** `deriveView(base, detail, instructions)` → `{kind:'loading'|'empty'|'error'|'ready', samples}`; the component renders off `.kind`. Emptiness, loading, and error are each defined once; error ≠ empty.

### Band-aid → architectural replacement
| slug-46 band-aid | replaced by |
|---|---|
| `sessionHasData` flag | emptiness = base query settled non-error && zero grids — base is the full-session result by construction, never sub-windowed |
| bridge + `&& overview.length===0` skeleton suppression | `detail ?? base` — base always under the overlay |
| empty-window unmounts chart+zoom (dead-end) | base never empties → the empty branch can't trip from a sub-window |
| `useState mode` + `useRawRef` dual-write | `resolution = shouldUseRaw(computeSpanSec(zoom))` — derived |
| `lastAggSignatureRef` + manual dedup + request storm | RQ `queryKey=['bio-agg', sessionId, qWindow, bucketSec]` |
| `fetchIdRef` stale-guards (aggregated) | RQ cancellation / last-write-wins |
| scattered `isLoading`/`isEmpty`/`isError` booleans | `deriveView()` → discriminated union |
| soft-fail overview → "No data" | `{kind:'error'}` distinct from `{kind:'empty'}` |

### Contract + volume facts (carried, still true)
- Response shape (i): synthetic min/max `BioSampleDto[]`, distinct in-bucket timestamps min<max, every numeric key of the `sampleType` on each synthetic sample. Mirrors client `sampling:'minmax'` (note 28), so zoom-out (aggregate) and zoom-in (raw) render identically.
- Volume ≈95 % `motion` (816k/860k; worst session 389k) → Phase 19 decimation (`minmax`/`large`/`progressive`) stays **mandatory** on the raw zoom-in path; LOD only removes volume on zoom-out.

### Decomposition (replaces the old single milestone)
- **M1** (note 33) — `bucketPolicy.ts`, pure resolution + window-quantization helpers.
- **M2** (note 34) — base overview layer via React Query + unified view-state. Headline memory win; one source; converges alone.
- **M3** (note 35) — high-res overlay (`detail ?? base`) + derived resolution switch; finer aggregate (RQ) mid-zoom, lazy raw deep-zoom.
- Dependencies **M1 → M2 → M3**; each independently shippable and runtime-verifiable now that Phase 48 is live.

## Open Questions

- `RAW_SPAN_LIMIT` / `TARGET_BUCKETS` / ladder are starting values — tune against the 389k-motion session.
- Whether raw deep-zoom also moves to React Query (keyed by chunk index) or stays on `useBiometricChunks` — default: **stay** (413 + proven dedup). Revisit only if the dual-loader seam is awkward in M3.
