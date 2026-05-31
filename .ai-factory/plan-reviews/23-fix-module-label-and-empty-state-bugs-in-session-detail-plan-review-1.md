# Plan Review: Fix module label and empty-state bugs in session detail

**Plan:** `.ai-factory/plans/23-fix-module-label-and-empty-state-bugs-in-session-detail.md`
**Risk Level:** 🟢 Low

## Scope & Intent

The plan targets two confirmed correctness bugs from the Phase 6 review (`notes/12-module-ui-review-followup.md`, Fix 1 and Fix 2):
1. A breath session with `description = null` showing the title "Meditation" next to a "Breath" badge.
2. A BCI-less meditation session rendering a blank ~90px chart instead of "No data".

It correctly excludes Fixes 3–6, which map to the separate Phase 7 milestones in `ROADMAP.md` (lines 63, 65). Scope matches intent exactly.

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** PASS. The new helper `src/pages/SessionsPage/sessionTitle.ts` lives under `pages/`, which is permitted to import `core/types`. No `components/ → core` violation is introduced, and the plan's own note confirms this. Dependency rules are respected.
- **Rules (`RULES.md`):** Not present — N/A. No raw `fetch`, no `localStorage` access, and no proto changes are involved, so the project rules in `CLAUDE.md` are not implicated.
- **Roadmap (`ROADMAP.md`):** PASS. The plan is a 1:1 match for the Phase 7 milestone "Fix module label and empty-state bugs in session detail" (line 61), including the exact remediation (`sessionTitle` helper + `gridCount` return). Milestone linkage is explicit and correct.
- **Skill-context (`skill-context/aif-review/SKILL.md`):** Not present — no project-specific review overrides to apply.

## Codebase Verification

Each assumption in the plan was checked against the source:

- **`SessionRun` fields (Task 1):** Confirmed in `src/core/types/index.ts` — `description: string | null` (line 19) and `activityType: ActivityType` (line 18). The `Pick<SessionRun, 'description' | 'activityType'>` field names are correct; no adjustment needed.
- **`SessionCharts.tsx` title (Task 2):** Confirmed `{session.description ?? 'Meditation'}` at line 71. Line reference accurate.
- **`SessionList.tsx` title (Task 2):** Confirmed inline `{session.description ?? (session.activityType === 'breath' ? 'Breath' : 'Meditation')}` at line 65. Line reference accurate. Note the helper's logic is identical to this existing expression, so `SessionList` output is unchanged — only `SessionCharts` behavior changes, which is the intended fix.
- **`totalGrids` (Task 3):** Confirmed `const totalGrids = nextIdx;` at line 120 of `chartOption.ts`, already computed before the return. The final `return { option, height };` is at line 315. The return-shape change is mechanical and safe.
- **Sole consumer (Task 3 safety):** `buildSessionChartOption` is called only from `SessionCharts.tsx` (besides its definition in `chartOption.ts`). Widening the return type with an added `gridCount` field is backward-compatible and breaks no other caller.
- **`isEmpty` derivation (Task 4):** Confirmed the current length-based block at lines 46–50. The `useMemo` already destructures `{ option, height }` at line 54, so adding `gridCount` is a clean extension. The `!isLoading` guard preventing a "No data" flash is correct as described.

## Observations (non-blocking)

- The explanatory comment above the `useMemo` (lines 52–53 of `SessionCharts.tsx`) remains valid after the change and does not need editing — the plan does not touch it, which is fine.
- The plan's closing instruction to run `npm run typecheck` and `npm run lint` is appropriate given the return-type change and new import.

## Positive Notes

- Tasks are correctly ordered with explicit dependencies (Task 2 → 1, Task 4 → 3).
- The plan defers `complexity === 0` and `ModuleBadge` fallback to their own milestones rather than silently bundling them — clean scope discipline.
- File paths, line numbers, type field names, and the existing `totalGrids` variable were all verified accurate; there are no wrong assumptions about the codebase.

No missing steps, no architectural mistakes, no incorrect paths or API usage, and no migrations are relevant (frontend-only, no schema). The plan is solid.

PLAN_REVIEW_PASS
