# Plan Review: Shared format utility and query co-location

**Plan:** `18-shared-format-utility-and-query-co-location.md`
**Files cross-checked:** 9
**Risk Level:** 🟡 Medium (one architecture-doc conflict the plan does not address)

## Verification of plan assumptions

All concrete codebase claims in the plan were checked against source and hold true:

- ✅ **3 importer files** of the duplicate `format.ts` modules confirmed: `SessionsPage/SessionList.tsx`, `SessionsPage/SessionCharts.tsx`, `CalibrationPage/chartOption.ts`. The ROADMAP milestone's "4 import sites" is reconciled correctly (it counts import *statements* loosely; there are 3 files / 3 import statements). `formatSessionDate` is used in 2 files, `formatCalibrationDate` in 1 file (2 call sites in `chartOption.ts`). No other references exist.
- ✅ **Date formatters produce identical output.** `formatSessionDate` uses `toLocaleString('en-GB', { month: 'short' })`, which yields the same `Jan…Dec` abbreviations as the hardcoded `MONTHS` array (including `May`, `Sep`). Choosing the locale-independent `MONTHS` implementation for `formatDate` is sound and removes a locale dependency. Both originals operate in local time and emit `"DD MMM, HH:mm"`.
- ✅ **`formatDuration`** is byte-identical to port (floors to whole seconds, zero-padded `mm:ss`).
- ✅ **`@/` path alias** resolves in both `tsconfig.app.json` (`paths: { "@/*": ["src/*"] }`) and `vite.config.ts`. `@/core/format` will resolve.
- ✅ **`useAuth()` exposes `logout`** (`AuthContextValue.logout(): void`), and `ProtectedRoute` already consumes `useAuth()` from `components/` — so `PageHeader` doing the same is consistent.
- ✅ **Header markup** matches: `CalibrationPage` header is `shrink-0 …px-6 py-4`; `SessionsPage` left header is `…px-4 py-4` (no `shrink-0`). The plan's normalization to `shrink-0 px-6 py-4` is correctly documented as intentional, and it does not touch the *right-panel* `SessionCharts` header (date + duration, no logout) — that header is correctly left alone.
- ✅ **Phase 3 query move** is mechanically correct. `SessionCharts` is rendered only inside the `selectedSession ?` branch with no `key` prop, so on session change React keeps the instance and the `useQuery` keys (`session.id`) update → refetch — behavior preserved. Dropping `enabled` is safe because the component only mounts when a session exists. `from`/`to` derivation via `encodeURIComponent(session.startedAt/endedAt)` mirrors the existing host code.
- ✅ **Spec file** `notes/08-shared-format-and-query-location.md` indeed does not exist; the plan correctly notes it derived from milestone text + source.

## Context Gates

### Architecture gate — ⚠️ WARN (must address before implementing)

`Phase 3 / Task 5` moves `useQuery` + `apiFetch` **into `SessionCharts.tsx`**, directly contradicting documented rules in `.ai-factory/ARCHITECTURE.md`:

- Line 67: *"Data fetching: pages use React Query `useQuery` hooks that call `apiFetch`. **No data fetching in components.**"*
- Line 69: *"Props down: pages pass pre-fetched data to chart/timeline sub-components as typed props. **Sub-components are pure render functions.**"*
- Line 75: *"Pages own data, components own presentation."*
- Line 162 (anti-pattern): *"❌ **Fetch in components** — calling `apiFetch` or `useQuery` inside a shared component. Data flows down as props; only pages initiate fetches."*

This is a genuine, authorized tension — the ROADMAP milestone explicitly directs the move ("Move the instructions and biometrics `useQuery` calls … into `SessionCharts.tsx`; `SessionChartsProps` shrinks to `{ session: SessionRun }`"). So the plan faithfully implements the milestone. **The problem is the plan is silent about the conflict.** As written, implementation will leave the codebase violating its own ARCHITECTURE.md, which a later `/aif-review` or `/aif-rules-check` will flag as a regression.

One could argue line 162's "shared component" only targets `src/components/`, and `SessionCharts` is a page-local sub-component — but lines 67/69/75 state the broader "sub-components are pure render functions" principle that this change breaks. The ambiguity is exactly why it should be resolved explicitly, not left implicit.

**Recommendation (non-blocking but should be done):** add a task to update `.ai-factory/ARCHITECTURE.md` to legitimize the new pattern — e.g. distinguish *shared* components in `components/` (pure, props-only) from *page-local feature sub-components* in `pages/<Feature>/` (may co-locate their own queries), and adjust the line 67/69/75/162 wording accordingly. At minimum, add a Notes/Assumptions entry acknowledging the intentional deviation so it is not later read as a defect.

### Rules gate — ✅ PASS

`.ai-factory/rules/` base rules satisfied: all files English, naming conventions respected (`PageHeader.tsx` PascalCase, `format.ts` camelCase util), HTTP stays through `apiFetch` (`core/api/client`), no `localStorage` touched, no `console.log` introduced.

### Roadmap gate — ✅ PASS

Plan maps 1:1 to ROADMAP milestone *"Shared format utility and query co-location"* (all three cleanup items covered). This is a `refactor`-class change; linkage is clear.

## Findings

### Critical Issues
None. The plan is mechanically executable and its codebase assumptions are accurate.

### Notable
1. **Architecture-doc conflict not acknowledged (Phase 3).** See Architecture gate above. Add an ARCHITECTURE.md update task or an explicit deviation note.

### Minor / implementation reminders
- **`verbatimModuleSyntax: true`** is on. In `SessionCharts.tsx`, new value imports (`useQuery`, `apiFetch`) must be regular imports while `SessionRun`/`InstructionDto`/`BioSampleDto` stay `import type`. The plan's wording ("keep … type imports") is consistent with this; just ensure the implementer does not collapse them into one non-type import.
- **`noUnusedLocals` / `noUnusedParameters: true`.** Tasks 4 and 6 already call out removing newly-unused imports (`useAuth`/`logout` in both pages; `useQuery`, `InstructionDto`, `BioSampleDto` in `SessionsPage/index.tsx`). This is mandatory — `tsc --noEmit` will fail otherwise. Note the shared import line `import { useInfiniteQuery, useQuery } from '@tanstack/react-query'` must be narrowed to `useInfiniteQuery` only, and `import type { ListRunsResponse, InstructionDto, BioSampleDto }` narrowed to `ListRunsResponse` only.
- **Commit messages** in the plan use sentence-case imperative with no type prefix — compliant with project commit conventions.

### Positive Notes
- Assumptions are explicitly stated and each was verifiable — strong, honest plan authoring.
- Correctly avoids over-reach: leaves the `SessionCharts` right-panel header untouched and does not invent an `enabled` guard that is no longer needed.
- Dependency ordering between tasks (1→2, 3→4, 5→6, and the shared-file note that Tasks 4 and 6 both edit `SessionsPage/index.tsx`) is sound and the cross-task coupling on that file is flagged.
- Choosing the locale-independent `MONTHS` implementation is a small correctness upgrade, not just a copy.
