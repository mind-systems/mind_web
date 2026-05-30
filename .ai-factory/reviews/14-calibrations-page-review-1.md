# Code Review: `/calibrations` page (14-calibrations-page)

**Scope reviewed:** `src/core/types/index.ts`, `src/pages/CalibrationPage/{index.tsx,CalibrationChart.tsx,chartOption.ts,format.ts,transforms.ts}`.
**Verification:** `npm run typecheck` ✅ clean, `npm run lint` ✅ clean. Backend contract cross-checked against `mind_api/src/nfb-calibration/*` (entity, service, REST controller).

**Verdict:** No blocking bugs. The implementation is correct and matches both the plan and the live API contract. A few low-severity / non-blocking notes below.

---

## Verified correct

- **API contract matches exactly.** `NfbCalibrationRestController.list` returns `{ records, total }`, service orders `createdAt DESC`, `take` defaults to 50 / caps at 200, `skip = offset`. The frontend query (`?limit=50&offset=${pageParam}`) and `getNextPageParam` (sum of loaded `records.length` vs `total`) align with this and mirror the proven `SessionsPage` pattern.
- **Type accuracy.** The entity confirms all numeric fields (`individualFrequency`, `individualPeakFrequencyPower`, etc.) are non-nullable `double precision`, and `failReason` is `nullable: true`. The DTO in `core/types/index.ts` types them as `number` and `string | null` respectively — accurate. `calibratedAt`/`createdAt` are `timestamptz` (serialize to ISO strings over JSON), so typing as `string` is correct.
- **Grouping + chronological sort.** `groupByDevice` preserves first-seen device order and sorts each group ascending by `calibratedAt`, correctly reversing the server's `createdAt DESC` order so charts plot left→right over time. Handles cross-page record spread correctly (regrouping runs over all loaded records each render).
- **Validity dot styling.** Valid → filled green (`color` + `borderColor` green); invalid → hollow red (transparent fill, red border). Lines keep their own stable `lineStyle.color` (blue / orange) so dot semantics don't clash with line identity. Matches the spec.
- **IntersectionObserver lifecycle.** The effect re-subscribes on `hasNextPage` / `isFetchingNextPage` changes, the callback is guarded with `hasNextPage && !isFetchingNextPage`, and `observer.disconnect()` cleanup is correct. The "sentinel only mounts after data loads" case is handled because `hasNextPage` transitions `false → true` trigger the effect re-run that attaches the observer. No stale-closure bug (React Query's `fetchNextPage` is referentially stable).
- **Tooltip indexing.** `params[0].dataIndex` indexes into the closed-over `records` array, which is built in the same order as the series data — alignment is correct. ECharts extracts `params.value` from object-form data items, so `item.value` resolves to the numeric value.
- **States.** `isLoading` → skeleton, `isError` → inline red message, empty → centered "No calibrations recorded yet" (exact roadmap text). Architecture rules respected: page owns the query, `CalibrationChart` is a pure prop-driven renderer, local `format.ts` avoids the cross-page-import anti-pattern, no raw `fetch`/`localStorage`.

---

## Non-blocking notes

1. **(Low / security) Unescaped `failReason` in tooltip HTML.** `chartOption.ts` interpolates `record.failReason` directly into the tooltip's returned HTML string (`Reason: ${record.failReason}`), which ECharts renders as raw HTML. This is **self-XSS only** — records are filtered by `userId` server-side, so a user could only inject markup originating from their own device's `failReason` into their own tooltip. Severity is low, but since `failReason` is free-form text passed through from the device SDK, consider HTML-escaping it (or rendering via a non-HTML path) for hygiene. Not blocking.

2. **(Cosmetic) Raw float precision in tooltip and on the axis.** `individualFrequency` / `individualPeakFrequencyPower` are `double precision` and are rendered verbatim (`<b>${item.value}</b>`), which may show long values like `10.2374312`. Consider `toFixed(2)` (or similar) for readability. Cosmetic only.

3. **(Observation) Page is not reachable via in-app navigation.** Neither the `SessionsPage` header nor this page links to `/calibrations`; it is only reachable by typing the URL. This is consistent with the current app state and the roadmap item does not request navigation, so it is out of scope for this milestone — flagging only so it isn't lost. A shared nav/header is a natural future task.

4. **(Trivial / perf) `groupByDevice` recomputes every render.** `deviceGroups` is derived (group + sort) on every render rather than memoized via `useMemo`. Negligible for realistic calibration volumes; mentioning only for completeness.

None of the above change behavior in a way that breaks the feature. The code is ready as implemented; items 1 and 2 are worth a quick follow-up touch.
