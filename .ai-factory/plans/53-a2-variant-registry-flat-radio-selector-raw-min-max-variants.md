# Plan: (A2) Variant registry + flat radio selector + raw & min/max variants

## Context
Turns the biometric chart into a flat, pluggable testbed: a registry of self-contained chart-variant components selected by a radio group, seeded with `raw` and `minmax`. Retires the zoom-driven base⊕overlay resolution switch — representation is now user-selected, not zoom-derived.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Notes / Constraints (from spec `.ai-factory/notes/39-variant-registry-radio-selector.md` + ARCHITECTURE.md)
- **Component-per-variant, not hook-per-variant.** Switching the radio remounts the variant subtree (`key = ${session.id}:${selectedId}`), so each variant's hooks always run unconditionally in their own tree — satisfies Rules of Hooks. The min/max + smoothing algorithms share ONE parameterized component (`makeWindowedVariant`); a future renderer swap (e.g. lightweight-charts) is a different `Component`.
- **Remount-on-switch simplifies memoization.** Because `SessionCharts` keys the variant on `${session.id}:${selectedId}`, the `session` prop identity is stable within a mount — `windowSec`/`buildPath` are effectively computed once per mount, sidestepping the stable-identity gymnastics that `useBiometricWindowedBase` needed.
- **No `localStorage`** for the selection — `useState` only (storage-access rule: only `core/auth`/`core/api`).
- **`deriveView` unchanged** (A1). Phase-19 decimation in `chartOption.buildLineSeriesEntry` (`sampling`/`large`/`progressive`) stays — mandatory on the Raw variant (`motion` ≈95 %).
- Files live under `pages/SessionsPage/` (page-local feature sub-components; co-located `useQuery` allowed per ARCHITECTURE.md §"Layer Communication"). `VariantSelector` is presentational — receives data as props, no `useQuery`.
- All files in English.

## Tasks

### Phase 1: Variant infrastructure

- [x] **Task 1: Define the `ChartVariant` type**
  Files: `src/pages/SessionsPage/chartVariants/types.ts`
  Export `interface ChartVariant { id: string; label: string; Component: React.ComponentType<{ session: SessionRun }> }`. Import `SessionRun` from `@/core/types`. This is the single contract every variant (windowed algorithms today, alternate renderers later) satisfies.

- [x] **Task 2: `makeWindowedVariant` factory** (depends on Task 1)
  Files: `src/pages/SessionsPage/chartVariants/makeWindowedVariant.tsx`
  Export `makeWindowedVariant(config): ChartVariant` where
  `config = { id: string; label: string; windowSec: (session: SessionRun) => number; buildPath: (session: SessionRun) => (fromMs: number, toMs: number) => string }`.
  (`windowSec`/`buildPath` are session-aware because min/max derives both from `session.durationSeconds`; raw ignores the session for `windowSec`.)
  The returned `Component({ session })`:
  1. `const windowSec = useMemo(() => config.windowSec(session), [session])`.
  2. `const buildPath = useMemo(() => config.buildPath(session), [session, windowSec])` — stable per mount (remount-on-switch guarantees stable `session`); satisfies the `useBiometricWindows` "stable buildPath" contract.
  3. `const loader = useBiometricWindows(session, { windowSec, buildPath })` (`./useBiometricWindows`).
  4. Auto-enqueue ALL windows on mount — generalize the `useBiometricWindowedBase` pattern: `useEffect(() => loader.requestWindows(Array.from({ length: loader.totalWindows }, (_, i) => i)), [session.id, loader.totalWindows])` (`requestWindows` is internally deduped; disable exhaustive-deps as done in the base hook).
  5. `const instructionsQuery = useChartInstructions(session)` (`./useChartInstructions`).
  6. Keep a `zoomRef = useRef({ start: 0, end: 100 })` and a minimal `onDataZoom` (`useCallback`) that records only `start`/`end` into `zoomRef.current` — NO resolution/overlay logic. This preserves the zoom window across the note-30 structural rebuilds without the retired raw/agg switch.
  7. Render the loading hint (moved out of the header) — a subtle `Loading…` span shown when `loader.isLoading`, matching the header's existing classes (`text-sm text-gray-400 dark:text-gray-500`) — plus `<BiometricEChartBody>` fed by: `startedAt`/`endedAt` from `session`, `instructions={instructionsQuery.data ?? EMPTY_INSTRUCTIONS}` (stable empty-array const, as in the current `SessionCharts`), `instructionsQuery`, `samples={loader.samples}`, `baseProgress={{ samples, allAttempted, failedCount, totalWindows }}` from the loader, `zoomRef`, `onDataZoom`.
  Keep `BiometricEChartBody`'s current props unchanged (it already accepts `zoomRef` + optional `onDataZoom`).

