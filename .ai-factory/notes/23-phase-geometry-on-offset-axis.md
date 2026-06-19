# Phase geometry on the client offset axis; drop `durationMs`; last bar = axis length

**Date:** 2026-06-19
**Source:** conversation context

## Key Findings

- The breath-phase timeline is misaligned because per-sample geometry is a **cross-clock subtraction**: `parsePhases` computes `secFromStart(event.timestamp, startedAt)` = `clientWallClock − serverStartedAt` (`src/pages/SessionsPage/transforms.ts:4,22,25`). Client and server are different physical clocks, so every phase boundary drifts (the observed ~1.5 s start lag).
- mind_mobile note 121 moves each `breath_phase` instruction onto a **monotonic offset-from-origin** axis: the payload becomes `{ phase, tickCount, offsetMs }`, `durationMs` is removed, and the wire `timestamp` is demoted to a display-only wall-clock. The web must consume `data.offsetMs` for per-sample geometry.
- **`startedAt` survives on the web in exactly one place — the axis length scalar `endedAt − startedAt`**, never in per-sample geometry. The cross-clock skew was a *per-sample* effect (it shifted each phase boundary relative to the bio points); a single scalar duration has no such skew — its only error vs. the true client-offset end is ~network RTT, invisible on the chart. So the last bar bounding by `endedAt − startedAt` is correct and needs no terminal marker.
- The last phase bar already auto-stretches to the next marker or, for the final marker, to `endedAt − startedAt`. Only the **source** of each per-sample boundary changes (timestamp→offset); the last-bar end stays the axis-length scalar. **No terminal marker, no zero-width end-cap, no `phase='end'`, no suppression, no clamping** — even for `abandoned`/`disconnected` (where `endedAt` is inflated by grace/disconnect) the last bar simply runs to whatever `endedAt − startedAt` gives.
- Biometrics are **out of scope** — `toSeries` stays on `timestamp − startedAt`. No bio anchoring: after the mobile emit-at-origin fix the residual phase↔bio offset is sub-second (phone↔BCI skew + RTT), accepted as invisible.

## Details

### Current state
- `src/pages/SessionsPage/transforms.ts`
  - `secFromStart(ts, startedAt)` = `(new Date(ts).getTime() − new Date(startedAt).getTime()) / 1000` (line 4).
  - `parsePhases(instructions, startedAt, endedAt)`: `startSec = secFromStart(event.timestamp, startedAt)`; `endSec = nextEvent ? secFromStart(nextEvent.timestamp, startedAt) : secFromStart(endedAt, startedAt)`; returns `{ startSec, endSec, phase: event.data.phase ?? 'rest', durationMs: event.data.durationMs }` (lines 13-34).
- `src/core/types/index.ts`
  - `InstructionDto.data: { phase?: BreathPhase; durationMs?: number } & Record<string, unknown>` (lines 41-44).
  - `PhaseBar { startSec; endSec; phase: BreathPhase; durationMs?: number }` (lines 30-35).
- `src/pages/SessionsPage/chartOption.ts`
  - `durationSec = (new Date(endedAt).getTime() − startMs) / 1000` (≈ line 90); x-axis `min: 0, max: durationSec` (lines 199-201).
  - In-bar label reads `bar.durationMs`: `bar.durationMs !== undefined ? \`${phaseLabel} · ${Math.round(bar.durationMs / 1000)}s\` : phaseLabel` (lines 316-321).

### The change
1. `transforms.ts` `parsePhases` — per-sample boundaries from offset:
   - `startSec = (event.data.offsetMs ?? 0) / 1000`.
   - `endSec = nextEvent ? (nextEvent.data.offsetMs ?? 0) / 1000 : secFromStart(endedAt, startedAt)`.
   - The last-bar branch (`secFromStart(endedAt, startedAt)`) is the **only** retained use of `secFromStart`/`startedAt` — it is the axis-length scalar, not per-sample geometry. Keep both `startedAt` and `endedAt` params for it.
   - Drop `durationMs` from the returned `PhaseBar`.
2. `core/types/index.ts` — `InstructionDto.data`: drop `durationMs`, add `offsetMs?: number` (and `tickCount?: number`, unused by the web today but part of the contract). Drop `PhaseBar.durationMs`.
3. `chartOption.ts` — recompute the in-bar duration label from the bar span instead of `bar.durationMs`: `\`${phaseLabel} · ${Math.round(api.value(1) − api.value(0))}s\`` (endSec − startSec). `durationSec` / x-axis `max` are unchanged (already `endedAt − startedAt`).
4. `toSeries` (bio) — **unchanged**.

### Guards
- Do NOT touch `toSeries` / biometric geometry — bio stays on `timestamp − startedAt`, no anchoring.
- Do NOT add a terminal-marker / end-cap / suppression path. The last bar = `endedAt − startedAt`, period (incl. abandoned/disconnected — runs to the inflated end, accepted).
- Keep `secFromStart` solely for the last-bar axis-length fallback; do not reintroduce it into per-sample paths.
- **Hard cutover — no legacy fallback.** Sessions recorded before mind_mobile Phase 42 carry no `offsetMs`; with `offsetMs ?? 0` their phase bars collapse to 0. Accepted: pre-migration data is stale. Do NOT add a `timestamp − startedAt` fallback (it would resurrect the cross-clock subtraction this task removes).

### Dependencies & cross-repo
- Sequence **after** mind_mobile Phase 42 (note 121) ships `data.offsetMs` + drops `durationMs`. Until then `offsetMs` is absent and bars collapse.
- mind_mobile note 124 (rewritten) emits **no** terminal/end marker — it explicitly delegates last-bar bounding to the web via `endedAt − startedAt`. Consistent with this task; no spurious final bar to suppress, no coordination pending.

### Verify
- After note 121 ships: open a breath session — the first `rest` bar starts at `0`, phase boundaries align with the bio points to sub-second, the last bar runs to the session end, and each bar still shows `Phase · Ns` (duration from the bar span). No spurious zero-width bar at the end.

## Open Questions

- None.
