# Plan: Replace echarts-for-react with custom EChart wrapper

## Context
Drop the abandoned `echarts-for-react` package (its compiled output imports `tslib` without declaring it, which Vite 8's Rolldown bundler cannot resolve) and replace it with a minimal in-repo `EChart` wrapper built directly on the `echarts` API. No chart behavior changes.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Wrapper component

- [x] **Task 1: Create the EChart wrapper component**
  Files: `src/components/EChart/index.tsx`
  Create a new shared component exporting `EChart`. Props:
  ```ts
  interface EChartProps {
    option: EChartsOption;        // import type { EChartsOption } from 'echarts';
    style?: React.CSSProperties;
    notMerge?: boolean;
  }
  ```
  Implementation:
  - Render `<div ref={divRef} style={style} />`.
  - `useRef<HTMLDivElement>(null)` for the container and `useRef<echarts.ECharts | null>(null)` for the chart instance.
  - Mount `useEffect` (run once): `const chart = echarts.init(divRef.current!); chartRef.current = chart;`. Set up a `ResizeObserver` on `divRef.current` that calls `chart.resize()`. Cleanup: disconnect the observer and call `chart.dispose()`. Guard against `divRef.current` being null.
  - Second `useEffect` keyed on `[option, notMerge]`: `chartRef.current?.setOption(option, notMerge ?? false)`.
  - Import `echarts` via `import * as echarts from 'echarts'`.
  - Component lives in `src/components/` (shared, presentational, props-only) — consistent with the project's dependency rules (components import from `core/types` only; this one depends solely on the `echarts` lib and React).

### Phase 2: Remove dependency and swap call sites

- [x] **Task 2: Remove echarts-for-react from package.json** (depends on Task 1)
  Files: `package.json`, `package-lock.json`
  Delete the `"echarts-for-react": "^3.0.6"` line from `dependencies` (keep `"echarts"`). Run `npm install` to regenerate `package-lock.json` and drop the package from `node_modules`.

- [x] **Task 3: Swap import and tag in SessionCharts.tsx** (depends on Task 1)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`
  - Line 3: replace `import ReactECharts from 'echarts-for-react';` with `import { EChart } from '@/components/EChart';`.
  - Line ~95: replace the `<ReactECharts ... />` tag with `<EChart ... />`, keeping the existing `option`, `style`, and `notMerge` props unchanged.

- [x] **Task 4: Swap import and tag in CalibrationChart.tsx** (depends on Task 1)
  Files: `src/pages/CalibrationPage/CalibrationChart.tsx`
  - Line 1: replace `import ReactECharts from 'echarts-for-react';` with `import { EChart } from '@/components/EChart';`.
  - Lines ~22–24: replace `<ReactECharts option={option} style={{ height: 320, width: '100%' }} notMerge />` with the same props on `<EChart ... />`.

### Verification
- `npm run typecheck` passes.
- `npm run dev` starts with no Vite import-analysis / `tslib` resolution errors.
- Session charts and calibration charts render identically; no console errors on mount or unmount.
