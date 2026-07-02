# Code Review 2: (B2) Zoom-driven tick density

**Plan:** `.ai-factory/plans/56-b2-zoom-driven-tick-density.md`
**Files reviewed (in full):** `src/pages/SessionsPage/bucketPolicy.ts`, `src/pages/SessionsPage/chartOption.ts`, `src/components/EChart/index.tsx`, `src/pages/SessionsPage/BiometricEChartBody.tsx`, plus context: `makeWindowedVariant.tsx`, `deriveView.ts`, `core/format.ts`.

**Checks run this round:**
- `npm run typecheck` → **passes**.
- `eslint src` (JSON formatter) → **0 errors, 0 warnings**. Review-1's Finding 1 (`react-hooks/refs` on `useState(intervalRef.current)`) is **fixed**: the code now hoists `const initialInterval = niceTimeInterval(computeSpanSec(...))` and feeds both `useRef` and `useState` from it (`BiometricEChartBody.tsx:50-53`). No ref is read during render.
- `npm run lint` (stylish) and `npm run build` still crash on Node v18.15.0 in the sandbox (`util.styleText` / `CustomEvent` missing) — environment-only, not code defects.

Review-1's substantive correctness assessment (helpers, option threading, effect ordering, memo/ref discipline, `notMerge`/`zoomRef`/`prevSignatureRef` preservation) still holds and is not repeated here. One new finding below.

---

## Findings

### 1. (Fixed) `chart.getOption()` deep-clones the entire option (incl. all series data) just to count axes

`src/components/EChart/index.tsx:63`

```ts
useEffect(() => {
  const chart = chartRef.current;
  if (!chart || xAxisInterval == null) return;
  const opt = chart.getOption();                                   // ← deep clone of the WHOLE option
  const count = Array.isArray(opt.xAxis) ? opt.xAxis.length : 1;
  chart.setOption(
    { xAxis: Array.from({ length: count }, () => ({ interval: xAxisInterval })) },
    false,
  );
}, [xAxisInterval, isDark]);
```

`ECharts#getOption()` returns a freshly cloned copy of the full maintained option, **including every series' `data` array**. On the biometric chart's target workload — the 389k-motion session with six motion series plus HR/EEG/emotions — that is a deep clone of hundreds of thousands of `[number, number]` points, performed only to read `xAxis.length`. It runs on every interval-boundary crossing during a zoom gesture (guarded by `next !== intervalRef.current`, so not per wheel tick, but several times across a full zoom-out). This is the exact "make the per-zoom interval update cheap, not a full rebuild" cost the plan and note 42 set out to avoid, reintroduced through the counting path rather than the merge path.

**Failure scenario:** on the 389k-motion session, each ladder-boundary crossing while zooming triggers a full-option deep clone (tens of ms each on a large dataset), producing visible stutter during the zoom gesture — noticeable precisely on the large sessions the LOD system exists for.

**Impact:** performance only — output is correct. Functionally fine on small/medium sessions.

**Suggested fix:** the axis count is already available without cloning. Read it from the `option` prop already in scope (no clone, and `length` is correct whenever this effect fires — the targeted merge exists only to override the stale interval in the cached option; the axis count never differs):

```ts
const count = Array.isArray(option.xAxis) ? option.xAxis.length : 1;
```

(Alternatively thread a `gridCount`/axis-count prop from `BiometricEChartBody`, which already computes `gridCount`. Do **not** add `option` to the effect deps — the effect must keep firing only on `xAxisInterval`/`isDark`; reading `option` from the closure at run time is sufficient and correct.)

---

## Correctness assessment (no correctness/security defects)

- **`bucketPolicy.ts`** — `computeSpanSec`/`niceTimeInterval` are pure, guarded against non-finite and `≤0` inputs (`durationSec 0` → span 0 → interval 1, no crash), and `niceTimeInterval` reuses `snapUp` with `DURATION_LADDER` (floor 1, cap 3600). Sound.
- **`chartOption.ts`** — `interval` is spread onto every xAxis only when `Number.isFinite(xAxisInterval)`; `undefined` preserves prior auto behavior. Baked into rebuilds so granularity survives data-arrival merges, mirroring `zoom`. Y-axes/phase series/`dataZoom`/`structureSignature` untouched.
- **`BiometricEChartBody.tsx`** — `intervalRef` excluded from the memo deps (no rebuild on interval change); `handleDataZoom` calls `onDataZoom?.()` before reading `zoomRef.current`, and the `next !== intervalRef.current` guard keeps most wheel ticks React-work-free. `initialInterval` computed once and shared by `useRef`/`useState`. `handleDataZoom`/`events` dep arrays are consistent.
- **`EChart/index.tsx`** — the interval effect is a genuine `xAxis`-only merge (`notMerge:false`); it does not touch series/grids/yAxis/dataZoom, and its post-option-effect declaration order guarantees the axis array exists when it runs. Only Finding 1 (the counting path) applies.

### Non-blocking observations (unchanged from review-1, no action required)
- Realized tick count skews low (~4–8, not "6–10") — faithful to note 42's formula; `TARGET_TICKS`/ladder are the tuning knobs.
- `handleDataZoom` bound unconditionally relies on `onDataZoom` to refresh `zoomRef`; in real wiring `makeWindowedVariant` always passes it, so latent robustness gap only.
- First-mount targeted merge is redundant but idempotent.
