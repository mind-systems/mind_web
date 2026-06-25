# Plan: Add Docker support

## Context
Add a multi-stage Docker build and nginx SPA config so `mind_web` can be built into a static-serving container image and included in the root `docker-compose.prod.yml`. Pure infrastructure addition — no `src/` or `vite.config.ts` changes.

**Critical build constraint (from plan review 1):** `mind_web` depends on a **private git dependency** —
`observe-js` (`package.json:19` → `git+https://github.com/mind-systems/observe-js.git#v0.1.0`), which `package-lock.json` pins to `git+ssh://git@github.com/mind-systems/observe-js.git#a42a85c…`. `npm ci` therefore clones over **SSH**, but `node:20-alpine` ships **no `git`** and a vanilla `docker build` has **no SSH key / known_hosts**. The builder stage must install `git` + `openssh-client` and forward SSH credentials, or the build fails at `npm ci` (`ENOGIT` / host-key / permission-denied).

**Chosen install strategy: BuildKit SSH agent forwarding** (`RUN --mount=type=ssh npm ci`). This keeps no secret in any image layer and matches a deploy-key server. It requires the build to be invoked with BuildKit and `--ssh default`, and the root-compose build to forward SSH (`ssh: [default]`) — a cross-repo implication flagged below. A PAT-secret alternative is documented in Task 3 as fallback for token-based hosts.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Container configuration

- [x] **Task 1: Add `.dockerignore`**
  Files: `.dockerignore`
  Create `.dockerignore` at the project root to keep the build context small and prevent the host's files from shadowing the in-image install. Exclude at minimum: `node_modules`, `dist`, `.vite`, `.git`, `.env.local`, `.env.*.local`, `.ai-factory`, `.playwright-mcp`, `*.log`, `.DS_Store`, `.vscode`, `.idea`, `*.tsbuildinfo`. Mirror the existing `.gitignore` entries.
  - **`node_modules` exclusion is load-bearing:** keeps `COPY . .` from overwriting the freshly `npm ci`-installed `node_modules` (which contains the SSH-cloned `observe-js`) with the host's copy.
  - **`.env.local` exclusion is load-bearing (review #3):** the host `.env.local` contains a `VITE_API_BASE_URL` value; if copied into the build context, Vite's env precedence could let it shadow the intended `ARG`. Excluding it removes the ambiguity. This task must land before Task 3's `COPY . .`.

- [x] **Task 2: Add `nginx.conf` (SPA routing)**
  Files: `nginx.conf`
  Create `nginx.conf` for the production stage. Single `server` block listening on port 80, `root /usr/share/nginx/html`, `index index.html`, and a `location /` block with `try_files $uri $uri/ /index.html;` so client-side routes (e.g. `/sessions`, `/calibration`) resolve to the SPA shell instead of returning an nginx 404 on direct navigation / refresh. This file is COPYed into `/etc/nginx/conf.d/default.conf` by the Dockerfile, so it must be a bare `server { ... }` block (NOT wrapped in `http { ... }`).

- [x] **Task 3: Add multi-stage `Dockerfile` with private-dependency SSH install** (depends on Task 1, Task 2)
  Files: `Dockerfile`
  Create a two-stage Dockerfile. The builder stage MUST install `git` + `openssh-client` and use a BuildKit SSH mount so `npm ci` can clone the private `observe-js` dependency.

  - **Builder stage** `FROM node:20-alpine AS builder` (matches `"engines": { "node": ">=20" }`):
    ```dockerfile
    FROM node:20-alpine AS builder
    ARG VITE_API_BASE_URL
    # fail fast: a missing build-arg otherwise yields a broken bundle that only
    # throws in the user's browser at runtime (review #2)
    RUN test -n "$VITE_API_BASE_URL" || (echo "VITE_API_BASE_URL build-arg is required" && exit 1)
    # git + ssh client for the private git+ssh observe-js dependency
    RUN apk add --no-cache git openssh-client
    WORKDIR /app
    RUN mkdir -p -m 0700 ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts
    COPY package*.json ./
    RUN --mount=type=ssh npm ci
    COPY . .
    RUN npm run build
    ```
    `VITE_API_BASE_URL` is baked into the bundle by `vite build` (Vite inlines `VITE_*` at build time — no runtime injection). `src/core/config.ts` already reads `import.meta.env.VITE_API_BASE_URL`; no code change.

  - **Production stage** `FROM nginx:alpine AS production`: `COPY --from=builder /app/dist /usr/share/nginx/html`, `COPY nginx.conf /etc/nginx/conf.d/default.conf`, `EXPOSE 80`, `CMD ["nginx", "-g", "daemon off;"]`.

  - **Fallback (PAT secret) — document as a comment or note, do NOT also implement:** for token-based hosts without an SSH agent, replace the ssh lines with `apk add --no-cache git` and
    ```dockerfile
    RUN --mount=type=secret,id=gh_token \
        git config --global url."https://x-access-token:$(cat /run/secrets/gh_token)@github.com/".insteadOf "ssh://git@github.com/" \
        && npm ci
    ```
    built with `--secret id=gh_token,src=<token-file>`.

  Verify locally (requires BuildKit + a loaded SSH agent with access to `mind-systems/observe-js`):
  ```bash
  DOCKER_BUILDKIT=1 docker build --ssh default \
    --build-arg VITE_API_BASE_URL=http://localhost:3000 -t mind_web_prod .
  docker run -p 8080:80 mind_web_prod
  # http://localhost:8080 opens; refresh on /sessions does NOT return an nginx 404
  ```

## Notes
- **Cross-repo implication (root `docker-compose.prod.yml`):** because the build uses an SSH mount, the root compose `build:` block for `mind_web` must forward SSH and pass the build arg, e.g.:
  ```yaml
  mind_web:
    build:
      context: ./mind_web
      ssh: [default]            # forwards the host SSH agent (BuildKit)
      args:
        VITE_API_BASE_URL: ${VITE_API_BASE_URL}
    ports:
      - "${HOST_WEB_PORT}:80"
  ```
  This — plus root `.env.example` / `HOST_WEB_PORT` / `VITE_API_BASE_URL` entries — lives in the root coordination repo, **out of scope for `mind_web`**. Spec `.ai-factory/notes/44-docker-support.md` documents the compose snippet for that follow-up.
- `VITE_API_BASE_URL` is a public browser-reachable URL (e.g. `https://api.mind-awake.life`), not a Docker-internal hostname — the bundle runs in the user's browser, outside the Docker network.
- Do not touch `vite.config.ts` (its `/otlp` dev proxy is dev-only and irrelevant to the nginx production image).
