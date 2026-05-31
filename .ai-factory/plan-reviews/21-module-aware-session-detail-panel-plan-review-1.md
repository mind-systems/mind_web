# Plan Review: Module-aware session detail panel

**Plan:** `21-module-aware-session-detail-panel.md`
**Files Reviewed:** 5 (plan + 4 source/context files)
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md` present):** PASS. The plan touches only `src/pages/SessionsPage/` (page-level) and imports the existing shared `ModuleBadge` from `src/components/`. No dependency-direction or boundary violations. `ModuleBadge` receives `type` as a prop — consistent with the "components receive data as props, no `useQuery` inside shared components" rule.
- **Rules (`.ai-factory/rules/` present):** PASS. No raw `fetch`, no new `localStorage` access, no console logging, Tailwind-only styling (plan explicitly preserves existing Tailwind classes). Empty-state rule respected — relies on the existing `isEmpty` placeholder.
- **Roadmap (`.ai-factory/ROADMAP.md` present):** PASS. Plan maps 1:1 to the open Phase 6 task "Module-aware session detail panel" (line 55), and faithfully implements the full spec in `notes/10-module-aware-session-detail.md`. No milestone linkage missing.
- **Skill-context (`.ai-factory/skill-context/aif-review/SKILL.md`):** not present — no project overrides to apply.

## Verification of Plan Assumptions

All codebase claims in the plan were checked and confirmed:

- ✅ `ModuleBadge` exists at `src/components/ModuleBadge.tsx`, exported with prop `type: ActivityType`.
- ✅ `SessionRun` (in `src/core/types/index.ts`) carries `activityType: ActivityType`, `description: string | null`, `complexity: number | null`.
- ✅ `formatDate` / `formatDuration` already imported in `SessionCharts.tsx`.
- ✅ Header lines 67–72 match the plan's description (date + duration row).
- ✅ `chartOption.ts` line references are accurate: grid-index assignment (114–119), `gridHeights` (122–127), instruction y-axis (160–168), phase custom-series (213–243), `allSeries` (245–268), JSDoc (47–54).
- ✅ `parsePhases` returns `[]` when no `breath_phase` instructions exist (transforms.ts line 19), so `hasPhases = phases.length > 0` is a robust presence flag — and crucially it keys off actual data, not `activityType`, which is the more correct signal.

## Correctness Analysis

The conditional-grid threading is sound:

- Making `INSTRUCTION_GRID` the first `nextIdx++` *only when* `hasPhases` keeps it at index 0 when present and lets HR/EEG/EMOT shift down to fill index 0 for meditation sessions. Correct.
- `gridHeights`, `gridTops`, `grids`, `xAxes` (`Array.from({length: totalGrids})`), and `height` all derive from `totalGrids` / `gridHeights` / `currentTop`, so they auto-adjust — the plan correctly identifies these need no manual change.
- **Y-axis ordering is safe:** each y-axis entry sets an explicit `gridIndex`, so ECharts maps axes to grids by `gridIndex` value, not array position. Conditionally spreading the instruction y-axis preserves correct mapping.
- **Zero-grid edge case** (no phases, no biometrics): `totalGrids === 0` produces empty `grid`/`xAxis`/`yAxis`/`series` arrays. This option is never rendered because `SessionCharts` already gates on `isEmpty`. The plan correctly notes no crash path. (The `height = currentTop - GAP + 60` becomes `TOP - GAP + 60 = 90`, harmless since unrendered.)

## Minor Notes (non-blocking, informational)

1. **Breath session with `null` description** would render the title as `'Meditation'` alongside a `Breath` badge. This is a pre-existing convention from milestone 09 (`description ?? 'Meditation'` is used identically in `SessionList`), and breath sessions are expected to always carry a description, so consistency is maintained. No action required — just be aware the fallback is module-agnostic.
2. **`useMemo` dependency array** in `SessionCharts` is unaffected — header metadata is rendered directly from `session` props outside the memo, and the memo's inputs (`instructionsData`, `biometricsData`, timestamps) are unchanged. No stale-render risk.
3. The plan leaves `PHASE_COLORS` and the `RenderItemAPI`/`buildLineSeriesEntry` helpers untouched, which is correct — they remain reachable when `hasPhases` is true.

## Positive Notes

- The plan mirrors an already-proven, in-repo pattern (`hasHeartRate`/`hasEeg`/`hasEmotions`) rather than inventing new structure — low regression risk and high reviewer familiarity.
- It explicitly threads the flag through *every* dependent site and enumerates them, with the rationale for which sites need no change — thorough and easy to verify against during implementation.
- Keys the conditional off `phases.length` (real data) instead of `activityType`, which is the more defensive choice.
- Correctly reuses the existing empty-state guard instead of adding a redundant one.
- Includes the JSDoc update so the "instruction grid always present" comment doesn't drift out of sync.

The plan is accurate, complete, architecturally aligned, and free of missing steps, wrong assumptions, or incorrect file/API references.

PLAN_REVIEW_PASS
