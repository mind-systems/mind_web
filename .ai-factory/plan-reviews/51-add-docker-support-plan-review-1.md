# Plan Review: Add Docker support (51)

## Code Review Summary

**Files Reviewed:** plan `51-add-docker-support.md` + targets (`package.json`, `package-lock.json`, `vite.config.ts`, `.gitignore`, `.env.example`, `.env.local`, `src/core/config.ts`, `index.html`, note `44-docker-support.md`, ROADMAP)
**Risk Level:** 🔴 High — the Dockerfile as specified will fail at `npm ci`.

### Context Gates
- **Architecture** (`ARCHITECTURE.md` present): No boundary or dependency-rule impact — pure infra addition, no `src/` changes. PASS.
- **Rules** (`CLAUDE.md`): Plan respects the rules — no `vite.config.ts` change, no `src/` change, no proto touch, no localStorage-key rename. PASS.
- **Roadmap** (`ROADMAP.md` present): Maps directly to **Phase 25 — Docker deployment / "Add Docker support"**. Linkage explicit (note `44-docker-support.md`). PASS.

---

### Critical Issues

#### 1. 🔴 `npm ci` will fail: `observe-js` is a private **git+ssh** dependency, but `node:20-alpine` has no `git` and the build has no SSH access

This is the headline problem and it is **not mentioned anywhere in the plan**.

`package.json` declares:
```json
"observe-js": "git+https://github.com/mind-systems/observe-js.git#v0.1.0"
```
and `package-lock.json` resolved it to:
```
git+ssh://git@github.com/mind-systems/observe-js.git#a42a85c10bbab0bc8bbf09099929148258a4dcd0
```

The Dockerfile in Task 3 (`FROM node:20-alpine` → `RUN npm ci`) breaks on two counts:

1. **No `git` binary.** `node:20-alpine` does not ship `git`. `npm ci` must shell out to `git` to clone a `git+`/`git+ssh` dependency, so it fails with `git: not found` (or `npm error code ENOGIT`).
2. **No SSH credentials / known_hosts.** The lockfile pins an **SSH** URL to what is almost certainly a private org repo (`mind-systems/observe-js`). A vanilla `docker build` has no SSH key, no agent, and no `github.com` host key, so even with `git` installed the clone fails with a host-key / permission-denied error.

The `verify` block in Task 3 (`docker build ... -t mind_web_prod .`) would surface this immediately — meaning the plan's own acceptance step cannot pass as written.

**Required fix — the plan must add an explicit step for this.** Options, in rough order of preference:

- **SSH build secret (BuildKit):** install the client and forward an SSH agent socket:
  ```dockerfile
  FROM node:20-alpine AS builder
  RUN apk add --no-cache git openssh-client
  WORKDIR /app
  RUN mkdir -p -m 0700 ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts
  COPY package*.json ./
  RUN --mount=type=ssh npm ci
  ```
  Build with `DOCKER_BUILDKIT=1 docker build --ssh default ...`. Note this also requires the compose/build invocation in the root repo to forward SSH — a cross-repo implication the plan should flag.

- **HTTPS + token rewrite:** `apk add --no-cache git`, then inside the build rewrite the remote using a `--secret`-mounted PAT:
  ```dockerfile
  RUN --mount=type=secret,id=gh_token \
      git config --global url."https://x-access-token:$(cat /run/secrets/gh_token)@github.com/".insteadOf "ssh://git@github.com/" \
      && npm ci
  ```

- **Vendor the package** so no network/SSH is needed at build time.

At minimum the Dockerfile **must** `apk add --no-cache git` (plus `openssh-client` for the SSH path). Without a decision here the plan is not implementable. Recommend looping `aif-improve` to add a dedicated task covering the private-dependency install path and the matching root-repo build invocation (`--ssh default` / `--secret`).

---

### Non-Blocking Issues

#### 2. 🟡 ARG → Vite env coupling is correct but fragile — worth an explicit guard
The plan relies on `ARG VITE_API_BASE_URL` reaching `vite build`. This works because Docker exposes an `ARG` as an env var to the subsequent `RUN`, and Vite's `loadEnv` exposes `VITE_`-prefixed `process.env` values into `import.meta.env`. That chain is correct.

However: `src/core/config.ts` throws **only at runtime in the browser** (module load), not during `vite build` (Vite bundles modules, it doesn't execute them). So if the `--build-arg` is omitted, the image **builds successfully** and then the app throws `VITE_API_BASE_URL is not set` in the user's browser — a silent, deploy-time failure. Consider a build-time assertion in the Dockerfile, e.g.:
```dockerfile
RUN test -n "$VITE_API_BASE_URL" || (echo "VITE_API_BASE_URL build-arg is required" && exit 1)
```
Not mandatory, but cheap insurance against a misconfigured root compose build.

#### 3. 🟡 `.env.local` exclusion in `.dockerignore` is load-bearing — keep it
Good call listing `.env.local` / `.env.*.local` in Task 1. Note the host `.env.local` currently contains `VITE_API_BASE_URL=http://localhost:3001`. If it were copied into the build context, Vite could pick it up and shadow the intended `ARG` value (Vite env precedence between `.env.local` and `process.env` is a footgun). Excluding it removes the ambiguity entirely — this is correct and important, not just hygiene. Worth keeping the `.dockerignore` task ordered before / verified against the Dockerfile's `COPY . .`.

#### 4. 🟢 nginx.conf is minimal but adequate; optional hardening
The single `server` block with `try_files $uri $uri/ /index.html;` is correct for SPA routing and matches the COPY target (`conf.d/default.conf`, no `http{}` wrapper) — accurate. Given "Logging: minimal / Docs: no", omitting `gzip`, long-lived `Cache-Control` for hashed `/assets/`, and security headers is acceptable. Flagging only as future polish, not a gap.

#### 5. 🟢 Base image / build chain checks out
- `node:20-alpine` matches `"engines": { "node": ">=20" }`. ✓
- `npm run build` = `tsc -b && vite build`; `npm ci` installs `typescript` (devDep), so `tsc -b` resolves. ✓
- `index.html` lives at project root (Vite default) and is included by `COPY . .`. ✓
- Layer split (`COPY package*.json` → `npm ci` → `COPY . .`) is correct for cache reuse. ✓

---

### Positive Notes
- Correctly identifies `VITE_API_BASE_URL` as **build-time** (baked by Vite), not runtime — the single most common Dockerized-SPA mistake, avoided.
- Correctly scopes root-repo compose wiring (`HOST_WEB_PORT`, root `.env.example`) **out** of `mind_web`, consistent with the monorepo's per-repo boundary.
- nginx COPY target and `server{}`-vs-`http{}` distinction is precise.
- Explicitly leaves `vite.config.ts` and `src/` untouched, matching the note and the rules.
- Tasks carry an executable verify block and correct dependency ordering (Task 3 depends on 1 & 2).

---

### Verdict
The plan is well-structured and accurate on the SPA/Vite/nginx mechanics, but it **omits the single thing that makes the build fail**: the private `git+ssh` `observe-js` dependency needs `git` (+ SSH/token plumbing) inside the builder stage. Until Task 3 (or a new task) addresses the private-dependency install path, `npm ci` — and therefore the plan's own verify step — cannot succeed. Resolve Critical Issue #1 before implementation.

(No `PLAN_REVIEW_PASS` — blocking issue present.)
