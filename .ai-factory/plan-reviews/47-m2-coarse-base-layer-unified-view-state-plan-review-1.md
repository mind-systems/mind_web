# Plan Review: (M2) Coarse base layer + unified view-state

**Plan:** `47-m2-coarse-base-layer-unified-view-state.md`
**Files Reviewed:** plan + 9 codebase files (web + api)
**Risk Level:** 🟢 Low

## Verification Summary

I traced every load-bearing assumption in the plan against the actual code:

| Plan assumption | Verified | Evidence |
|---|---|---|
| API supports `bucketSec` query param | ✅ | `sessions.controller.ts:48` → `sessions.service.ts:147` (`if (bucketSec !== undefined) …`) |
| `bucketSec` validated as positive int | ✅ | `time-range-query.dto.ts`: `@Type(() => Number) @IsInt() @Min(1)` |
| Aggregated path has NO 413/payload cap (so RQ-with-cache is safe) | ✅ | `sessions.service.ts:220-223` comment: "no ROW_CAP/FLAT_CAP/413 guard is needed on this path" |
| `from`/`to` optional alongside `bucketSec` | ✅ | `aggregateBiometrics(session, bucketSec, from?, to?)` — both optional |
| `computeBucketSec` shipped in M1 | ✅ | `bucketPolicy.ts:48` exists, floors at 1s (`@Min(1)` satisfied) |
| `startedAt`/`endedAt` are ISO strings on `SessionRun` | ✅ | `types/index.ts:15-16` both `string` |
| Aggregated samples flow through `byType → toSeries` unchanged | ✅ | `reshapeAggregatedBiometrics` emits `{ timestamp, sampleType, data }`; `toSeries` does `new Date(s.timestamp).getTime()` which handles the numeric epoch-ms timestamps the reshape returns |
| `buildSessionChartOption` param position for the data swap | ✅ | `chartOption.ts:93-99` — `biometrics` is arg 2; plan swaps overview samples into that exact slot |
| File paths under `pages/SessionsPage/` allowed to co-locate `useQuery` | ✅ | CLAUDE.md rule bars `useQuery` only in *shared components*; pages are exempt |

### Context Gates
- **Architecture / Rules:** Plan respects all project rules — HTTP via `apiFetch` (no raw `fetch`), logging via `logger` facade, new files in English, page-local hook co-location permitted. No storage access introduced. No proto changes. **PASS.**
- **Roadmap:** Plan is explicitly scoped as Phase 20 / M2 with a clean M3 boundary (`notes/35-detail-overlay.md`). Linkage present. **PASS.**

## Critical Issues
None. The plan is implementable as written and its central technical claims are all confirmed against the codebase.

## Observations (non-blocking)

1. **`gridCount` conflates instruction presence with biometric presence — pre-existing, correctly inherited.**
   `totalGrids` includes the `INSTRUCTION_GRID` whenever `hasPhases` is true (`chartOption.ts:170,175,182`). So `empty` (`gridCount === 0`) fires only when there are *neither* phases *nor* biometrics. This matches today's `isEmpty` semantics exactly, so it is not a regression — and it is arguably correct (a phase-only timeline is renderable). Worth a one-line acknowledgement in the implementer's head so the "base zero-grid == session emptiness" framing in Task 2 isn't read too literally: it's "zero renderable grids," which folds in the soft-failed/absent instructions. Because `loading` gates until *both* queries settle, `gridCount` is final before `empty`/`ready` is evaluated, so ordering is safe.

2. **Use `isPending` (not `isLoading`) consistently in `deriveView`, and confirm instructions failure resolves `loading`.**
   The plan's soft-instructions-error behavior depends on a failed instructions query no longer counting as "pending." In TanStack Query v5 an errored query has `isPending === false`, so `loading = overviewPending || instructionsPending` correctly releases when instructions error out, then `error` is driven by overview only — exactly the intended slug-46 fix. Just make sure Task 2 reads the instructions query's `isPending`/`isError` (the existing component destructures `isLoading`/`isError`; v5 keeps both, so either works for an enabled query, but `isPending` is the cleaner parity choice the plan already names).

3. **Minor redundancy: option is built from `overview.data ?? []` in the memo, and `view.samples` also returns `overview.data ?? []`.**
   Task 3 renders `EChart option={option}` (from the memo) while `deriveView` also returns `samples`. Both derive from the same `overviewQuery.data`, so they stay consistent and `view.samples` is effectively unused by the render path. That's harmless, but the implementer may choose to either drop `samples` from the consumed result or feed the memo from `view.samples` to make the single-source intent explicit. Not required for correctness.

4. **Removing `allChunksAttempted` from the empty condition is justified.**
   The old `isEmpty` needed `allChunksAttempted` to avoid trapping sessions whose biometrics start after chunk 0. A single full-session aggregate covers the entire span in one request, so that guard genuinely becomes unnecessary. The plan's reasoning here is sound.

5. **Import/lint cleanup reminder (already implied by Task 3).**
   Removing the chunk wiring orphans the `useBiometricChunks` + `CHUNK_SEC` imports and `totalChunks`/`requestWindowChunks`. `useEffect` (signature-commit), `useCallback` (datazoom), `useMemo` (events/option), and `useRef` (zoomRef/prevSignatureRef) all remain in use, so only the chunk-hook imports need pruning. The plan's "confirm `npm run lint`/`typecheck`" step covers this; flagging so it isn't missed.

## Positive Notes
- The plan correctly identifies and exploits the asymmetry between the two endpoints: raw path is 413-bounded (hence RQ-bypassing chunk hook), aggregated path is not (hence safe to put behind React Query with cache/dedup/cancellation). The required top-of-file doc comment documenting this divergence is the right call.
- Task dependencies (`Task 2 → Task 1`, `Task 3 → Task 1,2`) are accurate.
- The M2/M3 boundary is crisply drawn: keeping `useBiometricChunks.ts` on disk, retaining `zoomRef` + a no-op-persisting `datazoom` handler, and preserving the note-30 `notMerge`/`structureSignature` machinery all set up M3's lazy high-res overlay without over-building now.
- The slug-46 fix (error kept distinct from empty) is real and verifiable against the current code, which collapses both into "No data" via a single `isError = instructionsError` path.

PLAN_REVIEW_PASS
