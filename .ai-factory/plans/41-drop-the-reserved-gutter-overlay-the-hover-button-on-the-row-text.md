# Plan: Drop the reserved gutter; overlay the hover button on the row text

## Context
Remove the permanent `pr-10` right gutter from each session row's text block so the title and meta line use the full row width, and back the hover-revealed trash button with a row-matching chip so it stays legible when it floats over the trailing text.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Layout & overlay

- [x] **Task 1: Drop the reserved right gutter on the text block**
  Files: `src/pages/SessionsPage/SessionList.tsx`
  In the text content block (currently `<div className="pointer-events-none px-4 py-3 pr-10">`, around line 93), remove the `pr-10` extra right reserve so the class becomes `pointer-events-none px-4 py-3`. The title (`min-w-0 truncate`) and the meta line then span the full row width and truncate at the row edge. Do not touch the `pointer-events-none` text pattern or the stretched `Link` (`absolute inset-0 z-0`).

- [x] **Task 2: Back the trash button with a row-matching chip for legibility** (depends on Task 1)
  Files: `src/pages/SessionsPage/SessionList.tsx`
  The button (around line 112) now floats over the trailing text on hover, so add a backing chip so the glyph stays legible over characters underneath. Keep the existing positioning/visibility classes (`absolute right-2 top-2 z-10`, `opacity-0 ... focus:opacity-100 group-hover:opacity-100`, `rounded p-1 text-gray-400 transition-opacity hover:text-red-600`). Add a conditional background that matches the row in both states so the chip blends in: when the row is selected use `bg-gray-100 dark:bg-gray-800`, otherwise use `bg-gray-50 dark:bg-gray-900` (the row's hover background — the chip only shows on hover/focus, so this matches the hovered row). Build the className conditionally on `isSelected`, mirroring the row's existing selected/unselected background classes (rows use `bg-gray-100 dark:bg-gray-800` selected vs `hover:bg-gray-50 dark:hover:bg-gray-900` unselected).
  Verify legibility in light, dark, selected, and unselected rows.

  Guards (do NOT change):
  - The Phase 17 gate `session.endedAt != null` wrapping the button.
  - The click handling `e.preventDefault()` / `e.stopPropagation()` → `setConfirmId(session.id)`.
  - The stretched `Link` (`z-0`) and the `pointer-events-none` text pattern.
  - The `DeleteConfirmDialog` confirm-dialog wiring.
  This is layout/markup only — no behavior, data, or API change.

## Verification
- No reserved right padding when the button is hidden: title uses full width and truncates at the row edge.
- On hover, the trash button appears over the trailing text and stays clearly legible (chip backing prevents glyph collision) in light, dark, selected, and unselected rows.
- Clicking the button still opens the confirm dialog without navigating or selecting the row; the stretched `Link` still captures whole-row clicks elsewhere.
- Button renders only for finalized sessions and only on hover/focus.
- `npm run lint` and `npm run typecheck` pass.
