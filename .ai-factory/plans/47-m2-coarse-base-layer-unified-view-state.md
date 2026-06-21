# Plan: (M2) Coarse base layer + unified view-state

## Context
Replace the eager raw-chunk drain in `SessionCharts` with a single full-session aggregated request (the immutable "base"), rendered as the sole data source on mount, and collapse the scattered `isLoading`/`isError`/`isEmpty` booleans into one derived discriminated view-state. This is the headline memory win of Phase 20 and the foundation M3 layers the high-res overlay on.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Base overview hook

- [x] **Task 1: Add `useBiometricOverview(session)` React Query hook**
  Files: `src/pages/SessionsPage/useBiometricOverview.ts` (new)
  Create a React Query hook that fetches the full-session aggregate in ONE request.
  - `useQuery({ queryKey: ['bio-overview', session.id], queryFn: … })` returning `apiFetch<BioSampleDto[]>(...)`.
  - Compute `bucketSec = computeBucketSec(session.durationSeconds)` from `./bucketPolicy` (M1, already shipped).
  - Build the request path exactly like the chunk hook but full-span + bucketed: `/sessions/runs/${session.id}/biometrics?from=${from}&to=${to}&bucketSec=${bucketSec}`, where `from = encodeURIComponent(session.startedAt)` and `to = encodeURIComponent(session.endedAt)` (`startedAt`/`endedAt` are already ISO strings on `SessionRun` — no ms→ISO conversion needed).
  - **Deliberately use React Query** (unlike `useBiometricChunks`, which bypasses RQ to dodge 413 on raw full-session loads): the aggregate payload is small (≈`TARGET_BUCKETS` buckets), so RQ's cache + dedup + cancellation + clean `{ data, isPending, isError }` apply cleanly. Add a top-of-file doc comment stating this divergence and why the 413 rationale does not apply here.
  - Return the query result directly (or a thin typed wrapper) so the server's synthetic min/max `BioSampleDto[]` flow through `byType → toSeries(field) → buildLineSeriesEntry` unchanged.
  - Follow the `core/api` rule: all HTTP goes through `apiFetch` — no raw `fetch`.

### Phase 2: Unified view-state + base as sole source

- [x] **Task 2: Add `deriveView` view-state helper** (depends on Task 1)
  Files: `src/pages/SessionsPage/deriveView.ts` (new)
  Add a single pure function that is the one source of the chart's view kind, replacing the scattered booleans.
  - Signature: `deriveView(overviewQuery, instructionsQuery, gridCount) → { kind: 'loading' | 'empty' | 'error' | 'ready'; samples: BioSampleDto[] }`. Accept the minimal fields needed (`{ data, isPending, isError }`) rather than the whole query object if cleaner.
  - State machine:
    - `loading` = overview OR instructions still pending.
    - `error` = overview query failed — kept **distinct from empty** (fixes the slug-46 "failed fetch shows No data" bug). Instructions failure is soft: log via the `logger` facade and render biometrics without the timeline, do NOT surface it as `error`.
    - `empty` = overview settled AND not error AND `gridCount === 0`. **No `sessionHasData` flag** — the base IS the full-session result by construction, never sub-windowed, so its zero-grid state IS the session's emptiness.
    - `ready` = otherwise; `samples = overview.data ?? []`.
  - Keep it React-free and side-effect-free (no `logger` call inside; the soft-instructions-error log stays in the component). Order checks so `loading` wins before `empty`/`ready`.

- [x] **Task 3: Render base as the sole source in `SessionCharts` and switch on `view.kind`** (depends on Task 1, Task 2)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`
  Rewire the component so the coarse base is the only data source on mount and the render branches off the unified view-state.
  - Call `useBiometricOverview(session)` and feed its `data ?? []` into `buildSessionChartOption(...)` in place of the chunk `biometrics` array. The memo dep changes from `biometrics` to the overview samples; keep `instructionsData`, `session.startedAt`, `session.endedAt`, and the `zoomRef.current` read exactly as today.
  - **Remove the raw chunk drain entirely** (this is the memory win): delete the `useBiometricChunks` usage, `requestWindowChunks`, the chunk-requesting body of `handleDataZoom`, the eager `useEffect` mount load (`requestWindowChunks(zoomRef…)`), and the `isChunkLoading`/`totalChunks`/`allChunksAttempted` wiring. Do NOT delete `useBiometricChunks.ts` — M3 reuses it lazily.
  - Keep `zoomRef` and a lightweight `datazoom` handler that only persists `zoomRef.current = { start, end }` (no chunk requests) so the zoom window survives rebuilds; keep the `events`/`useMemo` wiring. (M3 reintroduces zoom-driven resolution switching here.)
  - Replace the `isLoading`/`isError`/`isEmpty` locals with a single `const view = deriveView(overviewQuery, instructionsQuery, gridCount)` and render: `view.kind === 'loading'` → `<SkeletonLoader />`; `'error'` → "Failed to load session data"; `'empty'` → "No data for this session"; `'ready'` → `<EChart … />`.
  - Preserve note 30's incremental-merge machinery unchanged: `prevSignatureRef`, the `notMerge = prevSignatureRef.current !== structureSignature` derivation, and the effect that commits `structureSignature` after render.
  - Update the header "Loading…" indicator: drop the `isChunkLoading && biometrics.length > 0` condition (no more chunk streaming); either remove it or gate it on `overviewQuery.isFetching` — keep it minimal and consistent with the single-fetch model.
  - Confirm `npm run typecheck` and `npm run lint` pass; the chart must render a coarse full-session shape at default zoom and never drain raw.

## Notes for the implementer
- Boundary: M2 is base-only. NO zoom-driven resolution switching, NO high-res overlay, NO lazy raw — those are M3 (`.ai-factory/notes/35-detail-overlay.md`). M2 alone must compile, render the coarse full-session chart, and never drain raw chunks.
- Architecture: this is a page-local feature hook/sub-component under `pages/SessionsPage/` — co-locating `useQuery` here is allowed by `ARCHITECTURE.md`. Keep all HTTP in `apiFetch`, all logging through the `logger` facade.
- Spec: `.ai-factory/notes/34-base-overview-layer.md`.
