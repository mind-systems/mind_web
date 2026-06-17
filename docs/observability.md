# Observability

The dashboard ships with OTLP log export via the `observe-js` SDK. Behaviour is controlled by two environment variables. Both must carry the `VITE_` prefix — Vite only exposes prefixed variables to client code via `import.meta.env`.

## Log destination modes

`VITE_LOG_DESTINATION` selects where log output goes. Any unknown or blank value falls back to `file`.

- **`file`** (default) — logs go to the browser console only. No OTLP traffic is emitted. This is the safe default: starting `npm run dev` without the observability stack running produces no errors and no network activity.
- **`grafana`** — logs are forwarded to the OTLP endpoint only. Console output is suppressed.
- **`both`** — logs go to both the browser console and the OTLP endpoint. Use this in `.env.local` when actively debugging with the observability stack running.

## OTLP endpoint

`VITE_OTLP_ENDPOINT` is the path the SDK posts log batches to. The `.env.example` default is `/otlp/v1/logs` — a relative path, not an absolute URL.

A relative path is intentional. During `npm run dev`, Vite proxies `/otlp` to `http://localhost:3100`, making the OTLP request same-origin. This eliminates CORS preflights and ensures `navigator.sendBeacon` (used on page unload to flush buffered records) works correctly, since `sendBeacon` cannot perform preflighted cross-origin requests.

Outside `npm run dev` — in `npm run preview` or a production build — the Vite dev proxy is not active. The relative path must resolve to a valid OTLP collector in the deployment environment. Because the `.env.example` default destination is `file`, no OTLP traffic is emitted until `VITE_LOG_DESTINATION` is set to `grafana` or `both`.
