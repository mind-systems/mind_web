# Plan: Fix InstructionDto field names

## Context
`InstructionDto` declares `type`/`payload`, but the API returns `instructionType`/`data` with a numeric epoch-ms `timestamp`, so `parsePhases` filters to an empty set and the breath phase grid never renders. This aligns the frontend DTO and its only consumer with the real API shape. No API change needed.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Align DTO and consumer

- [x] **Task 1: Correct `InstructionDto` shape**
  Files: `src/core/types/index.ts`
  Replace the `InstructionDto` interface (lines 36-43) to match the verified API write-path shape `{ timestamp: number, moduleId: string, instructionType: string, data: { phase?, durationMs? } & Record<string, unknown> }`:
  - `timestamp: string` → `timestamp: number` (API returns epoch ms, not ISO string)
  - add `moduleId: string`
  - `type: string` → `instructionType: string`
  - `payload: { phase?: BreathPhase; durationMs?: number } & Record<string, unknown>` → rename to `data` with the same value type
  Keep `BreathPhase` referenced as today.

- [x] **Task 2: Update `parsePhases` to the corrected fields** (depends on Task 1)
  Files: `src/pages/SessionsPage/transforms.ts`
  - Filter on the renamed field: `instructions.filter((i) => i.instructionType === 'breath_phase')` (line 18).
  - Read the renamed payload: `phase: event.data.phase ?? 'rest'` (line 30).
  - Broaden `secFromStart` so the numeric instruction timestamp typechecks: change its signature to `secFromStart(ts: string | number, startedAt: string)` (line 4). `new Date(ts)` already accepts both string and number, so the body stays unchanged. This keeps the existing `secFromStart(endedAt, …)` (string) call valid while allowing `secFromStart(event.timestamp, …)` (number). Do not change the `endedAt`/`startedAt` parameters — those remain ISO strings from `SessionRun`.

- [x] **Task 3: Confirm no other consumers and typecheck** (depends on Task 2)
  Files: `src/pages/SessionsPage/chartOption.ts`, `src/pages/SessionsPage/SessionCharts.tsx`
  These pass `InstructionDto[]` through to `parsePhases`/`buildSessionChartOption` without touching `.type`/`.payload`/`.timestamp` directly, so no edits are expected — verify this. Then run `npm run typecheck` and `npm run lint` and ensure both pass.

## Notes
- Single logical change → one commit at the end: "Fix InstructionDto field names to match API instruction shape".
- `BioSampleDto.timestamp` stays `string` — this milestone is scoped to instructions only; biometrics are out of scope.
