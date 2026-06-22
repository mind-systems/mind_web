# A1 — Extract shared `BiometricEChartBody` + `useChartInstructions`

**Date:** 2026-06-22
**Source:** conversation context — Phase 22 pluggable chart variants; isolate the reusable renderer

## Key Findings

- `SessionCharts.tsx` (~274 lines) fuses six concerns: the instructions fetch, the base⊕overlay data-source wiring (`useBiometricWindowedBase` + `useBiometricChunks` + `useBiometricAggregate`), the zoom-driven resolution switch (`handleDataZoom`), the chart-body machinery (`buildSessionChartOption` + `structureSignature`/`notMerge` + `zoomRef`), `deriveView`, and the header. The variant testbed (Phase 22 A2+) needs the chart-body machinery reusable in isolation by every variant.
- The variant-agnostic renderer is everything *below* "which samples to show": given instructions + samples + loader progress, build the option, manage incremental-vs-full rebuild (note 30 signature), persist zoom, and render the loading/empty/error/`EChart` switch. This must be lifted out verbatim so all variants share it.

## Details

### Change
- **Extract `useChartInstructions(session)`** (`src/pages/SessionsPage/useChartInstructions.ts`): the existing `instructionsQuery` (`queryKey: ['session-instructions', id]`, no `from/to` window — the offset-axis rationale in `SessionCharts.tsx:42-46` stays in a comment). Returns the query object.
- **Extract presentational `BiometricEChartBody`** (`src/pages/SessionsPage/BiometricEChartBody.tsx`). Props: `{ startedAt: string; endedAt: string; instructions: InstructionDto[]; instructionsQuery: { isPending: boolean; isError: boolean }; samples: BioSampleDto[]; baseProgress: BaseProgressLike; onDataZoom?: (params: unknown) => void }`. It owns: the `useMemo(buildSessionChartOption(...))` → `{ option, height, gridCount, structureSignature }`; the `zoomRef` + `prevSignatureRef` + `notMerge` logic (read-ref-at-rebuild, effect-write of `prevSignatureRef` for StrictMode); the `deriveView(baseProgress, instructionsQuery, gridCount)` call; the `events` memo wrapping `onDataZoom`; and the `loading | error | empty | <EChart>` body render switch.
- **`SessionCharts` keeps all data wiring** (windowed base, chunks, aggregate overlay, `handleDataZoom`) and the header unchanged; it now renders `<BiometricEChartBody startedAt endedAt instructions={instructionsQuery.data ?? []} instructionsQuery={instructionsQuery} samples={detail ?? base} baseProgress={…} onDataZoom={handleDataZoom} />`.

### Guards / boundary
- **PURE REFACTOR** — identical behavior and DOM. Keep `zoomRef`-read-at-rebuild (no memo dep on zoom), the effect-write of `prevSignatureRef`, `notMerge` semantics, and the soft-instructions-error `logger.warn`.
- Do **not** move the header or the "Loading…" hint yet — that is A2 (the hint is variant-specific and moves into the variant then).
- Do **not** change `deriveView` or `chartOption`. `logger` facade only; no raw storage.

### Verify
- Lint/typecheck green. A session renders byte-identical: skeleton → chart, and the existing zoom→raw/agg switch still works (because `SessionCharts` still owns `handleDataZoom`, now passed via `onDataZoom`).

## Open Questions
- Whether the loading hint should already move into the body — deferred to A2 where the header splits shell vs variant.
</content>
</invoke>
