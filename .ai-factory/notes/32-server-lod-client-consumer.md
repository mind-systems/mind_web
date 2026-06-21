# Consume server-aggregated biometrics for the zoomed-out overview (client half of LOD)

**Date:** 2026-06-21
**Source:** conversation context (perf triage; option 4 web side; API/storage owner coordination)

## Key Findings

- Display decimation (notes 28/31) fixes the render freeze, but the client still **fetches and accumulates every raw sample** of a long session (`useBiometricChunks` drains all chunks into one array). The raw memory/network footprint is only removed by loading a **coarse resolution when zoomed out** — served by the mind_api aggregated read (Phase 48 / api note 58).
- **Contract is now fixed** (api note 58, confirmed against the live DB): `GET /sessions/runs/:id/biometrics?...&bucketSec=<n>`. Without `bucketSec` ⇒ raw, byte-for-byte as today (the existing chunked path is untouched). With `bucketSec` ⇒ per-bucket per-field **min+max** envelope — mutually mirrored with the client's `sampling:'minmax'` (note 28). The server aggregates schema-agnostically (`jsonb_typeof='number'`), filters garbage `timestamp=0` itself, and owns the on-the-fly-vs-rollup strategy — **none of that touches this side.**
- **Volume is ~95 % `motion`** (816k/860k samples; worst session 389k motion points). Consequence for this side: the raw zoom-in path still returns huge point counts, so **Phase 19 display decimation is mandatory regardless of LOD** — LOD removes volume on zoom-out, Phase 19 removes it on the raw zoom-in path.

## Details

### Response-shape decision — **(i)** synthetic `BioSampleDto[]` (this side's vote)
- Server emits, per bucket per sampleType, **2 synthetic `BioSampleDto`**: one carrying every numeric field's **min**, one carrying every field's **max**. Rationale from the ECharts side:
  - Reproduces exactly what `sampling:'minmax'` does on raw data → zoom-out (aggregated) and zoom-in (raw) render **identically**, same series type, same envelope semantics, no visual jump at the raw↔aggregated threshold.
  - **Zero client churn:** the whole pipeline (`byType` partition → `toSeries(field)` → `buildLineSeriesEntry` → grids) is reused unchanged; the resolution switch becomes a *data-source* swap, not a render-path swap. Note 30's structure-signature/merge keeps working.
  - (ii) (a distinct aggregated DTO → an area band between min/max) is cleaner visually but needs a new transform + a new series type here — not worth it for an overview mode.
- **Requirement on the server for (i) to render correctly:** the two synthetic samples need **distinct in-bucket timestamps** and stable order (min before max, or the real sub-bucket extremum times) — e.g. min at `bucketStart`, max at `bucketStart + bucketSec/2` — so a field's two points don't collapse onto one x. Each synthetic sample must carry **all** numeric keys of its `sampleType`.

### Zoom-window → `bucketSec` policy (this side owns it)
- `spanSec = (zoom.end − zoom.start) / 100 × durationSec`.
- **Raw ↔ aggregated threshold:** `spanSec ≤ RAW_SPAN_LIMIT` (~90 s, tunable) → use the existing raw chunked path (`useBiometricChunks`), rendered with note 28's `minmax`. Else → aggregated. Add **hysteresis** (e.g. switch to raw at 90 s, back to aggregated at ~110 s) so micro-zoom at the boundary doesn't flap between loaders.
- **Bucket size when aggregated:** target ~1 bucket per 1–2 px → `TARGET_BUCKETS ≈ 1200`. `idealBucket = spanSec / TARGET_BUCKETS`; **snap up to a nice ladder** `[1, 2, 5, 10, 15, 30, 60, 120, 300]` s (floor 1 s). Snapping is load-bearing: it keeps `bucketSec` constant across small zoom moves so we don't refetch on every pixel, and it's server-cache-friendly. Full 30-min view → `1800/1200 ≈ 1.5 → 2 s` → ~900 buckets → ~1800 drawn points/series.
- **On mount:** fetch the aggregated overview at the full-zoom `bucketSec` in a **single request** → instant full-session shape, no waiting for ~60 chunk drains. This is the main memory/UX win; raw chunks load lazily only on zoom-in past the threshold.

### Decomposition (now that the contract is fixed)
- **(a)** Coarse full-session overview fetch + render — new single-request loader (not chunked), rendered through the existing pipeline as synthetic min/max samples.
- **(b)** Zoom-driven resolution switch (coarse ↔ raw) — the `RAW_SPAN_LIMIT`/ladder policy above, swapping between the overview loader and `useBiometricChunks`, reusing `zoomRef` + note 30's merge.

Re-run `/roadmap-decompose` to split (a)/(b) into atomic milestones once mind_api Phase 48 ships the endpoint.

### Dependency
- mind_api Phase 48 "Biometric LOD aggregated read" (api note 58). Contract-first — endpoint must ship before this is implementable.

## Open Questions

- `RAW_SPAN_LIMIT`, `TARGET_BUCKETS`, and the ladder are starting values — tune against the 389k-motion session once the endpoint is live.
- **(Decided)** Response shape → **(i)** synthetic `BioSampleDto[]` (above); finalize alongside api note 58 in `/aif-plan`.
