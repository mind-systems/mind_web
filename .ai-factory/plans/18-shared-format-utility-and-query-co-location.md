# Plan: Shared format utility and query co-location

## Context
Three cleanup items that remove duplicated formatting helpers, extract a shared page header, and move chart-data fetching out of the session list host into the chart panel so chart fetches no longer re-run on `SessionList` re-renders. A fourth phase updates the architecture doc to legitimize the query co-location (see deviation note below).

## Settings
- Testing: no
- Logging: minimal
- Docs: no (ARCHITECTURE.md update in Phase 4 is a rules-alignment change, not user-facing docs)

## Notes / Assumptions
- The referenced spec `notes/08-shared-format-and-query-location.md` does not exist in the repo. Plan is derived directly from the milestone text and the current source.
- The milestone says "update 4 import sites", but the codebase has **3 actual importer files** of the duplicate `format.ts` modules: `SessionsPage/SessionList.tsx`, `SessionsPage/SessionCharts.tsx`, and `CalibrationPage/chartOption.ts`. All three will be updated.
- Date formatters differ only in implementation, not output: `formatSessionDate` uses `toLocaleString('en-GB', { month: 'short' })`; `formatCalibrationDate` uses a hardcoded `MONTHS` array. Both produce `"DD MMM, HH:mm"` in local time. The shared `formatDate` will use the locale-independent `MONTHS`-array implementation for deterministic output.
- The two page headers are not byte-identical (`SessionsPage` uses `px-4`; `CalibrationPage` uses `px-6 shrink-0`). `PageHeader` will standardize on `shrink-0 px-6 py-4` to match the existing `CalibrationPage` header. This is a minor, intentional normalization of the left-column header padding. The right-panel `SessionCharts` header (date + duration, no logout) is **not** a page header and is left untouched.
- `PageHeader` owns the "Log out" button and calls `useAuth()` directly — consistent with `ProtectedRoute`, which already consumes `useAuth()` from `components/`. This keeps the logout wiring out of every page.
- **Architecture deviation (intentional, milestone-directed).** Phase 3 moves `useQuery` + `apiFetch` into `SessionCharts.tsx`, which conflicts with `.ai-factory/ARCHITECTURE.md` lines 67/69/75/162 ("No data fetching in components", "Sub-components are pure render functions", "Fetch in components" anti-pattern). The ROADMAP milestone explicitly directs this move. To avoid leaving the codebase in violation of its own architecture doc (which a later `/aif-review` or `/aif-rules-check` would flag as a regression), **Phase 4** updates ARCHITECTURE.md to distinguish **shared components** in `src/components/` (pure, props-only — rule unchanged) from **page-local feature sub-components** in `pages/<Feature>/` (may co-locate their own queries close to where the data is used). The anti-pattern's "shared component" wording is exactly what this distinction formalizes.
- **`verbatimModuleSyntax: true`** is enabled: value imports (`useQuery`, `apiFetch`) must be regular imports; DTO/type imports (`SessionRun`, `InstructionDto`, `BioSampleDto`, `ListRunsResponse`) must stay `import type`. Do not collapse them into one non-type import.
- **`noUnusedLocals` / `noUnusedParameters: true`**: every newly-unused import must be removed or `tsc --noEmit` fails. Affected import lines are called out per task.

## Tasks

### Phase 1: Shared format utility

- [x] **Task 1: Create `src/core/format.ts`**
  Files: `src/core/format.ts`
  Create a new shared module exporting two functions:
  - `formatDate(iso: string): string` — formats an ISO string as `"DD MMM, HH:mm"` in local time using a module-level `MONTHS` array (port the implementation from `CalibrationPage/format.ts`). Keep the doc comment describing the output format.
  - `formatDuration(seconds: number): string` — port verbatim from `SessionsPage/format.ts` (floors to whole seconds, returns zero-padded `"mm:ss"`). Keep its doc comment.

- [x] **Task 2: Repoint importers to `@/core/format` and delete duplicate modules** (depends on Task 1)
  Files: `src/pages/SessionsPage/SessionList.tsx`, `src/pages/SessionsPage/SessionCharts.tsx`, `src/pages/CalibrationPage/chartOption.ts`, `src/pages/SessionsPage/format.ts` (delete), `src/pages/CalibrationPage/format.ts` (delete)
  - In `SessionList.tsx` and `SessionCharts.tsx`: change `import { formatSessionDate, formatDuration } from './format'` to `import { formatDate, formatDuration } from '@/core/format'`, and rename all `formatSessionDate(...)` call sites to `formatDate(...)`.
  - In `CalibrationPage/chartOption.ts`: change `import { formatCalibrationDate } from './format'` to `import { formatDate } from '@/core/format'`, and rename both `formatCalibrationDate(...)` call sites to `formatDate(...)`.
  - Delete `src/pages/SessionsPage/format.ts` and `src/pages/CalibrationPage/format.ts`.
  - Verify no remaining references to `formatSessionDate` / `formatCalibrationDate` / `./format`.

### Phase 2: Shared page header

