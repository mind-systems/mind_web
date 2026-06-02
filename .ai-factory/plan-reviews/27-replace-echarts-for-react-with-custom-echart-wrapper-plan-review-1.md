# Plan Review: Replace echarts-for-react with custom EChart wrapper

**Plan:** `27-replace-echarts-for-react-with-custom-echart-wrapper.md`
**Verdict:** 🟢 Solid — no blocking issues. A few non-blocking refinements below.

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** ✅ PASS. `EChart` is a stateless, presentational shared component placed in `src/components/` and receives all data via props (`option`, `style`, `notMerge`). The dependency rule "components/ → core/types only" restricts *internal `src/` imports*; depending on the third-party `echarts` lib and React does not violate it (no `core/api`, no `pages/`, no `localStorage`). The plan calls this out explicitly. No boundary breach.
- **Rules (`.ai-factory/RULES.md`):** Not present. Project `CLAUDE.md` rules checked: no raw `fetch`, no storage access, no proto edits, English-only — none are touched by this change. ✅
- **Roadmap (`.ai-factory/ROADMAP.md`):** ✅ PASS. Properly linked as Phase 9 — "Dependency Health → Replace echarts-for-react with custom EChart wrapper". Milestone alignment is correct.
- **Skill-context (`.ai-factory/skill-context/aif-review/SKILL.md`):** Not present — no project-level review overrides to apply.

## Verified Against the Codebase

- **Call sites are exactly two**, both confirmed: `src/pages/SessionsPage/SessionCharts.tsx` and `src/pages/CalibrationPage/CalibrationChart.tsx`. No other `ReactECharts` / `echarts-for-react` usages exist. ✅
- **Line numbers are accurate:** SessionCharts import is line 3, the `<ReactECharts>` tag is line 95; CalibrationChart import is line 1, the tag spans lines 22–24. ✅
- **`package.json`** contains `"echarts-for-react": "^3.0.6"` and `"echarts": "^6.1.0"` — the plan removes the former and keeps the latter. ✅
- **Type usage is valid for echarts 6.** `import type { EChartsOption } from 'echarts'` is exported. `echarts.ECharts` resolves — echarts re-exports `EChartsType as ECharts`, so `useRef<echarts.ECharts | null>(null)` typechecks, and `echarts.init()` returns `EChartsType` (assignable to that ref). `npm run typecheck` should pass.
- **`@/*` path alias** is configured in `tsconfig.app.json` (`baseUrl: "."`, `paths: { "@/*": ["src/*"] }`), so `import { EChart } from '@/components/EChart'` resolves. ✅
- **Full `echarts` import is correct here.** The chart builders rely on grids, dataZoom, line/bar/scatter, tooltip etc. being registered. Using `import * as echarts from 'echarts'` (the full build) preserves that — matches the prior `echarts-for-react` behavior. (Had the plan used `echarts/core`, charts would silently break. It does not.) ✅
- **Both call sites always pass an explicit `height`**, so the init-time container measurement is non-zero. ✅

## Findings (non-blocking)

### 1. StrictMode double-invoke — make the mount effect robust (LOW)
`main.tsx` wraps the app in `<StrictMode>`, so in dev every effect runs setup → cleanup → setup. The plan's init/dispose pairing in the mount effect handles this correctly **provided declaration order is respected**: the mount effect (`echarts.init`) must be declared *before* the option effect (`setOption`) so that on the StrictMode remount the new instance exists before `setOption` is called. Two small hardening suggestions:
- After `chart.dispose()` in cleanup, also set `chartRef.current = null` — leaving the ref pointing at a disposed instance is a latent footgun if any future code reads it.
- The option effect already uses optional chaining (`chartRef.current?.setOption(...)`), which is the right guard. Keep it.

This is already implied by the plan; just call out the ordering and the null-out explicitly in the task so the implementer doesn't get it subtly wrong.

### 2. ResizeObserver: disconnect before dispose, guard the callback (LOW)
In the cleanup, disconnect the observer *before* `chart.dispose()` to avoid a `resize()` landing on a disposed instance. Also consider guarding the resize callback (`chartRef.current?.resize()`) — `ResizeObserver` fires an initial callback synchronously-ish on `observe()`, which is fine since the chart exists by then, but the guard costs nothing and prevents a teardown-race throw. Container height varies per session (gridCount-driven), and the ResizeObserver is precisely what makes the chart re-lay-out when the `style.height` changes between sessions — so this observer is load-bearing, not just cosmetic. Worth a one-line note that height changes are handled by the observer, not by `setOption`.

### 3. `CalibrationChart` rebuilds `option` every render (LOW / pre-existing)
`const option = buildCalibrationChartOption(records)` (line 12) produces a fresh object reference on every render. With the new wrapper's `[option, notMerge]`-keyed effect, that triggers a redundant `setOption` on each parent re-render. `echarts-for-react` had effectively the same behavior, so this is **not a regression** — but since `SessionCharts` already wraps its builder in `useMemo`, consider memoizing here too (`useMemo(() => buildCalibrationChartOption(records), [records])`) for consistency. Optional; out of strict scope.

### 4. Vite dep cache after dependency removal (INFO)
Removing `echarts-for-react` changes `package-lock.json`, which Vite uses to invalidate its `node_modules/.vite` pre-bundle cache automatically. If `npm run dev` still surfaces a stale `tslib`/import-analysis error during verification, clearing `node_modules/.vite` (or `vite --force`) resolves it. Worth adding to the verification step as a fallback, not a required step.

### 5. Shared-component defensiveness (INFO)
`style` is optional in the prop type but both call sites supply height. If `EChart` is reused later without a height, `echarts.init` measures a 0-height container and renders nothing. Optional: document that callers must provide a height, or default the container to a sane min-height. Not needed for the current two consumers.

## Positive Notes

- Correct root-cause framing (Rolldown externalizing an undeclared `tslib`) and the minimal, surgical fix — delete the package, add one ~30-line wrapper, swap two tags.
- Prop shape (`option` / `style` / `notMerge`) is a drop-in match for the existing call sites, so the swaps are mechanical and behavior-preserving.
- Dependency direction and component placement respect the architecture; the plan preemptively justifies the `components/` placement.
- Verification criteria are concrete and cover the actual failure mode (Vite import-analysis / tslib) plus visual parity and mount/unmount console cleanliness.

PLAN_REVIEW_PASS
