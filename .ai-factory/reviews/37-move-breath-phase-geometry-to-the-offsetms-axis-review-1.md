# Code Review: Move breath-phase geometry to the `offsetMs` axis

**Plan:** `37-move-breath-phase-geometry-to-the-offsetms-axis.md`
**Files reviewed (in full):** `src/core/types/index.ts`, `src/pages/SessionsPage/transforms.ts`, `src/pages/SessionsPage/chartOption.ts`
**Risk:** 🟢 Low

## Scope of changes

Three-file frontend transform/view-model change, exactly as planned:

- `core/types/index.ts` — dropped `PhaseBar.durationMs`; in `InstructionDto.data` dropped `durationMs?`, added `offsetMs?: number` and `tickCount?: number`.
- `transforms.ts` — `parsePhases` per-sample boundaries now read `(event.data.offsetMs ?? 0) / 1000`; last-bar end retains `secFromStart(endedAt, startedAt)`; `durationMs` removed from the returned object; JSDoc updated. `secFromStart` and `toSeries` untouched.
- `chartOption.ts` — in-bar label recomputed from the bar span `Math.round(api.value(1) - api.value(0))`.

## Verification performed

- `npm run typecheck` (`tsc --noEmit`) — **passes**. Confirms `offsetMs?: number` resolves the `(unknown ?? 0)` risk, and that `RenderItemAPI.value` is typed `(dim: number) => number` so the `api.value(1) - api.value(0)` subtraction is type-safe.
- `npm run lint` (`eslint .`) — **passes**, no warnings.
- Full-tree grep for `durationMs` — **zero remaining references**. The only `offsetMs`/`tickCount` consumers are the intended sites. No hidden consumer of `PhaseBar.durationMs` was orphaned.
- Confirmed `parsePhases` has a single caller (`chartOption.ts:93`) and that the x-axis `max` (`durationSec`, line 90) is the same `endedAt − startedAt` scalar the last bar bounds to — per-sample origin and axis origin are consistent at `0`.

## Correctness notes (no action required)

1. **Label data source is correct.** The custom series `data` is `value: [p.startSec, p.endSec]` (line 334), so `api.value(0)` = startSec and `api.value(1)` = endSec. The new label `endSec − startSec` correctly yields each bar's span in seconds. `renderItem` already binds `startSec`/`endSec` locals (lines 296-297); reusing them would read marginally cleaner than re-calling `api.value`, but the result is identical — cosmetic only.

2. **Negative/zero-width bars degrade gracefully.** For pre-migration data (no `offsetMs`, `?? 0`) intermediate bars collapse to zero width, and for inflated `abandoned`/`disconnected` ends the last bar could in theory invert (`endSec < startSec`). In both cases `barWidth = Math.max(bottomRight[0] - topLeft[0], 1)` clamps to 1px, which is `< 40`, so `renderItem` returns the bare rect **before** reaching the label — no negative `· -Ns` text is ever rendered, no crash. This is a happy accident of the existing `barWidth < 40` guard, but it holds. Consistent with the spec's "accepted, pre-migration data is stale" stance.

3. **Last-bar label semantics.** As designed, the final bar's label is the axis remainder `(endedAt − startedAt) − lastOffsetMs/1000`, not the instruction's intended duration. This is the deliberate, documented consequence of the hard cutover and is acceptable.

## Conclusion

The implementation matches the plan precisely, typechecks, lints clean, leaves no dangling `durationMs` references, and preserves the single intended use of `secFromStart`/`startedAt` (the last-bar axis scalar). No bugs, security, or correctness issues found.

REVIEW_PASS
