# Plan Review: Session charts panel (right panel) — ECharts multi-grid

**Plan:** `13-session-charts-panel-right-panel-echarts-multi-grid.md`
**Risk Level:** 🟢 Low
**Verdict:** Solid — minor advisory notes only, no blockers.

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** ✅ Aligned. The plan keeps all `useQuery`/`apiFetch` in the page (`SessionsPage/index.tsx`) and makes `SessionCharts.tsx` a pure presentational component receiving data as props — exactly matching the "Pages own data, components own presentation" rule and the "no fetch in components" anti-pattern. Transforms are pulled into framework-free helpers (`transforms.ts`, `chartOption.ts`), consistent with "shape data outside JSX." No raw `fetch`, no `localStorage` access. — **PASS**
  - Minor: ARCHITECTURE's folder template lists `BiometricCharts.tsx` / `InstructionTimeline.tsx` as the SessionsPage children, but the plan introduces a single `SessionCharts.tsx` plus `transforms.ts` / `chartOption.ts`. This is a reasonable deviation (single multi-grid ECharts instance, not two separate chart components) and does not violate any dependency rule. **WARN** — the template in ARCHITECTURE.md is now stale relative to the actual design; consider updating it post-implementation.
- **Rules (`.ai-factory/RULES.md`):** Not present (empty). The CLAUDE.md rules (English, `mind_auth_token` untouched, all HTTP via `apiFetch`, no `localStorage` in pages) are all respected by the plan. — **PASS**
- **Roadmap (`.ai-factory/ROADMAP.md`):** ✅ The plan maps 1:1 onto the open Phase 3 milestone "Session charts panel (right panel) — ECharts multi-grid", including the conditional-grid behavior, linked X-axes, and the `notes/04-echarts-session-charts.md` reference. — **PASS**

## Critical Issues

None. This is frontend-only work — no migrations, no schema changes, no auth-flow changes. All data access flows through the existing `apiFetch` wrapper.

## Findings (non-blocking)

### 1. Notes path is relative to `.ai-factory/`, not the plan dir — **WARN**
The plan references `notes/04-echarts-session-charts.md` throughout. The file actually lives at `.ai-factory/notes/04-echarts-session-charts.md` (confirmed present). This matches the repo's existing convention (ROADMAP.md uses the same `notes/...` shorthand), so an implementer should find it — but the path is not literally correct from the plan file's own directory. No change required; just be aware.

### 2. Chart container height must include the bottom dataZoom slider — **WARN**
Task 4 says compute `height` from "the number of active grids." The spec's layout starts at `top: 50`, then instruction grid `80` + `20` gap, then each data grid `160` + `20`. But it also adds a `dataZoom` slider at `bottom: 10` (~30px tall). If `height` is set to only the sum of the grids/top, the slider (and the bottom grid's axis labels) will be clipped. The height formula should be roughly `50 + 80 + 20 + activeDataGrids * (160 + 20) + ~50` (slider + bottom margin). Worth getting explicit in the implementation.

### 3. `yAxisIndex` — follow the prose note, not the skeleton's ad-hoc expressions — **WARN**
Task 3 correctly tells the implementer to keep `yAxisIndex` in 1:1 correspondence with the dynamic grid indices ("Note on yAxisIndex"). Note that the skeleton code in the spec expresses these awkwardly (`yAxisIndex: HR_GRID !== -1 ? 2 : 1`, `yAxisIndex: totalGrids - 1`) rather than using `EEG_GRID` / `EMOT_GRID` directly. They happen to evaluate to the same values, but the implementer should use the named indices (`HR_GRID`, `EEG_GRID`, `EMOT_GRID`) directly as the plan instructs — cleaner and less error-prone if the grid set changes later.

### 4. ECharts `custom` series `renderItem` typing — **WARN**
Task 3 asks to type the return as `EChartsOption` from `echarts`. The `type: 'custom'` series `renderItem(params, api)` callback is notoriously loosely typed under strict TS; `api.coord(...)` returns `number[]` and indexing `[0]`/`[1]` plus the `api.value(2) as string` cast may need explicit `CustomSeriesRenderItemAPI` / `CustomSeriesRenderItemReturn` annotations (or a localized cast) to satisfy `tsc --noEmit`. Plan already anticipates `as const` on literal `type` fields, which is the right instinct — just flag that the custom series may need a bit more typing care than the other series. `EChartsOption` is exported from `echarts` (v6.1.0 is installed), so the import itself is fine.

### 5. Deep-link / hard-refresh to a session beyond the first loaded page — **WARN (acknowledged)**
Task 5 resolves `selectedSession` from the already-loaded infinite-query pages and falls back to "Select a session" if the id isn't loaded. This means refreshing `/sessions/:id` for a session that lives on page 2+ shows the empty state indefinitely. The plan explicitly scopes this out as an MVP limitation with a code comment — acceptable for this milestone, but recording it here so it's tracked as a known UX gap.

### 6. Endpoints unverifiable from this repo — **WARN**
`GET /sessions/runs/:id/instructions` and `GET /sessions/runs/:id/biometrics` (with `?from=&to=`) and the exact `data` field names (`heartRate`, `delta/theta/alpha/smr/beta`, `attention/relaxation/cognitiveLoad/cognitiveControl/selfControl`) come from `mind_api`/`mind_mobile` inspection captured in the notes file. They cannot be verified inside `mind_web`. The plan's permissive `data: Record<string, number | boolean | string>` typing is a sensible hedge against shape drift. Confirm the endpoints/fields against `mind_api` before or during implementation.

## Positive Notes

- Correctly assigns query ownership to the page and keeps `SessionCharts` presentational — no architecture violation, reuses existing `apiFetch`, `format.ts`, and `SkeletonLoader`.
- Improves on the spec by URL-encoding the ISO `from`/`to` values (the raw skeleton did not), avoiding breakage from `:`/`+` in timestamps.
- Calls out `notMerge` on `<ReactECharts>` — important because the grid/axis/series set changes between sessions and a merge would leave stale grids.
- Sensible task decomposition with explicit dependencies (types → transforms → option builder → component → wiring) and framework-free pure helpers that are easy to test/reason about.
- Conditional-grid logic and dynamic index assignment faithfully mirror the spec; empty/loading/error states are all handled.
- Commit plan is clean and follows the repo's commit-message conventions (no type prefixes, sentence case).

## Conclusion

The plan is faithful to the spec, architecturally clean, and free of blocking issues. The findings above are advisory refinements an implementer should keep in mind — none require a plan revision.

PLAN_REVIEW_PASS
