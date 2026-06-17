# Code Review (Pass 3): Stand up the SDK lifecycle (observe-js OTLP)

**Scope reviewed:** `src/core/observe/{config,init,index}.ts`, `src/main.tsx`, `vite.config.ts`, `.env.example`, `docs/observability.md`, `CLAUDE.md`, `package.json`, `package-lock.json`. Code is byte-identical to passes 1 and 2 (same diffstat). This pass focuses on the angle not yet centered: **security and production/preview behavior**.

## Security & production-exposure check (new this pass)

- **The dev proxy never ships.** `server.proxy` in `vite.config.ts` configures only the Vite **dev** server. `npm run preview` uses Vite's separate `preview` config key (not `server`), and a production build is static assets with no server at all. Confirmed no `proxy`/`server` reference exists in any build/preview config. So the `/otlp → http://localhost:3100` mapping cannot leak into a deployed artifact — it is a local-dev convenience only.
- **No secrets in the shipped bundle.** Both inlined env vars are non-sensitive: `VITE_OTLP_ENDPOINT` is a relative path and `VITE_LOG_DESTINATION` is an enum string. Nothing credential-bearing is exposed via `import.meta.env`. `changeOrigin: true` only rewrites the Host header toward `localhost:3100` in dev.
- **`.env.local` is gitignored and not staged** (`git check-ignore` confirms; not in the staged set), so no developer-local `both` override or other local config leaks into the commit.
- **Production fallback is safe-by-default.** Outside dev there is no proxy, so a relative endpoint would POST to the app's own origin and 404 — but the committed default `VITE_LOG_DESTINATION=file` gates `initObserve()` off entirely, so no OTLP traffic is attempted. Even if forced on, the SDK swallows export failures (bounded drop-oldest queue, errors routed to `onError`). No app-visible failure path.

## Correctness — reconfirmed from prior passes

No change to the conclusions established in review-1 (static checks) and review-2 (SDK-source verification):
- Resolver never throws; hard `file` default; `logToConsole`/`logToObserver`/`otlpEndpoint` derived correctly.
- `initObserve()` gated on `logToObserver && otlpEndpoint`; `init` call site matches `InitOptions`; relative endpoint is safe (SDK never calls `new URL()`); SDK is first-wins idempotent and never throws on double-init; unload flush is SDK-internal and correctly not duplicated.
- `npm run typecheck` and `npm run lint` pass clean; `dist/browser.mjs` present and exports `init`; proxy prefix aligns with the endpoint path and Loki's native OTLP route.

**No bugs, security issues, or correctness problems in the changed code.**

## Findings (carried forward — both non-blocking, neither a defect in the observe code)

### 1. [Minor / portability] Lockfile pins `observe-js` over SSH while `package.json` uses HTTPS
`package.json` → `git+https://…/observe-js.git#v0.1.0`; `package-lock.json:2911` resolved to `git+ssh://git@github.com/mind-systems/observe-js.git#a42a85c…`. An HTTPS/token-authenticated CI without an SSH key for this private org will fail `npm ci`. Verify install on shared CI before merge, or normalize the lockfile `resolved` URL to `git+https://`. First git dependency in the repo, so this path is previously unexercised.

### 2. [Pre-existing / out of scope] `npm run build` is red, independent of this change
`tsc -b` fails on `src/pages/SessionsPage/transforms.ts:50` (`TS2322`), a file not touched here; `npm run typecheck` (root tsconfig) passes. This pre-existing breakage, plus the sandbox's Node 18.15.0 (< Vite's required 20.19+), prevented an end-to-end Vite build here; SDK resolution was confirmed statically instead. Recommend a one-time `npm run dev` smoke check on Node 20+ with `VITE_LOG_DESTINATION=both` to confirm `service.start` reaches Loki (the note's DoD).

## Notes (no action)
- `logDestination`/`logToConsole` exported-but-unused by design (consumed by the follow-up logger facade).
- `onError`'s DEV-only `console.error` is an SDK error handler, not an app log line — consistent with the "zero app log lines" guard.
- ES module import hoisting evaluates `@/core/config` before `initObserve()`; inherent and harmless — the "before `createRoot`" requirement holds.
