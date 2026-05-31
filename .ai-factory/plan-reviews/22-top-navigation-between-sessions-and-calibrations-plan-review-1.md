# Plan Review: Top navigation between Sessions and Calibrations

**Plan:** `22-top-navigation-between-sessions-and-calibrations.md`
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture (`ARCHITECTURE.md`):** PASS. `PageHeader` is a shared component in `src/components/`. The architecture rule "components import from `core/types` only" is already relaxed for `PageHeader` (it imports `useAuth` from `core/auth` for the Log out button — a pre-existing, accepted exception). Adding `NavLink` from the external `react-router-dom` package introduces no new `src/` dependency and does not violate dependency rules. No fetch/`localStorage`/data-shaping logic is added. WARN-level only worth noting: navigation links are slightly outside the strict "presentation receives all data as props" ideal, but routing primitives are conventional for a shared header and consistent with how `useAuth` is already used here.
- **Rules (`RULES.md`):** PASS. File is empty — no project-specific conventions to enforce.
- **Roadmap (`ROADMAP.md`):** PASS. This is the final open Phase 6 task and the description matches the plan exactly. Linkage confirmed.
- **Skill-context (`.ai-factory/skill-context/aif-review/SKILL.md`):** Not present — no project-level overrides apply.

## Verification Against Codebase

All file paths and assumptions in the plan were checked against the real source:

- `src/components/PageHeader.tsx` — confirmed: has `PageHeaderProps { title }`, renders `<span>{title}</span>` + Log out button inside `flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4`. The container classes quoted in Task 1 match the file verbatim. ✅
- `src/pages/SessionsPage/index.tsx` — confirmed: root is `<div className="flex h-screen overflow-hidden">` with `<PageHeader title="Sessions" />` nested inside the 280px left column (line 48). Task 2's restructure (full-width header above a `flex flex-1` row) is correct and necessary — leaving the header inside the left column would clip the nav to 280px. `ModuleFilter`, `SessionList`, `SessionCharts`, and the `useInfiniteQuery`/filter logic are untouched by the plan, as stated. ✅
- `src/pages/CalibrationPage/index.tsx` — confirmed: already `flex h-screen flex-col overflow-hidden` with `<PageHeader title="Calibrations" />` as first child (line 48). Task 3's one-line prop drop is accurate; no structural change needed. ✅
- `src/router.tsx` — confirmed routes `/sessions`, `/sessions/:id`, `/calibrations` exist and are protected. ✅
- Only two call sites pass `title` (SessionsPage, CalibrationPage); both are covered by Tasks 2 and 3, so removing the prop in Task 1 will not leave a dangling TypeScript error elsewhere. ✅

## Notes

- **NavLink active-state claim is correct.** In React Router v6, `<NavLink to="/sessions">` (without the `end` prop) is marked active for `/sessions` *and* descendant paths like `/sessions/:id`, which is the desired behavior for the Sessions tab. The plan's note (line 14) is accurate. No `end` prop should be added to the Sessions link.
- **Task ordering is sound.** Tasks 2 and 3 correctly declare a dependency on Task 1. Because Task 1 removes the `title` prop, both consuming pages must be updated in the same change set to keep `tsc --noEmit` green — the plan handles this.
- **Calibrations tab and `end`:** `/calibrations` has no descendant routes, so its `NavLink` needs no special handling. Fine as planned.

## Minor Suggestions (non-blocking)

- When implementing Task 2, ensure the new inner `<div className="flex flex-1 overflow-hidden">` preserves the independent scroll regions: the left column keeps `overflow-y-auto` on its inner list wrapper, and the right panel keeps `flex-1 overflow-y-auto`. The plan says to leave these unchanged, which is correct — just verify the moved `overflow-hidden` on the new flex row doesn't suppress the children's scrolling (it won't, since the scroll containers are nested deeper).
- Consider giving the two `NavLink`s a shared base class (padding/text-size) and only toggling color/weight via the `isActive` render prop, to keep active/inactive states from shifting layout. The plan already implies this ("matching the existing Tailwind text scale") — just a reminder for the implementer.

## Conclusion

The plan is accurate, scoped tightly, and consistent with the codebase and architecture. File paths, quoted class strings, prop shapes, and the React Router behavior assumption all verified against source. No missing steps, no wrong assumptions, no security or migration concerns (pure frontend presentation change).

PLAN_REVIEW_PASS
