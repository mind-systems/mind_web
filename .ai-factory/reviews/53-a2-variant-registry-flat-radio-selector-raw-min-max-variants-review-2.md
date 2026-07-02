# Code Review 2: (A2) Variant registry + flat radio selector + raw & min/max variants

**Reviewed:** `git diff HEAD` / `git status` — new `chartVariants/{types,makeWindowedVariant,registry}`, new `VariantSelector`, rewritten `SessionCharts`, trimmed `bucketPolicy`, deleted `useBiometricAggregate`/`useBiometricChunks`/`useBiometricWindowedBase`. Source is unchanged since review-1; this is an independent second pass focused on runtime correctness, effect ordering, and edge cases.
**Build:** `npm run typecheck` ✅ clean · `npm run lint` ✅ clean.

## What I re-verified this pass

**Effect ordering on mount (the highest-risk area).** The variant's hooks execute in declaration order: `useBiometricWindows`'s drain effect → its session reset effect (line 184) → the variant's auto-enqueue effect. On mount this resolves correctly:
1. drain sees an empty queue and no-ops;
2. reset clears state and `setQueue([])`;
3. auto-enqueue calls `requestWindows([0..n-1])`, filling `queuedSetRef` and `setQueue([0..n-1])`.
Because reset (which empties `queuedSetRef`/`loadedRef`) runs *before* auto-enqueue in the same commit's passive-effect pass, every window survives the dedup guards and gets enqueued; the next commit re-runs only the `[queue]`-keyed drain effect and fetching begins. This is byte-for-byte the same ordering the retired `useBiometricWindowedBase` relied on (its auto-enqueue effect was likewise declared after the `useBiometricWindows` call), so the progressive-load behavior is preserved, not merely re-approximated. No lost-enqueue race.

**Per-mount stability of `windowSec`/`buildPath`.** `session` identity is constant within a variant mount: `SessionCharts` is keyed by `index.tsx` on `selectedSession.id`, and a radio change re-renders `SessionCharts` but remounts the variant (both the `key` and the `Component` type change). So `useMemo(…, [session])` / `[session, windowSec]` are effectively compute-once, satisfying `useBiometricWindows`'s stable-`buildPath` contract — the drain effect never re-binds mid-load. Confirmed the eslint-disabled `windowSec` dep on the `buildPath` memo is inert given this stability.

**`minmax` parity with the retired base loader.** Window math (`bucketSec = computeBucketSec(durationSeconds)`, `windowSec = max(ceil(ceil(dur/8)/bucketSec)*bucketSec, bucketSec)`) and the quantizing `buildPath` (floor interior boundaries, ceil only the final window when `toMs >= sessionEndMs`, `&bucketSec=N`) match `useBiometricWindowedBase` exactly. Default behavior is preserved.

**Degenerate sessions.** `durationSeconds === 0`: minmax → `computeBucketSec(0)=1`, `windowSec=max(0,1)=1`, `totalWindows=0`; raw → `windowSec=30`, `totalWindows=0`. Auto-enqueue builds an empty array, `requestWindows([])` no-ops, and `deriveView`'s `totalWindows > 0` guard steers to `empty` rather than `error`. No divide-by-zero, no crash.

**Retirement completeness.** No `src/**` importers remain for the three deleted hooks or the removed `bucketPolicy` exports (`shouldUseRaw`, `computeSpanSec`, `quantizeWindow`, `RAW_SPAN_LIMIT_*`); the retained exports (`computeBucketSec`, `snapUp`, `TARGET_BUCKETS`, `BUCKET_LADDER`) are all still used. Typecheck confirms zero dangling references. The lone match in `transforms.ts:41` is a stale doc comment, not an import.

**Security.** URL construction is unchanged in shape from the retired `useBiometricChunks` (`/sessions/runs/${session.id}/biometrics?from=…&to=…`); `session.id` is an API-issued UUID, `from`/`to` are `encodeURIComponent`-wrapped ISO strings, auth flows through the `apiFetch` interceptor. No new injection or auth surface.

## Non-blocking notes (no change required)

- **Loading hint placement.** Rendering `Loading…` as a block sibling above `BiometricEChartBody` (rather than inline in the header) lets it vertically shift the chart as `isLoading` toggles between windows. This is exactly what the plan specified ("loading hint moves into the variant"), so it is an accepted design consequence, not a defect. Recorded from review-1 for continuity.
- **Eager full raw load.** Selecting **Raw** now loads the entire session at raw resolution (all 30 s windows auto-enqueued) instead of the retired zoom-scoped chunk loading. This is the milestone's stated intent ("the Raw radio serves deep inspection"; Phase-19 render decimation stays and is mandatory here). Requests remain per-window bounded, so the original 413 (single full-session request) does not recur.

## Conclusion

No bugs, security issues, or correctness problems. The change is faithful to the plan and spec note 39, preserves `minmax` default behavior, correctly retires the zoom-driven overlay, and handles the edge cases above. The two notes are intended design consequences requiring no action.

REVIEW_PASS
</content>
