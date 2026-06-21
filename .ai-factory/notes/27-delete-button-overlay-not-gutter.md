# Delete button overlays the row text instead of reserving a gutter

**Date:** 2026-06-21
**Source:** conversation context

## Key Findings

- After Phase 16, the trash button is absolutely positioned (`absolute right-2 top-2`) but the row's text block carries a permanent **`pr-10`** right padding (`SessionList.tsx`, the content `<div className="pointer-events-none px-4 py-3 pr-10">`). That `pr-10` reserves a fixed ~40px gutter on **every** row at all times — so the title/meta are permanently squeezed even though the button only appears on hover. The user wants the button to float **over** the text on hover, with no permanently reserved zone.
- Fix is layout-only: drop the reserved gutter so text spans the full row width, and let the hover-revealed button overlay the trailing text. Add a small backing behind the button so the icon stays legible over glyphs underneath.

## Details

### Scope — single atomic milestone, follow-up to Phase 16

Pure CSS/markup tweak in `src/pages/SessionsPage/SessionList.tsx`. No behavior, data, or API change. The button's existing gating (`session.endedAt != null`, Phase 17), click handling (`preventDefault`/`stopPropagation`), and the stretched-`Link` overlay pattern all stay.

### Change — `SessionList.tsx`

- Replace the content block's `pr-10` with the normal horizontal padding (`px-4 py-3`, i.e. drop the extra right reserve) so the title (`truncate`) and meta line use the full width.
- Keep the button `absolute right-2 top-2 z-10` (already above the stretched `Link` at `z-0` and the `pointer-events-none` text). On hover it now sits **on top of** the trailing text rather than in a cleared gutter.
- Legibility over text: give the button a backing so the trash glyph doesn't collide with characters underneath. Two options — pick the cleaner:
  - a small rounded chip matching the row background (`rounded bg-gray-50 dark:bg-gray-900` on hover state — but the row bg also changes on hover/selected, so match `group-hover:bg-gray-50`/selected `bg-gray-100`), or
  - a left-edge gradient fade behind the button (`bg-gradient-to-l from-gray-50 dark:from-gray-900` over a slightly wider hit area) so the text dissolves under the icon.
  The chip is simpler and robust against the selected-row background (`bg-gray-100 dark:bg-gray-800`); if used, give the chip the same conditional background as the row so it blends in both selected and unselected states.

### Guards / verify

- No reserved right padding when the button is hidden — the title uses the full width and truncates at the row edge.
- On hover, the trash button appears over the trailing text and remains clearly visible/legible (backing prevents glyph collision) in light, dark, selected, and unselected rows.
- Clicking the button still opens the confirm dialog without navigating/selecting (`preventDefault`/`stopPropagation` unchanged); the stretched `Link` still captures whole-row clicks elsewhere.
- Button still only renders for finalized sessions (Phase 17) and only on hover/focus.

## Open Questions

None — this is a contained layout refinement.
