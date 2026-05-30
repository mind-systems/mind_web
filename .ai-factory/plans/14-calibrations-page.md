# Plan: `/calibrations` page

## Context
Implement the NFB calibration history page at `/calibrations`: fetch paginated calibration records, group them by BCI device serial, and render a per-device ECharts line chart showing the evolution of individual alpha frequency and alpha peak power over calibration history.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Codebase Notes
- API contract (from `.ai-factory/notes/01-api-contract-decisions.md`): `GET /nfb-calibrations?deviceSerial=<optional>&limit=50&offset=0` → `{ records: NfbCalibrationRecordDto[], total: number }`, ordered `createdAt DESC`. Each record contains all 13 entity fields, including `deviceSerial`, `calibratedAt`, `isValid`, `failReason`, `individualFrequency`, `individualPeakFrequencyPower`.
- Follow existing `SessionsPage` patterns: page owns the query, sub-components receive shaped props (ARCHITECTURE rules). `useInfiniteQuery` offset pattern already used in `SessionsPage/index.tsx`.
- ECharts via `echarts-for-react` (`ReactECharts`), option built in a separate `chartOption.ts` builder (see `SessionsPage/chartOption.ts`); transforms isolated in `transforms.ts`; date formatting in a local `format.ts`.
- All HTTP via `apiFetch` from `@/core/api/client`. No raw `fetch`, no `localStorage` access. No cross-page imports — do not import `SessionsPage/format.ts`; create a local formatter instead.
- Page is already routed and protected in `src/router.tsx` (`/calibrations` → `CalibrationPage`). Current `CalibrationPage/index.tsx` is a stub to be replaced.

## Tasks

### Phase 1: Types & data shaping

- [x] **Task 1: Add calibration DTO types**
  Files: `src/core/types/index.ts`
  Add `NfbCalibrationRecord` interface mirroring the API entity fields used by the page: `id: string`, `deviceSerial: string`, `calibratedAt: string`, `isValid: boolean`, `failReason: string | null`, `individualFrequency: number`, `individualPeakFrequencyPower: number` (include the remaining numeric fields — `individualPeakFrequencySuppression`, `individualBandwidth`, `individualNormalizedPower`, `lowerFrequency`, `upperFrequency`, `userId`, `createdAt` — typed as `number`/`string` to match the contract). Add `NfbCalibrationsResponse { records: NfbCalibrationRecord[]; total: number }`.

- [x] **Task 2: Grouping + formatting helpers** (depends on Task 1)
  Files: `src/pages/CalibrationPage/transforms.ts`, `src/pages/CalibrationPage/format.ts`
  In `transforms.ts`: export `groupByDevice(records: NfbCalibrationRecord[]): { deviceSerial: string; records: NfbCalibrationRecord[]; validCount: number }[]`. Group by `deviceSerial`, and within each group sort records ascending by `calibratedAt` (the API returns them `createdAt DESC`, so the chart must reverse to chronological order). `validCount` = number of records with `isValid === true`. Preserve a stable device order (first-seen order from the input list).
  In `format.ts`: export `formatCalibrationDate(iso: string): string` producing a compact `DD MMM, HH:mm` label (local copy — do not import from `SessionsPage`).

### Phase 2: Chart

- [x] **Task 3: Calibration chart option builder** (depends on Task 2)
  Files: `src/pages/CalibrationPage/chartOption.ts`
  Export `buildCalibrationChartOption(records: NfbCalibrationRecord[]): EChartsOption`. Input is one device's records, already sorted chronologically (ascending). Build:
  - X-axis: `type: 'category'`, data = `records.map(r => formatCalibrationDate(r.calibratedAt))` in chronological order.
  - Two Y-axes (units differ greatly): left axis "Hz" for `individualFrequency`, right axis "Power" for `individualPeakFrequencyPower`. Each line bound to its own `yAxisIndex`. (Spec says "Y-axis: value" with two lines; dual axes keep both lines readable.)
  - Two `line` series: `individualFrequency` (Hz) and `individualPeakFrequencyPower` (power). For each, build data items as `{ value }` carrying per-point `itemStyle`/`symbol` so dot styling reflects that record's validity: valid → filled green dot (`symbol: 'circle'`, solid green fill); invalid → hollow red dot (red `borderColor`, transparent/white fill). Define color constants at the top of the file (e.g. `VALID_COLOR = '#5BAD6F'`, `INVALID_COLOR = '#E96F6F'`).
  - `tooltip` with `trigger: 'axis'` and a `formatter` that, via `dataIndex`, reads the source record and shows `calibratedAt` (formatted), `isValid`, and `failReason` (omit/placeholder line when `failReason` is null). The builder closes over the `records` array so the formatter can index into it.
  - Add a `legend` for the two line names.

- [x] **Task 4: Per-device chart component** (depends on Task 3)
  Files: `src/pages/CalibrationPage/CalibrationChart.tsx`
  Stateless component. Props: `{ deviceSerial: string; records: NfbCalibrationRecord[]; validCount: number }`. Renders a section: header row with the `deviceSerial` and a "valid / total" badge (`{validCount} / {records.length}`), followed by one `<ReactECharts>` built from `buildCalibrationChartOption(records)` with a fixed height (e.g. `style={{ height: 320, width: '100%' }}`, `notMerge`). Pure render — no data fetching.

### Phase 3: Page assembly

- [x] **Task 5: CalibrationPage with infinite scroll** (depends on Task 4)
  Files: `src/pages/CalibrationPage/index.tsx`
  Replace the stub. Use `useInfiniteQuery`:
  - `queryKey: ['nfb-calibrations']`, `queryFn: ({ pageParam }) => apiFetch<NfbCalibrationsResponse>(`/nfb-calibrations?limit=50&offset=${pageParam}`)`, `initialPageParam: 0`.
  - `getNextPageParam`: sum loaded `records.length` across pages; return that offset if `< total`, else `undefined` (same shape as `SessionsPage`).
  - Flatten `data.pages.flatMap(p => p.records)`, then `groupByDevice(...)`.
  - Layout: full-height page (`flex h-screen flex-col overflow-hidden`) with a header bar ("Calibrations" title + "Log out" button calling `useAuth().logout`, consistent with `SessionsPage`) and a scrollable body. Render one `<CalibrationChart>` per device group.
  - Infinite scroll: place a sentinel `<div>` at the bottom of the scroll container and observe it with an `IntersectionObserver` (in a `useEffect`/`useRef`) to call `fetchNextPage()` when it enters view and `hasNextPage && !isFetchingNextPage`. Show a small "Loading…" indicator while `isFetchingNextPage`.
  - States: `isLoading` → `<SkeletonLoader />`; query `isError` → inline error message (`text-red-500`); empty (no records after load) → centered "No calibrations recorded yet".

## Commit Plan
- **Commit 1** (after tasks 1-2): "Add NFB calibration types and grouping helpers"
- **Commit 2** (after tasks 3-4): "Build calibration chart option and per-device chart component"
- **Commit 3** (after task 5): "Implement calibrations page with grouped charts and infinite scroll"