- [x] **Task 3: Variant registry** (depends on Task 2)
  Files: `src/pages/SessionsPage/chartVariants/registry.ts`
  Export `CHART_VARIANTS: ChartVariant[] = [rawVariant, minmaxVariant]` and `DEFAULT_VARIANT_ID = 'minmax'`.
  - `rawVariant = makeWindowedVariant({ id: 'raw', label: 'Raw', windowSec: () => 30, buildPath: (session) => (fromMs, toMs) => \`/sessions/runs/${session.id}/biometrics?from=${enc(fromMs)}&to=${enc(toMs)}\` })` — no `bucketSec` param → server returns raw (mirror the raw path built in `useBiometricChunks`: `encodeURIComponent(new Date(ms).toISOString())`).
  - `minmaxVariant = makeWindowedVariant({ id: 'minmax', label: 'Min/max', windowSec, buildPath })` reproducing `useBiometricWindowedBase` exactly:
    - `windowSec(session)`: `const bucketSec = computeBucketSec(session.durationSeconds); const raw = Math.ceil(session.durationSeconds / 8); return Math.max(Math.ceil(raw / bucketSec) * bucketSec, bucketSec)`.
    - `buildPath(session)`: compute `bucketSec` and `sessionEndMs = new Date(session.endedAt).getTime()` once, return `(fromMs, toMs) => { step = bucketSec*1000; qFrom = floor(fromMs/step)*step; qTo = toMs >= sessionEndMs ? ceil(toMs/step)*step : floor(toMs/step)*step; return \`…?from=${enc(qFrom)}&to=${enc(qTo)}&bucketSec=${bucketSec}\` }` (floor interior boundaries so windows tile contiguously; ceil only the last window).
    Import `computeBucketSec` from `../bucketPolicy`.
  (Future avg/lttb radios are appended here one line each — do not add them now.)

- [x] **Task 4: `VariantSelector` radio group** (depends on Task 1)
  Files: `src/pages/SessionsPage/VariantSelector.tsx`
  Presentational component: `props = { variants: ChartVariant[]; value: string; onChange: (id: string) => void }`. Render a `role="radiogroup"` of radio inputs, one per `variant` (`label` as text, `id` as value), the one matching `value` checked, calling `onChange(variant.id)` on change. No data fetching, no `useQuery`, no storage. Style with Tailwind consistent with the existing header (compact, inline in the shell). All labels in English.

### Phase 2: Shell + retirement

- [x] **Task 5: `SessionCharts` becomes the shell** (depends on Tasks 3, 4)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`
  Reduce to: `const [selectedId, setSelectedId] = useState(DEFAULT_VARIANT_ID)`; render the header (`ModuleBadge`, `sessionTitle`, `formatDate`, `formatDuration`, difficulty) + `<VariantSelector variants={CHART_VARIANTS} value={selectedId} onChange={setSelectedId} />` + `const V = CHART_VARIANTS.find(v => v.id === selectedId)!; return <V.Component session={session} key={\`${session.id}:${selectedId}\`} />`.
  REMOVE from this file: `useBiometricWindowedBase`, `useBiometricChunks`, `useBiometricAggregate` usage; the `Overlay` type + `overlay`/`overlayRef` state and its reset effect; `handleDataZoom`, `requestWindowChunks`, `zoomRef`, and the `base`/`detail`/`samples` derivation; the header `Loading…` indicator (moved into the variant in Task 2); imports of `computeSpanSec`/`shouldUseRaw`/`quantizeWindow`/`computeBucketSec` and `BiometricEChartBody`/`useChartInstructions`/`EMPTY_INSTRUCTIONS` (now owned by the variant). Keep `key={selectedSession.id}` in `index.tsx` as-is (the inner `key` adds variant remount on top).

- [x] **Task 6: Retire the zoom-driven overlay code** (depends on Task 5)
  Files: `src/pages/SessionsPage/useBiometricWindowedBase.ts`, `src/pages/SessionsPage/useBiometricChunks.ts`, `src/pages/SessionsPage/useBiometricAggregate.ts`, `src/pages/SessionsPage/bucketPolicy.ts`
  Delete `useBiometricWindowedBase.ts` (superseded by `makeWindowedVariant`), `useBiometricChunks.ts` (raw path now lives in `rawVariant`), and `useBiometricAggregate.ts` (overlay retired) — after confirming no remaining importers via grep. In `bucketPolicy.ts` remove exports that become unreferenced (`shouldUseRaw`, `computeSpanSec`, `RAW_SPAN_LIMIT_ENTER`, `RAW_SPAN_LIMIT_EXIT`, and `quantizeWindow` if unused), keeping `computeBucketSec`, `snapUp`, `TARGET_BUCKETS`, `BUCKET_LADDER` (still used to size the min/max `bucketSec` and align windows). `deriveView.ts` stays untouched. Do not remove anything still referenced — verify with grep before deleting each symbol.

- [x] **Task 7: Verify build integrity** (depends on Task 6)
  Files: — (no edits; fix any fallout in the files above)
  Run `npm run typecheck` and `npm run lint`; resolve any dangling imports or unused-symbol errors introduced by the retirement. Expected behavior: two radios (Raw, Min/max); `minmax` default renders as today (progressive, coarse min/max, full session); Raw shows full-resolution progressive (first window immediately, decimated draw); switching radios remounts cleanly; no zoom-driven resolution change.

## Commit Plan
- **Commit 1** (after tasks 1-4): "Add chart-variant registry, windowed-variant factory and radio selector"
- **Commit 2** (after tasks 5-7): "Switch SessionCharts to variant shell and retire zoom-driven overlay"
</content>
</invoke>
