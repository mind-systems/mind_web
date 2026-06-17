# Observability logging — outbound trace origination in `apiFetch` (Phase 14, droppable)

**Date:** 2026-06-18
**Source:** `~/projects/observability/.ai-factory/notes/03-integrate-mind-web.md` (DoD #3) + codebase recon + owner confirmation. The browser counterpart to mind_mobile note 112 (gRPC `traceparent` inject in the interceptor). Receiving leg is mind_api Phase 35 (note 47 / 46 — HTTP `extract`). Depends on note 20; independent of note 21. **Droppable.**

## Key Findings

- **`apiFetch` in `src/core/api/client.ts` is the single HTTP choke point** — every API call goes through it; `CLAUDE.md` forbids raw `fetch` in pages/components. So trace origination lives **here, in the infrastructure wrapper, configured once** — never in `onClick`/components/business code (the rejected mobile-agent mistake). This is the browser analogue of mind_mobile's `GrpcLoggingInterceptor`.
- **One-way is the honest floor.** The browser ambient context (explicit, lightweight — deliberately **not** `zone.js`) holds only within the **synchronous call stack + the immediately-chained microtask**; it does **not** survive `await` hops (no TC39 `AsyncContext` yet). The `apiFetch` error log fires *after* `await fetch`, outside that window, so the **browser-side error log will not inherit the `trace_id`**. mind_api *will* (it `extract`s the header on arrival). One-sided correlation is the deliverable; **never add a log line to force two-way.**
- **The inject itself is robust** because it happens **synchronously before** `fetch`: mint a span, activate it with `withSpan`, build headers with `withTraceparent` (which `inject`s the active span's `traceparent`), then call `fetch` with those headers — all within the sync window. The `trace_id` is captured into the request headers at call time regardless of what happens across the later `await`.
- **SDK surface (verified, `v0.1.0`, `src/browser/fetch.ts` + core):**
  - `startSpan(name?: string): Span`, `withSpan<T>(spanOrName, fn): T` — synchronous.
  - `withTraceparent(headers?: HeadersInit): Headers` — returns a new `Headers` with the **active** span's `traceparent` injected; **no-op when no span is active** (hence the explicit `withSpan` wrapper). `tracedFetch` is the all-in-one helper but `apiFetch` already owns the `fetch` call + header merge, so use `withTraceparent` and keep the existing `fetch`.
  - These are pure context ops — they work whether or not `init` ran; no exporter needed for inject.

## Details

### Current `apiFetch` (`src/core/api/client.ts`)

```ts
const res = await fetch(`${API_BASE_URL}${path}`, {
  ...options,
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  },
});
```

### Change — mint + inject synchronously, gated on observer

Build the merged headers first, then run `withTraceparent` inside a freshly-minted, activated span, gated on `logToObserver` so plain `file` dev emits no extra header:

```ts
import { startSpan, withSpan, withTraceparent } from 'observe-js';
import { logToObserver } from '@/core/observe/config';

const baseHeaders: HeadersInit = {
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...options?.headers,
};

// Mint a root span per request and inject its traceparent — synchronously, in the
// sync/microtask window, before the await. mind_api extracts it and stamps its logs
// with the same trace_id (one-way correlation — the honest floor).
const headers = logToObserver
  ? withSpan(startSpan(), () => withTraceparent(baseHeaders))
  : baseHeaders;

const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
```

`withTraceparent` returns a `Headers` instance; `fetch` accepts it directly. The auth `Authorization` header and any caller `options.headers` are preserved (merged into `baseHeaders` first).

### Why per-request span, not a shared one

A new span per call (`startSpan()` with no reuse) so each request carries its own `trace_id` — never a stale, app-wide id (rule: no single global `runWithContext`). Mirrors mind_mobile note 112 ("mint per call, don't reuse a trace").

## Verification (DoD #3)

- Destination `both`, observability up: a user action that calls mind_api (which has its Phase 35 extraction shipped) produces mind_api logs carrying the request's `trace_id` — `observe-logs trace <id>` shows the mind_api leg. The browser-side log (when one exists) is expected **not** to share it — that's the documented one-way floor.
- Destination `file`: no `traceparent` header is added (gated on `logToObserver`); request shape unchanged.

## Guards / honest fallback

- ZERO new log lines; trace origination lives in `apiFetch` only — **never** in `onClick`/components/business code; no `withSpan` around action handlers.
- Mint per call; do **not** reuse a span or wrap the app in one `runWithContext`.
- Inject is synchronous **before** the `await` — do not move it after.
- One-way is the floor. If even one-way inject proves undesirable, **drop Phase 14** and keep Phase 13 (the sink) as the shipped result. Never add logging to force correlation.
- Gated on `logToObserver` so `file` mode sends no extra header.