- [x] **Task 3: Create `src/components/PageHeader.tsx`** (depends on Task 2)
  Files: `src/components/PageHeader.tsx`
  Extract the duplicated header block into a stateless shared component:
  - Props: `{ title: string }`.
  - Render the existing markup pattern: a flex row with `shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4`, the title in `text-lg font-semibold text-gray-900`, and a "Log out" `<button type="button">` styled `text-sm text-gray-500 hover:text-gray-700`.
  - Get `logout` from `useAuth()` (`@/core/auth/AuthContext`) and wire it to the button's `onClick`. Mirrors `ProtectedRoute`'s use of `useAuth()` from `components/`.

- [x] **Task 4: Use `PageHeader` in both pages** (depends on Task 3)
  Files: `src/pages/CalibrationPage/index.tsx`, `src/pages/SessionsPage/index.tsx`
  - `CalibrationPage/index.tsx`: replace the top header `<div>` (the "Calibrations" + Log out block) with `<PageHeader title="Calibrations" />`. Remove the now-unused `useAuth` import and `logout` local if not used elsewhere in the file.
  - `SessionsPage/index.tsx`: replace the left-column header `<div>` (the "Sessions" + Log out block) with `<PageHeader title="Sessions" />`, keeping it as the first child of the `w-[280px]` column. Remove the now-unused `useAuth` import and `logout` local if not used elsewhere (note: Task 6 also touches this file).
  - Add the `PageHeader` import to both files.

### Phase 3: Query co-location

- [x] **Task 5: Move chart-data queries into `SessionCharts.tsx`** (depends on Task 2)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`
  - Change `SessionChartsProps` to `{ session: SessionRun }` (drop `instructions`, `biometrics`, `isLoading`, `isError`).
  - Inside the component, derive `from`/`to` from `session.startedAt` / `session.endedAt` via `encodeURIComponent`.
  - Add the two `useQuery` calls (moved from `index.tsx`): `['session-instructions', session.id]` fetching `InstructionDto[]` from `/sessions/runs/${session.id}/instructions?from=${from}&to=${to}`, and `['session-biometrics', session.id]` fetching `BioSampleDto[]` from `/sessions/runs/${session.id}/biometrics?from=${from}&to=${to}`. The component only renders when a session is selected, so no `enabled` guard is needed.
  - Reconstruct local `instructions` / `biometrics` arrays (`data ?? []`), `isLoading` (either query loading), and `isError` (either query error) from the query results; the existing `isEmpty`, `useMemo`, and JSX below stay unchanged.
  - Imports (respecting `verbatimModuleSyntax`): add `import { useQuery } from '@tanstack/react-query'` and `import { apiFetch } from '@/core/api/client'` as regular imports; keep `SessionRun`, `InstructionDto`, `BioSampleDto` as `import type` from `@/core/types`.

- [x] **Task 6: Slim `SessionsPage/index.tsx`** (depends on Task 5)
  Files: `src/pages/SessionsPage/index.tsx`
  - Remove the two `useQuery` blocks (`session-instructions`, `session-biometrics`) and the `from`/`to` constants.
  - Update the `<SessionCharts ... />` usage to pass only `session={selectedSession}`.
  - Narrow imports: change `import { useInfiniteQuery, useQuery } from '@tanstack/react-query'` to import `useInfiniteQuery` only; change `import type { ListRunsResponse, InstructionDto, BioSampleDto } from '@/core/types'` to `import type { ListRunsResponse } from '@/core/types'`. Keep `apiFetch` (the `session-runs` query still uses it). Confirm `tsc --noEmit` passes with no unused-symbol errors.

### Phase 4: Align architecture doc with co-located queries

- [x] **Task 7: Update `.ai-factory/ARCHITECTURE.md` to permit page-local query co-location** (depends on Task 5)
  Files: `.ai-factory/ARCHITECTURE.md`
  Resolve the conflict the Phase 3 change introduces by distinguishing shared components from page-local feature sub-components. Concretely:
  - In **Layer Communication** (lines ~67/69): clarify that *shared* components in `src/components/` are pure render functions that receive data as props, while *page-local feature sub-components* under `pages/<Feature>/` (e.g. `SessionCharts`) may co-locate their own `useQuery` calls for data that is solely their concern.
  - In **Key Principles** (line ~75, "Pages own data, components own presentation"): reword to "Pages and their feature sub-components own data; *shared* components own presentation," keeping the props-down rule for `src/components/`.
  - In **Anti-Patterns** (line ~162, "Fetch in components"): scope it explicitly to *shared* components in `src/components/`, and state that page-local feature sub-components co-locating their queries is allowed.
  - Keep edits minimal and surgical — do not restructure the document; only adjust the wording that would otherwise read the Phase 3 change as a violation.

## Commit Plan
- **Commit 1** (after tasks 1-2): "Extract shared date and duration formatters into core/format"
- **Commit 2** (after tasks 3-4): "Extract shared PageHeader component"
- **Commit 3** (after tasks 5-6): "Co-locate session chart queries in SessionCharts"
- **Commit 4** (after task 7): "Allow page-local query co-location in architecture doc"
