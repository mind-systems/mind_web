# Plan: Top navigation between Sessions and Calibrations

## Context
`/calibrations` currently has no UI entry point. This milestone turns the shared `PageHeader` into a top navigation bar with `NavLink`s for Sessions and Calibrations so both pages are reachable, keeping Log out on the right.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Notes
- The referenced spec `notes/11-top-navigation.md` does not exist in the repo; this plan is derived from the milestone description and the current code.
- Routes are defined in `src/router.tsx`: `/sessions` (+ `/sessions/:id`) and `/calibrations`.
- React Router v6 `NavLink` marks `to="/sessions"` active on `/sessions/:id` too (descendant match), which is the desired behavior.

## Tasks

### Phase 1: Navigation bar

- [x] **Task 1: Convert `PageHeader` into a top navigation bar**
  Files: `src/components/PageHeader.tsx`
  Remove the `PageHeaderProps` interface and the `title` prop — `PageHeader` now takes no props. Replace the `<span>{title}</span>` block with a `<nav>` containing two `NavLink`s from `react-router-dom`: "Sessions" → `/sessions` and "Calibrations" → `/calibrations`. Use the `NavLink` render-prop `className={({ isActive }) => ...}` to apply active-state styling (e.g. active: `text-gray-900 font-semibold`; inactive: `text-gray-500 hover:text-gray-700`), matching the existing Tailwind text scale used in this component. Keep the outer container classes (`flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4`) and keep the existing Log out `<button>` (with `useAuth().logout`) on the right. Place the two links in a horizontal group on the left (e.g. `flex items-center gap-6`).

### Phase 2: Page integration

- [x] **Task 2: Restructure `SessionsPage` so the header spans full width above the split panel** (depends on Task 1)
  Files: `src/pages/SessionsPage/index.tsx`
  Change the root layout from a single horizontal flex row to a vertical column: outer `<div className="flex h-screen flex-col overflow-hidden">`. Render `<PageHeader />` (no `title` prop) as the first child, full width. Wrap the existing left column + right panel in a new `<div className="flex flex-1 overflow-hidden">` so they sit side-by-side below the header. Remove the `<PageHeader title="Sessions" />` that was inside the left column. Leave `ModuleFilter`, `SessionList`, and `SessionCharts` and all query/filter logic unchanged.

- [x] **Task 3: Drop the `title` prop from `PageHeader` in `CalibrationPage`** (depends on Task 1)
  Files: `src/pages/CalibrationPage/index.tsx`
  Change `<PageHeader title="Calibrations" />` to `<PageHeader />`. The existing `flex h-screen flex-col` layout already places the header full-width above the body, so no further structural change is needed.
