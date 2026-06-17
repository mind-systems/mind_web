# Plan: Mint a span + inject `traceparent` inside `apiFetch`

## Context
Originate one-way trace correlation at the single HTTP choke point: mint a per-request span and synchronously inject its `traceparent` header inside `apiFetch`, gated on `logToObserver`, so mind_api stamps its logs with the request's `trace_id`. This is **Phase 14** (Observability logging: outbound trace origination, ROADMAP.md line 99-103), building on the Phase 13 sink. Note: the roadmap's Phase 14 text prescribes `withTraceparent(baseHeaders)` — this plan **intentionally overrides** that export because it breaks the typed build (see Task 1); the roadmap entry should be corrected to match when next touched.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Inject trace context in apiFetch

- [x] **Task 1: Build merged headers, then mint span + inject `traceparent` before the `await`**
  Files: `src/core/api/client.ts`
  Add imports at the top of the file: `import { startSpan, inject, headersCarrier } from 'observe-js';` and `import { logToObserver } from '@/core/observe/config';` (mirrors the existing `@/core/config` import alias style). **Do not import `withSpan`** — the explicit-context form below does not use it, and `noUnusedLocals` is enabled (an unused import fails typecheck).

  > **Do NOT import `withTraceparent`.** It is a browser-only export present only in `dist/browser.d.ts`. The project's `tsconfig.app.json` uses `"moduleResolution": "bundler"` with **no `customConditions`** (verified), so tsc resolves the package's `"."` `import` condition to `dist/node.d.ts`, which exports `startSpan, inject, headersCarrier` (and `withSpan`) but **not** `withTraceparent`/`tracedFetch`. Importing `withTraceparent` raises **TS2305** and fails both `npm run build` (`tsc -b && vite build`) and `npm run typecheck`. The trap: Vite's runtime resolves the `"browser"` condition and *would* provide `withTraceparent`, so a runtime smoke test passes while the typed build is broken. Use `inject` + `headersCarrier` instead — both are in `node.d.ts`, typecheck cleanly, and behave identically in the browser.

  Inside `apiFetch`, refactor the inline `fetch` call so header construction is explicit:
  1. First build `const baseHeaders: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { Authorization: \`Bearer ${token}\` } : {}), ...options?.headers };` — preserving the exact current merge order (content-type → auth → caller headers). The object-spread of `options?.headers` is verbatim from today's inline literal, so there is no behavioral regression; the explicit `: HeadersInit` annotation matches the type the value already feeds (`RequestInit.headers`).
  2. Then gate the inject. **Pass the freshly-minted span to `inject` as the explicit `ctx` argument** (not via `withSpan`) — `headersCarrier` requires a real `Headers` instance, so wrap `baseHeaders` in `new Headers(...)`:
     ```ts
     let headers: HeadersInit = baseHeaders;
     if (logToObserver) {
       const traced = new Headers(baseHeaders);
       inject(headersCarrier(traced), startSpan());
       headers = traced;
     }
     ```
  3. Call `const res = await fetch(\`${API_BASE_URL}${path}\`, { ...options, headers });`

  **Why explicit `ctx`, not `withSpan(startSpan(), () => inject(...))`:** verified in the SDK, `inject(carrier, ctx)` resolves the trace as `ctx ?? getActiveContext()`. Passing `startSpan()` directly makes injection independent of the installed context manager. The `withSpan` form instead relies on `getActiveContext()`, which only works because `observe-js` installs its browser context manager as a **top-level import-time side-effect** (`setContextManager(browserContextManager)`) — but the package declares `"sideEffects": false`, so a production Rollup/`vite build` pass is *permitted* to tree-shake that statement away (the app imports neither `browserContextManager` nor `setContextManager`), leaving the no-op manager active and `inject` silently writing **no** header. That is the same runtime-vs-build trap as the `withTraceparent` issue: dev would pass while the production bundle drops the header. The explicit-`ctx` form is immune to tree-shaking and `init()` ordering. Type-compat is verified: `startSpan()` returns `Span` (`{traceId, spanId, traceFlags, ...}`), structurally assignable to `inject`'s `Context` param, and all three exports are in `node.d.ts`.

  The mint + `inject` must run **synchronously before** the `await fetch` (within the sync/microtask window) so the `trace_id` lands in the request headers at call time. Mint a fresh span per call — no reuse, no app-wide `runWithContext`. In `file` mode the unmodified `baseHeaders` object is passed as-is, leaving request shape unchanged. Leave the rest of the function (401 handling, error parsing, `res.json()`) unchanged. After the edit, confirm `npm run typecheck` and `npm run build` are clean.

## Cross-project dependency: mind_api CORS (verify before enabling `grafana`/`both`)
API calls go to `VITE_API_BASE_URL` (mind_api), which is **cross-origin** — only `/otlp` is proxied in dev. Adding a `traceparent` request header means mind_api's CORS preflight response must allow it: `Access-Control-Allow-Headers` must include `traceparent` (or be `*`), otherwise the browser blocks **every** gated API request. Requests already send `Authorization` + `Content-Type`, so a preflight already happens — this adds a header to allow-list, not a new preflight. The injection is gated on `logToObserver`, so a misconfiguration only bites in `grafana`/`both` modes, never in the default `file` mode. **Verification step:** before switching the destination to `grafana`/`both`, confirm mind_api's `Access-Control-Allow-Headers` includes `traceparent`.

## Production-build verification (DoD)
Because the runtime-vs-build traps above are invisible to a dev-server smoke test, verify in a production build: run `npm run build` + `npm run preview` with `VITE_LOG_DESTINATION=grafana` (or `both`) and confirm an actual mind_api request carries a `traceparent` request header (DevTools → Network). In default `file` mode, confirm no `traceparent` header is added.

## Architecture note (update opportunistically)
This introduces a new intra-`core` dependency edge `core/api → core/observe` (`import { logToObserver } from '@/core/observe/config'`). The documented dependency matrix in `ARCHITECTURE.md` (line 53) lists only `core/api → core/config, core/types`. The edge is benign (core→core, no layering inversion) but not yet in the matrix — add it when docs are next touched.

## Notes / Guards (must hold)
- **ZERO new log lines** — this task only injects a header; it never calls `logger`/`log`.
- Trace origination lives **only** in `apiFetch` — never in `onClick`/components/business code; no `withSpan` around action handlers.
- Inject stays **synchronous before** the `await` — do not move it after.
- Gated on `logToObserver` so `file` mode adds no extra header and leaves request shape unchanged.
- The emitted `traceparent` carries SDK-determined `traceFlags` (sampled bit `00`/`01`); this is fine as long as mind_api stamps `trace_id` from the header regardless of the sampled bit — no change needed here.
- One-way correlation is the floor: the browser-side error log (fired after `await`) is expected **not** to share the `trace_id`. Do **not** add a log line to force two-way. If even one-way inject proves undesirable, drop this phase and keep the Phase 13 sink.
