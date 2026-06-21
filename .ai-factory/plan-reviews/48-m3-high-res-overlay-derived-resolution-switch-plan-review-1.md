# Plan Review: (M3) High-res overlay + derived resolution switch

**Plan:** `48-m3-high-res-overlay-derived-resolution-switch.md`
**Reviewed against:** `SessionCharts.tsx`, `useBiometricChunks.ts`, `useBiometricOverview.ts`, `bucketPolicy.ts`, `deriveView.ts`, `chartOption.ts`, `core/types/index.ts`, note 35, note 32 design, ROADMAP Phase 20.
**Risk Level:** 🟢 Low

## Verdict

The plan is accurate and faithful to the M3 spec. Every codebase claim in the **Background** section was verified against the live source and is correct:

- `SessionCharts.tsx` renders a single base from `overviewQuery.data ?? []`; there is **no** `useBiometricChunks` import and **no** mount `requestWindowChunks` effect (confirmed via grep — `useBiometricChunks` is defined but imported nowhere in `src/`). ✅
- `zoomRef`, `prevSignatureRef`/`structureSignature` `notMerge` merge, and the lightweight `handleDataZoom` that only persists the window are all present exactly as described. ✅
- `bucketPolicy.ts` exports `computeSpanSec`, `computeBucketSec`, `shouldUseRaw` (hysteresis ENTER=90/EXIT=110), and `quantizeWindow` with the signatures the plan relies on. ✅
- `useBiometricChunks` reset effect (lines 166–188) enqueues chunk 0 via the exact `if (totalChunks > 0) { queuedSetRef.current.add(0); setQueue([0]); }` block Task 1 targets; dedup refs (`loadedRef`/`inFlightRef`/`queuedSetRef`/`fetchIdRef`) and the 413 per-chunk windowing are as described. ✅
- TanStack Query is `^5.100.14` — `keepPreviousData` (the placeholder sentinel) is the correct v5 idiom. ✅
- `deriveView(overviewQuery, instructionsQuery, gridCount)` is base-driven and unchanged; `gridCount === 0` is the only empty trigger. ✅

`<SessionCharts key={selectedSession.id} …>` in `SessionsPage/index.tsx` remounts the component per session, which underwrites the plan's "starts with an empty queue" and "reset overlay to null on session change" claims — both reset paths are belt-and-suspenders on top of the remount, so they are safe and correct.

### Context Gates

- **Architecture (`ARCHITECTURE.md`):** PASS. `useBiometricAggregate` is a page-local feature hook under `pages/SessionsPage/`, which the architecture explicitly permits for co-located queries ("Page-local feature sub-components … may co-locate their own `useQuery` calls"). It fetches via `apiFetch` through React Query — no raw `fetch`, no `localStorage`, no shared-component data fetching. Mirroring `useBiometricOverview.ts` keeps the pattern consistent.
- **Rules (`rules/base.md` + `CLAUDE.md`):** PASS. No `console.*` (the chunks hook already routes through the `logger` facade; the new aggregate hook performs no logging, matching `useBiometricOverview`). All HTTP stays in `core/api/client.ts` via `apiFetch`. `mind_auth_token` untouched.
- **Roadmap (`ROADMAP.md`):** PASS. This is the final unchecked task of Phase 20 ("(M3) High-res overlay + derived resolution switch — depends on M2"); the plan matches its description precisely and correctly removes both eager mount loads while preserving the chunk-index dedup + 413 rationale.

## Non-Blocking Notes

These are clarity/precision refinements for the implementer. None block implementation.

1. **`baseBucketSec` should use `session.durationSeconds`, not the chart's `durationSec`.** Step 4 defines `baseBucketSec = computeBucketSec(durationSec)` and calls it "the same value the base uses." The base (`useBiometricOverview`) computes `computeBucketSec(session.durationSeconds)`, whereas the chart's `durationSec` is `(new Date(endedAt) - new Date(startedAt)) / 1000`. These usually match but can drift (the codebase already documents `durationSeconds > (endedAt − startedAt)/1000` data drift in `useBiometricChunks` line 124). To make the "no finer than base → `setOverlay(null)`" short-circuit exactly correct, derive `baseBucketSec` from `session.durationSeconds`.

2. **`fromMs`/`toMs` derivation in `handleDataZoom` is only stated for the raw path.** Step 4's aggregate branch references `quantizeWindow(fromMs, toMs, bucketSec)`, but the plan only spells out the percentage→ms conversion inside `requestWindowChunks` (raw path). The implementer should compute `fromMs = startMs + (start/100)*durationMs` and `toMs = startMs + (end/100)*durationMs` once and feed both the agg-path quantization and the raw-path chunk mapping, so both share one zoom model (as `bucketPolicy.ts`'s comment intends). Be explicit about which duration source feeds `durationMs` (keep it consistent with `computeSpanSec`'s `durationSec`).

3. **`detail ?? base` is a whole-array swap, not a per-grid overlay.** When the zoomed window's detail (raw chunks for the loaded indices, or the finer aggregate for `[qFrom,qTo]`) contains a *subset* of the base's `sampleType`s — e.g. a deep zoom into a window where only `motion` was recorded — `buildSessionChartOption` will produce fewer grids than the base, so grids present in the base **disappear** while overlaid (rather than continuing to show coarse base data for those signals). This is faithful to the spec's single `samples = detail ?? base` array and note 30's structure-signature merge handles it correctly (`notMerge: true` on the grid-set delta). The plan's stronger guarantee — that `gridCount === 0` can only occur when the base is empty — does hold (detail is forced `null` when it has zero renderable samples). Worth confirming this grid-collapse-on-zoom is acceptable LOD behavior and not mistaken for a regression during QA.

4. **`keepPreviousData` means the base does not bridge between aggregate windows.** While the next quantized window loads, `aggQuery.data` holds the *previous* window's samples, so the chart briefly shows stale overlay geometry over the new range rather than falling back to base. This is the explicit "smoother" choice in Task 2 and note 35's open question; just confirm it is intended (the note's phrasing "base bridges either way" is slightly inaccurate for the `keepPreviousData` path — the previous overlay bridges, not the base).

5. **Minor mechanics:** `CHUNK_SEC` must be imported into `SessionCharts.tsx` (it is exported from `useBiometricChunks.ts`) for the `requestWindowChunks` index math; the `sameAgg(prev, qFrom, qTo, bucketSec)` comparator referenced in Step 4 needs a trivial inline definition; and Task 1's doc-comment update should also cover the inline reset-effect comment at line ~165 ("enqueues chunk 0") and the hook header ("Chunk 0 is loaded on mount") so neither contradicts the new lazy behavior.

## Positive Notes

- The layered `detail ?? base` model genuinely dissolves the slug-46 failure modes (storm, blank-on-zoom-in, skeleton-suppression, unmount-on-empty-window) by construction, and the plan's **Guards / non-goals** section correctly forbids reintroducing `mode`/`useRawRef`/`lastAggSignatureRef`/`sessionHasData`.
- Using the **quantized window as the React Query key** is the right call — it delivers dedup + cache for free and the functional `setOverlay(prev => …)` identity check correctly prevents the per-pixel re-render storm.
- Keeping `deriveView` base-driven and reading hysteresis state from `overlayRef` (not a separate flag) keeps the single-source-of-truth invariant intact and `handleDataZoom` stable.
- Preserving the Phase 19 `minmax`/`large`/`progressive` flags on the raw path and the note 30 structure-signature merge is explicitly called out and untouched.

PLAN_REVIEW_PASS
