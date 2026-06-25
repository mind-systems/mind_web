# Docker support for mind_web

**Date:** 2026-06-25
**Source:** conversation context

## Key Findings

- mind_web has no Dockerfile; it cannot be included in the root docker-compose deployment today.
- Two files are needed: `Dockerfile` (multi-stage) and `nginx.conf` (SPA routing). They ship together — the Dockerfile COPYs the nginx config, so neither is deployable alone.
- `VITE_API_BASE_URL` is a build-time env var (Vite bakes `VITE_*` into the bundle); it must be injected as a Docker `ARG`, not a runtime env.
- No application code (`src/`) changes required.

## Details

### Files to create

**`mind_web/Dockerfile`** — multi-stage:

```dockerfile
# Stage 1 — build
FROM node:20-alpine AS builder
ARG VITE_API_BASE_URL
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — serve
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**`mind_web/nginx.conf`** — SPA routing (all paths → `index.html`):

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### How VITE_API_BASE_URL is passed

`VITE_API_BASE_URL` is a **public domain URL** — the React bundle runs in the user's browser, which has no access to the Docker internal network. It must point to the publicly reachable API:

- dev deploy: `https://dev-api.mind-awake.life`
- prod deploy: `https://api.mind-awake.life`

Passed at build time via Docker `ARG` (Vite bakes `VITE_*` into the bundle at `npm run build`):

```bash
docker build --build-arg VITE_API_BASE_URL=https://api.mind-awake.life -t mind_web_prod .
```

In the root docker-compose, read from the `.env` file:

```yaml
mind_web:
  build:
    context: ./mind_web
    args:
      VITE_API_BASE_URL: ${VITE_API_BASE_URL}
  ports:
    - "${HOST_WEB_PORT}:80"
```

Root `.env.dev` (gitignored, created manually on server):
```env
VITE_API_BASE_URL=https://dev-api.mind-awake.life
HOST_WEB_PORT=8080
```

Root `.env.prod` (gitignored, created manually on server):
```env
VITE_API_BASE_URL=https://api.mind-awake.life
HOST_WEB_PORT=8080
```

Commit a `.env.example` at the root with empty values as a template:
```env
VITE_API_BASE_URL=
HOST_WEB_PORT=
```

`src/core/config.ts` already reads `import.meta.env.VITE_API_BASE_URL` — no code change needed.

### What NOT to change

- `vite.config.ts` — the `/otlp` dev proxy is dev-only, irrelevant in the nginx production image.
- `src/core/config.ts` — already correct.
- Any `src/` file — purely infrastructure addition.

## Verify

```bash
cd mind_web
docker build --build-arg VITE_API_BASE_URL=http://localhost:3000 -t mind_web_prod .
docker run -p 8080:80 mind_web_prod
# http://localhost:8080 opens, F5 on /sessions does NOT return nginx 404
```
