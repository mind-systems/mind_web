# Plan Review: `/calibrations` page (14-calibrations-page.md)

**Files/areas verified:** plan vs. live backend (`mind_api/src/nfb-calibration/*`), frontend (`SessionsPage` patterns, `core/api/client.ts`, `core/types`, `router.tsx`), and `.ai-factory` context (ARCHITECTURE, ROADMAP, rules).

**Risk Level:** 🟢 Low — plan is accurate and implementable. No blocking issues found.

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** `WARN` (cosmetic only). The documented folder example names the calibration sub-component `CalibrationTrends.tsx`; the plan names it `CalibrationChart.tsx`. The ARCHITECTURE tree is illustrative, not normative, and `CalibrationChart` is clearer for a per-device chart — acceptable deviation, just noting the divergence from the doc. All hard dependency rules are respected: page owns the `useInfiniteQuery`, sub-components are pure prop-driven renderers, no raw `fetch`/`localStorage`, transforms live in a named `transforms.ts` (not inline JSX), and the explicit "no cross-page import — create a local `format.ts`" instruction directly honors the anti-pattern in ARCHITECTURE.md.
- **Rules (`.ai-factory/rules/base.md`):** Pass. PascalCase components / camelCase utils respected. One reminder: "No console.log in production code" + plan's "Logging: minimal" — keep any logging out of the shipped code.
- **Roadmap (`.ai-factory/ROADMAP.md`):** Pass. Maps directly to the open Phase 4 item "`/calibrations` page". Plan satisfies every roadmap requirement: group by `deviceSerial`, per-device header with "valid / total" badge, two lines (`individualFrequency`, `individualPeakFrequencyPower`), hollow-red/filled-green validity dots, tooltip with `calibratedAt`/`isValid`/`failReason`, empty state text "No calibrations recorded yet" (exact match), and offset load-more on scroll.

## Verified Correct (no action needed)

- **API contract is real and matches.** `NfbCalibrationRestController` serves `GET /nfb-calibrations`, guarded by `JwtAuthGuard`, returns `{ records, total }`. The entity has exactly the 13 fields the plan lists. The service orders `createdAt DESC`, `take` defaults to 50 and caps at 200, `offset` → `skip`. The plan's contract notes are faithful.
- **Date field typing.** Entity columns `calibratedAt`/`createdAt` are `Date` (`timestamptz`) server-side but serialize to ISO strings over JSON — so typing them as `string` in the DTO is correct.
- **Pagination shape.** `getNextPageParam` (sum of loaded `records.length` vs `total`) mirrors the working `SessionsPage` implementation. `initialPageParam: 0`, `apiFetch<NfbCalibrationsResponse>` usage, and `data.pages.flatMap(...)` are all consistent with the codebase.
- **Color constants.** `#5BAD6F` (green) / `#E96F6F` (red) already exist in `SessionsPage/chartOption.ts` — palette stays consistent.

## Non-Blocking Notes (consider during implementation)

1. **Line color vs. validity-dot color is under-specified (Task 3).** The plan defines green/red for *validity dots* but never states the color of the two connecting *lines*. With per-point `itemStyle` driving dot color, the two series still need their own stable `lineStyle.color` so the legend and the two lines remain distinguishable (otherwise both lines may inherit ambiguous colors and clash with the validity semantics). Recommend: give each series a neutral distinct line color (e.g. reuse the EEG palette — Hz line `#4B9CD3`, Power line `#E89B2A`) and keep green/red strictly for the dot fill/border. Worth making explicit before coding.

2. **Sort key vs. server order (Task 2).** The chart sorts ascending by `calibratedAt`, but the server paginates by `createdAt DESC`. These are effectively identical (a record is created right after calibration), so in practice fine. If backfilled/imported calibrations ever exist where the two timestamps diverge, page boundaries could interleave slightly on the chart. Not a concern for the MVP; flagging for awareness only.

3. **`trigger: 'axis'` tooltip formatter receives an array (Task 3).** With two series and axis trigger, the formatter gets `params: TooltipParam[]`. Read `params[0].dataIndex` to index the closed-over `records` array. The plan says "via `dataIndex`" — just ensure it reads from the array element, not a single object.

4. **IntersectionObserver is a new pattern (Task 5).** `SessionsPage` uses a "Load more" button (`SessionList.tsx`), not an observer — so "follow existing SessionsPage patterns" applies to `useInfiniteQuery`/`getNextPageParam` (true) but not to the scroll mechanism (new). The observer approach actually matches the ROADMAP wording ("load more … as the user scrolls down") better, so it's an improvement. Implementation reminders: observe a sentinel inside the scrollable body (set `root` to that container or rely on viewport correctly), guard the callback with `hasNextPage && !isFetchingNextPage`, and ensure the effect re-subscribes when the sentinel ref / `hasNextPage` changes.

5. **`EChartsOption` import (Task 3).** Match `SessionsPage/chartOption.ts`: `import type { EChartsOption } from 'echarts'`.

## Positive Notes

- Strong codebase grounding: the plan correctly identifies the existing stub, the routed+protected `/calibrations` entry, and the `useInfiniteQuery` precedent.
- Proactively avoids the cross-page-import anti-pattern by mandating a local `format.ts`.
- Clean phase/dependency ordering and a sensible 3-commit plan.
- No migrations needed — the `nfb_calibration_records` table and endpoint already exist; this is a frontend-only change, correctly scoped.

The notes above are refinements, not corrections — none change the plan's structure or block implementation.

PLAN_REVIEW_PASS
