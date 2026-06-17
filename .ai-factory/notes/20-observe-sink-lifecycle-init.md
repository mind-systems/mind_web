# Observability logging — OTLP sink lifecycle + `init` (Phase 13, task 1)

**Date:** 2026-06-18
**Source:** `~/projects/observability/.ai-factory/notes/03-integrate-mind-web.md` (DoD #1/#2/#4) + codebase recon + owner confirmation. First **browser** integration in the family — sets the pattern tradeoxy_gui will copy. Sibling references: mind_api note 45 (Node sink swap), mind_mobile note 109 (Dart SDK lifecycle).

## Key Findings

- **No project logger.** mind_web uses raw `console.*`; the only real call site is `console.error` in `src/pages/SessionsPage/useBiometricChunks.ts:118` (migrated in task 2 / note 21). This task stands up the SDK lifecycle; it routes **no** app logs yet — the only observable output is the `service.start` restart marker.
- **Entry point** is `src/main.tsx` — bare `createRoot` after `QueryClientProvider`/`RouterProvider`. `init` goes at the top, before `createRoot`.
- **Config precedent.** `src/core/config.ts` reads `import.meta.env.VITE_API_BASE_URL` and **throws** on absence. The observe resolver must do the **opposite — never throw**: a missing/blank endpoint or destination degrades silently so a bad observability env never blocks the dashboard.
- **Vite env constraint.** Vite only exposes `VITE_`-prefixed vars to client code via `import.meta.env`. The convention's logical names are kept but the prefix is mandatory: `VITE_LOG_DESTINATION`, `VITE_OTLP_ENDPOINT`. Document the prefix requirement.
- **CORS — solved with a Vite dev proxy (owner-confirmed).** The browser posting OTLP to Loki (`:5173` → `:3100`) is cross-origin → preflight, and `sendBeacon` on unload cannot do a preflighted request. A `server.proxy` entry making the OTLP path **same-origin** removes both problems and touches **zero** of the shared observability backend. `VITE_OTLP_ENDPOINT` is therefore a **relative** path in dev (`/otlp/v1/logs`). Non-dev builds (`preview`/prod) have no proxy → out of scope (and default `file` ships nothing anyway).
- **SDK browser surface (verified against the `v0.1.0` source tree at `~/projects/observability/observe-js`):**
  - `init(opts: InitOptions): void` — synchronous, **first-wins idempotent** (second call no-ops, reports via `onError`), emits the `service.start` marker. `InitOptions = { project, service, endpoint, batch?, onError?, exporter? }`.
  - The **browser** `init` (shadows core init) auto-registers the unload flush itself (`pagehide` + `visibilitychange=hidden` → `enableBeacon()` + `flush()` via `navigator.sendBeacon`). **Do not implement unload/flush** — it's built in.
  - A failed/slow/unreachable export degrades silently (bounded buffer, drop-oldest) — an SDK guarantee, not something to implement.

## Details

### Confirmed decisions

1. Env names: `VITE_LOG_DESTINATION` (∈ `file|grafana|both`) + `VITE_OTLP_ENDPOINT`. `VITE_` prefix mandatory — documented.
2. Default `LOG_DESTINATION`: **hard `file`** (not `DEV?both:file`). `npm run dev` without the observability stack up must not spam the console with failing-OTLP `onError` output. `grafana`/`both` is opt-in. Matches mind_api's "safe default".
3. `init` at top of `main.tsx`, before `createRoot`, gated on destination including `grafana`, idempotent.
4. CORS: Vite dev proxy, same-origin relative endpoint. Zero backend change.

### New module `src/core/observe/`

**`config.ts`** — destination/endpoint resolver. **Never throws.**

```ts
type LogDestination = 'file' | 'grafana' | 'both';

const raw = (import.meta.env.VITE_LOG_DESTINATION as string | undefined)?.trim();
export const logDestination: LogDestination =
  raw === 'grafana' || raw === 'both' || raw === 'file' ? raw : 'file'; // unknown → file

export const logToConsole = logDestination === 'file' || logDestination === 'both';
export const logToObserver = logDestination === 'grafana' || logDestination === 'both';

export const otlpEndpoint =
  (import.meta.env.VITE_OTLP_ENDPOINT as string | undefined)?.trim() || undefined;
```

**`init.ts`** — idempotent bootstrap, gated.

```ts
import { init } from 'observe-js';
import { logToObserver, otlpEndpoint } from './config';

export function initObserve(): void {
  if (!logToObserver || !otlpEndpoint) return; // silent degrade — never block the app
  init({
    project: 'mind',
    service: 'mind_web',
    endpoint: otlpEndpoint,
    onError: import.meta.env.DEV ? (err) => console.error('[observe-js]', err) : undefined,
  });
}
```

**`index.ts`** — re-export `initObserve` (and, after task 2, `logger`).

### `src/main.tsx`

Call `initObserve()` as the first statement, before `createRoot`:

```ts
import { initObserve } from '@/core/observe';
initObserve();
```

### Dependency (`package.json`)

```jsonc
"dependencies": {
  "observe-js": "git+https://github.com/mind-systems/observe-js.git#v0.1.0"
}
```

`npm install` — the `prepare` hook builds `dist/` on install; Vite resolves the `browser` export condition automatically. Smoke-check that `import { init } from 'observe-js'` resolves under Vite.

### Vite dev proxy (`vite.config.ts`)

Add a `server.proxy` entry so the OTLP path is same-origin in dev:

```ts
server: {
  proxy: {
    '/otlp': { target: 'http://localhost:3100', changeOrigin: true },
  },
},
```

### Env files

- `.env.example`: append `VITE_LOG_DESTINATION=file` and `VITE_OTLP_ENDPOINT=/otlp/v1/logs` (committed, documenting the contract; default `file` ships nothing).
- `.env.local` (gitignored): set `VITE_LOG_DESTINATION=both` for active local debugging.

### Docs

Add a short page to the project docs (match neighboring docs' language/style) describing the three `LOG_DESTINATION` modes, the mandatory `VITE_` prefix, the relative `VITE_OTLP_ENDPOINT` + Vite dev proxy, and the non-dev caveat. Register it in `CLAUDE.md`'s AI Context list if a docs index exists.

## Verification (DoD #1/#2/#4)

- Default (`VITE_LOG_DESTINATION` unset → `file`): no OTLP traffic, console unchanged, app byte-identical to today.
- `VITE_LOG_DESTINATION=both` + observability stack up + `npm run dev`: `service.start` appears in Loki tagged `project=mind`, `service_name=mind_web` — `observe-logs since-restart mind_web --project mind`.
- Reload re-emits `service.start`; `init` called twice in one page life is a no-op.

## Guards

- ZERO new log lines (the facade + the one repoint are task 2 / note 21).
- The resolver **never throws** — unlike `config.ts`.
- Do **not** implement unload/flush — the browser `init` registers it.
- Default destination is hard `file` — not `DEV`-conditional.
- `import.meta.env` access stays inside `src/core/observe/` (mirrors `config.ts` confinement); no `localStorage`/`sessionStorage` involved, so the storage allow-list rule is untouched.
