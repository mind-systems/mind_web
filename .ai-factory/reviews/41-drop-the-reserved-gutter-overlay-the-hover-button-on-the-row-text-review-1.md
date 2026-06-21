# Code Review: Drop the reserved gutter; overlay the hover button on the row text

**Scope:** `src/pages/SessionsPage/SessionList.tsx` (the only code change in the diff; other changed files are plan/note/roadmap docs).
**Risk:** 🟢 Low — markup/CSS only, no behavior, data, or API change.

## Verification performed
- `npm run typecheck` — passes clean.
- `npm run lint` — passes clean.
- Read the full component, not just the diff.

## What changed
1. Text content block: `pointer-events-none px-4 py-3 pr-10` → `pointer-events-none px-4 py-3` (drops the reserved ~40px right gutter).
2. Trash button: static `className` string → conditional `[...].join(' ')` adding a row-matching backing chip (`bg-gray-100 dark:bg-gray-800` when selected, else `bg-gray-50 dark:bg-gray-900`).

## Correctness assessment
- **Guards preserved.** The Phase 17 gate (`session.endedAt != null`, line 111), the `preventDefault`/`stopPropagation` → `setConfirmId` click handler (lines 119–123), the stretched `Link` at `z-0` (line 88), the `pointer-events-none` text pattern (line 93), and the `DeleteConfirmDialog` wiring are all untouched. ✓
- **Chip color matches the row in the visible states.** The chip is part of the button, which is `opacity-0` until `group-hover:opacity-100` / `focus:opacity-100`. On hover the unselected row background is `hover:bg-gray-50 dark:hover:bg-gray-900`, which the chip's `bg-gray-50 dark:bg-gray-900` matches exactly. Selected rows are `bg-gray-100 dark:bg-gray-800`, matched by the selected branch. The selected branch carries no hover variant, so a hovered selected row stays gray-100/gray-800 and the chip still matches. ✓
- **Z-order intact.** Button `z-10` stays above the stretched `Link` (`z-0`) and the default-stacked `pointer-events-none` text, so the chip masks the glyphs underneath and the button remains clickable. ✓
- **No type/runtime concerns.** The `[...].join(' ')` className pattern mirrors the existing row className construction (lines 78–83); valid TSX, confirmed by typecheck.

## Minor observations (non-blocking, no action required)
- **Keyboard focus without hover.** The button also reveals on `focus:opacity-100`. When focused via keyboard while the row is *not* hovered, an unselected row's base background is transparent/white, but the chip renders `bg-gray-50 dark:bg-gray-900` — a faint gray box rather than a perfect blend. This is cosmetic and arguably *aids* legibility (it still backs the glyph); it does not affect behavior. Pre-existing reveal logic, not introduced by this change.
- **Overlap over trailing content.** With the gutter removed, a long truncated title can push the `ModuleBadge` close to the right edge, so on hover the button/chip may partially overlay the badge. This is the intended "float over the trailing text" behavior per the spec, and the chip covers only ~24px around the glyph. No defect.

No bugs, security issues, or correctness problems found. The implementation matches the plan and spec exactly.

REVIEW_PASS
