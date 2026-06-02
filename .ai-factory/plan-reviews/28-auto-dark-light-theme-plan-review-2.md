# Plan Review 2: Auto dark/light theme (28)

**Plan:** `.ai-factory/plans/28-auto-dark-light-theme.md`
**Files cross-checked:** `tailwind.config.js`, `src/index.css`, `src/components/EChart/index.tsx`, `moduleMeta.ts`, `ModuleBadge.tsx`, `SkeletonLoader.tsx`, `PageHeader.tsx`, `ProtectedRoute.tsx`, all `src/pages/**`, plus a repo-wide grep for `bg-*/text-gray-*/border-gray-*` classes.
**Risk Level:** 🟢 Low — both blocking issues from review 1 are resolved; remaining notes are non-blocking.

## Context Gates

- **Architecture** (`.ai-factory/ARCHITECTURE.md`): ✅ PASS. Pure Tailwind/styling change inside existing feature-module and shared-component boundaries. No new cross-layer dependency, no storage access, no `useQuery` pushed into shared components. `EChart` keeps its prop contract; consuming call sites untouched.
- **Rules** (project `CLAUDE.md`): ✅ PASS. No `mind_auth_token` rename, no raw `fetch`, no new browser-storage access, English-only. `EChartProps` explicitly left unchanged.
- **Roadmap** (`.ai-factory/ROADMAP.md`): ✅ PASS. Implements the `Auto dark/light theme` milestone; approach (media darkMode + ECharts theme via `init` + `dark:` sweep) matches the roadmap entry.

## Resolution of Review 1 Blockers

- **C1 (blank chart after theme switch) — RESOLVED.** Task 2 step 3 now mandates calling `chart.setOption(option, notMerge ?? false)` inside the init effect right after `echarts.init(...)` and adding `option`/`notMerge` to that effect's deps. Verified against the codebase: `option` is a stable `useMemo` in both `SessionCharts.tsx` (deps `[instructionsData, biometricsData, session.startedAt, session.endedAt]`) and `CalibrationChart.tsx` (deps `[records]`), so the original assumption that the standalone `setOption` effect would re-fire after re-init was indeed wrong. The new instruction fixes it correctly.
- **C2 (no background class on shell containers → white shell in dark mode) — RESOLVED.** Task 1 adds a global `body { @apply bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 }` backstop plus `color-scheme: light dark`, and Tasks 5/7/8 now explicitly *add* (not just rewrite) per-surface backgrounds. Confirmed against source: `PageHeader.tsx` has only `border-b border-gray-200` (no `bg-*`), and both `SessionsPage/index.tsx` and `CalibrationPage/index.tsx` roots are `flex h-screen flex-col overflow-hidden` (transparent) — exactly the containers the plan now calls out.
- **M1 (Tailwind v3 default darkMode) — ADDRESSED.** Plan's review note correctly reframes `darkMode: 'media'` as intent-only, not the enabling step.
- **M2 (CalibrationChart sub-elements) — RESOLVED.** Task 8 now widens to the device serial (`text-gray-800`), the valid-count pill (`bg-gray-100`, `text-gray-500`), and the section border (`border-gray-100`). Matches the actual classes in `CalibrationChart.tsx`.
- **M3 (navy `'dark'` theme background) — RESOLVED.** Task 2 step 4 merges `{ backgroundColor: 'transparent' }` under the passed option at the wrapper level.

## Coverage Check

A repo-wide grep for theme-relevant classes returns exactly 13 files, and **every one is in the plan's task list**:
`ModuleBadge.tsx`, `moduleMeta.ts`, `SkeletonLoader.tsx`, `PageHeader.tsx`, `CalibrationChart.tsx`, `CalibrationPage/index.tsx`, `GoogleCallbackPage/index.tsx`, `LoginPage/index.tsx`, `MagicLinkPage/index.tsx`, `ModuleFilter.tsx`, `SessionCharts.tsx`, `SessionList.tsx`, `SessionsPage/index.tsx`. `ProtectedRoute.tsx` carries no styling (correctly omitted). No styled file is missed. There is no separate `SessionPage` file despite the CLAUDE.md sketch — the detail view lives in `SessionsPage/SessionCharts.tsx`, which the plan covers.

## Non-Blocking Notes

### N1. Task 2 will re-initialize the chart on every option change, not just theme change (minor perf)
Because step 3 adds `option`/`notMerge` to the **init** effect deps, selecting a different session or loading new data will now dispose and re-create the entire ECharts instance (and its `ResizeObserver`) rather than just calling `setOption`. This is functionally correct and harmless for this dashboard's interaction rate, but heavier than necessary. The lighter alternative offered in review 1 — keep the init effect deps as `[isDark]` only and add `isDark` to the **standalone** `setOption` effect's deps — avoids full re-init on data changes while still re-applying the option after a theme switch. Either is acceptable; if the implementer keeps the standalone effect, prefer that variant. Not blocking.

### N2. Transparent-background merge must be applied wherever `setOption` is called (consistency)
Step 4's example shows the `{ backgroundColor: 'transparent', ...(option) }` merge inside the init effect. If the implementer **keeps** the standalone `setOption` effect, the same merge must be applied there too — otherwise `CalibrationChart` (which passes `notMerge`, so `setOption` replaces rather than merges) would drop the transparent background on the next option update and the navy rectangle would reappear. The plan's wording "when calling `setOption`" implies this, but it's worth stating once more during implementation. The cleanest way to avoid the trap is a single `applyOption` helper used by both paths, or removing the standalone effect entirely.

### N3. Doc/stack drift (informational)
Root CLAUDE.md describes React 18 while the project runs React 19. No impact on effect semantics or this plan.

## Positive Notes

- Correctly treats ECharts as canvas-based and themes it through `init`, not CSS — the core insight.
- Centralized color-mapping table makes the sweep mechanical and reviewable; blue accents and `text-red-500` errors correctly left untouched.
- The global `body` backstop + `color-scheme: light dark` is the right fix for overscroll/scrollbar/transparent-shell flashing, beyond just per-surface classes.
- "Add, don't only rewrite" guidance is explicit and matches the real (background-less) shell containers.
- Commit plan follows the project's no-prefix convention and groups changes coherently.

The two blocking issues from review 1 are fully resolved, codebase assumptions are verified accurate, file paths exist, and coverage is complete. The remaining notes are quality/perf refinements that do not block implementation.

PLAN_REVIEW_PASS
