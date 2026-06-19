# Plan: Move breath-phase geometry to the `offsetMs` axis

## Context
Switch per-sample breath-phase boundaries from a cross-clock `timestamp − startedAt` subtraction to the monotonic `data.offsetMs` axis emitted by mind_mobile (note 121), eliminating the ~1.5 s drift; keep `endedAt − startedAt` only as the last-bar axis-length scalar.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Contract types

- [x] **Task 1: Update DTO and view-model types**
  Files: `src/core/types/index.ts`
  In `InstructionDto.data` (lines 41-44): drop `durationMs?: number`, add `offsetMs?: number` and `tickCount?: number` (`tickCount` is unused by the web today but part of the contract). In `PhaseBar` (lines 30-35): drop `durationMs?: number`. Keep `startSec`, `endSec`, `phase`.

### Phase 2: Geometry source

- [x] **Task 2: Switch `parsePhases` per-sample boundaries to `offsetMs`** (depends on Task 1)
  Files: `src/pages/SessionsPage/transforms.ts`
  In `parsePhases` (lines 13-34): set `startSec = (event.data.offsetMs ?? 0) / 1000`; set `endSec = nextEvent ? (nextEvent.data.offsetMs ?? 0) / 1000 : secFromStart(endedAt, startedAt)`. The last-bar branch (`secFromStart(endedAt, startedAt)`) is the **only** retained use of `secFromStart`/`startedAt` — the axis-length scalar; keep both `startedAt` and `endedAt` params. Drop `durationMs` from the returned object. **Hard cutover — no `timestamp − startedAt` fallback** (it would resurrect the cross-clock skew this task removes; pre-migration data collapsing to 0 is accepted). Leave `secFromStart` (it still serves the last bar) and `toSeries` untouched. Update the `parsePhases` JSDoc (lines 8-12) to say each bar starts at its instruction `offsetMs` and the last bar ends at `endedAt − startedAt`.

### Phase 3: In-bar label

- [x] **Task 3: Recompute the in-bar duration label from the bar span** (depends on Task 2)
  Files: `src/pages/SessionsPage/chartOption.ts`
  Replace the `bar.durationMs`-based label (lines 318-321) with one derived from the bar span: `` `${phaseLabel} · ${Math.round(api.value(1) - api.value(0))}s` `` (i.e. `endSec − startSec`). `bar.phase`/`phaseLabel` stay; `durationSec` and the x-axis `max` (already `endedAt − startedAt`) are unchanged. Confirm no other reference to `durationMs` remains in this file.
