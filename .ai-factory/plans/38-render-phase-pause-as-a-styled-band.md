# Plan: Render `phase='pause'` as a styled band

## Context
The instruction grid renders breath phases as colored bars, but mind_mobile (note 124) now emits pause/resume as `breath_phase` markers with `data.phase='pause'`. Today such markers fall through to the `#ccc` fallback color and a raw `"pause"` label. This milestone styles the pause interval as a distinct neutral "Pause" band that flows through the existing renderer.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Type widening

- [x] **Task 1: Admit `'pause'` in the phase type**
  Files: `src/core/types/index.ts`
  Introduce `export type PhaseKind = BreathPhase | 'pause';` directly after the existing `BreathPhase` union (line 28). Keep `BreathPhase = 'inhale' | 'hold' | 'exhale' | 'rest'` unchanged so it continues to mean breath-only phases.
  Change `PhaseBar.phase` (line 33) from `BreathPhase` to `PhaseKind`.
  Change `InstructionDto.data.phase` (line 41) from `BreathPhase` to `PhaseKind` so a `'pause'` marker is a typed-valid value flowing through `parsePhases`. No change to `parsePhases` itself — `event.data.phase ?? 'rest'` already passes the value through verbatim (`transforms.ts:31`) and now type-checks against `PhaseBar.phase: PhaseKind`.

### Phase 2: Pause styling

- [x] **Task 2: Add `pause` color + label to the phase maps** (depends on Task 1)
  Files: `src/pages/SessionsPage/chartOption.ts`
  Add `pause` to `PHASE_COLORS` (lines 5-10) with a distinct neutral tone clearly different from `rest`'s mid-grey `#9E9E9E` — use a lighter/desaturated grey such as `#CFCFCF`.
  Add `pause: 'Pause'` to `PHASE_LABELS` (lines 12-17).
  Do NOT touch the renderer's `PHASE_COLORS[p.phase] ?? '#ccc'` (line 335) or `PHASE_LABELS[bar.phase] ?? bar.phase` (line 317) fallbacks — keep them as the catch-all for any future unknown phase value.

- [x] **Task 3: Suppress the duration suffix for pause bars** (depends on Task 2)
  Files: `src/pages/SessionsPage/chartOption.ts`
  In the phase custom-series `renderItem` (line 317-318), gate the `· Ns` duration suffix on `bar.phase !== 'pause'`. A pause span is user-driven, not a prescribed duration, so the pause band should show only the `'Pause'` label without the seconds suffix. Build the label conditionally, e.g. the suffix is appended only when `bar.phase !== 'pause'`.

## Notes
- Do NOT add a new `instructionType` or any special-case parsing — `'pause'` is a normal `breath_phase` marker handled by the existing `parsePhases`.
- Pause is a phase **band** occupying the instruction grid exactly like the other phase bars — not a separate grid or overlay.
- This is inert until mind_mobile note 124 ships `phase='pause'` markers; until then the new map key is simply unused. Depends on note 23 (offset-axis phase geometry).
