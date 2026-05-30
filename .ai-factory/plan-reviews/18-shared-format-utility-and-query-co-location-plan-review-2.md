# Plan Review (2): Shared format utility and query co-location

**Plan:** `18-shared-format-utility-and-query-co-location.md`
**Files cross-checked:** 12
**Risk Level:** 🟢 Low

This is the second-iteration review. Review 1 raised exactly one substantive issue — Phase 3 moves `useQuery`/`apiFetch` into a sub-component, violating ARCHITECTURE.md, and the plan was silent about it. The revised plan **resolves that fully**: it adds a `## Notes / Assumptions` deviation entry and a dedicated **Phase 4 / Task 7** to realign ARCHITECTURE.md. All codebase assumptions re-verified below.

## Verification of plan assumptions

- ✅ **3 importer files** confirmed by source: `SessionList.tsx` (1 `formatSessionDate` call), `SessionCharts.tsx` (1 `formatSessionDate` call), `CalibrationPage/chartOption.ts` (2 `formatCalibrationDate` calls). No other references to `formatSessionDate` / `formatCalibrationDate` / `./format` exist. The milestone's "4 import sites" vs. 3 files is correctly reconciled in the Notes.
- ✅ **Format module contents** match the plan's descriptions exactly. `SessionsPage/format.ts` has `formatSessionDate` (`toLocaleString('en-GB', { month: 'short' })`) + `formatDuration` (floors, zero-pads `mm:ss`). `CalibrationPage/format.ts` has `formatCalibrationDate` using a hardcoded `MONTHS` array. Both date functions emit `"DD MMM, HH:mm"` in local time. Choosing the `MONTHS`-array implementation for the shared `formatDate` is a sound, locale-independent unification.
- ✅ **`@/` alias** resolves in both `tsconfig.app.json` (`paths: { "@/*": ["src/*"] }`) and `vite.config.ts`. `@/core/format` will resolve.
- ✅ **`useAuth()` exposes `logout`** (`AuthContextValue.logout(): void`); `ProtectedRoute` already consumes `useAuth()` from `components/`, so `PageHeader` doing the same is consistent.
- ✅ **Header markup** matches the plan: `CalibrationPage` header is `shrink-0 … px-6 py-4`; `SessionsPage` left header is `… px-4 py-4` (no `shrink-0`). Normalizing to `shrink-0 px-6 py-4` is correctly documented as an intentional, minor change, and the right-panel `SessionCharts` header (date + duration, no logout) is correctly left untouched.
- ✅ **Phase 3 query move is mechanically sound.** `SessionCharts` renders only inside the `selectedSession ?` branch with no `key` prop, so on session change React keeps the instance and the query keys (`session.id`) change → refetch — behavior preserved. Dropping the `enabled` guard is safe since the component only mounts when a session exists. `SessionRun` (`id`, `startedAt`, `endedAt`, `durationSeconds`) are all non-nullable `string`/`number`, so `encodeURIComponent(session.startedAt/endedAt)` is safe.
- ✅ **`verbatimModuleSyntax: true`** and **`noUnusedLocals`/`noUnusedParameters: true`** confirmed in `tsconfig.app.json`. The plan's per-task import-narrowing instructions (Tasks 4, 5, 6) correctly account for both flags.
- ✅ **ARCHITECTURE.md line references accurate.** Line 67 ("No data fetching in components"), line 69 ("Sub-components are pure render functions"), line 75 ("Pages own data, components own presentation"), line 162 (anti-pattern "Fetch in components") all match current source. Task 7's edit targets are correct.
- ✅ **ROADMAP milestone** "Shared format utility and query co-location" maps 1:1 to the plan's three cleanup items. The referenced `notes/08-…` spec genuinely does not exist; correctly noted.

## Commit-boundary compilability

Each commit leaves the tree compiling:
- **Commit 1** (Tasks 1–2): new `core/format.ts`, importers repointed, duplicates deleted — self-consistent.
- **Commit 2** (Tasks 3–4): `PageHeader` added and used; `index.tsx` still owns the two queries and passes the old props to the unchanged `SessionCharts` interface — consistent.
- **Commit 3** (Tasks 5–6): `SessionCharts` prop shrink and `index.tsx` slimming land together, keeping the producer/consumer contract in sync.
- **Commit 4** (Task 7): doc-only.

The plan flags the shared-file coupling (Tasks 4 and 6 both edit `SessionsPage/index.tsx`); ordering is correct.

## Context Gates

### Architecture gate — ✅ PASS
The review-1 WARN is resolved. Phase 4 / Task 7 realigns ARCHITECTURE.md by distinguishing *shared* components in `src/components/` (pure, props-only) from *page-local feature sub-components* in `pages/<Feature>/` (may co-locate their own queries), and the deviation is explicitly documented in Notes. The instruction to keep edits "minimal and surgical" is appropriate.

*Minor (non-blocking):* the ARCHITECTURE.md **Folder Structure** block (lines ~33–37) is already stale — it lists `InstructionTimeline.tsx` / `BiometricCharts.tsx` / `CalibrationTrends.tsx`, none of which exist (actual files: `SessionCharts.tsx`, `SessionList.tsx`, `chartOption.ts`, `CalibrationChart.tsx`). This predates the plan and is out of scope; Task 7 correctly targets only the prose rules. Implementer should treat the `~67/69/75/162` line numbers as approximate (they are exact today, but any prior edit shifts them) and locate by quoted text.

### Rules gate — ✅ PASS
`.ai-factory/rules/base.md` satisfied: all files English; PascalCase component (`PageHeader.tsx`) and camelCase util (`format.ts`); HTTP stays through `apiFetch` (`core/api/client`); no `localStorage` access introduced outside `AuthContext`/`client`; no `console.*` added. No project `skill-context/aif-review/SKILL.md` present, so only general + base rules apply.

### Roadmap gate — ✅ PASS
1:1 mapping to the active ROADMAP milestone. This is a `refactor`-class change; linkage is unambiguous.

## Findings

### Critical Issues
None.

### Notable
None. The review-1 architecture conflict is fully addressed.

### Minor / implementation reminders
- The query key changes from `['session-instructions', id]` (from `useParams`) to `['session-instructions', session.id]`. These are equal (`selectedSession.id === id`), so the React Query cache identity is preserved — no behavior change.
- Locate ARCHITECTURE.md edit targets by quoted text rather than fixed line numbers, in case Task 7 runs after any unrelated doc edit.

### Positive Notes
- Every assumption is explicitly stated and independently verifiable — honest, high-quality plan authoring.
- The revision cleanly closes the one open issue from review 1 with a properly-scoped extra phase rather than hand-waving it.
- Correctly avoids over-reach: leaves the right-panel `SessionCharts` header alone and drops the now-unnecessary `enabled` guard.
- Commit decomposition keeps each commit independently compilable and single-concern.

PLAN_REVIEW_PASS
