# Plan: Session charts panel (right panel) — ECharts multi-grid

## Context
Render the right panel of `SessionsPage` for `/sessions/:id`: fetch the selected session's instructions and biometrics in parallel and display a single ECharts instance with up to 4 vertically-stacked, X-axis-linked grids (instruction phases, heart rate, EEG bands, emotions), plus a panel header with formatted date and total duration.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Types & data transforms

- [x] **Task 1: Add session-detail DTO and view-model types**
  Files: `src/core/types/index.ts`
  Append types mirroring the API response shapes from `notes/04-echarts-session-charts.md`:
  - `InstructionDto { timestamp: string; type: string; payload: { phase?: 'inhale' | 'hold' | 'exhale' | 'rest'; durationMs?: number } & Record<string, unknown> }`.
  - `BioSampleDto { timestamp: string; sampleType: string; data: Record<string, number | boolean | string> }` (sampleType is `'cardio' | 'nfb' | 'emotions'` among others; keep `data` permissive since `heartRate`, `delta/theta/alpha/smr/beta`, `attention/relaxation/cognitiveLoad/cognitiveControl/selfControl` are numbers).
  - `BreathPhase = 'inhale' | 'hold' | 'exhale' | 'rest'` and `PhaseBar { startSec: number; endSec: number; phase: BreathPhase }`.
  Do not alter existing `SessionRun` / `ListRunsResponse` types.

- [x] **Task 2: Implement data transforms** (depends on Task 1)
  Files: `src/pages/SessionsPage/transforms.ts`
  Pure helpers, exactly per the spec in `notes/04-echarts-session-charts.md` ("Data transforms" section):
  - `secFromStart(ts: string, startedAt: string): number` — `(Date(ts) - Date(startedAt)) / 1000`.
  - `parsePhases(instructions: InstructionDto[], startedAt: string, endedAt: string): PhaseBar[]` — filter `type === 'breath_phase'`, each bar starts at its timestamp and ends at the next breath_phase timestamp (last one ends at `endedAt`). Ignore `session_event` and any non-`breath_phase` type.
  - `toSeries(samples: BioSampleDto[], sampleType: string, field: string): [number, number][]` — filter by `sampleType`, map to `[secFromStart(...), data[field]]`. Used to derive heart rate, the five EEG bands, and the five emotion metrics.
  Keep these framework-free (no ECharts/React imports) so they stay easy to reason about.

### Phase 2: Chart option builder

- [x] **Task 3: Implement the dynamic ECharts option builder** (depends on Task 2)
  Files: `src/pages/SessionsPage/chartOption.ts`
  Export `PHASE_COLORS` and `buildSessionChartOption(instructions: InstructionDto[], biometrics: BioSampleDto[], startedAt: string, endedAt: string): EChartsOption` following the "ECharts option skeleton" in `notes/04-echarts-session-charts.md`:
  - Compute `phases`, `heartRate`, the EEG band series (`delta/theta/alpha/smr/beta`), and emotion series via the Task 2 transforms.
  - Derive `hasHeartRate`, `hasEeg`, `hasEmotions` from non-empty data and assign grid indices dynamically (`INSTRUCTION_GRID` always present; HR/EEG/EMOT only when their data exists). Omit any grid/xAxis/yAxis/series whose sample type produced zero points.
  - Build stacked `grid` layout (instruction grid ~80px, each data grid ~160px, 20px gaps, `left: 60, right: 20`, `top` starting at 50 for the header).
  - X-axes are `type: 'value'`, `min: 0`, `max: durationSec`; only the bottom-most grid shows axis labels formatted as `${Math.round(v)}s`.
  - Link all X-axes via `dataZoom` (`inside` + `slider` at the bottom) over all axis indices and `axisPointer.link: [{ xAxisIndex: 'all' }]` with `type: 'cross'`.
  - Instruction phases use a `type: 'custom'` series with the `renderItem` rect from the spec, colored by `PHASE_COLORS[phase]`. EEG and emotions use `scale: true` Y-axes (no fixed min/max).
  - Keep `yAxisIndex` in 1:1 correspondence with the dynamically-assigned grid indices, per the spec's "Note on yAxisIndex".
  Type the return as `EChartsOption` imported from `echarts`; use `as const` on `type` literals where TS narrowing requires it.

### Phase 3: Panel component & page wiring

- [x] **Task 4: Build the presentational charts panel** (depends on Task 3)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`
  Pure render component (no data fetching — receives data as props, per ARCHITECTURE dependency rules). Props: `{ session: SessionRun; instructions: InstructionDto[]; biometrics: BioSampleDto[]; isLoading: boolean; isError: boolean }`.
  - Header: `formatSessionDate(session.startedAt)` + `formatDuration(session.durationSeconds)` (reuse `./format`).
  - While `isLoading`: render `<SkeletonLoader />`. On `isError`: render an inline error message (plain styled `div`, since no shared `ErrorMessage` component exists yet — keep it minimal and consistent with existing Tailwind styling).
  - Otherwise call `buildSessionChartOption(...)` and render `<ReactECharts>` (default import from `echarts-for-react`) with `style={{ height: <computed from active grids>, width: '100%' }}` and `notMerge`. Compute height from the number of active grids so the panel sizes to content.
  - If both `instructions` and `biometrics` are empty, show a "No data for this session" empty state.

- [x] **Task 5: Wire parallel queries into SessionsPage and render the panel** (depends on Task 4)
  Files: `src/pages/SessionsPage/index.tsx`
  - Resolve the selected `SessionRun` for `id` from the already-loaded `sessions` array (the page owns all data fetching; queries cannot live in the component). If the id is not among loaded pages, treat `selectedSession` as undefined and render the existing "Select a session" / loading fallback — note this MVP limitation in a code comment (deep-linking to a not-yet-loaded session is out of scope for this milestone).
  - Add two `useQuery` calls keyed `['session-instructions', id]` and `['session-biometrics', id]`, each `enabled: !!selectedSession`, calling `apiFetch<InstructionDto[]>` / `apiFetch<BioSampleDto[]>` with `?from=${startedAt}&to=${endedAt}` (URL-encode the ISO values). React Query runs them in parallel automatically.
  - Replace the `{/* session charts — next milestone */}` placeholder: when `selectedSession` exists, render `<SessionCharts session={selectedSession} instructions={...} biometrics={...} isLoading={instructionsLoading || biometricsLoading} isError={instructionsError || biometricsError} />`. Keep the empty "Select a session" state when no id.
  - Do not introduce raw `fetch` or `localStorage` access; all HTTP stays through `apiFetch`.

## Commit Plan
- **Commit 1** (after tasks 1-3): "Add session-detail types, transforms, and ECharts option builder"
- **Commit 2** (after tasks 4-5): "Render session charts panel with parallel instruction and biometric queries"
