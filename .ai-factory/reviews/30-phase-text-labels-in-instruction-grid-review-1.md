# Code Review: Phase text labels in instruction grid

**Plan:** `.ai-factory/plans/30-phase-text-labels-in-instruction-grid.md`
**Files reviewed (in full):** `src/core/types/index.ts`, `src/pages/SessionsPage/transforms.ts`, `src/pages/SessionsPage/chartOption.ts`
**Build gates:** `npm run typecheck` ✅ clean · `npm run lint` ✅ clean

## Summary

The implementation matches the (round-2-approved) plan task-for-task. All five tasks landed:

- `PhaseBar.durationMs?: number` added (`index.ts:34`).
- `parsePhases` populates `durationMs: event.data.durationMs` (`transforms.ts:31`).
- `PHASE_LABELS` map added beside `PHASE_COLORS` (`chartOption.ts:12-17`).
- `renderItem` rewritten to a rect+text `group`, with the `barWidth < 40` early-return preserving the bare-rect path for narrow bars (`chartOption.ts:234-274`).

The label source is correct **by construction**: `phaseSeries.data` is `phases.map(...)`, so `params.dataIndex` indexes 1:1 back into the in-scope `phases` array. This is the type-safe `dataIndex`-closure approach the plan reviews converged on — no `params.name` dependency, no `as`-cast, no empty-label failure mode. The round-1 critical issue does not reappear in the code.

## Correctness / runtime

- **No crash risk on the index access.** `phases[params.dataIndex]` is only reached when `INSTRUCTION_GRID !== undefined`, i.e. `phases.length > 0`, and `dataIndex` is bounded by the same array. `tsconfig.app.json` does not enable `noUncheckedIndexedAccess`, so `bar` is typed `PhaseBar` and `bar.phase` / `bar.durationMs` typecheck without optional chaining — consistent with the typecheck pass.
- **`durationMs` guard is sound.** `bar.durationMs !== undefined` correctly distinguishes "no planned duration" from a real `0`. Note `Math.round(0/1000)` → `0s`, which only occurs for an explicit `durationMs: 0` — acceptable.
- **Geometry/layering unchanged for bars; text correctly centered.** `x: topLeft[0]+6`, `y: topLeft[1]+barHeight/2` with `textBaseline:'middle'` against the rect from `api.coord([startSec,1])`/`api.coord([endSec,0])`. `z2` (rect 0, text 1) under series `z:2` keeps labels above bars and grid lines.
- **Narrow-bar suppression re-evaluates under zoom.** `barWidth` derives from `api.coord(...)`, which tracks the live `dataZoom` window, so the `< 40px` cutoff is dynamic per the spec intent.
- **No security surface.** Pure client-side chart-option construction; no new fetch, storage, auth, or user-controlled sink. (`label` is rendered into an ECharts canvas `text` element, not the DOM — no injection vector.)

## Non-blocking observations (informational — faithful to spec, no action required)

1. **Label can overflow a borderline-width bar.** `Inhale · 4s` in bold 11px is ~70px wide; a bar just over the 40px threshold (40–70px) will let its label spill past the bar's right edge over the neighbouring bar, since ECharts does not clip the `text` element to the rect. This is inherent to the spec's fixed 40px cutoff and is cosmetic only. If it proves distracting in practice, a future tweak could clip text to `barWidth` or raise the threshold — out of scope here.
2. **Label duration ≠ bar width.** `durationMs` is the *planned* phase duration, while the bar spans `startSec→endSec` (time to the next `breath_phase` event). A bar may read "4s" while drawn slightly wider/narrower. This is by design per the spec note and not a defect.
3. **`rest` contrast.** White text on `rest: #9E9E9E` is low-contrast (~2.3:1). Matches the spec's "white bold 11px" mandate; flagging only for awareness.

## Verdict

No bugs, type mismatches, race conditions, or security issues. Build gates pass. The three notes above are cosmetic and faithful to the approved spec.

REVIEW_PASS
