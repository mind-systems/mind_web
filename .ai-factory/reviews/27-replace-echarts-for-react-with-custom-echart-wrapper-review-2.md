# Code Review (pass 2): Replace echarts-for-react with custom EChart wrapper

**Plan:** `27-replace-echarts-for-react-with-custom-echart-wrapper.md`
**Scope reviewed:** `git diff HEAD` + `git status` — `src/components/EChart/index.tsx` (new), `src/pages/SessionsPage/SessionCharts.tsx`, `src/pages/CalibrationPage/CalibrationChart.tsx`, `package.json`, `package-lock.json`, plus doc/roadmap edits.

## Verdict

🟢 No bugs, security issues, or correctness problems found.

## Delta since review-1

The wrapper was hardened: `EChart/index.tsx:28` now sets `chartRef.current = null;` after `chart.dispose()` in the cleanup, resolving review-1 finding #2. No other code changed.

## Verification performed

- `npm run typecheck` → **passes**. `EChartsOption`, `echarts.ECharts` (echarts 6 re-exports `EChartsType as ECharts`), `echarts.init()`, and the global `React.CSSProperties` all resolve.
- `npm run lint` → **passes**. The `[]` and `[option, notMerge]` dependency arrays are correct (refs are exempt from `exhaustive-deps`).
- `grep` for `echarts-for-react` / `ReactECharts` in `src/` → **0 matches**. Dependency removed from `package.json` and lockfile; transitive `size-sensor` dropped, `fast-deep-equal` correctly demoted to `dev`.
- `vite build` / `npm run dev` not runnable in this environment (local Node 18.15.0 < Vite 8's required Node ≥20; `package.json engines` already declares `>=20`). `tsc -b` succeeds. The original `tslib` resolution failure is eliminated by construction — the package and its undeclared `tslib` import no longer exist in the graph.

## Correctness analysis (behavior parity with echarts-for-react)

- **Lifecycle:** init on mount, `dispose()` + `ResizeObserver.disconnect()` on unmount, ref nulled. Observer is disconnected before dispose — no teardown race. StrictMode's init→dispose→init cycle is safe; the option effect's optional chaining covers the gap.
- **Resize:** `ResizeObserver` on the container replaces `echarts-for-react`'s element-based `size-sensor` — equivalent coverage, including width-driven reflow on window resize (width is `100%`). Load-bearing for `SessionCharts`, whose height varies per session by `gridCount`.
- **`notMerge`:** defaults to `false` (echarts default); both call sites pass `notMerge`, so grid/axis count changes between sessions are cleared correctly.
- **Renderer/theme:** `echarts.init(dom)` with no opts uses the canvas renderer and default theme — same as the prior wrapper.

## Observation (optional polish, not a defect — no action required)

`CalibrationChart.tsx:12` builds `option` without `useMemo`, so the wrapper's `[option]` effect calls `setOption` on each re-render where the reference changes. `echarts-for-react` deep-compared via `fast-deep-equal` and skipped no-op updates. In practice this is immaterial: the page is read-only, `CalibrationChart` re-renders only when its `records`/`validCount` props settle, and the chart has no interactive state (no `dataZoom`) to lose — rendered output is identical. `SessionCharts` already memoizes its option, so it is unaffected. Wrapping the builder in `useMemo(() => buildCalibrationChartOption(records), [records])` would restore exact parity, but this is neither a bug nor a correctness issue.

## Positive notes

- Root cause removed at the source rather than patched around.
- Drop-in prop shape (`option` / `style` / `notMerge`); both swaps are purely mechanical.
- Respects architecture: stateless presentational component in `src/components/`, depends only on `echarts` + React.
- Docs kept in sync (`DESCRIPTION.md`, `ROADMAP.md` Phase 9, `README.md`).

REVIEW_PASS
