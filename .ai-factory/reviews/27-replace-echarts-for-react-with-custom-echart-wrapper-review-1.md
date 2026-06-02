# Code Review: Replace echarts-for-react with custom EChart wrapper

**Plan:** `27-replace-echarts-for-react-with-custom-echart-wrapper.md`
**Scope reviewed:** `git diff HEAD` + `git status` — `src/components/EChart/index.tsx` (new), `src/pages/SessionsPage/SessionCharts.tsx`, `src/pages/CalibrationPage/CalibrationChart.tsx`, `package.json`, `package-lock.json`, plus doc/roadmap edits.

## Verdict

🟢 No blocking issues. The change is correct, minimal, and behavior-preserving. A few low-severity / informational notes below.

## Verification performed

- `npm run typecheck` → **passes**. Confirms `import type { EChartsOption } from 'echarts'`, `useRef<echarts.ECharts | null>` (echarts 6 re-exports `EChartsType as ECharts` — verified in `node_modules/echarts/types/dist/echarts.d.ts`), `echarts.init()` return type, and `React.CSSProperties` (global namespace from `@types/react`) all resolve.
- `npm run lint` → **passes**. No `react-hooks/exhaustive-deps` complaints: refs are exempt, and `[option, notMerge]` is complete for the second effect.
- `grep` for `echarts-for-react` / `ReactECharts` across `src/` → **0 matches**. Both call sites fully swapped; the dependency is removed from both `package.json` and `package-lock.json` (along with its transitive `size-sensor`; `fast-deep-equal` correctly demoted to `dev`).
- `vite build` / `npm run dev` could **not** be executed in this environment: the local runtime is Node 18.15.0 while Vite 8 requires Node ≥20 (`package.json` `engines` already declares `>=20`). This is an environment limitation, not a code defect — `tsc -b` completed before the Vite CLI failed to launch. The original `tslib` resolution failure is eliminated by construction, since the offending package and its undeclared `tslib` import path no longer exist in the dependency graph.

## Findings

### 1. CalibrationChart re-applies `setOption` on every render — minor behavior change (LOW)
`CalibrationChart.tsx:12` builds `const option = buildCalibrationChartOption(records)` with no memoization, so a fresh object reference is produced on each render. The new wrapper's `[option, notMerge]`-keyed effect then calls `setOption(option, true)` on every parent re-render.

This is a subtle deviation from the prior behavior: `echarts-for-react` guarded `setOption` with `fast-deep-equal` (the now-removed `fast-deep-equal` dependency), so an unchanged option value was *not* re-applied. With `notMerge: true`, each re-application is a full chart rebuild. The plan states "No chart behavior changes," and this is the one place where behavior differs in principle.

Practical impact is small — `CalibrationChart` has no interactive state to lose (no `dataZoom`; tooltips are ephemeral) and re-renders are infrequent. `SessionCharts` is unaffected because its `option` is already `useMemo`-ized (`SessionCharts.tsx:49`).

Recommendation (optional, for parity + to honor the "no behavior changes" goal): wrap the builder in `useMemo`:
```ts
const option = useMemo(() => buildCalibrationChartOption(records), [records]);
```

### 2. `chartRef.current` not nulled after `dispose()` (LOW — hardening)
In the mount effect cleanup (`EChart/index.tsx:24-27`), `chart.dispose()` is called but `chartRef.current` keeps pointing at the disposed instance. No current code path calls `setOption` on a disposed instance (effects run top-to-bottom, so the option effect always re-runs after the mount effect within any commit/StrictMode cycle, and the mount effect re-assigns the ref first), so this is not a live bug. It is a latent footgun if the component grows. Suggest adding `chartRef.current = null;` after `dispose()`.

### 3. Wrapper assumes caller provides a height (INFO)
`style` is optional, but `echarts.init` measures the container at mount; a zero-height container renders nothing. Both current consumers pass an explicit `height` (`SessionCharts.tsx:95`, `CalibrationChart.tsx:24`), so this is fine today. Worth a one-line caveat if `EChart` is reused elsewhere later.

### 4. Container resize handling is sound (INFO — confirmed, not a defect)
`ResizeObserver` is set up and `disconnect()`ed before `dispose()` in cleanup — correct order, no teardown race. This observer is load-bearing for `SessionCharts`, whose container height varies per session (`gridCount`-driven): ECharts does not re-measure the DOM on `setOption`, only on `resize()`, and the observer fires before paint when the inline `style.height` changes, so height transitions between sessions are handled correctly.

## Positive notes

- Correct root-cause fix: deleting the package removes the undeclared-`tslib` import path entirely rather than patching around it.
- Prop shape (`option` / `style` / `notMerge`) is a drop-in match; both swaps are purely mechanical with no prop changes.
- Effect structure is correct for React StrictMode's double-invoke (init → dispose → init), and the option effect's optional chaining guards the gap.
- Architecture respected: `EChart` is a stateless presentational component in `src/components/`, depends only on `echarts` + React, touches no `core/api`, `localStorage`, or `pages/`.
- Docs kept in sync (`DESCRIPTION.md` charts line, `ROADMAP.md` Phase 9, `README.md`).
