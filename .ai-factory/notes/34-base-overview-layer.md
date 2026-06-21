# M2 — Coarse base layer + unified view-state

**Date:** 2026-06-21
**Source:** conversation context — Phase 20 decomposition (governing design: note 32)

## Key Findings

- The "base" layer is the headline memory win and the simple half: ONE full-session aggregated request on mount, rendered as the sole data source, with raw chunks never drained. It converges on its own because there is one data source and no resolution switching yet.
- Doing this layer right (immutable base + a single view-state) is what makes M3 clean — most slug-46 band-aids existed because emptiness/loading were derived from a mutable, sub-windowed array. Here the base is the full-session result by construction.

## Details

### Base overview hook — React Query
`src/pages/SessionsPage/useBiometricOverview.ts` (new). `useBiometricOverview(session)`:
- `useQuery({ queryKey: ['bio-overview', session.id], queryFn: … })` → one `apiFetch<BioSampleDto[]>` for the full session: `from = session.startedAt`, `to = session.endedAt`, `bucketSec = computeBucketSec(session.durationSeconds)` (M1), path `/sessions/runs/${id}/biometrics?from=&to=&bucketSec=` (ISO + `encodeURIComponent`).
- **Use React Query deliberately** — the aggregate payload is small, so the 413 reason `useBiometricChunks` bypasses RQ does not apply; RQ gives cache + dedup + cancellation + a clean `{ data, isPending, isError }` for free. Document this as the explicit divergence from the chunk hook.
- Returns the query result (or a thin wrapper); the server's synthetic min/max samples flow through `byType → toSeries(field) → buildLineSeriesEntry` unchanged.

### Render base as the sole source + unified view-state
`src/pages/SessionsPage/SessionCharts.tsx`:
- Feed the base `overview` into `buildSessionChartOption` as the data source on mount; **do not** drain raw chunks (that lands in M3). At default zoom the coarse full-session shape shows immediately.
- Replace the scattered `isLoading` / `isError` / `isEmpty` booleans (currently wired to the chunk hook) with one derivation: `deriveView(overviewQuery, instructionsQuery, gridCount)` → `{ kind: 'loading' | 'empty' | 'error' | 'ready', samples }`.
  - `loading` = overview/instructions still pending.
  - `error` = overview query failed (distinct from empty — fixes the slug-46 "failed fetch shows No data").
  - `empty` = settled non-error AND `gridCount === 0` of the base. **No `sessionHasData` flag** — the base IS the full session, never sub-windowed, so its emptiness is the session's emptiness.
  - `ready` = renderable samples.
- Component renders off `view.kind`. Keep note 30's `notMerge`/`structureSignature` (derived from the built option).

### Boundary
- No zoom-driven switching, no raw, no overlay in M2 — that is M3. M2 alone must compile, render a coarse full-session chart, and never drain raw.

## Open Questions

- Exact shape of `deriveView` (standalone helper vs inline) — implementer's call; keep it a single source of the view kind.
