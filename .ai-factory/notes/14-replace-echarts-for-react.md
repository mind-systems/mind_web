# Replace echarts-for-react with Custom Wrapper

**Date:** 2026-06-02
**Source:** conversation context

## Key Findings

- `echarts-for-react@3.0.6` is abandoned (last real release 2021) and its compiled output imports `from "tslib"` without declaring it as a dependency — Vite 8's Rolldown bundler externalizes the import and cannot find `tslib` at the top level (it's nested at `echarts/node_modules/tslib`).
- The fix is to drop the package entirely and write a minimal `EChart` wrapper component using `useRef` + `useEffect` + `echarts.init()` directly.
- Only two files use `echarts-for-react`: `src/pages/SessionsPage/SessionCharts.tsx` and `src/pages/CalibrationPage/CalibrationChart.tsx` — both use `<ReactECharts option={...} style={...} notMerge />` with identical props.

## Details

### Root Cause

Vite 8 switched to the Rolldown bundler for dependency pre-bundling. When pre-bundling `echarts-for-react`, Rolldown treats `tslib` as an external ESM import (because it appears as a bare specifier in the compiled output). At runtime, Vite cannot resolve `"tslib"` from the top-level `node_modules/` — the package is only present as `node_modules/echarts/node_modules/tslib`. `echarts-for-react` never declared `tslib` in its `dependencies` or `peerDependencies`.

### New Component: src/components/EChart/index.tsx

Props:
```ts
interface EChartProps {
  option: EChartsOption;
  style?: React.CSSProperties;
  notMerge?: boolean;
}
```

Implementation outline:
- Render a `<div ref={divRef} style={style} />`.
- `useEffect` on mount: `const chart = echarts.init(divRef.current); chartRef.current = chart;` — store instance in a ref.
- `useEffect` keyed on `[option, notMerge]`: `chartRef.current?.setOption(option, notMerge ?? false)`.
- Cleanup on unmount: `chartRef.current?.dispose()`.
- `ResizeObserver` on the container div: `chart.resize()` on size change — dispose the observer on unmount.

### Changes Required

1. **Create** `src/components/EChart/index.tsx` with the wrapper above.
2. **Remove** `"echarts-for-react"` from `dependencies` in `package.json`.
3. **Run** `npm install` to update `package-lock.json`.
4. **Update** `src/pages/SessionsPage/SessionCharts.tsx`:
   - Line 3: `import ReactECharts from 'echarts-for-react'` → `import { EChart } from '@/components/EChart'`
   - Line 95: `<ReactECharts` → `<EChart`
5. **Update** `src/pages/CalibrationPage/CalibrationChart.tsx`:
   - Line 1: same import swap
   - Lines 22–24: `<ReactECharts` → `<EChart`

### Verification

- `npm run dev` starts with no Vite import-analysis errors.
- Session charts render (biometric grids, instruction phases, linked zoom).
- Calibration charts render (frequency + power lines, valid/invalid dot styles).
- No console errors on mount or unmount.
