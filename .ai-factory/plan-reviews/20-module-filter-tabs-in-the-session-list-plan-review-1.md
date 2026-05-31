# Plan Review: Module filter tabs in the session list

**Plan:** `.ai-factory/plans/20-module-filter-tabs-in-the-session-list.md`
**Files Reviewed:** plan + 4 codebase files (`SessionsPage/index.tsx`, `SessionsPage/SessionList.tsx`, `core/types/index.ts`, `components/ModuleBadge.tsx`) + ARCHITECTURE.md, ROADMAP.md, `notes/09-module-aware-session-list.md`
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture** (`ARCHITECTURE.md`) — PASS. The plan honors the dependency rules: `ModuleFilter` is a page-local feature sub-component under `pages/SessionsPage/` (allowed), filter state lives in `useState` inside the page (matches Key Principle 5), `SessionList` stays a presentation component receiving data + an `emptyMessage` prop (no fetching, no localStorage). No raw `fetch`, no `useInfiniteQuery` change. Fully aligned.
- **Rules** (`.ai-factory/RULES.md`) — WARN: file not present. No explicit rule violations detectable. CLAUDE.md rules (English-only, all HTTP through client, components receive props) are all respected by the plan.
- **Roadmap** (`ROADMAP.md`) — PASS. The plan maps directly to the Phase 6 milestone "Module filter tabs in the session list" (currently `[ ]`). Scope matches the milestone text (segmented control, client-side filter, preserve order + `getNextPageParam`/"Load more", "No {module} sessions" empty state).
- **Skill context** (`.ai-factory/skill-context/aif-review/SKILL.md`) — not present; no project-specific overrides to apply.

## Critical Issues

None.

## Findings

### 1. Assumption #1 is factually incorrect (low impact)

The plan states:

> The referenced `notes/09-module-aware-session-list.md` does not exist in the repo; the roadmap entry (ROADMAP.md line 53) is the authoritative spec for this milestone.

This is wrong on both counts. The file **does** exist at `.ai-factory/notes/09-module-aware-session-list.md`, and its **Step 3 — Module filter (segmented control)** is the detailed authoritative spec for this milestone (the note's footer explicitly maps Step 3 to the "Module filter tabs in the session list" roadmap task).

**Impact is low** because the plan's design independently matches the note's Step 3 spec (filter `useState('all')`, `visible = filter === 'all' ? sessions : sessions.filter(...)`, order preserved, "Load more" stays driven by the full `sessions`/`hasNextPage`, and a "No {module} sessions" message via an empty-message prop). So the wrong assumption did not produce a wrong design.

**Why fix it anyway:** an implementer reading this assumption may skip the note and lose context, and the claim that the one-line roadmap entry is "authoritative" understates the actual spec. Recommend correcting Assumption #1 to reference `notes/09` Step 3 as the spec.

## Verification of plan correctness against the codebase

These all checked out — no issues:

- `ActivityType` (`'breath' | 'meditation'`) exists in `src/core/types/index.ts:11` and is exported. The `@/core/types` alias import path is valid (used by `ModuleBadge.tsx`).
- `SessionRun.activityType` exists, so `sessions.filter((s) => s.activityType === filter)` is type-correct.
- `SessionsPage/index.tsx` builds `sessions` via `data?.pages.flatMap(...)` and resolves `selectedSession` against that full array (`index.tsx:30`). The plan's instruction to filter only what is passed to `<SessionList>` while leaving `selectedSession` against the full array is correct and necessary — otherwise the right-hand `SessionCharts` panel would vanish when the filter hides the selected row.
- Task 3's note about the empty branch is accurate: the current `SessionList` `sessions.length === 0` branch (`SessionList.tsx:28-34`) returns early and does **not** render the "Load more" button. Adding the button to that branch (so a filtered-empty view can still page forward) is a real, well-justified change, not a no-op.
- The left-column layout (`PageHeader` then an `overflow-y-auto` wrapper around `SessionList`, `index.tsx:35-46`) matches the plan's described insertion point. Placing `ModuleFilter` between `PageHeader` and the scroll container (rather than inside it) is the better of the two offered options, since it keeps the control fixed while the list scrolls — worth making explicit during implementation.
- No migrations, no API changes, no proto changes — purely client-side, consistent with the "filter the already-loaded array" approach. No security surface touched.
- `FilterValue` exported from `ModuleFilter.tsx` and imported by `index.tsx` is a valid intra-page-folder import and does not violate the cross-page import rule.

## Positive Notes

- Cleanly scoped to three small tasks with correct dependency ordering (control → wiring → empty-state prop).
- Correctly preserves `getNextPageParam`/"Load more" semantics tied to the full loaded set, matching the note's explicit edge-case guidance.
- Reuses the existing `ActivityType` type and mirrors `ModuleBadge`'s label mapping rather than inventing new literals.
- Respects the architecture's presentation-vs-page separation precisely (stateless `ModuleFilter`, data-driven `SessionList`).

## Recommendation

Solid plan. Only one non-blocking correction needed: fix the false claim in Assumption #1 and point it at `notes/09` Step 3. The implementation steps themselves are accurate and require no structural change.
