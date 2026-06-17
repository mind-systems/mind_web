# Plan: Stand up the SDK lifecycle — dependency, env resolver, idempotent init, Vite dev proxy, env docs

## Context
Bring up the `observe-js` OTLP logging lifecycle in `mind_web`: add the SDK dependency, a never-throwing env resolver, an idempotent `initObserve()` bootstrap gated on a relative OTLP endpoint, a same-origin Vite dev proxy, and the env-contract documentation. This task only emits the SDK's `service.start` marker — it routes zero app log lines (the logger facade is a later task).

## Settings
- Testing: no
- Logging: minimal
- Docs: yes

## Tasks

### Phase 1: Dependency

- [x] **Task 1: Add `observe-js` git dependency**
  Files: `package.json`, `package-lock.json`
  Add `"observe-js": "git+https://github.com/mind-systems/observe-js.git#v0.1.0"` to `dependencies`. Run `npm install` so the package's `prepare` hook builds its `dist/` and the lockfile updates. Smoke-check that `import { init } from 'observe-js'` resolves under Vite (the `browser` export condition resolves automatically). Do not pin a different ref — `v0.1.0` is mandated.

### Phase 2: Observe module

- [x] **Task 2: Create never-throwing env resolver** (depends on Task 1)
  Files: `src/core/observe/config.ts`
  Resolve `import.meta.env.VITE_LOG_DESTINATION` (trimmed) into a `LogDestination = 'file' | 'grafana' | 'both'`, defaulting unknown/blank to **`file`** (hard default — NOT `DEV`-conditional). Derive `logToConsole = file | both` and `logToObserver = grafana | both`. Resolve `otlpEndpoint` from trimmed `VITE_OTLP_ENDPOINT` or `undefined`. This module must **never throw** — the exact opposite of `src/core/config.ts`, which throws on a missing var. Keep all `import.meta.env` access confined to this file (mirrors the `config.ts` confinement convention). Follow the reference implementation in `.ai-factory/notes/20-observe-sink-lifecycle-init.md`.

- [x] **Task 3: Create idempotent `initObserve()` bootstrap** (depends on Task 2)
  Files: `src/core/observe/init.ts`
  Export `initObserve(): void`. Return early (silent degrade) unless both `logToObserver` and `otlpEndpoint` are truthy. Otherwise call the SDK `init({ project: 'mind', service: 'mind_web', endpoint: otlpEndpoint, onError: import.meta.env.DEV ? (err) => console.error('[observe-js]', err) : undefined })`. Rely on the SDK's first-wins idempotency — do **not** add a local "already initialised" guard. Do **NOT** implement any unload/flush/`sendBeacon` handling — the browser `init` registers `pagehide`/`visibilitychange` flushing itself.

- [x] **Task 4: Add barrel re-export** (depends on Task 3)
  Files: `src/core/observe/index.ts`
  Re-export `initObserve` from `./init`. Keep it minimal — the logger facade is added here by a later task.

### Phase 3: Wiring

- [x] **Task 5: Call `initObserve()` in the entry point** (depends on Task 4)
  Files: `src/main.tsx`
  Import `initObserve` from `@/core/observe` and call it as the **first statement**, before `createRoot(...)`. Add no other logging and change nothing else in the file.

- [x] **Task 6: Add same-origin OTLP dev proxy**
  Files: `vite.config.ts`
  Add a `server.proxy` entry mapping `'/otlp'` to `{ target: 'http://localhost:3100', changeOrigin: true }`. This makes the OTLP path same-origin in dev so there is no CORS preflight and `sendBeacon` works on unload. Touch nothing in the shared observability backend. Non-dev (`preview`/prod) builds have no proxy — out of scope.

### Phase 4: Env + docs

- [x] **Task 7: Document the env contract in `.env.example`**
  Files: `.env.example`
  Append `VITE_LOG_DESTINATION=file` and `VITE_OTLP_ENDPOINT=/otlp/v1/logs`. These commit the contract; the default `file` ships no OTLP traffic. Do not touch `.env.local` (gitignored; developers set `both` there for active debugging).

- [x] **Task 8: Write the observability env-contract doc**
  Files: `docs/observability.md`, `mind_web/CLAUDE.md`
  Create a short doc page (English; describe behavior, not code — no field/endpoint tables, no file trees) covering: the three `LOG_DESTINATION` modes (`file` default → console only, `grafana` → OTLP only, `both`), the mandatory `VITE_` prefix (Vite only exposes `VITE_`-prefixed vars to client code), the **relative** `VITE_OTLP_ENDPOINT` (`/otlp/v1/logs`) paired with the Vite dev proxy for same-origin delivery, and the non-dev caveat (no proxy outside `npm run dev`). Add the doc to the `## AI Context` list in `mind_web/CLAUDE.md`.

## Commit Plan
- **Commit 1** (after tasks 1-4): "Add observe-js dependency and lifecycle module"
- **Commit 2** (after tasks 5-6): "Wire observe init into entry point and OTLP dev proxy"
- **Commit 3** (after tasks 7-8): "Document observability env contract"
