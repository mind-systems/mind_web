# Render `phase='pause'` as a styled band in the instruction grid

**Date:** 2026-06-19
**Source:** conversation context

## Key Findings

- mind_mobile note 124 emits pause/resume as `breath_phase` boundary markers carrying `data.phase = 'pause'` on the same offset axis as the breath phases (it rides the existing `breath_phase` instruction type — no new instruction type, no proto change). So the web receives `'pause'` as just another value in the phase stream.
- The web's phase color/label maps only cover the four breath phases: `PHASE_COLORS`/`PHASE_LABELS` in `src/pages/SessionsPage/chartOption.ts:5-17` have `inhale/hold/exhale/rest`. A `'pause'` marker therefore falls through to the `?? '#ccc'` color (`chartOption.ts:338`) and the `?? bar.phase` raw label (`chartOption.ts:317`) — an uncolored bar labelled "pause".
- `parsePhases` already passes any `data.phase` through verbatim (`event.data.phase ?? 'rest'`, `transforms.ts:30`), so no parsing change is needed — only the color/label map and the `phase` type need to admit `'pause'`.

## Details

### Current state
- `PHASE_COLORS: Record<string, string> = { inhale:'#5BAD6F', hold:'#4B9CD3', exhale:'#E89B2A', rest:'#9E9E9E' }` (`chartOption.ts:5-10`).
- `PHASE_LABELS: Record<string, string> = { inhale:'Inhale', hold:'Hold', exhale:'Exhale', rest:'Rest' }` (`chartOption.ts:12-17`).
- `PhaseBar.phase: BreathPhase` and `BreathPhase = 'inhale' | 'hold' | 'exhale' | 'rest'` (`src/core/types/index.ts:28-35`). `'pause'` is not assignable today.
- The phase custom series colors each bar by `PHASE_COLORS[p.phase] ?? '#ccc'` and labels via `PHASE_LABELS[bar.phase] ?? bar.phase` (`chartOption.ts:317,338`).

### The change
1. `src/core/types/index.ts` — widen the phase union so `'pause'` is valid for a `PhaseBar`. Either extend `BreathPhase` to include `'pause'`, or introduce a `PhaseKind = BreathPhase | 'pause'` used by `PhaseBar.phase`. Prefer a distinct `PhaseKind` so `BreathPhase` keeps meaning *breath* phases.
2. `chartOption.ts` — add `pause` to both maps: a distinct neutral style clearly different from `rest` (`rest` is mid-grey `#9E9E9E`; use a lighter/desaturated tone, e.g. `#CFCFCF` or a hatch-like flat grey) and `PHASE_LABELS.pause = 'Pause'`. The existing renderer then colors and labels the band with no further change.
3. Optional polish: suppress the `· Ns` duration suffix for `pause` bars (a pause span is user-driven, not a prescribed duration) — gate the suffix on `bar.phase !== 'pause'`. Decide at implementation; not required for correctness.

### Guards
- Do NOT add a new `instructionType` or special-case parsing — `'pause'` is a normal `breath_phase` marker; it flows through `parsePhases` already.
- Keep the `?? '#ccc'` / `?? bar.phase` fallbacks as the catch-all for any future unknown phase value (do not remove them when adding `pause`).
- Pause is a phase **band**, not a separate grid or overlay — it occupies the instruction grid exactly like the other phase bars.

### Dependencies & cross-repo
- Sequence **after** mind_mobile Phase 42 (note 124) emits `phase='pause'` markers, which in turn depends on mind_api note 49 (server accepts instruction samples through pause). Until those ship, no `'pause'` marker arrives and this is inert (the maps simply gain an unused key).
- Builds on note 23 (offset-axis phase geometry) — the pause band is positioned by the same `offsetMs` boundaries; either can land first, but the pause band is only meaningful once geometry is offset-based.

### Verify
- After the mobile pause markers ship: drive a session, pause and resume it, open it on the web — the paused interval renders as a distinctly-coloured "Pause" band between the breath-phase bars, biometric points continue inside the band (bio streams through pause, mind_mobile note 123).

## Open Questions

- None.
