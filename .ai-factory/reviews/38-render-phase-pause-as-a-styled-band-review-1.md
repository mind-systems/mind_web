# Code Review: Render `phase='pause'` as a styled band

**Scope:** `src/core/types/index.ts`, `src/pages/SessionsPage/chartOption.ts`
**Risk:** 🟢 Low

## What changed
- `types/index.ts`: added `export type PhaseKind = BreathPhase | 'pause';`; widened `PhaseBar.phase` and `InstructionDto.data.phase` from `BreathPhase` to `PhaseKind`. `BreathPhase` kept breath-only.
- `chartOption.ts`: added `pause: '#CFCFCF'` to `PHASE_COLORS`, `pause: 'Pause'` to `PHASE_LABELS`, and suppressed the `· Ns` duration suffix for `bar.phase === 'pause'`.

## Verification
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- Read both changed files in full.

## Correctness analysis

- **Type widening is sound.** `event.data.phase ?? 'rest'` in `parsePhases` (`transforms.ts:31`) now resolves to `PhaseKind` and satisfies `PhaseBar.phase: PhaseKind`. The `bar.phase !== 'pause'` narrowing in `chartOption.ts:320` is a valid comparison against `PhaseKind`. Indexing the `Record<string, string>` maps with a `PhaseKind` value is fine.
- **Fallbacks preserved.** `PHASE_COLORS[p.phase] ?? '#ccc'` (line 338) and `PHASE_LABELS[bar.phase] ?? bar.phase` (line 319) remain untouched, so unknown future phase values still degrade gracefully. `'pause'` now hits the map instead of the fallback, as intended.
- **No parsing change.** No new `instructionType` or special-case branch was introduced; `'pause'` flows through the existing `breath_phase` path. Matches the spec guard.
- **Consumer sweep.** The only readers of `PhaseBar.phase` / `InstructionDto.data.phase` are `transforms.ts` and `chartOption.ts`. No downstream site narrows on `BreathPhase`, so widening the union breaks nothing.
- **No security surface.** No auth, storage, network, or input-handling code touched.

## Findings

### Critical / Correctness
None. No runtime break, type mismatch, or logic error.

### Non-blocking

1. **Label legibility on `#CFCFCF` (cosmetic).** The phase label is hard-coded white (`fill: '#fff'`, `chartOption.ts:328`). White on `#CFCFCF` yields a contrast ratio of roughly 1.6:1 — the "Pause" text will be faint. The band color still clearly conveys the pause, and labels only render for bars ≥ 40px wide (`line 317`), so short pauses show color only regardless. If legibility of the word matters, a darker/desaturated tone (e.g. a cooler slate around `#8A8F98`) would both distinguish it from `rest`'s `#9E9E9E` and keep the white label readable. This was already anticipated in the plan review and is a styling judgment, not a defect.

2. **Inert until upstream ships (info).** As designed, no `'pause'` marker arrives until mind_mobile note 124 lands; until then the new map key is simply unused. No action needed.

The change is minimal, type-safe, and faithful to the plan. The single note above is cosmetic and does not block.

REVIEW_PASS
