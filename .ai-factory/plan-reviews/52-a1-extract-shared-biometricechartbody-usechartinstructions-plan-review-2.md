## Plan Review #2: (A1) Extract shared `BiometricEChartBody` + `useChartInstructions`

**Plan:** `52-a1-extract-shared-biometricechartbody-usechartinstructions.md`
**Files Reviewed:** 1 plan + `SessionCharts.tsx`, `deriveView.ts`, `chartOption.ts`, `components/EChart/index.tsx`, `core/types/index.ts`, `core/observe/index.ts`
**Risk Level:** 🟢 Low — pure refactor; both issues from review #1 are now resolved and all type/signature assumptions verified against the real code.

### Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** ✅ Aligned. `useChartInstructions` is a page-local `useQuery` hook co-located under `pages/SessionsPage/` — explicitly permitted ("Page-local feature sub-components under `pages/<Feature>/` may co-locate their own `useQuery` calls"). `BiometricEChartBody` is a page-local presentational sub-component that fetches nothing and receives all data as props, satisfying the "props down" and "no fetch in shared components" rules. Routes HTTP through `apiFetch`; no raw `fetch`. **WARN (non-blocking, carried from review #1):** the component is named "shared" but lives under one page — correct for A1; the eventual move to `src/components/` is deferred to Phase 22 and remains compliant since the component holds no query.
- **Rules (project CLAUDE.md / mind_web):** ✅ No violations. No new `fetch`, no `localStorage`, `logger` used via `@/core/observe` (confirmed the facade exports `logger`), English-only, `useQuery` stays out of `src/components/`.
- **Roadmap:** Refactor prep for Phase 22 chart variants. No milestone linkage concern.

### Review #1 Follow-up — both issues resolved

1. **`zoomRef` ownership (was the blocker) — FIXED.** Task 2 now explicitly keeps `zoomRef` declared in `SessionCharts` (parent, where `handleDataZoom` writes it at `:124`) and threads it into the child as a `zoomRef: React.MutableRefObject<{ start: number; end: number }>` prop; the child only *reads* `zoomRef.current` in the option memo at rebuild time. Task 3 explicitly says "Keep the `zoomRef` declaration at `:91`" and does not delete it. Only `prevSignatureRef` moves into the child, which is correct — it is used solely by the memo/`notMerge`/write-effect, never by `handleDataZoom`. This preserves the write/read coupling and the zoom-persistence behavior; no compile error.

2. **`instructions` reference stability (was minor perf) — FIXED.** Task 3 adds a module-level `const EMPTY_INSTRUCTIONS: InstructionDto[] = []` and passes `instructions={instructionsQuery.data ?? EMPTY_INSTRUCTIONS}`, giving a stable reference during the pending window so the child option memo does not re-run per render. `InstructionDto` is correctly kept imported in the parent for this constant.

### Verified against source

- **`buildSessionChartOption` signature** (`chartOption.ts:93-99`): `(instructions, biometrics, startedAt, endedAt, zoom = {start,end})` → `{ option, height, gridCount, structureSignature }`. Matches the plan's memo call and destructuring exactly, including passing `zoomRef.current` as the 5th arg.
- **`deriveView` / `BaseProgressLike`** (`deriveView.ts`): `BaseProgressLike` is exported and has exactly `{ samples, allAttempted, failedCount, totalWindows }` — matches the `baseProgress` prop shape and the parent's object literal. `InstructionsQueryLike` needs only `isPending`, so the `{ isPending; isError }` prop is structurally compatible; passing the full query object (wider) to the narrower prop type is valid TS.
- **`EChart` props** (`components/EChart/index.tsx`): accepts `option`, `style`, `notMerge`, `onEvents?: Record<string, (params: unknown) => void>`. The `events` memo (`{ datazoom: onDataZoom } | {}`) is assignable to `onEvents`, and `{}` is tolerated. Signature `onDataZoom?: (params: unknown) => void` matches `handleDataZoom`'s `(params: unknown) => void`.
- **`React.MutableRefObject` in the prop type needs no explicit `React` import** — the existing `EChart` already uses `React.CSSProperties` unqualified (via the global `React` namespace from `@types/react` + `jsx: react-jsx`), so the plan's usage is consistent and will typecheck.
- **Types** (`core/types/index.ts`): `SessionRun`, `InstructionDto`, `BioSampleDto` all exported as assumed.
- **Import add/remove lists (Task 3) are accurate.** After the refactor the parent still needs `useRef` (`zoomRef` + `overlayRef`), `useCallback` (`requestWindowChunks` + `handleDataZoom`), `useEffect` (overlay mirror + reset), `useState` (overlay). Both remaining `useMemo` sites (`events` `:165`, option `:187`) move to the child, so removing `useMemo` from the parent is correct. `ModuleBadge`, `formatDate/formatDuration`, `sessionTitle`, the loader hooks, and `bucketPolicy` helpers all correctly stay.
- **New file names** `useChartInstructions.ts` / `BiometricEChartBody.tsx` do not collide with existing files in `pages/SessionsPage/`.

### Minor Notes (non-blocking)

- Task 1 writes the `queryFn` path with single quotes around a `${session.id}` interpolation. That is markdown shorthand — the implementer must use a backtick template literal (as the current `:47-51` code does). Trivial; the intent is unambiguous.
- `baseProgress` is passed as a fresh object literal per render, but `deriveView` runs unmemoized every render today anyway (`:212-221`), so there is no behavior or perf change.

### Positive Notes

- DOM parity is preserved precisely: the outer `<div className="flex-1 overflow-y-auto px-6 py-4">` body wrapper moves into the child while the header and `<div className="flex h-full flex-col">` stay in the parent, so the rendered tree is identical.
- The `baseProgress.samples` (coarse base, drives `deriveView`) vs. `samples={detail ?? base}` (drives the chart option) split is correctly kept distinct — the exact separation that makes loading/error/empty gating independent from overlay resolution.
- The StrictMode/effect-write and `react-hooks/refs` rationale comments are explicitly preserved with the code they annotate.

### Verdict

Both critical and minor findings from review #1 are addressed, and every type, signature, export, and line reference re-verified against the current source. This is a clean, behavior-preserving refactor plan ready to implement.

PLAN_REVIEW_PASS
