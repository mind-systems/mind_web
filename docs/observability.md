# Observability

The dashboard ships with OTLP log export via the `observe-js` SDK. Behaviour is controlled by three environment variables. All three must carry the `VITE_` prefix — Vite only exposes prefixed variables to client code via `import.meta.env`.

## Log destination modes

`VITE_LOG_DESTINATION` selects where log output goes. Any unknown or blank value falls back to `file`.

- **`file`** (default) — logs go to the browser console only. No OTLP traffic is emitted. This is the safe default: starting `npm run dev` without the observability stack running produces no errors and no network activity.
- **`grafana`** — logs are forwarded to the OTLP endpoint only. Console output is suppressed.
- **`both`** — logs go to both the browser console and the OTLP endpoint. Use this in `.env.development.local` when actively debugging with the observability stack running.

## OTLP endpoint and auth

`VITE_OTLP_ENDPOINT` is the path the SDK posts log batches to. The `.env.example` default is `/otlp/v1/logs` — a relative path, not an absolute URL.

A relative path is intentional. Vite proxies `/otlp` to the local `observe-write-proxy` (not directly to Loki), rewriting the path from `/otlp/v1/logs` to the proxy's `/v1/logs`, and making the OTLP request same-origin. This eliminates CORS preflights and ensures `navigator.sendBeacon` (used on page unload to flush buffered records) works correctly, since `sendBeacon` cannot perform preflighted cross-origin requests. In a deployed build, the same relative-path trick relies on the real web server in front of the app proxying `/otlp/` to the write-proxy the same way.

The write-proxy requires `Authorization: Bearer <token>` on every write. `VITE_OTLP_AUTH_TOKEN` supplies that token; it is threaded into the SDK's `init(...)` call as a header. A missing or invalid token degrades silently — the write is dropped, nothing crashes — so a working endpoint with no token configured looks identical to a disabled destination until checked in Grafana.

Outside `npm run dev` — in `npm run preview` or a production build — the Vite dev proxy is not active. The relative path must resolve to a valid OTLP collector in the deployment environment. Because the `.env.example` default destination is `file`, no OTLP traffic is emitted until `VITE_LOG_DESTINATION` is set to `grafana` or `both`.

## Environment files

Real endpoint/token values are never committed. `.env.example` documents the three keys with placeholder/empty values; `.env.development.local` (gitignored, loaded by `npm run dev`) and `.env.production.local` (gitignored, loaded by a local `vite build`) hold the real per-environment values. The deployed build instead receives `VITE_OTLP_ENDPOINT`/`VITE_OTLP_AUTH_TOKEN` as Docker build arguments — see the root `~/projects/mind` repo's `docker-compose.staging.yml` and its own gitignored `.env.staging`.
