## Plan Review: (A1) Extract shared `BiometricEChartBody` + `useChartInstructions`

**Plan:** `52-a1-extract-shared-biometricechartbody-usechartinstructions.md`
**Files Reviewed:** 1 plan + `SessionCharts.tsx`, `deriveView.ts`, `chartOption.ts`, `components/EChart`, `core/types`, `core/observe`
**Risk Level:** 🔴 High — the plan as written will not typecheck and will break zoom persistence.

### Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** ✅ Aligned. `BiometricEChartBody` is a page-local presentational sub-component under `pages/SessionsPage/`, does not fetch data (the query lives in the `useChartInstructions` hook, called by the page and passed down as props). The hook co-located under `pages/SessionsPage/` is exactly the "page-local feature sub-component may co-locate its own `useQuery`" allowance. If Phase 22 later promotes `BiometricEChartBody` to `src/components/`, it still complies since it holds no `useQuery`. No boundary violation. **WARN (non-blocking):** the file is named "shared" but placed under a single page — fine for A1, just note the eventual move to `components/` is deferred.
- **Rules (project CLAUDE.md):** ✅ No violations. No new `fetch`, no `localStorage`, `logger` used via `@/core/observe`, English-only. `useChartInstructions` routes through `apiFetch` as required.
- **Roadmap:** Not evaluated in depth (refactor prep for Phase 22 variants). No linkage concern.

### Critical Issues

**1. `zoomRef` is split across parent and child — the plan breaks the write/read coupling (blocker).**

`zoomRef` has two live use sites in `SessionCharts.tsx`:
- **Written at line 124**, inside `handleDataZoom` — `zoomRef.current = { start, end }`.
- **Read at line 197**, inside the option `useMemo` (`zoomRef.current` passed to `buildSessionChartOption`).

The plan (Task 2) moves `zoomRef` **into** `BiometricEChartBody` (it moves the memo), while Task 3 explicitly **keeps `handleDataZoom` in `SessionCharts`** ("Keep all data wiring intact: … `handleDataZoom` …") and deletes `zoomRef` from the parent. `handleDataZoom` cannot move to the child — it depends on `requestWindowChunks`, `setOverlay`, `overlayRef`, `durationSec`, `startMs`, `baseBucketSec`, all of which stay in the parent.

Consequences as written:
- **Compile error:** after deleting `zoomRef` from `SessionCharts`, line 124 (`zoomRef.current = …`) references an undefined name → `npm run typecheck` fails.
- **Behavior break (even if you patch around the error):** if you create a *separate* `zoomRef` inside the child, the parent's datazoom handler writes to a different ref object than the child's memo reads. The memo would always read the initial `{ start: 0, end: 100 }`, so every full rebuild (`notMerge`) would snap the chart back to full range instead of preserving the current zoom window — exactly the regression the comment at lines 89–91 and 194–197 exists to prevent. This is a behavior change, contradicting the plan's "identical behavior and DOM" claim.

**Fix:** `zoomRef` must remain owned by the parent (where `handleDataZoom` writes it) and be **passed into `BiometricEChartBody` as a prop** so the child memo can read `zoomRef.current` at rebuild time. Add to the prop type, e.g.:
```ts
zoomRef: React.MutableRefObject<{ start: number; end: number }>;
```
and in Task 3 wiring pass `zoomRef={zoomRef}` (keep the `zoomRef` declaration at line 91 in the parent, do **not** delete it). The `// eslint-disable react-hooks/refs` read-at-rebuild pattern is preserved unchanged inside the child. Only `prevSignatureRef` (used solely by the memo/`notMerge`/write-effect, never by `handleDataZoom`) can safely move wholesale into the child — the plan is correct about that one.

### Minor Issues

**2. `instructions` prop reference instability recomputes the option memo during the loading window (perf, non-blocking).**

Currently the option memo deps on `instructionsQuery.data` (line 199) — a stable value that is `undefined` while instructions are pending, so the memo does not re-run on that account during loading. After the refactor, Task 3 passes `instructions={instructionsQuery.data ?? []}`, and Task 2 makes the child memo dep on the `instructions` prop. While `data` is `undefined`, `?? []` yields a **new array literal every parent render**, so the child memo re-runs `buildSessionChartOption` on every render during the loading phase.

Output is identical (the builder is pure and the body shows the skeleton then, not the chart), and `structureSignature` is a string compared by value so `notMerge`/the write-effect are unaffected — hence non-blocking. But it is a small deviation from the "identical behavior" claim and a minor perf regression. Optional mitigation: default inside the child (`const list = instructions ?? EMPTY` with a module-level `const EMPTY: InstructionDto[] = []`) or have the parent pass `instructionsQuery.data` and let the child coalesce, keeping the memo dep on the stable value.

### Positive Notes

- All cited line numbers (`47–51`, `42–46`, `91`, `94`, `165`, `187–200`, `204–208`, `212–221`, `226`, `231–233`, `257`, `258–270`, `238–254`) match the current `SessionCharts.tsx` exactly — the plan was written against the real file.
- Type assumptions are correct: `BaseProgressLike` is exported from `deriveView.ts`; `deriveView`'s `InstructionsQueryLike` needs only `isPending`, so the `{ isPending; isError }` prop shape is structurally compatible. `buildSessionChartOption` returns `{ option, height, gridCount, structureSignature }` as the plan expects. `EChart` accepts `option`, `style`, `notMerge`, `onEvents` — matching the intended render call.
- The `baseProgress.samples` (base loader) vs. `samples` (detail ?? base) split is correctly preserved — `deriveView` keeps consuming coarse base progress while the chart option consumes the overlay, so loading/error/empty gating does not change.
- The `events` memo rewrite (`onDataZoom ? { datazoom: onDataZoom } : {}`) is behavior-equivalent because the parent always passes `handleDataZoom`; `EChart.onEvents` tolerates `{}`.
- Import add/remove lists are accurate; `BioSampleDto`, `useRef`, `useEffect`, `useState`, `useCallback` correctly stay in the parent.

### Verdict

Resolve Critical Issue #1 (thread `zoomRef` as a prop; do not move it into the child) — without it the refactor neither compiles nor preserves zoom behavior. Address Minor #2 if strict "identical behavior" is required. Re-plan those two points and this is ready.
