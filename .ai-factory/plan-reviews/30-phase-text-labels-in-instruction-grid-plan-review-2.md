## Plan Review (round 2): Phase text labels in instruction grid

**Plan:** `.ai-factory/plans/30-phase-text-labels-in-instruction-grid.md`
**Files Reviewed:** 3 source files (`chartOption.ts`, `core/types/index.ts`, `SessionsPage/transforms.ts`) + plan + spec note (`19-phase-text-labels.md`) + round-1 review + `tsconfig.app.json` + ROADMAP.md + ARCHITECTURE.md
**Risk Level:** 🟢 Low

This is the second-round review of a plan that was revised to address round-1's findings. Both blocking issues from review-1 are resolved, and the previously-flagged roadmap gap no longer applies.

---

### Context Gates

- **Architecture (`ARCHITECTURE.md`):** PASS. The change stays entirely within `src/pages/SessionsPage/` (transform + chart option) and `src/core/types/index.ts` (shared DTO type) — consistent with the Feature-Based Modules pattern. No dependency-rule violation: no new `fetch`, no `localStorage`, no `useQuery` in a shared component. Data shaping stays in the named `parsePhases`/`buildSessionChartOption` transforms, exactly where the architecture says it belongs ("transformations happen close to the fetch site, in named transform functions").
- **Rules (`.ai-factory/rules/base.md`):** PASS. English-only respected; logging is "minimal" (none added — consistent with the no-stray-console convention); naming follows the existing `PHASE_COLORS` parallel-map precedent. No skill-context overrides exist (`.ai-factory/skill-context/aif-review/SKILL.md` absent).
- **Roadmap (`ROADMAP.md`):** PASS. Round-1 flagged "no matching milestone"; that is now resolved — Phase 11 line 83 carries the exact `[ ]` milestone ("Phase text labels in instruction grid"), and its spec (white bold 11 px, `< 40 px` suppression, `PHASE_LABELS`, `durationMs` plumbing) matches the plan task-for-task. The dependency milestone (Phase 11 "Fix InstructionDto field names") is confirmed landed `[x]`, so the plan's "no dependency work remains" claim holds.

---

### Round-1 Findings — Resolution Check

**1. (was Critical) `params.name` empty-label failure → RESOLVED.**
The revised plan abandons the `params.name` route entirely. Task 4 now sources the label from `phases[params.dataIndex]` — a closure over the in-scope `phases` array indexed by the documented, typed `dataIndex` field — which is precisely the robust fix review-1 recommended. The implementer notes (plan lines 15, 46) call this out as "load-bearing — do not regress" and explicitly forbid re-adding a `name` data-item field. Correctness is guaranteed by construction: `phaseSeries.data` is built from `phases.map(...)`, so `dataIndex` is a 1:1 index back into the same array. No `as`-cast, no `undefined`-label risk.

**2. (was Medium) `durationMs` dead code → RESOLVED.**
Task 4 now *consumes* `durationMs`, rendering `Inhale · 4s` via `` `${phaseLabel} · ${Math.round(bar.durationMs / 1000)}s` `` with an explicit `bar.durationMs !== undefined` guard and a bare-word fallback. Tasks 1–2 (type field + transform population) are no longer orphaned. The plan's "keep the change minimal" instruction is now self-consistent.

---

### Verification of Plan Details

- **Line references accurate.** `PHASE_COLORS` (lines 5–10), `PhaseBar` (30–34, `phase` on 33), `parsePhases` `satisfies PhaseBar` literal (27–31), and `phaseSeries` (221–254) all match the current files.
- **Typecheck safety confirmed.** `tsconfig.app.json` does **not** enable `noUncheckedIndexedAccess` (and there is no `strict`/base config turning it on), so `const bar = phases[params.dataIndex]` is typed `PhaseBar` (not `PhaseBar | undefined`). Accessing `bar.phase` / `bar.durationMs` without optional chaining typechecks cleanly — the round-1 reviewer's defensive `?.` is unnecessary here, and its omission is not a regression.
- **`noUnusedLocals`/`noUnusedParameters` (both `true`) satisfied.** The renamed `params` is read (`params.dataIndex`); `api` is read; `bar`/`phaseLabel`/`label`/`text` are declared only in the wide-bar branch *after* the narrow-bar early-return, so no unused-binding error arises. Task 5 correctly anticipates a possible leftover-binding warning and budgets for it.
- **Task 2 type-soundness holds.** `event.data.durationMs` is typed `number | undefined` (per `InstructionDto.data`), `PhaseBar.durationMs?` is optional → the `satisfies PhaseBar` literal still compiles.
- **Geometry & layering correct.** `x: topLeft[0] + 6`, `y: topLeft[1] + barHeight/2` with `textBaseline: 'middle'` centers the label against the rect built from `api.coord([startSec,1])`/`api.coord([endSec,0])`. `z2` ordering (rect `0`, text `1`) inside the group, under series `z: 2`, keeps labels above bars and grid lines.
- **Mixed return type is fine.** Returning a bare `rect` for narrow bars vs a `group` otherwise is valid for a custom series; the existing `allSeries as EChartsOption['series']` cast already erases the `renderItem` signature, so no new type friction.
- **Dynamic narrow-bar guard works under zoom.** `barWidth` derives from `api.coord(...)`, which reflects the current `dataZoom` window, so the `< 40 px` suppression re-evaluates correctly as the user zooms — matching the spec's intent. ECharts confirmed at 6.1.0, the version the implementer notes were verified against.

### Positive Notes

- The label-source mechanism is now the most type-safe option available (typed `dataIndex` + closure), and the plan documents *why* the obvious-but-wrong `name` alternative was rejected — this prevents a future regression back into the round-1 trap.
- Scope discipline is preserved: line/biometric series untouched, `PHASE_COLORS` parallel-map pattern reused for `PHASE_LABELS`.
- Honest verification framing: Task 5 explicitly states that typecheck/lint confirm compilation only, not that labels visually render, and grounds runtime correctness in the by-construction argument rather than over-claiming.

---

**Verdict:** Solid. Both round-1 blockers are fixed, the roadmap milestone now exists, line references and type-soundness are verified against the live codebase, and the label-source mechanism is correct by construction. Safe to implement as written.

PLAN_REVIEW_PASS
