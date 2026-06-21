# Plan: Incremental chart update on stable grid structure

## Context
Stop full-rebuilding the session biometric chart (`notMerge: true`) on every chunk arrival. Full rebuild is only needed when the set of present grids changes; otherwise ECharts can merge each series' `data` by stable `id`, which is the biggest per-chunk cost saving.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Structure signature

- [x] **Task 1: Return a structure signature from `buildSessionChartOption`**
  Files: `src/pages/SessionsPage/chartOption.ts`
  Extend the return type from `{ option, height, gridCount }` to also include `structureSignature: string`. Derive it from the already-built `gridDefs` array as the ordered, comma-joined present-grid ids, e.g. `gridDefs.map((d) => d.id).join(',')` → `"instruction,hr,eeg,emot,motion"` (empty string when `gridDefs` is empty / `gridCount === 0`). The signature must depend only on *which* grids are present (their ordered ids), never on per-chunk data length, so it stays stable as data accumulates and only changes when a new sampleType's grid first appears. Add it to the returned object next to `gridCount`. No other behavior changes in this function.

### Phase 2: Conditional merge in SessionCharts

- [x] **Task 2: Derive `notMerge` from signature changes and pass it to `<EChart>`** (depends on Task 1)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`
  - Destructure `structureSignature` from the `buildSessionChartOption` result (the existing `useMemo` at lines ~95–108). Keep the memo's dependency array unchanged.
  - Add a ref to track the previously-applied signature: `const prevSignatureRef = useRef<string | null>(null);` (initial `null`).
  - Compute `notMerge` during render by **reading** (not mutating) the ref: `const notMerge = prevSignatureRef.current !== structureSignature;`. This yields `true` on first render (ref is `null`) and on any signature delta (a new grid appeared), and `false` when the present-grid set is unchanged.
  - **Lint (mandatory):** annotate that render-phase read with `// eslint-disable-next-line react-hooks/refs` on the line directly above it, mirroring the existing `zoomRef.current` read at `SessionCharts.tsx:104`. The project's `eslint-plugin-react-hooks@7` (flat `recommended` config) `react-hooks/refs` rule reports render-phase `ref.current` access, so without the suppression `npm run lint` fails on this line. The ref *write* lives in `useEffect` (an allowed location) and needs no disable.
  - Update the ref **in an effect**, not during render, to stay correct under React StrictMode double-render: `useEffect(() => { prevSignatureRef.current = structureSignature; }, [structureSignature]);`. (Reading in render + writing in effect avoids the committed-render mismatch a render-phase ref write would cause; child `EChart` effects run before this parent effect, so `notMerge` is already applied by the time the ref updates.)
  - Replace the hardcoded `notMerge` prop on the `<EChart>` element (line ~164) with `notMerge={notMerge}`. The `EChart` wrapper already keys its `setOption` effect on `[option, notMerge, isDark]`, so no wrapper change is required.
  - Guards to preserve: first render and every signature delta full-rebuild (covered by the comparison above); the `"" → non-empty` transition when the first data grid appears also counts as a delta → full rebuild. `zoomRef` continues to work on both paths because the option memo still encodes `zoom.start/end` into the `dataZoom` entries (count is always 2, so ECharts merges them by index without a jump). `yAxis.scale: true` auto-range still recomputes under merge.

### Phase 3: Comment hygiene

- [x] **Task 3: Update stale "full rebuild per chunk" comments** (depends on Task 2)
  Files: `src/pages/SessionsPage/SessionCharts.tsx`, `src/pages/SessionsPage/chartOption.ts`
  The codebase has several comments asserting the chart *always* rebuilds with `notMerge: true`; these are now wrong and actively misleading about the axis-binding invariant. Update them to describe the new behavior: full rebuild on first render and on any structure-signature change (a new grid appearing), incremental merge-by-`id` otherwise.
  - `SessionCharts.tsx` top-of-file block comment (lines ~3–9).
  - `chartOption.ts` `buildLineSeriesEntry` doc comment (lines ~37–41) — the stable `id` is now load-bearing for merge, not "informational only".
  - `chartOption.ts` `buildSessionChartOption` doc comment (lines ~75–87) — explain that the signature drives `notMerge`, and that a structural change (new grid) still forces a full rebuild to avoid the creation-order axis cross-wiring described there. Note that series `data` is replaced wholesale on merge (already-sorted per `toSeries` / note 29), not via `appendData`.
