# Plan Review: Mint a span + inject `traceparent` inside `apiFetch`

**Plan:** `36-mint-a-span-inject-traceparent-inside-apifetch.md`
**Target:** `mind_web/src/core/api/client.ts`
**Risk Level:** 🔴 High — the plan as written breaks `npm run build` / `npm run typecheck`.

## Context Gates

- **Architecture (`.ai-factory/ARCHITECTURE.md`):** ✅ Aligned. The plan keeps trace origination at the single HTTP choke point (`core/api/client.ts`), which is exactly the "Single fetch point" key principle. No new layering, no storage access, no log lines added. Good fit.
- **Rules (`.ai-factory/RULES.md`):** ⚠️ File not present — no explicit convention file to check against. Project rules from `CLAUDE.md` (all-English, `mind_auth_token` untouched, single fetch point) are respected.
- **Roadmap (`.ai-factory/ROADMAP.md`):** ⚠️ WARN — the plan references "Phase 13 sink" but does not link to a roadmap milestone. Non-blocking; consider adding the linkage since this is observability `feat` work.
- **Skill-context (`.ai-factory/skill-context/aif-review/SKILL.md`):** Not present — no project-specific review overrides to apply.

## Critical Issues

### 1. `withTraceparent` is not visible to TypeScript → build/typecheck failure (BLOCKING)

The plan imports:
```ts
import { startSpan, withSpan, withTraceparent } from 'observe-js';
```

`withTraceparent` is a **browser-only** export. I verified the published type surface:

- `node_modules/observe-js/dist/browser.d.ts` exports `withTraceparent` and `tracedFetch`.
- `node_modules/observe-js/dist/node.d.ts` exports **only**: `bindContext, extract, flush, getActiveContext, headersCarrier, init, inject, log, objectCarrier, runWithContext, shutdown, startSpan, withSpan` — **no `withTraceparent`, no `tracedFetch`**.

How TypeScript resolves the package matters here. `tsconfig.app.json` uses `"moduleResolution": "bundler"` with **no `customConditions`** (confirmed across `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, and `vite.config.ts`). Bundler resolution does **not** automatically apply the `"browser"` condition. Walking the `exports` map for `"."`, tsc skips the `browser` and `node` condition blocks and matches `import` → `types: ./dist/node.d.ts`.

Result: `import { ... withTraceparent } from 'observe-js'` raises **TS2305: Module 'observe-js' has no exported member 'withTraceparent'**. `npm run build` (`tsc -b && vite build`) and `npm run typecheck` (`tsc --noEmit`) both fail. `skipLibCheck: true` does not help — the error is on the consumer import, not inside a `.d.ts`.

Note the trap: at **runtime** Vite resolves the `"browser"` condition (`browser.mjs`), which *does* provide `withTraceparent` — so a naive runtime smoke test would pass while the typed build is broken.

`startSpan` and `withSpan` are fine — both are in `node.d.ts`. The failure is isolated to `withTraceparent`.

**Recommended fix — use exports available under both conditions.** `inject` and `headersCarrier` are exported from `node.d.ts`, typecheck cleanly, and run identically in the browser:

```ts
import { startSpan, withSpan, inject, headersCarrier } from 'observe-js';
import { logToObserver } from '@/core/observe/config';

// ...inside apiFetch, after building baseHeaders:
let headers: HeadersInit = baseHeaders;
if (logToObserver) {
  const traced = new Headers(baseHeaders);
  withSpan(startSpan(), () => inject(headersCarrier(traced)));
  headers = traced;
}
const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
```

This preserves every guard in the plan: synchronous mint+inject before the `await`, a fresh span per call, gating on `logToObserver`, file-mode request shape unchanged (`baseHeaders` object passed as-is), and zero new log lines.

Alternative fix: add `"customConditions": ["browser"]` to `tsconfig.app.json` so tsc resolves `browser.d.ts` and `withTraceparent` becomes visible. This is cleaner conceptually (types match the browser runtime target) but is an extra, unscoped change that affects resolution for *all* packages and is not currently in the plan — prefer the export swap above unless you intend to align the whole project's type resolution to the browser target.

## Secondary Issues / Risks

### 2. Cross-origin CORS for the `traceparent` header (verify against mind_api)

In `npm run dev`, only `/otlp` is proxied to `localhost:3100`. API calls go to `VITE_API_BASE_URL` (`mind_api`), which is **cross-origin**. Adding a `traceparent` request header means the CORS preflight's `Access-Control-Allow-Headers` must now include `traceparent`, or the browser blocks **every** gated API request.

- Mitigating factor: requests already send `Authorization` + `Content-Type: application/json`, so a preflight already happens — this is not a *new* preflight, only a new header that must be allow-listed.
- Containment: the injection is gated on `logToObserver`, so this only bites in `grafana`/`both` modes, never in the default `file` mode.
- **Action:** confirm `mind_api` CORS allows the `traceparent` header (e.g. `Access-Control-Allow-Headers` includes it or is `*`). This is a cross-project dependency the plan does not mention; worth a one-line note or a verification step.

### 3. Sampling flag (minor, likely fine)

`startSpan()` opens a new root trace; the emitted `traceparent` carries whatever `traceFlags` the SDK sets. As long as `mind_api` stamps `trace_id` from the header regardless of the sampled bit (`00` vs `01`), one-way correlation works. No change needed — just be aware the flag value is SDK-determined, not set by this code.

## Things the Plan Gets Right (Positive Notes)

- Correct architectural placement — origination at the single fetch choke point, not in components/handlers. Matches ARCHITECTURE.md exactly.
- `logToObserver` is correctly sourced from `@/core/observe/config` (verified the export exists) and the `@/` alias resolves to `src/`.
- The `withSpan(startSpan(), () => ...)` nesting is semantically correct: `withSpan` makes the new span the active context, and the inject reads the active context inside the callback. Logic is sound — only the chosen export (`withTraceparent`) is the problem.
- Explicit, well-reasoned guards: synchronous-before-`await`, fresh span per call, no `runWithContext` app-wide, zero new log lines, one-way correlation accepted as the floor. These are the right constraints.
- Preserving the exact header merge order (content-type → auth → caller headers) avoids regressions in existing request behavior.

## Verdict

Do **not** implement as written — Task 1's `withTraceparent` import will fail the typed build under the project's `moduleResolution: "bundler"` + no-`customConditions` setup. Swap to `inject` + `headersCarrier` (Recommended fix in Issue 1), and add a verification note for `mind_api` CORS (Issue 2). With those two adjustments the plan is solid and well-scoped.
