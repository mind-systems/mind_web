# Code Review: (B2) Zoom-driven tick density

**Plan:** `.ai-factory/plans/56-b2-zoom-driven-tick-density.md`
**Files reviewed (in full):** `src/pages/SessionsPage/bucketPolicy.ts`, `src/pages/SessionsPage/chartOption.ts`, `src/components/EChart/index.tsx`, `src/pages/SessionsPage/BiometricEChartBody.tsx`, plus context: `makeWindowedVariant.tsx`, `deriveView.ts`, `core/format.ts`.

**Checks run:**
- `npm run typecheck` → **passes** (no errors).
- `npm run lint` → the `stylish` formatter crashes (`util.styleText is not a function`) because the sandbox runs Node v18.15.0 and that API needs Node ≥ 20; the ESLint *engine* itself runs fine. Running `eslint` with the JSON formatter reports **1 error, 0 warnings** — see Finding 1.
- `npm run build` → fails with `ReferenceError: CustomEvent is not defined` in Vite's CLI — again a Node-18-too-old environment issue, **not** a code defect. Not counted as a finding.

---

## Findings

### 1. (Fixed) `useState(intervalRef.current)` violates `react-hooks/refs`

`src/pages/SessionsPage/BiometricEChartBody.tsx:53`

```ts
const intervalRef = useRef(niceTimeInterval(computeSpanSec({ start: 0, end: 100 }, durationSec)));
const [liveInterval, setLiveInterval] = useState(intervalRef.current);   // ← ref read during render
```

ESLint (`react-hooks/refs`, error-level) flags this as *"Cannot access refs during render … Passing a ref to a function may read its value during render."* This is the sole ESLint error in the entire `src/` tree, so `npm run lint` now exits non-zero and fails CI. Note the other three ref reads in this file (`zoomRef.current`, `intervalRef.current` inside the memo, `prevSignatureRef.current` for `notMerge`) each carry an `// eslint-disable-next-line react-hooks/refs` comment — this new read at line 53 does not.

**Failure scenario:** `npm run lint` returns exit code 1 → the lint step of the pipeline/CI fails even though the code is functionally correct.

**Impact:** Lint-gate only — no runtime bug. On mount `intervalRef.current` and the `useState` initializer resolve to the same freshly computed value, so behavior is correct.

**Suggested fix:** compute the initial interval once and reuse it for both, so no ref is read during render:

```ts
const initialInterval = niceTimeInterval(computeSpanSec({ start: 0, end: 100 }, durationSec));
const intervalRef = useRef(initialInterval);
const [liveInterval, setLiveInterval] = useState(initialInterval);
```

(Adding an `eslint-disable-next-line react-hooks/refs` above line 53 would silence it too, but the local-const version is cleaner and avoids a needless suppression.)

---

## Correctness assessment (no defects found beyond Finding 1)

The implementation matches the plan and is sound:

- **`bucketPolicy.ts`** — `computeSpanSec` re-added with the canonical `(zoom, durationSec)` signature and guarded (`durationSec <= 0` / non-finite → `0`; negative/NaN span → `0`). `niceTimeInterval` guards `spanSec <= 0`/non-finite → `1`, and reuses `snapUp(spanSec / TARGET_TICKS, DURATION_LADDER)` — floor `1`, cap `3600`, no duplicated snapping loop. Pure and React-free.
- **`chartOption.ts`** — `xAxisInterval?: number` appended after `zoom`; `...(Number.isFinite(xAxisInterval) ? { interval: xAxisInterval } : {})` spread onto every xAxis so an `undefined` interval preserves ECharts' prior auto behavior, and the value is baked into rebuilds (mirrors `zoom`). Y-axes, phase custom series, `dataZoom`, and `structureSignature` untouched.
- **`EChart/index.tsx`** — new effect keyed `[xAxisInterval, isDark]`, declared *after* the option effect, so on mount `getOption()` sees a normalized (always-array) `xAxis` before reading `.length`. The merge (`setOption({ xAxis: [...] }, false)`) touches only `interval`; series/grids/yAxis/dataZoom are left intact — a genuine targeted update, not a `notMerge:true` rebuild. `getOption().xAxis` is always an array at runtime, so `count` is correct; the `Array.isArray` guard also satisfies TS narrowing (typecheck passes).
- **`BiometricEChartBody.tsx`** — the memo reads `intervalRef.current` (suppressed, same pattern as `zoomRef.current`) and excludes it from deps, so a `liveInterval` change returns the cached option and triggers only EChart's targeted merge — no full rebuild per wheel tick, and `notMerge`/`prevSignatureRef`/`zoomRef` are preserved. `handleDataZoom` calls `onDataZoom?.(params)` *before* reading `zoomRef.current`, so the parent (`makeWindowedVariant.onDataZoom`) has updated the ref first; the `next !== intervalRef.current` guard keeps most wheel ticks free of React work. `durationSec` is a stable-per-mount `useCallback` dep. Effect/memo dependency arrays are consistent.

### Non-blocking observations (no change required)

- **Actual tick count skews low, not "~6–10".** `snapUp(spanSec / 8, …)` returns the smallest step whose count is ≤ 8, so realized counts land around **4–8** (e.g. 20 s span → interval 5 → 4 ticks). This faithfully implements note 42's formula, and the note lists exact tick count as an open tuning question — `TARGET_TICKS`/ladder granularity are the tuning knobs.
- **`handleDataZoom` is bound unconditionally but relies on `onDataZoom` to refresh `zoomRef`.** In real wiring `makeWindowedVariant` always passes `onDataZoom`, so the interval always reflects the current window. If a future caller mounts `BiometricEChartBody` without `onDataZoom`, the interval would be computed from a stale `zoomRef` — latent robustness gap only, matching the plan's stated intent.
- **First-mount targeted merge is redundant** (the freshly built option already carries the interval) but idempotent and harmless.
