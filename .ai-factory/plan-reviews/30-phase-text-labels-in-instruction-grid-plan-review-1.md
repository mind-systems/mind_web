## Plan Review: Phase text labels in instruction grid

**Plan:** `.ai-factory/plans/30-phase-text-labels-in-instruction-grid.md`
**Files Reviewed:** 3 source files + plan + spec note + echarts runtime source
**Risk Level:** 🔴 High

### Context Gates

- **Architecture (`ARCHITECTURE.md`):** WARN (informational only). No dependency/boundary violation — change stays within `src/pages/SessionsPage/` + `src/core/types/`, consistent with the Feature-Based Modules pattern. No rule against the `as`-cast technique, but see Critical Issue 1 — the chosen cast is also functionally wrong.
- **Rules (`.ai-factory/rules/base.md`):** PASS. Naming, module structure, logging ("minimal" matches the no-console rule), and English-only are all respected. No new `localStorage`/`fetch`/component-`useQuery` violations introduced.
- **Roadmap (`ROADMAP.md`):** WARN. The note-18 dependency (Phase 11 — "Fix InstructionDto field names") is confirmed landed (`[x]`), so the plan's "no dependency work remains" claim is accurate. However, this is `feat`-class work with **no matching ROADMAP milestone** — there is no "phase text labels" entry under Phase 11 or elsewhere. Add a roadmap line for traceability before/at implementation.

---

### Critical Issues

**1. `params.name` is NOT populated at runtime — labels will silently render empty.**

This is the load-bearing mechanism of the whole feature, and it does not work as specified.

Task 4 instructs: read the phase name from the first `renderItem` argument via `const name = (params as { name?: string }).name;`, then resolve `label = PHASE_LABELS[name] ?? name ?? ''`.

I verified against the installed ECharts (v6.1.0) **runtime source**, not just the types:

- `node_modules/echarts/lib/chart/custom/CustomView.js:430-442` builds `userParams` with exactly: `context, seriesId, seriesName, seriesIndex, coordSys, dataInsideLength, encode, itemPayload`.
- Line 472-477 passes `defaults({ dataIndexInside, dataIndex, actionType }, userParams)` to `renderItem`.
- The TypeScript interface `CustomSeriesRenderItemParams` (`types/dist/echarts.d.ts:3244`) matches exactly — **no `name` field exists**.

So at runtime `(params as { name?: string }).name` is `undefined`, and `PHASE_LABELS[undefined] ?? undefined ?? ''` evaluates to `''`. **Every bar renders an empty string** — the feature produces no visible labels at all.

Worse, this passes silently: the `as` cast suppresses the TS error, so `npm run typecheck` and `npm run lint` (Task 5, the only verification step) both pass green. Nothing in the plan would catch the failure. The spec note (`19-phase-text-labels.md`, lines 29 & 51) even flagged this uncertainty ("Alternatively encode as dimension index 2 if `params.name` is not easily accessible") — the plan resolved it the wrong way.

Adding `name: p.phase` to the series data item (Task 4's data-mapping change) does NOT make it appear on `params` — ECharts stores it on the data item, not on the renderItem params object.

**Recommended fix (most robust, fully type-safe — no string cast needed):** use the documented `dataIndex` field plus a closure over the in-scope `phases` array.

```typescript
renderItem: (params: { dataIndex: number }, api: RenderItemAPI) => {
  // ...rect computation unchanged...
  const phase = phases[params.dataIndex]?.phase;
  const label = PHASE_LABELS[phase] ?? phase ?? '';
  // ...
}
```

`phases` is already in scope inside `buildSessionChartOption`, `dataIndex` is a real, typed field, and `phase` is a `BreathPhase` — no `as`-cast and no risk of `undefined`. With this approach the `name: p.phase` data-item addition becomes unnecessary and can be dropped.

(Alternative: encode phase as a third value element `value: [p.startSec, p.endSec, p.phase]` and read `api.value(2)` — but that returns a typed `number`, so it needs its own cast and is strictly worse than the `dataIndex` route.)

---

### Medium Issues

**2. `durationMs` plumbing (Tasks 1 & 2) is dead code — added but never consumed.**

Tasks 1 and 2 extend `PhaseBar` with `durationMs?` and populate it in `parsePhases`, but Task 4's rendering only draws the phase **label** text — `durationMs` is never read anywhere in the rendered output or anywhere else in the codebase. The spec note calls duration "useful for display," but the plan's actual `text` element renders only the phase word.

This leaves an unused field threaded through the type and transform — minor dead code that contradicts the plan's own "Keep the change minimal" instruction. Resolve one of two ways:
- **Drop Tasks 1 & 2** entirely if duration isn't being shown; or
- **Use it** — e.g. render `Inhale · 4s` by combining `PHASE_LABELS[phase]` with `Math.round(durationMs / 1000)`. Note `durationMs` is optional, so guard for `undefined`.

Pick one and state it; don't add the field and leave it unread.

---

### Minor Notes

- **Line-number references are accurate.** `PHASE_COLORS` (5-10), `PhaseBar` (30-34, `phase` on 33), and `phaseSeries` (221-254) all match the current files. File paths are correct.
- **`parsePhases` change is sound.** `event.data.durationMs` is typed `number | undefined` and `PhaseBar.durationMs?` is optional, so the `satisfies PhaseBar` literal still type-checks (only relevant if Task 2 is kept per Issue 2).
- **Text geometry is correct.** `x: topLeft[0] + 6`, `y: topLeft[1] + barHeight/2` with `textBaseline: 'middle'` correctly centers the label vertically against the rect computed from `api.coord([startSec,1])`/`api.coord([endSec,0])`.
- **`z2` ordering** (rect `z2:0`, text `z2:1` inside the group) is fine; the group inherits the series `z: 2` so it stays above grid lines.
- **Return-type union** (rect for narrow bars, group otherwise) is accepted by the custom series — both are valid `CustomRootElementOption`s, and the final `allSeries as EChartsOption['series']` cast already erases the renderItem signature mismatch.

### Positive Notes

- Correctly identifies that `RenderItemAPI` is a deliberately minimal local interface and reasons about what it does/doesn't expose (the instinct was right; only the resolution was wrong).
- The `barWidth < 40` narrow-bar guard preserves existing behavior and avoids unreadable clipped text — good UX call carried over from the spec.
- Scope discipline is good: explicitly leaves line/biometric series untouched and reuses the existing `PHASE_COLORS` parallel-map pattern for `PHASE_LABELS`.
- Dependency reasoning (note-18 already landed) is verified and accurate against the roadmap.

---

**Verdict:** Do not implement as written. Critical Issue 1 means the feature ships invisible (empty labels) while passing all stated verification gates — fix the label-source mechanism (use `params.dataIndex` + `phases` closure) before implementation, and resolve the `durationMs` dead-code question.
