# Observability logging — `logger` facade + repoint the `console.error` (Phase 13, task 2)

**Date:** 2026-06-18
**Source:** `~/projects/observability/.ai-factory/notes/03-integrate-mind-web.md` (DoD #2) + codebase recon + owner confirmation. Depends on note 20 (lifecycle/`init` + resolver). Sibling reference: mind_mobile note 110 (route `logPrint` through the sink).

## Key Findings

- **Unlike the other projects, there is no existing sink to swap** — mind_web logs via raw `console.*`. This task introduces a thin facade that becomes the project's logger going forward and routes through it the **one** existing call site. No new log lines — the facade is the only "new" thing, not the logs.
- The single real call site is `src/pages/SessionsPage/useBiometricChunks.ts:118`:
  ```ts
  console.error(
    `Failed to load biometric chunk ${idx} for session ${session.id}:`,
    err,
  );
  ```
  A soft error in the chunk drain loop. It becomes `logger.error('Failed to load biometric chunk …', { err })`.
- **SDK surface (verified, `v0.1.0`):** `log(level: Level, msg: string, attrs?: Record<string, unknown>): void`; `Level = 'trace'|'debug'|'info'|'warn'|'error'|'fatal'`. `log` no-ops safely when `init` wasn't called (destination `file`), but the facade still gates on `logToObserver` so we never depend on that.
- **Facade name is `logger`** (owner-confirmed) — `logger.info/warn/error` reads naturally and avoids shadowing the SDK's exported `log` inside the observe module.

## Details

### `src/core/observe/logger.ts`

Routes each call to `console` and/or the SDK per the note-20 resolver. Reuses `logToConsole`/`logToObserver` — does not re-read env.

```ts
import { log } from 'observe-js';
import type { Level } from 'observe-js';
import { logToConsole, logToObserver } from './config';

type ConsoleFn = (msg: string, ...rest: unknown[]) => void;

function emit(level: Level, consoleFn: ConsoleFn, msg: string, attrs?: Record<string, unknown>): void {
  if (logToConsole) attrs ? consoleFn(msg, attrs) : consoleFn(msg);
  if (logToObserver) log(level, msg, attrs);
}

export const logger = {
  info: (msg: string, attrs?: Record<string, unknown>) => emit('info', console.info, msg, attrs),
  warn: (msg: string, attrs?: Record<string, unknown>) => emit('warn', console.warn, msg, attrs),
  error: (msg: string, attrs?: Record<string, unknown>) => emit('error', console.error, msg, attrs),
};
```

Re-export `logger` from `src/core/observe/index.ts` alongside `initObserve`.

### Repoint `useBiometricChunks.ts:118`

```ts
import { logger } from '@/core/observe';
// ...
logger.error(`Failed to load biometric chunk ${idx} for session ${session.id}`, { err });
```

Keep it inside the existing `.catch`, after the `fetchIdRef` stale-guard — behavior (mark attempted, soft error) is unchanged. Drop the trailing `:` from the message (the err moves into structured `attrs`).

### Incremental adoption

Per the brief, replace ad-hoc `console.*` incrementally starting with error paths; there's no curated body of lines to migrate, so this task covers only the single existing site. Future error paths use `logger.*`.

## Verification (DoD #2)

- Destination `file` (default): `logger.error` prints to the console exactly as before (message + `{ err }`); no OTLP traffic.
- Destination `both` + stack up: forcing a chunk fetch to fail produces the line in Loki tagged `project=mind`, `service_name=mind_web`, level `error` — `observe-logs window … --service mind_web --level error`.

## Guards

- ZERO new log lines — only the existing `console.error` is rerouted.
- Reuse the note-20 resolver (`logToConsole`/`logToObserver`); do not re-read `import.meta.env` here.
- Facade name `logger`, not `log` (no SDK shadow).
- No `try/catch` around `log` — the SDK never throws into the host.
- Components receive data as props and contain no logging concern; the facade is used in hooks/pages/`core`, never pushed into shared presentational components.
