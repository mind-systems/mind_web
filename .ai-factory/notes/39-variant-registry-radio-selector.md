# A2 — Variant registry + flat radio selector + raw & min/max variants

**Date:** 2026-06-22
**Source:** conversation context — flat one-radio-per-algorithm testbed; pluggable renderer

## Key Findings

- After A1 the chart body (`BiometricEChartBody`) is reusable. The user's settled mental model: a **flat list of radio buttons, one per representation algorithm**, all flowing through **one API layer** (the aggregation endpoint parameterized by `bucketSec` + `agg`) — from raw → min/max → smoothing algos — and the architecture must let an entirely different chart *renderer* (e.g. lightweight-charts) be just another radio with the whole UI rebuilding around it.
- Therefore a **variant = a self-contained component** `{ id, label, Component<{ session }> }` that owns its own data loading and rendering. **Component-per-variant, not hook-per-variant**, is required by Rules of Hooks: switching the radio remounts the subtree (`key` = variant id), so each variant's hooks always run unconditionally inside its own tree. The min/max + smoothing variants share ONE parameterized component (windowed loader + shared body, differing only by `buildPath`); a future renderer swap is a different `Component`.

## Details

### Change
- **`src/pages/SessionsPage/chartVariants/types.ts`** — `export interface ChartVariant { id: string; label: string; Component: React.ComponentType<{ session: SessionRun }> }`.
- **`makeWindowedVariant({ id, label, windowSec, buildPath })`** (`chartVariants/makeWindowedVariant.tsx`) — returns a `ChartVariant` whose `Component`: (a) memoizes `buildPath`, (b) `useBiometricWindows(session, { windowSec, buildPath })`, (c) auto-enqueues ALL windows on mount (`requestWindows([0..totalWindows-1])` — the `useBiometricWindowedBase` pattern, generalized), (d) renders `<BiometricEChartBody>` fed by `useChartInstructions(session)` + the loader's `samples` / progress (`allAttempted`/`failedCount`/`totalWindows`), showing the "Loading…" hint from `loader.isLoading`. `windowSec`/`buildPath` are computed per entry.
- **`chartVariants/registry.ts`** — `CHART_VARIANTS: ChartVariant[] = [ rawVariant, minmaxVariant ]` and `DEFAULT_VARIANT_ID = 'minmax'`.
  - `rawVariant = makeWindowedVariant({ id: 'raw', label: 'Raw', windowSec: 30, buildPath: (f,t) => '/sessions/runs/${id}/biometrics?from=…&to=…' })`.
  - `minmaxVariant = makeWindowedVariant({ id: 'minmax', label: 'Min/max', windowSec: <~8 bucket-aligned, as useBiometricWindowedBase>, buildPath: …&bucketSec=N })`. (avg/lttb radios are appended by mind_api Phase 50 — one line each.)
- **`VariantSelector.tsx`** — presentational radio group (`role="radiogroup"`) over `CHART_VARIANTS`, `value = selectedId`, `onChange`. Receives data as props (no `useQuery` — shared-component rule).
- **`SessionCharts` → shell**: `useState(selectedId, default 'minmax')`; header (badge/title/date/difficulty) + `<VariantSelector variants={CHART_VARIANTS} value={selectedId} onChange={…} />` + `const V = CHART_VARIANTS.find(v => v.id === selectedId)!; <V.Component session={session} key={`${session.id}:${selectedId}`} />`. The loading hint moves out of the header into the variant. The `key` remounts cleanly on both session and variant switch.

### Retire the zoom-driven resolution switch (explicit decision)
- Representation is now **user-selected, not zoom-derived**. Remove from the page: `useBiometricAggregate` usage, the `handleDataZoom` raw/agg overlay logic, and the `Overlay` state. The deep-zoom-to-raw need is served by the explicit **Raw** radio; uniform per-variant representation is what makes the algorithms comparable (a min/max chart that silently switched to raw on zoom would break the comparison).
- `useBiometricWindowedBase` is superseded by `makeWindowedVariant`'s aggregated config (fold/delete). `bucketPolicy.computeBucketSec`/`snapUp`/`quantizeWindow` stay (still size the aggregated `bucketSec` and align windows); `shouldUseRaw` + the overlay quantize path are no longer used by the page.

### Guards / boundary
- Default `minmax` preserves perceived behavior (coarse min/max, full session, progressive). **Phase-19 decimation** (`sampling`/`large`/`progressive` in `buildLineSeriesEntry`) stays — mandatory on the Raw variant (`motion` ≈95 %).
- `deriveView` unchanged (A1). Each variant calls its hooks unconditionally (remount on switch — never a conditional hook). **No `localStorage`** for the selection (storage rule) — `useState` only. Shared components receive data as props.

### Verify
- Two radios (Raw, Min/max). Min/max default renders as today (progressive, coarse). Raw shows full-resolution progressive (first window immediately, decimated draw). Switching remounts cleanly. No zoom-driven resolution change.

## Open Questions
- Persist selection in the URL (`?chart=raw`) later — deferred (router coupling; testbed resets on nav are fine).
- Whether to delete `useBiometricAggregate` / `useBiometricWindowedBase` files or keep them dormant — implementation choice.
</content>
