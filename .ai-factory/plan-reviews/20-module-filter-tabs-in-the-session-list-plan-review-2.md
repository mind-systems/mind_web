# Plan Review 2: Module filter tabs in the session list

**Plan:** `.ai-factory/plans/20-module-filter-tabs-in-the-session-list.md`
**Files Reviewed:** plan + `SessionsPage/index.tsx`, `SessionsPage/SessionList.tsx`, `core/types/index.ts`, `notes/09-module-aware-session-list.md`, plus the prior review (`-plan-review-1.md`)
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture** (`.ai-factory/ARCHITECTURE.md`) — PASS. `ModuleFilter` is a page-local feature sub-component under `pages/SessionsPage/` (allowed). Filter state lives in `useState` inside the page. `SessionList` stays a presentation component that receives data + a new `emptyMessage` prop — no fetching, no `localStorage`. No raw `fetch`, no `useInfiniteQuery` change. Aligned.
- **Rules** (`.ai-factory/RULES.md`) — WARN: file not present. CLAUDE.md project rules (English-only, all HTTP through `core/api/client.ts`, components receive props, no `useQuery` in shared components) are all respected. The new `ModuleFilter` lives under `pages/SessionsPage/` so it is allowed to hold no query and stay stateless; `SessionList` keeps receiving props. No violations.
- **Roadmap** (`.ai-factory/ROADMAP.md`) — PASS. Maps directly to the Phase 6 milestone "Module filter tabs in the session list". Scope matches (segmented control, client-side filter, preserved order, `getNextPageParam`/"Load more" untouched, "No {module} sessions" empty state).
- **Skill context** (`.ai-factory/skill-context/aif-review/SKILL.md`) — not present; no project-specific overrides.

## Critical Issues

None.

## Findings

### 1. Assumption #1 is still factually wrong (cosmetic, carried over from review 1)

The plan states:

> The referenced `notes/09-module-aware-session-list.md` does not exist in the repo; the roadmap entry (ROADMAP.md line 53) is the authoritative spec for this milestone.

This is incorrect. The file **does** exist at `.ai-factory/notes/09-module-aware-session-list.md`, and its **Step 3 — Module filter (segmented control)** is the detailed spec for this milestone (the note's footer explicitly maps Step 3 to the "Module filter tabs in the session list" roadmap task).

**Impact: none on correctness.** The plan's tasks independently match the note's Step 3 spec verbatim (filter `useState('all')`, `visible = filter === 'all' ? sessions : sessions.filter(...)`, order preserved, "Load more" stays driven by the full `sessions`/`hasNextPage`, "No {module} sessions" via an empty-message prop). Review 1 already raised this; it remains uncorrected. Non-blocking — recommend fixing the assumption text to point at `notes/09` Step 3, but it changes no task.

## Verification against the codebase

All confirmed accurate — no issues:

- `ActivityType = 'breath' | 'meditation'` exists and is exported (`core/types/index.ts:11`); `@/core/types` alias import is valid (used by `ModuleBadge.tsx`/`SessionList.tsx`). Reusing it for `FilterValue = 'all' | ActivityType` is type-correct.
- `SessionRun.activityType` exists (`index.ts:18`), so `sessions.filter((s) => s.activityType === filter)` type-checks.
- `index.tsx` builds `sessions` via `data?.pages.flatMap(...)` (`:25`) and resolves `selectedSession` against that **full** array (`:30`). Task 2's instruction to filter only what is passed to `<SessionList>` while leaving `selectedSession` on the full array is correct and necessary — otherwise the right-hand `SessionCharts` panel would vanish when the filter hides the selected row.
- Insertion point is accurate: `PageHeader` (`:36`) then an `overflow-y-auto` wrapper (`:37`) around `<SessionList>`. Placing `ModuleFilter` between `PageHeader` and the scroll container keeps the control fixed while the list scrolls — the better of the two options the plan offers.
- Task 3 is accurate: the current `sessions.length === 0` branch (`SessionList.tsx:28-34`) returns early and does **not** render "Load more". Adding the button there (so a filtered-empty view can still page forward to a page that may contain the module) is a real, justified change, not a no-op. The existing button markup (`:69-78`) is reusable.
- `emptyMessage` label mapping in Task 2 (`filter === 'breath' ? 'Breath' : 'Meditation'`) mirrors the existing label logic in `SessionList.tsx:53` and `ModuleBadge` — consistent.
- No migrations, API, or proto changes — purely client-side filtering of the already-loaded array. No security surface touched.
- `FilterValue` exported from `ModuleFilter.tsx` and imported by `index.tsx` is a valid intra-folder import; does not violate the cross-page import rule.

## Positive Notes

- Cleanly scoped into three small tasks with correct dependency ordering (control → wiring → empty-state prop).
- Correctly preserves `getNextPageParam`/"Load more" semantics tied to the full loaded set, and keeps `selectedSession` resolving against the unfiltered array — both real edge cases handled explicitly.
- Reuses the existing `ActivityType` type rather than inventing new literals.
- Respects the presentation-vs-page architecture separation precisely (stateless `ModuleFilter`, data-driven `SessionList`).

## Recommendation

The plan is solid and implementable as written. The only outstanding item is the cosmetic, non-blocking inaccuracy in Assumption #1 (the `notes/09` file does exist) — worth correcting but it changes no task and introduces no implementation risk.

PLAN_REVIEW_PASS
