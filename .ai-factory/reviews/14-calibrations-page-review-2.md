# Code Review (round 2): `/calibrations` page (14-calibrations-page)

**Scope reviewed:** `src/core/types/index.ts`, `src/pages/CalibrationPage/{index.tsx,CalibrationChart.tsx,chartOption.ts,format.ts,transforms.ts}`.
**Verification:** `npm run typecheck` ✅ clean, `npm run lint` ✅ clean. Backend contract re-confirmed against `mind_api/src/nfb-calibration/*` (entity, service, REST controller).

**Verdict:** No bugs, security issues, or correctness problems. The two low-severity items raised in review-1 have been resolved; all other code is unchanged and was verified correct in round 1.

---

## Changes since review-1

Only `chartOption.ts` changed (123 → 131 lines). Both prior notes were addressed:

1. **`failReason` is now HTML-escaped.** A new `escapeHtml()` helper escapes `&`, `<`, `>`, `"` and is applied to `failReason` before it is interpolated into the tooltip HTML (`Reason: ${escapeHtml(record.failReason)}`). This closes the (self-only) markup-injection note from round 1. Escaping is sufficient for the HTML text context used here.
2. **Tooltip values are rounded.** Series values now render via `item.value.toFixed(2)` instead of raw floats — addresses the readability note. `param.value` for object-form data items (`{ value, itemStyle, symbol }`) resolves to the numeric value, so `.toFixed(2)` is safe; values are non-nullable `double precision` per the entity, so no null/undefined risk.

No regression introduced by these edits.

---

## Re-verified correct (unchanged files)

- **Contract & types** still match the live API: `{ records, total }`, `createdAt DESC`, numeric fields non-nullable `double precision`, `failReason` nullable, timestamps serialized as ISO strings. DTO types accurate.
- **Pagination** (`getNextPageParam` summing `records.length` vs `total`) mirrors the proven `SessionsPage` pattern.
- **Grouping/sorting** (`groupByDevice`) preserves first-seen device order and sorts each group ascending by `calibratedAt`, correctly reversing the server's DESC order.
- **Validity dots** — filled green (valid) / hollow red (invalid) with stable blue/orange line colors.
- **IntersectionObserver** lifecycle is sound: guarded callback, correct re-subscription on `hasNextPage`/`isFetchingNextPage`, proper `disconnect()` cleanup, no stale closures.
- **Tooltip dataIndex** aligns with the closed-over `records` array (series data built in the same order).
- **States**: skeleton / inline error / "No calibrations recorded yet" empty state, all correct. Architecture rules respected (page owns query, pure child component, local `format.ts`, no raw `fetch`/`localStorage`).

---

## Non-blocking observations (not defects, out of milestone scope)

- The page is reachable only by direct URL — no in-app nav link to `/calibrations` exists (consistent with the current app; `SessionsPage` likewise has none). A shared nav header is a natural future task, not part of this milestone.
- `deviceGroups` is recomputed each render rather than memoized — negligible at realistic data volumes.

Neither affects correctness.

REVIEW_PASS
