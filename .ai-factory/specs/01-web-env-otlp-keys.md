# Add committed .env.production with OTLP env keys

**Date:** 2026-07-04
**Source:** conversation context

## Key Findings

- `src/core/observe/config.ts` already resolved `VITE_LOG_DESTINATION`/`VITE_OTLP_ENDPOINT` from Vite's `import.meta.env`; there was no `.env.production`, so `vite build` (Vite's default production mode) shipped file-only.
- The staging cloud observe backend is now live and verified (see `digital_ocean/.ai-factory/handoffs/03-observe-staging-deploy-endpoints.md` — its live URL is an operational value, not repeated here). It's a **different origin** than mind_web's own deployed domain — posting directly from the browser is cross-origin CORS; the fix is a same-origin reverse-proxy path, not CORS on the shared backend.
- `init(...)` in `src/core/observe/init.ts` passed no `headers`, but the write-proxy requires `Authorization: Bearer <token>` on every write.

## Details

### Current state → target change (shipped 2026-07-04)

- `config.ts` now also resolves `otlpAuthToken` from `VITE_OTLP_AUTH_TOKEN`; `init.ts` threads it into `init(...)`'s `headers`.
- `vite.config.ts`'s dev proxy (`/otlp` → previously straight to local Loki) now targets the local `observe-write-proxy` instead, with a path rewrite (`/otlp/v1/logs` → `/v1/logs`) — same-origin locally, and the `Authorization` header set by `init()` passes through the proxy untouched. This means local dev now also requires a write token (parity with the cloud auth model), where it previously needed none.
- `.env.development.local` (gitignored) carries the real local dev endpoint + token — named for Vite's `development` mode explicitly, not the ambiguous `.env.local` (which loads in **every** Vite mode, including `production`, and would have silently shadowed `.env.production`/`.env.production.local` on a local `vite build`).
- `.env.production` (committed) carries only the **non-secret** default: `VITE_LOG_DESTINATION=both`, `VITE_OTLP_ENDPOINT=/otlp/v1/logs` (a relative path — never the bare cross-origin cloud URL).
- `.env.production.local` (gitignored, Vite-native override for production mode) carries the real staging token, kept out of the committed file.

### Open item — resolved (2026-07-04)

`digital_ocean`'s `staging.mind-awake.life` nginx vhost now has a `location /otlp/` proxying to the local `observe-write-proxy` (`127.0.0.1:4318`), confirmed live (prefix strips correctly, request reaches the proxy). The relative `/otlp/v1/logs` path resolves end-to-end for the browser now — CORS is no longer a blocker.

### Open item — resolved (2026-07-04)

The Docker deploy path for the real token needed a build-arg, mirroring `VITE_API_BASE_URL` — and the root `~/projects/mind` repo already has exactly this mechanism: `docker-compose.staging.yml`'s `mind_web.build.args` reads `VITE_API_BASE_URL` from the root (gitignored) `.env.staging`, and `deploy-staging.sh` scp's that same file to the server before building. Added `VITE_OTLP_ENDPOINT`/`VITE_OTLP_AUTH_TOKEN` as two more `ARG`s in `mind_web/Dockerfile` (optional — fall back to `.env.production`'s committed defaults when omitted) and as two more `args:` entries in `docker-compose.staging.yml`'s `mind_web` service, sourced from the same root `.env.staging`. No `digital_ocean`-side secret storage needed — the existing `mind`-repo deploy flow already carries it end-to-end.

### Guards

- Don't put real endpoints or tokens in `.env.example`, `.env.production` (committed), this spec, or the roadmap contract line.
- Never wire the bare cross-origin cloud URL directly — same-origin relative path only.

## Verify

- Local dev (`npm run dev`): confirm via `observe-logs` skill (`since-restart mind_web --project mind`) — now requires the local write-proxy + token to be reachable.
- Staging deploy: `./deploy-staging.sh mind_web` from `~/projects/mind` rebuilds with the real `VITE_OTLP_ENDPOINT`/`VITE_OTLP_AUTH_TOKEN` baked in; confirm via Grafana Explore against the staging backend (`{project="mind", service_name="mind_web"}`).
