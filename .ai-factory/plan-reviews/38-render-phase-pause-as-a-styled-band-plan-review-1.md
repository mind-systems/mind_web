# Plan Review: Render `phase='pause'` as a styled band

**Plan:** `.ai-factory/plans/38-render-phase-pause-as-a-styled-band.md`
**Risk Level:** 🟢 Low

## Scope

A small, well-scoped type-widening + styling change confined to two files (`src/core/types/index.ts`, `src/pages/SessionsPage/chartOption.ts`). I verified every file path, line reference, and code assumption against the current codebase.

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** WARN — no boundary violations. The change stays inside `core/types` (shared types mirroring API shapes) and the `pages/SessionsPage` feature module, consistent with the Feature-Based Modules pattern. No new cross-module dependency.
- **Rules (`.ai-factory/rules/base.md`):** PASS — `PhaseKind` follows `PascalCase` type naming; no `console.*` introduced; no storage/auth touch. No violation.
- **Roadmap (`.ai-factory/ROADMAP.md:111`):** PASS — the plan maps 1:1 onto the milestone entry ("Render `phase='pause'` as a styled band"), and to spec note `.ai-factory/notes/24-pause-phase-band.md`. Cross-repo sequencing (mind_mobile note 124 / mind_api note 49) is correctly captured as making the change inert until markers ship.

## Verification of Plan Assumptions

All claims checked against current source — they hold:

- `BreathPhase = 'inhale' | 'hold' | 'exhale' | 'rest'` at `types/index.ts:28` ✓
- `PhaseBar.phase` at line 33, `InstructionDto.data.phase?` at line 41 ✓
- `PHASE_COLORS` lines 5–10, `PHASE_LABELS` lines 12–17 ✓
- Renderer color fallback `PHASE_COLORS[p.phase] ?? '#ccc'` at line **335** (plan cites 335 — correct; note 24's "338" is stale, the plan is right) ✓
- Label fallback `PHASE_LABELS[bar.phase] ?? bar.phase` at line 317, suffix built at line 318 ✓
- `parsePhases` passes `event.data.phase ?? 'rest'` through verbatim (`transforms.ts:31`) — no parsing change needed ✓

**Type-safety check (Task 1):** With `PhaseBar.phase: PhaseKind` and `data.phase?: PhaseKind`, the expression `event.data.phase ?? 'rest'` resolves to `PhaseKind` and satisfies `PhaseBar` — type-checks cleanly. The `bar.phase !== 'pause'` comparison in Task 3 is valid against `PhaseKind`. Indexing `Record<string, string>` maps with a `PhaseKind` value is fine.

**Consumer sweep:** The only consumers of `PhaseBar.phase` / `InstructionDto.data.phase` are `transforms.ts` and `chartOption.ts` (confirmed by grep). `SessionCharts.tsx` does not read `.phase`. Widening the union breaks nothing downstream — no other site narrows on `BreathPhase`.

## Findings

### Critical Issues
None.

### Non-blocking Notes

1. **WARN — Label contrast on the suggested `#CFCFCF`.** The phase label text is hard-coded white (`fill: '#fff'`, `chartOption.ts:325`). `rest`'s `#9E9E9E` already gives white text modest contrast; a *lighter* grey like `#CFCFCF` pushes the "Pause" label toward illegible (white-on-light-grey, ~1.4:1). Since the plan's stated goal is a band "clearly different from `rest`," consider going *darker/more desaturated* than `#9E9E9E` rather than lighter (e.g. a cooler slate `#8A8F98`), which both distinguishes it from `rest` and keeps the white label readable. This is a judgment call for implementation, not a blocker — the plan correctly leaves the exact tone open ("such as `#CFCFCF`").

2. **INFO — Theme awareness.** `PHASE_COLORS` is static and not theme-reactive (milestone 28 auto dark/light). This matches the existing breath-phase colors, so `pause` inheriting the same static behavior is consistent — no regression. Noted only so it is a conscious choice.

3. **INFO — Short pause bars.** The label (and thus the suffix-suppression logic in Task 3) only renders when `barWidth >= 40px` (`chartOption.ts:315`). A brief pause may render as a colored band with no text at all. This is the existing behavior for all short phases and is acceptable; the styled color still conveys the pause.

## Positive Notes

- Correctly resists scope creep: explicitly forbids a new `instructionType` or special-case parsing, keeping `'pause'` a normal `breath_phase` marker through the existing `parsePhases`.
- Preserves the `?? '#ccc'` / `?? bar.phase` catch-all fallbacks as future-proofing for unknown phase values — a deliberate, well-reasoned guard.
- Choosing `PhaseKind = BreathPhase | 'pause'` over polluting `BreathPhase` keeps the breath-only semantics intact for any breath-specific logic — the right modeling decision.
- Task dependencies (Task 2 → Task 1, Task 3 → Task 2) are correctly ordered, and line references match the live code exactly.

The plan is implementation-ready. The only substantive note (label contrast) is a styling refinement that the plan already leaves open to the implementer.

PLAN_REVIEW_PASS
