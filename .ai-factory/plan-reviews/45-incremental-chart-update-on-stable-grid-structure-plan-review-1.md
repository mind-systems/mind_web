# Plan Review: Incremental chart update on stable grid structure

**Plan:** `.ai-factory/plans/45-incremental-chart-update-on-stable-grid-structure.md`
**Files reviewed:** 4 (plan, `chartOption.ts`, `SessionCharts.tsx`, `EChart/index.tsx`) + context (note 30, ROADMAP, ARCHITECTURE, base rules)
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`)** — PASS. Both edited files live under `pages/SessionsPage/`; `notMerge` is passed *into* the shared `EChart` component as a prop. This respects the dependency rule (`pages/ → components/`) and the "components receive data as props" convention. No boundary crossing introduced.
- **Rules (`.ai-factory/rules/base.md`)** — PASS. No new `console.*`, no storage access, no auth/env touch. Naming stays `camelCase` (`structureSignature`, `prevSignatureRef`, `notMerge`).
- **Roadmap (`.ai-factory/ROADMAP.md`)** — PASS. The plan directly implements the single unchecked item at line 147 ("Incremental chart update on stable grid structure"), and is correctly sequenced *after* notes 28/29/31 (all `[x]` done), matching the "order by risk: 28 → 31 → 29 → 30" directive in the Phase summary.

## Verification of plan assumptions against the codebase

All concrete claims in the plan were checked against the source and hold:

- **Return shape** — `buildSessionChartOption` currently returns `{ option, height, gridCount }` (`chartOption.ts:95`). Extending it with `structureSignature` is additive and non-breaking. Grep confirms **only** `SessionCharts.tsx` and `chartOption.ts` reference the function — no other callers, and no test files (consistent with `Testing: no`).
- **`gridDefs` source for the signature** — `gridDefs` (`chartOption.ts:177-183`) is built from presence flags in fixed order `instruction,hr,eeg,emot,motion`, each with a stable role-based `id`. `gridDefs.map(d => d.id).join(',')` is a correct, data-length-independent signature. Empty array → `""`, matching the `gridCount === 0` case.
- **Line anchors are accurate** — memo at `SessionCharts.tsx:95-108`; existing `zoomRef.current` render-read with `// eslint-disable-next-line react-hooks/refs` at line 104; hardcoded `notMerge` prop at line 164; top-of-file comment at lines 3-9; `buildLineSeriesEntry` doc at lines 37-41; `buildSessionChartOption` doc at lines 75-87. All confirmed.
- **`react-hooks/refs` rule is real and enforced** — `eslint-plugin-react-hooks@7.1.1` with `reactHooks.configs.flat.recommended` is active in `eslint.config.js`, and line 104 already carries this exact suppression. The plan's mandatory lint instruction is correct — and note 30 flags this as "the single recurring gap that failed three plan-review rounds," so its explicit inclusion is the right call.
- **EChart wrapper needs no change** — `EChart/index.tsx:47-53` keys its `setOption` effect on `[option, notMerge, isDark]` and applies `notMerge ?? false`. Passing a dynamic boolean works as-is; switching `notMerge` (bare `true`) to `notMerge={notMerge}` is valid.

## Correctness analysis of the core mechanism

The read-in-render / write-in-effect pattern is sound:

- **First paint** → `prevSignatureRef.current` is `null` → `notMerge === true` → full rebuild. Correct.
- **Same grid set, new data** → signature unchanged, effect has synced ref → `notMerge === false` → merge-by-`id`, swapping each series' `data`. This is the optimization, and it is safe because series carry stable ids and the present-grid set (hence numeric `xAxisIndex`/`yAxisIndex`) is identical.
- **New grid appears** → signature delta → `notMerge === true` for exactly one render → full rebuild avoids the creation-order axis cross-wiring documented at `chartOption.ts:75-87`. The next chunk merges again. Correct and self-limiting.
- **Effect ordering** — child `EChart` effects commit before the parent ref-update effect (React runs child effects before parent effects), so `notMerge` is applied before the ref advances. The plan states this explicitly and it is accurate.
- **StrictMode / concurrent safety** — reading a ref in render and writing only in a committed effect is the React-recommended "compare-to-previous-committed-value" pattern. A discarded render never commits, so it never advances the ref; the worst case is a redundant `notMerge=true` (full rebuild) which is always safe. No false `notMerge=false` is possible on first mount.
- **Monotonic grid set** — within a session, chunks only accumulate, so grids only ever appear, never disappear. Even a hypothetical disappearance would change the signature → full rebuild → safe. Merge-without-`replaceMerge` (which handles removals poorly) is therefore never exercised on a shrinking set. The plan's "treat any signature delta as a full rebuild" guard covers this defensively.
- **Zoom preservation** — the option memo still encodes `zoom.start/end` into both `dataZoom` entries (count always 2 → merged by index, no jump), and the memo dependency array is unchanged, so `zoomRef` behavior is identical on both paths. `yAxis.scale: true` extents recompute from merged series data under `setOption` merge — standard ECharts behavior.
- **Wholesale `data` replacement, not `appendData`** — correctly mandated. Note 29 (`[x]` done) guarantees `biometrics` is globally time-sorted via merge-insert, so replacing each series' full sorted array avoids the out-of-order-`appendData` X-zigzag hazard. The plan references this correctly.

## Critical Issues

None.

## Minor Notes (non-blocking, optional)

- **Loading-phase renders before `EChart` mounts:** the new `useEffect(() => { prevSignatureRef.current = structureSignature }, [structureSignature])` runs on the parent regardless of whether `EChart` is in the tree, so during loading the ref may settle to `""`. When the first real data arrives the signature goes `"" → "hr,…"`, a delta → `notMerge=true` on the render where `EChart` first mounts. This still yields a full rebuild on first real paint (correct), and `prevSignatureRef` starting `null` independently guarantees the same. No action needed — just confirming the empty-string path was considered and is harmless.
- **Comment hygiene (Task 3) is genuinely load-bearing here**, not cosmetic: the existing comments at `chartOption.ts:37-41` and `:75-87` and `SessionCharts.tsx:3-9` assert the chart *always* full-rebuilds, which becomes actively misleading about the axis-binding invariant once merge is conditional. Keeping Task 3 in scope is the right decision; reviewers of the resulting diff will rely on those comments to understand why the structure signature exists.

## Positive Notes

- The plan is unusually well-grounded: every line reference, the exact lint rule, the wrapper effect deps, and the sorted-accumulation prerequisite (note 29) were all verified true against the current source.
- It correctly identifies and front-loads the historically failure-causing detail (the `react-hooks/refs` suppression) as a mandatory step.
- Scope is minimal and additive — one new return field, one ref, one render-time read, one effect, one prop swap, plus comment updates — with no API, type-breaking, or architectural changes.
- Phasing (signature → conditional merge → comments) with explicit `depends on` ordering is clean and matches the data dependencies.

PLAN_REVIEW_PASS
