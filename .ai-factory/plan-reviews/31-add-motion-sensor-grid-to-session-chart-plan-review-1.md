# Plan Review: Add motion sensor grid to session chart

**Plan:** `31-add-motion-sensor-grid-to-session-chart.md`
**Target file:** `src/pages/SessionsPage/chartOption.ts`
**Risk Level:** 🟢 Low

## Context Gates

- **Architecture** (`.ai-factory/ARCHITECTURE.md`): ✅ PASS. The change is confined to a page-local transform/option builder under `pages/SessionsPage/`. No new fetches, no `localStorage` access, no shared-component data fetching, no cross-page imports. Stays within the "pages own data shaping" principle.
- **Rules** (`mind_web/CLAUDE.md` + `.ai-factory/rules/base.md`): ✅ PASS. No raw `fetch`, no storage access, no proto edits, `mind_auth_token` untouched. File stays in English.
- **Roadmap** (`.ai-factory/ROADMAP.md`): ✅ PASS. Directly implements the open milestone "Add motion sensor grid to session chart" (line 87). Plan scope matches the milestone description and its referenced spec `.ai-factory/notes/16-motion-grid.md` exactly.

## Assumption Verification (cross-repo)

The plan's central risk is the `sampleType` string and field names, since the web repo has no prior reference to motion data. Verified against the actual producer in `mind_mobile`:

- `mind_mobile/lib/Biometrics/BioSample.dart` → `BioSample.fromMotion` emits `sampleType: 'motion'`. ✅ Matches `byType.get('motion')`.
- Payload fields are exactly `ax`, `ay`, `az`, `gx`, `gy`, `gz` (all `double`), plus a non-numeric `source` string. ✅ Matches the six `toSeries` field keys. `toSeries` filters on `typeof === 'number'`, so the `source` string is naturally ignored — no special handling needed.
- `BioSampleDto.data` is typed `Record<string, number | boolean | string>` (`core/types/index.ts:50`) and `sampleType` is `string`, so no type changes are required — the plan's claim is correct.

## Pattern Conformance

Read the full target file. Each task maps cleanly onto the established HR_GRID / EEG_GRID / EMOT_GRID conditional pattern:

- **Task 1** — `const motion = byType.get('motion') ?? []` + six `toSeries(motion, 'a*'/'g*', startMs)` calls + `hasMotion` OR-flag. Mirrors `hasEmotions` (lines 114–119). ✅
- **Task 2** — `const MOTION_GRID = hasMotion ? nextIdx++ : undefined;` placed after `EMOT_GRID` and before `totalGrids = nextIdx` (line 129). `gridHeights` append is correct; `gridTops`, `grids` (line 147), and `xAxes` (line 155) all derive from `gridHeights`/`totalGrids` and need no edits. ✅ Confirmed by inspection.
- **Task 3** — conditional Y-axis with `scale: true`, `gridIndex: MOTION_GRID`, name `'m/s²·rad/s'`, copying the Score-axis styling (lines 209–221). Inside the `MOTION_GRID !== undefined` guard TS narrows `number | undefined` → `number`, matching the existing blocks. ✅
- **Task 4** — six `buildLineSeriesEntry(MOTION_GRID, …)` calls. Colors/names match the spec note table verbatim. The `gridIndex: number` parameter is satisfied by the narrowed guard, same as EMOT_GRID (lines 299–307). ✅
- **Task 5** — JSDoc update ("four" → "five" grids). ✅ Non-functional, correct.

## Critical Issues

None.

## Non-Blocking Observations (informational, no plan change required)

- **WARN — Series density / performance.** Motion is sampled at ~250 Hz (per ROADMAP line 89), so a multi-minute session yields tens of thousands of points across six series. The plan follows the existing pattern (`symbol: 'none'`, no `sampling`/`large` mode), which is the correct call for consistency, but the motion grid will be markedly heavier than HR/EEG/emotions. ECharts `sampling: 'lts'` on the motion line series would help if rendering lags — worth keeping in mind, not required for this milestone.
- **Sequencing note.** ROADMAP line 89 states the full-session biometrics fetch currently returns **413** for real sessions largely *because* of motion volume; chunked loading is a separate downstream milestone. Until that lands, the motion grid will only populate for short sessions. This is expected and out of scope — the option-builder code is correct regardless of how the data arrives.
- **Axis-label migration (expected behavior).** Because `xAxes` shows ticks/labels only on the last grid (`i === totalGrids - 1`, lines 161/165), adding MOTION_GRID moves the time axis from the emotions grid to the motion grid. This is the intended stacked-grid behavior, not a regression.

## Positive Notes

- The plan correctly identified that `transforms.ts` and `core/types` need no changes — verified true.
- Single-file scope, exact reuse of the proven conditional-grid pattern, and `totalGrids = nextIdx` auto-counting means `gridCount`/empty-state logic needs no touch. Low blast radius.
- Color palette, axis name, field names, and `sampleType` all match both the spec note and the upstream mobile producer.

PLAN_REVIEW_PASS
