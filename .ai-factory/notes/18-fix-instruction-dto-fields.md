# Fix InstructionDto Field Names

**Date:** 2026-06-03
**Source:** conversation context — detangle of instruction stream architecture

## Key Findings

- The API stores instruction samples as `{ timestamp, moduleId, instructionType, data }`.
- `InstructionDto` in `src/core/types/index.ts` has `type` and `payload` — both wrong.
- `parsePhases` in `transforms.ts` filters by `i.type === 'breath_phase'` → always empty → no phase grid ever renders.
- No API change needed; only the frontend DTO and its consumers.

## Details

### Actual API response shape (from sessions.service.ts write-path)

```json
{
  "timestamp": 1780482889104,
  "moduleId": "breath",
  "instructionType": "breath_phase",
  "data": { "phase": "inhale", "durationMs": 4000 }
}
```

### `src/core/types/index.ts`

Replace:
```typescript
export interface InstructionDto {
  timestamp: string;
  type: string;
  payload: {
    phase?: BreathPhase;
    durationMs?: number;
  } & Record<string, unknown>;
}
```

With:
```typescript
export interface InstructionDto {
  timestamp: number;
  moduleId: string;
  instructionType: string;
  data: {
    phase?: BreathPhase;
    durationMs?: number;
  } & Record<string, unknown>;
}
```

### `src/pages/SessionsPage/transforms.ts` — `parsePhases`

```typescript
// before
const breathEvents = instructions.filter((i) => i.type === 'breath_phase');
// ...
phase: event.payload.phase ?? 'rest',

// after
const breathEvents = instructions.filter((i) => i.instructionType === 'breath_phase');
// ...
phase: event.data.phase ?? 'rest',
```

### Verify

In a breath session where `session_stream_samples` has rows: the instruction grid appears and phase bars render. Until real data exists in the DB, verify via a mock/fixture in browser console by setting `instructionsData` manually.
