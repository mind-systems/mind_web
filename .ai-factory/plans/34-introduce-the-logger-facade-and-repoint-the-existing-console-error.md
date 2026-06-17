# Plan: Introduce the `logger` facade and repoint the existing `console.error`

## Context
Stand up `src/core/observe/logger.ts` as the project's logging facade that routes through the note-20 resolver to `console.*` and/or the observe-js SDK, then reroute the single existing `console.error` site in `useBiometricChunks.ts` through it without changing behavior.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Facade

- [x] **Task 1: Create the `logger` facade**
  Files: `src/core/observe/logger.ts`
  Create a new module exporting `const logger` with `info/warn/error(msg: string, attrs?: Record<string, unknown>)`. Implement a private `emit(level, consoleFn, msg, attrs)` that:
  - calls `consoleFn(msg, attrs)` when `attrs` is present, else `consoleFn(msg)`, gated on `logToConsole`;
  - calls the SDK `log(level, msg, attrs)` gated on `logToObserver`.
  Import `log` and `Level` from `observe-js` as **two separate statements** (`verbatimModuleSyntax: true` forbids combining them): `import { log } from 'observe-js';` then `import type { Level } from 'observe-js';`. Reuse `logToConsole` / `logToObserver` from `./config` (the note-20 resolver). Do NOT re-read `import.meta.env` here. Map `info → console.info`, `warn → console.warn`, `error → console.error`. Implement `emit` with nested `if/else` — do NOT use a ternary as an expression statement (fails `@typescript-eslint/no-unused-expressions`):
  ```ts
  function emit(level: Level, consoleFn: ConsoleFn, msg: string, attrs?: Record<string, unknown>): void {
    if (logToConsole) {
      if (attrs) consoleFn(msg, attrs);
      else consoleFn(msg);
    }
    if (logToObserver) log(level, msg, attrs);
  }
  ```
  Guards: facade name is `logger` (never shadow the SDK's `log`); no `try/catch` around `log` (the SDK never throws into the host). Acceptance gate: `npm run lint && npm run typecheck` must pass.

- [x] **Task 2: Re-export `logger` from the observe barrel** (depends on Task 1)
  Files: `src/core/observe/index.ts`
  Add `export { logger } from './logger';` alongside the existing `initObserve` export.

### Phase 2: Repoint

- [x] **Task 3: Reroute the chunk-drain `console.error` through `logger`** (depends on Task 2)
  Files: `src/pages/SessionsPage/useBiometricChunks.ts`
  Add `import { logger } from '@/core/observe';` to the imports. Inside the existing `.catch((err: unknown) => { ... })` (around line 115-123), keep the `fetchIdRef.current !== myFetchId` stale-guard and the `loadedRef.current.add(idx)` call exactly as they are; replace only the `console.error(...)` call with:
  ```ts
  logger.error(`Failed to load biometric chunk ${idx} for session ${session.id}`, { err });
  ```
  Drop the trailing `:` from the message — `err` now travels in the structured `attrs` object. Keep the explanatory comment ("Soft error: mark as attempted ..."). Do NOT add any other log lines anywhere; this is the only site touched. Behavior (mark attempted, soft error) stays unchanged.

## Notes
- Depends on note 20 (already implemented: `config.ts`, `init.ts`, `index.ts` present).
- Guards (all milestones): ZERO new log lines beyond rerouting the one site; facade named `logger`; no `try/catch` around the SDK `log`; resolver reused, env not re-read.
- Single commit at the end: "Add logger facade and route biometric chunk error through it".
