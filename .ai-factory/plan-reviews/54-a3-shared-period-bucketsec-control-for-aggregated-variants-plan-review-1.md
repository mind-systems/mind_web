# Plan Review: (A3) Shared period (`bucketSec`) control for aggregated variants

**Plan:** `54-a3-shared-period-bucketsec-control-for-aggregated-variants.md`
**Risk Level:** 🟢 Low
**Verdict:** Solid — implementable as written. A few advisory notes below; none blocking.

## Verification against the codebase

I read every file the plan targets and confirmed the plan's assumptions hold:

- **`chartVariants/types.ts`** — `ChartVariant` is exactly `{ id, label, Component: ComponentType<{ session }> }`. The proposed prop widening to `{ session; bucketSec: number | null }` plus the new `aggregated: boolean` field is accurate.
- **`chartVariants/makeWindowedVariant.tsx`** — matches the plan: `WindowedVariantConfig` has `windowSec(session)` and `buildPath(session)`, the `useMemo` deps and eslint-disable comment are present as described, and `return { id, label, Component }` is where `aggregated` must be added. The `../bucketPolicy` import path resolves correctly (registry.ts already imports `computeBucketSec` from `../bucketPolicy`).
- **`chartVariants/registry.ts`** — `rawVariant` (`windowSec: () => 30`, raw `?from&to`) and `minmaxVariant` (two `computeBucketSec(session.durationSeconds)` calls, absolute-grid `qFrom`/`qTo` quantization with `bucketSec * 1000` step) are exactly as the plan describes. `DEFAULT_VARIANT_ID = 'minmax'` and the "do not add avg/lttb now" comment are present.
- **`SessionCharts.tsx`** — the shell owns `selectedId` via `useState`, renders `<VariantSelector>` and `<V session key={`${session.id}:${selectedId}`} />`. The proposed `periodSec` state, `<PeriodInput>`, `bucketSec` prop, and extended remount key slot in cleanly.
- **`VariantSelector.tsx`** — the sole consumer of `ChartVariant` beyond registry/factory; uses only `id`/`label`, so the prop-type change does not ripple here.
- **`useBiometricWindows.ts`** — its reset effect keys on `[session.id, totalWindows]` (line 202), confirming the plan's claim that a `windowSec` change → `totalWindows` change fires the reset, and that the Task 5 remount key covers the same-`totalWindows` case. The `useBiometricWindows` signature (`windowSec`/`buildPath`) is unchanged by this plan, correctly.

**No other consumers.** `grep` for `ChartVariant | .Component | CHART_VARIANTS | aggregated` finds only the files the plan already edits. No tests reference these modules (consistent with `Testing: no`).

## Context Gates

- **Architecture (ARCHITECTURE.md):** ✅ No violations. `PeriodInput` is a page-local presentational component under `pages/SessionsPage/` (allowed to be purely presentational; no fetch, no storage). Period state lives as `useState` in the page-level shell (`SessionCharts`), matching principle 5 ("local UI state lives in `useState`"). No `localStorage` — honors the rule that only `core/auth`/`core/api` touch storage.
- **Rules (RULES.md):** File is empty — no explicit conventions to check. Project CLAUDE.md rules honored: English-only, no `mind_auth_token` rename, no proto edits, HTTP still routed through the injected `buildPath` → `apiFetch` in the loader (no raw fetch added), and `PeriodInput` receives all data as props (no `useQuery` inside it). ✅
- **Roadmap (ROADMAP.md):** ✅ Strong linkage. The A3 entry (line 179) matches the plan point-for-point: `{ session, bucketSec: number | null }` props, `null = Auto = computeBucketSec(duration)`, `aggregated: boolean` on the factory config, shell-owned `periodSec` + input (positive int, empty ⇒ Auto, on-blur, disabled when Raw), remount key includes the period, free input with NO ladder snap, period ⟂ algorithm, web-only/no API change, no `localStorage`.

## Critical Issues

None.

## Advisory Notes (non-blocking)

1. **Header layout — placement relative to `VariantSelector` (WARN).** `VariantSelector`'s root carries `ml-auto` (line 16), which consumes all free space to its left and pins it to the right edge of the flex header. If `PeriodInput` is rendered as a plain sibling *before* `<VariantSelector>`, it will be pushed to the left (next to the duration/difficulty text), not "next to" the selector as intended. To keep them adjacent on the right, the implementer should either (a) wrap both controls in a single `ml-auto` container and drop `ml-auto` from `VariantSelector`, or (b) move `ml-auto` onto `PeriodInput` and render it first. Task 5 says "next to `<VariantSelector>`" without specifying this — worth calling out so the header renders as designed.

2. **Server accepts arbitrary integer `bucketSec` — assumption confirmed (positive note, but note the integer constraint).** I verified `mind_api/src/sessions/dto/time-range-query.dto.ts`: `bucketSec` is `@IsOptional @IsInt @Min(1)` — any integer ≥ 1, no ladder restriction server-side. This validates the "no API change" and "free seconds input, no ladder snap" assumptions. **Implication for Task 4:** the commit path MUST produce an integer (the plan already says "parse a positive integer" and clamp to `[1, maxSec]` — good). Ensure the parsed value is coerced to an integer (e.g. reject/truncate decimals) so a value like `12.5` never reaches the query string; the server would 400 on a non-integer `bucketSec`.

3. **`maxSec` clamp is safe against the min/max window math (positive note).** With `effBucketSec` clamped to `[1, durationSeconds]`, the `minmaxVariant.windowSec` formula `Math.max(Math.ceil(raw / effBucketSec) * effBucketSec, effBucketSec)` degrades gracefully: at `effBucketSec = durationSeconds` it yields `windowSec = durationSeconds` → `totalWindows = 1`. No division-by-zero (min is 1) and no degenerate empty render. Good that the clamp upper bound is the session duration rather than unbounded.

4. **`PeriodInput` does not remount on variant/period change (positive note).** Because it lives in the header (outside the keyed body), it retains its draft across variant switches and period commits — matching the "period ⟂ algorithm" guard. The `useEffect` that syncs the draft from `value` correctly reflects clamping back into the visible field (e.g. user types `999999`, sees it snap to `maxSec`). No feedback loop since `value: number|null` → `draft: string` and the effect only runs on `value` change.

## Positive Notes

- The **scope-reconciliation assumption** (milestone text names avg/lttb, but only `minmax` is aggregated today) is well-reasoned and matches both the A2 registry guard and the roadmap's "future one-line addition" framing. The plan correctly resists adding avg/lttb now.
- **Belt-and-suspenders reload reasoning** (Task 2 + Task 5) is correct and explicitly justified: the remount key guarantees a clean loader per period even when two periods yield the same `totalWindows`, and the `useMemo` deps keep `windowSec`/`buildPath` honest.
- **No-`localStorage` decision** for the input (blur + Enter commit, no debounce timer) is a clean choice that keeps the input purely local UI state and honors the storage rule.
- Commit plan is coherent: contract+factory+registry first (compiles as a unit since Task 3 threads the new signatures), then shell wiring.

PLAN_REVIEW_PASS
