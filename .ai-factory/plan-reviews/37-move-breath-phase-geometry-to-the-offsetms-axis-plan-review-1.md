## Plan Review: Move breath-phase geometry to the `offsetMs` axis

**Plan:** `37-move-breath-phase-geometry-to-the-offsetms-axis.md`
**Files Reviewed:** 3 (`src/core/types/index.ts`, `src/pages/SessionsPage/transforms.ts`, `src/pages/SessionsPage/chartOption.ts`)
**Risk Level:** 🟢 Low

### Context Gates

- **Architecture** (`.ai-factory/ARCHITECTURE.md`): PASS. The change stays entirely within `pages/SessionsPage/` (transform + chart option) and `core/types`. Transformation logic lives in the page-local transform module, consistent with principle #4 ("transformations happen close to the fetch site"). No dependency-rule violations — no new `fetch`, no `localStorage`, no cross-layer imports.
- **Rules** (project `CLAUDE.md`): PASS. All files English, no proto changes, no raw `fetch`, no storage access, no renamed `mind_auth_token`. No `console.*` usage introduced.
- **Roadmap** (`.ai-factory/ROADMAP.md`): WARN (non-blocking). The plan does not cite a roadmap milestone. This is a `fix`-class change (drift correction); linking it to a roadmap item would aid traceability but is not required for correctness.

### Verification of Plan Claims

All line numbers and code references in the plan were checked against the current source and are **accurate**:

- `InstructionDto.data` at lines 41–44, `PhaseBar` at lines 30–35 — confirmed.
- `parsePhases` at lines 13–34, JSDoc at lines 8–12 — confirmed.
- The `bar.durationMs`-based label at `chartOption.ts` lines 318–321 — confirmed verbatim.
- A full-tree grep for `durationMs` returns **exactly** the five sites the plan touches (2 in `types`, 1 in `transforms`, 2 in `chartOption`). No hidden consumer of `PhaseBar.durationMs` exists, so Task 3's "confirm no other reference remains" will succeed and the type field can be dropped cleanly.
- `parsePhases` has a single caller: `chartOption.ts:93`. The x-axis `max` is `durationSec` (lines 89–90, 201) = `endedAt − startedAt`, matching the plan's claim that the axis length and the last-bar end share the same scalar. The new per-sample `offsetMs` origin and the axis origin are therefore consistent.

### Critical Issues

None.

### Observations (non-blocking)

1. **Type dependency ordering is correct and necessary.** `InstructionDto.data` is `{ phase?; durationMs? } & Record<string, unknown>`, so `event.data.offsetMs` currently resolves to `unknown`, and `(unknown ?? 0) / 1000` would fail `tsc`. Adding `offsetMs?: number` in Task 1 is a hard prerequisite for Task 2 — the plan already marks Task 2 as `depends on Task 1`. Good.

2. **Last-bar label semantics shift slightly.** After Task 3, the in-bar label is `endSec − startSec`. For intermediate bars this is `nextOffsetMs − thisOffsetMs` (actual inter-instruction span ≈ intended phase duration — fine). For the **last** bar it becomes `(endedAt − startedAt) − lastOffsetMs/1000`, i.e. the axis remainder rather than the instruction's intended `durationMs`. This is a deliberate consequence of the cutover and acceptable, but worth being aware of: if the session ends well after the final phase instruction, the last bar's label will read longer than the phase actually lasted.

3. **Negative/inverted last bar is theoretically possible.** If the final instruction's `offsetMs/1000` exceeds `endedAt − startedAt` (clock drift in the opposite direction), `endSec < startSec`. ECharts `Math.max(..., 1)` on width/height (lines 302–303) already guards rendering, so this degrades gracefully — no crash. No action needed; noting for completeness.

4. **Minor style.** Task 3 specifies `Math.round(api.value(1) − api.value(0))`. The `renderItem` already binds `startSec = api.value(0)` and `endSec = api.value(1)` (lines 296–297), so `Math.round(endSec − startSec)` reads cleaner and is equivalent. Cosmetic only.

5. **`tickCount` is added to the type but unused.** The plan documents this as "part of the contract." Harmless; no objection.

### Positive Notes

- Correct scope: no migration, no API contract change (mind_api proto untouched), no auth surface — purely a frontend transform/view-model change.
- The "hard cutover, no `timestamp − startedAt` fallback" decision is sound and explicitly justified — a fallback would reintroduce the exact cross-clock skew being removed, and pre-migration data collapsing to `0` via `?? 0` is an acknowledged, bounded tradeoff.
- Single retained use of `secFromStart`/`startedAt` (the last-bar axis scalar) is correctly identified, so neither is left dangling nor over-removed.
- Settings (no tests, minimal logging, no docs) are appropriate for a self-contained 3-file geometry fix.

The plan is accurate, complete, correctly ordered, and free of architectural or security concerns.

PLAN_REVIEW_PASS
