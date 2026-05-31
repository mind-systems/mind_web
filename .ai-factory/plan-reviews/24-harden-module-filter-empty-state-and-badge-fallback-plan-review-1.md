# Plan Review: Harden module filter empty-state and badge fallback

## Code Review Summary

**Files Reviewed:** 2 plan-targeted source files + 4 supporting files
**Risk Level:** 🟢 Low

### Context Gates
- **Architecture** (`.ai-factory/ARCHITECTURE.md` present): PASS. Both changes stay within their layers — `SessionsPage/index.tsx` (page) and `components/ModuleBadge.tsx` (shared component). `ModuleBadge` continues to receive `type` as a prop with no data-fetching, honoring the "components receive data as props" rule. No `localStorage` or raw `fetch` introduced.
- **Rules** (`.ai-factory/RULES.md` absent): WARN — no standalone RULES.md; project conventions read from CLAUDE.md instead. No violations found (English-only, no proto edits, no localStorage key rename).
- **Roadmap** (`.ai-factory/ROADMAP.md` present): PASS. The plan maps 1:1 to the open milestone at line 63, "Harden module filter empty-state and badge fallback" (Phase 7 — Module UI Review Follow-Up). Both sub-items (filter empty-state, badge fallback) match the roadmap description and the cited note `notes/12-module-ui-review-followup.md` (which exists). Linkage is explicit.

### Critical Issues
None.

### Verification Notes (all confirmed against the codebase)

**Task 1 — filter empty-state**
- File path `src/pages/SessionsPage/index.tsx` is correct.
- Cited lines 39–42 exactly match the current `emptyMessage` ternary. ✓
- `hasNextPage` is destructured from `useInfiniteQuery` (line 16) and already passed to `SessionList` (line 59). ✓
- The plan's claim that `SessionList`'s empty branch only renders "Load more" when `hasNextPage` is true is correct — verified at `SessionList.tsx:35-44`. The reworded "…load more below" message and the rendered button therefore agree. ✓
- The button is rendered *after* the message span in the empty branch, so "below" is literally accurate. ✓
- The extracted `moduleLabel` is reused, removing the duplicated `filter === 'breath' ? …` expression. Clean.

**Task 2 — ModuleBadge fallback**
- File path `src/components/ModuleBadge.tsx` is correct; current body indexes `STYLES[type]` / `LABELS[type]` with no fallback (lines 17–22), matching the plan's premise. ✓
- `LABELS[type] ?? type` and `STYLES[type] ?? 'bg-gray-100 text-gray-600'` correctly guard the runtime-unknown case. The `Record<ActivityType, …>` compile-time typing (with `ActivityType = 'breath' | 'meditation'`, confirmed in `core/types/index.ts:11`) is intentionally retained; the fallback only matters for runtime values outside the union, which is sound.
- Both fallback class strings are static literals (`bg-gray-100 text-gray-600`), so Tailwind's content scanner will emit them. ✓

### Minor Observations (non-blocking, no action required)
- `useInfiniteQuery`'s `hasNextPage` is typed `boolean | undefined`; the plan uses it inside a ternary (`hasNextPage ? … : …`), where an `undefined` value falls to the "no more pages" branch — the desired behavior. No type change needed, and this matches the existing `SessionList` prop contract (`hasNextPage: boolean`) already in use upstream.
- Scope boundary is well drawn: the plan explicitly excludes Fixes 1, 2, 5, 6 from the note, and the separate roadmap milestone at line 65 covers the vertical-centering and `complexity === 0` items. No overlap or omission.

### Positive Notes
- Tightly scoped, surgical plan with exact line references that all check out.
- Both fixes are honest robustness improvements (UI-truthfulness and defensive rendering) with zero behavioral risk to the existing happy path.
- Correctly reasons about the compile-time vs. runtime type boundary rather than weakening the `Record` typing.
- Roadmap and source-of-truth note linkage is explicit and accurate.

PLAN_REVIEW_PASS
