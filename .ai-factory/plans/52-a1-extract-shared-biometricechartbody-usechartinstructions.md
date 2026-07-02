# Plan: (A1) Extract shared `BiometricEChartBody` + `useChartInstructions`

## Context
Lift the variant-agnostic chart renderer out of `SessionCharts.tsx` into a reusable hook (`useChartInstructions`) and a presentational component (`BiometricEChartBody`), so Phase 22 variants can share the chart-body machinery. Pure refactor — identical behavior and DOM.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Extract the reusable pieces

- [x] **Task 1: Extract `useChartInstructions(session)` hook**
  Files: `src/pages/SessionsPage/useChartInstructions.ts` (new)
  Move the existing `instructionsQuery` out of `SessionCharts.tsx:47-51` into a new hook `useChartInstructions(session: SessionRun)` that runs `useQuery({ queryKey: ['session-instructions', session.id], queryFn: () => apiFetch<InstructionDto[]>('/sessions/runs/${session.id}/instructions') })` and returns the query object. Preserve the no-time-window rationale comment (`SessionCharts.tsx:42-46`) verbatim above the query. Import `useQuery`, `apiFetch`, and the `SessionRun`/`InstructionDto` types. Do not change the query key, path, or options — identical fetch behavior.

- [x] **Task 2: Create presentational `BiometricEChartBody` component** (depends on Task 1)
  Files: `src/pages/SessionsPage/BiometricEChartBody.tsx` (new)
  Create a presentational component owning the variant-agnostic renderer. Props:
  `{ startedAt: string; endedAt: string; instructions: InstructionDto[]; instructionsQuery: { isPending: boolean; isError: boolean }; samples: BioSampleDto[]; baseProgress: BaseProgressLike; zoomRef: React.MutableRefObject<{ start: number; end: number }>; onDataZoom?: (params: unknown) => void }`.

  **`zoomRef` ownership (per plan review #1):** `zoomRef` is written by `handleDataZoom`, which stays in the parent, so it MUST remain declared in `SessionCharts` and be passed **into** this component as the `zoomRef` prop — do NOT declare a new `zoomRef` here. The child only *reads* `zoomRef.current` inside the option memo at rebuild time. Declaring a separate ref here would decouple the parent's write from the child's read and snap the chart back to full range on every full rebuild — a behavior break. Only `prevSignatureRef` (used solely by the memo/`notMerge`/write-effect) is created and owned inside this component.

  Move these blocks out of `SessionCharts.tsx` **verbatim** (behavior/DOM identical):
  - the `prevSignatureRef` (`:94`) ref — created and owned here;
  - the `useMemo(buildSessionChartOption(instructions, samples, startedAt, endedAt, zoomRef.current))` → `{ option, height, gridCount, structureSignature }` (`:187-200`), reading `zoomRef.current` (the prop) and keeping the two `eslint-disable react-hooks/refs`/dep-array notes so `zoomRef` is read at rebuild time without being a memo dep;
  - the soft-instructions-error `useEffect` calling `logger.warn(...)` (`:204-208`), driven by `instructionsQuery.isError`;
  - the `deriveView(baseProgress, instructionsQuery, gridCount)` call (`:212-221`) — pass `baseProgress` straight through as the `BaseProgressLike` argument;
  - the `notMerge = prevSignatureRef.current !== structureSignature` computation (`:226`) and the `prevSignatureRef` write `useEffect` (`:231-233`), keeping the StrictMode/effect-write rationale comments;
  - a `const events = useMemo(() => (onDataZoom ? { datazoom: onDataZoom } : {}), [onDataZoom])` memo wrapping the passed `onDataZoom` (replacing `:165`);
  - the body render switch `loading | error | empty | <EChart>` (`:258-270`) — the outer scrolling `<div className="flex-1 overflow-y-auto px-6 py-4">` wrapper (`:257`) moves into this component; `<EChart>` receives `option`, `style={{ height, width: '100%' }}`, `notMerge`, and `onEvents={events}`.
  Import `useRef`, `useMemo`, `useEffect` from react; `EChart`, `SkeletonLoader`, `logger`; `buildSessionChartOption`, `deriveView` + `BaseProgressLike`; and `InstructionDto`/`BioSampleDto` types. Do NOT move the header or the "Loading…" hint, and do NOT change `deriveView` or `buildSessionChartOption` (A2 territory).

- [x] **Task 3: Rewire `SessionCharts` to consume the extracted pieces** (depends on Tasks 1-2)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`
  Replace the inline `instructionsQuery` with `const instructionsQuery = useChartInstructions(session)`. Delete only the code moved in Task 2 — the `prevSignatureRef` ref, the option `useMemo`, the instructions-error effect, the `deriveView`/`view` call, the `notMerge` line, the `prevSignatureRef` write effect, and the `events` memo. **Keep the `zoomRef` declaration at `:91` in the parent** (per plan review #1 — `handleDataZoom` writes it, the child reads it via prop); do NOT delete `zoomRef`. Keep all data wiring intact: `useBiometricWindowedBase`, overlay state + `overlayRef` + reset effect, `useBiometricChunks`, `useBiometricAggregate`, `requestWindowChunks`, `handleDataZoom`, and the `base`/`detail`/`samples` derivation. Keep the header block (`:238-254`) including the `Loading…` hint unchanged.

  **Stable `instructions` reference (per plan review #2):** add a module-level `const EMPTY_INSTRUCTIONS: InstructionDto[] = []` and pass `instructions={instructionsQuery.data ?? EMPTY_INSTRUCTIONS}` so the prop reference is stable while instructions are pending — otherwise a fresh `[]` literal per render would re-run the child option memo during the loading window. This keeps `InstructionDto` imported in the parent.

  In the returned JSX, keep the outer `<div className="flex h-full flex-col">` + header, then render:
  `<BiometricEChartBody startedAt={session.startedAt} endedAt={session.endedAt} instructions={instructionsQuery.data ?? EMPTY_INSTRUCTIONS} instructionsQuery={instructionsQuery} samples={detail ?? base} baseProgress={{ samples: baseLoader.samples, allAttempted: baseLoader.allAttempted, failedCount: baseLoader.failedCount, totalWindows: baseLoader.totalWindows }} zoomRef={zoomRef} onDataZoom={handleDataZoom} />`.
  Remove now-unused imports (`useMemo`, `EChart`, `SkeletonLoader`, `buildSessionChartOption`, `deriveView`, `useQuery`, `apiFetch`, `logger` — keep `InstructionDto` for `EMPTY_INSTRUCTIONS`, and keep `useRef` for `zoomRef`/`overlayRef`; keep any others still referenced). Run `npm run lint` and `npm run typecheck` to confirm green.
