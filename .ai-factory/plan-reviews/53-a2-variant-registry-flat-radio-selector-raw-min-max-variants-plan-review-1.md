# Plan Review: (A2) Variant registry + flat radio selector + raw & min/max variants

**Plan:** `53-a2-variant-registry-flat-radio-selector-raw-min-max-variants.md`
**Reviewed against:** live `src/pages/SessionsPage/` code, spec note 39, ROADMAP Phase 22, ARCHITECTURE.md
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture (WARN → OK):** ARCHITECTURE §"Layer Communication" (line 67) and §Anti-patterns (line 162) explicitly permit page-local feature sub-components under `pages/<Feature>/` to co-locate their own `useQuery` calls. The variant components in `chartVariants/` calling `useBiometricWindows`/`useChartInstructions` are page-local — compliant. `VariantSelector` is presentational (no query) — compliant. Storage rule (only `core/auth`/`core/api`) is honored: selection uses `useState`, no `localStorage`. No boundary violation.
- **Rules:** No `.ai-factory/RULES.md` present — nothing to enforce.
- **Roadmap:** Task maps 1:1 to the open `[ ] (A2)` item in ROADMAP.md Phase 22 (line 177). Depends on A1 (`[x]` done — `BiometricEChartBody`/`useChartInstructions` extracted and verified). Downstream A3 (line 179) extends `ChartVariant.Component` props to `{ session, bucketSec }` — the A2 contract `Component<{ session }>` is a clean forward-compatible subset. Linkage present.
- **Skill-context:** `.ai-factory/skill-context/aif-review/SKILL.md` absent — no project overrides.

## Verification Performed

Confirmed against the actual codebase:

- **Types exist.** `SessionRun` (`core/types`) has `id`, `startedAt`, `endedAt`, `durationSeconds`, `activityType`, `complexity` — all fields the plan reads.
- **`deriveView.BaseProgressLike`** requires exactly `{ samples, allAttempted, failedCount, totalWindows }` — matches the `baseProgress` the plan feeds from the loader (Task 2 step 7). `useBiometricWindows` returns all four.
- **`BiometricEChartBody` prop contract** already accepts `zoomRef` (required) + optional `onDataZoom` — Task 2 step 7 reuses it unchanged, as claimed.
- **min/max windowSec + buildPath math** in Task 3 is a character-exact reproduction of `useBiometricWindowedBase.ts` (floor interior boundaries, ceil only the final window at `toMs >= sessionEndMs`, `windowSec = max(ceil(ceil(dur/8)/bucketSec)*bucketSec, bucketSec)`). No drift.
- **Raw path** in Task 3 correctly mirrors `useBiometricChunks.buildPath` (`encodeURIComponent(new Date(ms).toISOString())`, no `bucketSec`).
- **Deletion safety (Task 6).** Grep across `src/**/*.ts*` shows the only importers of `useBiometricWindowedBase`, `useBiometricChunks`, `useBiometricAggregate`, `shouldUseRaw`, `computeSpanSec`, `quantizeWindow`, `RAW_SPAN_LIMIT_*`, `CHUNK_SEC` are `SessionCharts.tsx` (rewritten in Task 5) and the target files themselves. `transforms.ts` mentions `useBiometricChunks` only in a comment (no import). Retained `bucketPolicy` symbols (`computeBucketSec`, `snapUp`, `TARGET_BUCKETS`, `BUCKET_LADDER`) remain live: `computeBucketSec` is used by the min/max variant; the other three transitively support it. Deletions are clean.
- **Remount semantics.** `index.tsx` keys `<SessionCharts key={selectedSession.id}>`, so `selectedId` state resets to `DEFAULT_VARIANT_ID` on session switch (correct). The inner `key={`${session.id}:${selectedId}`}` remounts the variant subtree on variant switch, and switching also changes the component *type* (`rawVariant.Component` ≠ `minmaxVariant.Component`) — both independently force a remount, satisfying the Rules-of-Hooks argument.
- **Rules of Hooks.** With remount-on-switch, each variant's hooks (`useMemo`, `useBiometricWindows`, `useEffect`, `useChartInstructions`, `useRef`, `useCallback`) run unconditionally in a stable tree. `CHART_VARIANTS` is module-level, so `Component` identities are stable across renders.

## Critical Issues

None found.

## Observations (non-blocking)

1. **Raw variant now eagerly loads the full-resolution session.** The retired design loaded raw 30 s chunks *lazily* on zoom precisely because raw is huge (the `motion ≈95 %` / ~389k baseline). Task 2's auto-enqueue-all-windows generalization means selecting **Raw** fetches the entire session at full resolution: for a long session that is many sequential 30 s requests, and `mergeSortedByTimestamp` runs O(n) against an ever-growing array each window (cumulative cost grows with total sample count). This is spec-sanctioned (note 39 "Raw shows full-resolution progressive… decimated draw"; Phase-19 decimation is called out as mandatory) and Raw is **not** the default, so the heavy path is opt-in. No change required — flagged so the implementer keeps decimation intact and does not expect Raw to feel as light as `minmax`.

2. **`enc` is pseudocode.** Task 3 uses `enc(fromMs)` shorthand; the implementer must inline `encodeURIComponent(new Date(ms).toISOString())` in `registry.ts` (the plan already states this in prose). Just ensure it is a real local helper, not an undefined import.

3. **ESLint react-hooks inside the factory.** `makeWindowedVariant` defines a component that calls hooks. Keep the inner component capitalized (e.g. `function WindowedVariant({ session }) {…}` or `const Component = …` assigned then returned) so the hooks linter recognizes it as a component; otherwise expect a false-positive `react-hooks/rules-of-hooks` warning that Task 7 would have to silence. Minor — surfaced by the `npm run lint` gate in Task 7.

4. **Two `disable`d exhaustive-deps effects carry over.** The auto-enqueue effect (`[session.id, loader.totalWindows]`) and the existing loader internals need the same `eslint-disable-next-line react-hooks/exhaustive-deps` the base hook used. The plan already notes this for the enqueue effect — good.

## Positive Notes

- The remount-on-switch reasoning is sound and correctly leverages the existing `useBiometricWindows` reset effect (keyed on `[session.id, totalWindows]`), so no stale-window bleed between variants.
- Deletion scope was verified symbol-by-symbol and the retained `bucketPolicy` set is exactly the transitive closure needed by `computeBucketSec` — no over- or under-deletion.
- min/max math is reproduced verbatim, preserving the mind_api Phase-49 contiguous-tiling contract (floor interior / ceil final).
- Forward-compatible with A3: the `{ session }` prop is a subset of A3's `{ session, bucketSec }`, and the factory `config` shape leaves room for the `aggregated` flag without rework.
- Commit split (infra 1-4, shell+retire 5-7) is coherent and each commit is independently buildable given Task 7's typecheck/lint gate.

PLAN_REVIEW_PASS
