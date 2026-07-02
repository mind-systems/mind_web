# Code Review 3: (B2) Zoom-driven tick density

**Plan:** `.ai-factory/plans/56-b2-zoom-driven-tick-density.md`
**Files reviewed (in full):** `src/pages/SessionsPage/bucketPolicy.ts`, `src/pages/SessionsPage/chartOption.ts`, `src/components/EChart/index.tsx`, `src/pages/SessionsPage/BiometricEChartBody.tsx`, plus context: `makeWindowedVariant.tsx`, `deriveView.ts`, `core/format.ts`.

**Checks run this round:**
- `npm run typecheck` → **passes**.
- `eslint src` (JSON formatter) → **0 errors, 0 warnings**.
- `npm run lint` (stylish) / `npm run build` still crash on the sandbox's Node v18.15.0 (`util.styleText` / `CustomEvent`) — environment-only, not code defects.

## Prior findings — both resolved

- **Review-1 Finding 1** (`react-hooks/refs` on `useState(intervalRef.current)`): **fixed** — a hoisted `const initialInterval` now feeds both `useRef` and `useState`.
- **Review-2 Finding 1** (`chart.getOption()` deep-cloning the whole option to count axes): **fixed** — the interval effect now reads the count from the `option` prop closure (`EChart/index.tsx:63`: `const count = Array.isArray(option.xAxis) ? option.xAxis.length : 1;`), with a documented `exhaustive-deps` suppression so it keeps firing only on `xAxisInterval`/`isDark`.

I confirmed the closure-read fix is **correct**, not just cheaper:
- When the interval effect fires (`xAxisInterval` or `isDark` changed), React runs the *latest* render's effect closure, so `option.xAxis` is the current option and `count` matches the live axis set — even though `option` is not in the dep array.
- When the grid structure changes but the interval does not (a new sampleType grid appears), the effect correctly does **not** fire; the option effect re-applies the full rebuilt option, which already carries `interval` baked onto every axis via `buildSessionChartOption`. So the interval is right on all axes regardless of which path ran. No stale-count or missing-interval window exists.

## Correctness assessment (no defects)

- **`bucketPolicy.ts`** — `computeSpanSec`/`niceTimeInterval` are pure and fully guarded against non-finite / `≤0` inputs (degenerate `durationSec 0` → span 0 → interval 1, no crash / no divide issue); `niceTimeInterval` reuses `snapUp` with `DURATION_LADDER` (floor 1, cap 3600). Sound.
- **`chartOption.ts`** — `interval` spread onto every xAxis only when `Number.isFinite(xAxisInterval)`; `undefined` preserves prior auto behavior; value baked into rebuilds so granularity survives data-arrival merges (mirrors `zoom`). Y-axes / phase series / `dataZoom filterMode:'none'` / `structureSignature` untouched.
- **`EChart/index.tsx`** — interval effect is a genuine `xAxis`-only merge (`notMerge:false`), declared after the option effect; no `getOption()` clone; touches nothing but `interval`.
- **`BiometricEChartBody.tsx`** — `intervalRef` excluded from memo deps (no rebuild on interval change → only the targeted merge fires per boundary crossing); `handleDataZoom` updates the parent's `zoomRef` via `onDataZoom?.()` before reading it; the `next !== intervalRef.current` guard keeps most wheel ticks React-work-free; `initialInterval` shared by `useRef`/`useState`; `notMerge`/`prevSignatureRef`/`zoomRef` preserved.

### Non-blocking observations (informational only — no action required)
- Realized tick count skews low (~4–8, not the "6–10" in the plan's prose) — faithful to note 42's formula; `TARGET_TICKS`/ladder are the documented tuning knobs.
- `handleDataZoom` is bound unconditionally and relies on `onDataZoom` to refresh `zoomRef`; in the real wiring `makeWindowedVariant` always passes it, so this is a latent robustness note only, consistent with the plan's stated intent.
- First-mount targeted merge is redundant (option already carries the interval) but idempotent.

REVIEW_PASS
