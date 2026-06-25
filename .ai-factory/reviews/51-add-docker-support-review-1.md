# Code Review: Add Docker support (51) — Review 1

## Scope
Code changes reviewed (the only files that are runnable artifacts; the rest of the diff is `.ai-factory/` plan/note/roadmap docs):
- `Dockerfile` (new)
- `nginx.conf` (new)
- `.dockerignore` (new)

Cross-referenced: `package.json`, `package-lock.json`, `src/core/config.ts`, `vite.config.ts`, `.gitignore`, `.env.example`, the plan, and plan-review 1.

## Verification performed

**1. Private `observe-js` build blocker (the headline risk from plan-review 1) — RESOLVED correctly.**
- `package.json:19` → `git+https://github.com/...`; `package-lock.json:2911` pins `git+ssh://git@github.com/mind-systems/observe-js.git`, so `npm ci` clones over SSH.
- `Dockerfile` installs `git openssh-client` (line 16), pre-seeds `known_hosts` via `ssh-keyscan github.com` (line 21), and runs `RUN --mount=type=ssh npm ci` (line 28) with the `# syntax=docker/dockerfile:1` directive (line 1) enabling the SSH mount. `npm ci` runs as root (no `USER` switch), which matches the default uid-0 owner of the BuildKit SSH mount, so the agent socket is readable. Chain is sound.

**2. `ARG VITE_API_BASE_URL` → bundle inlining — correct.**
- Docker exposes an in-stage `ARG` as an environment variable to subsequent `RUN` shells, so both the `test -n "$VITE_API_BASE_URL"` guard (lines 11–12) and `vite build` see the value.
- Vite's `loadEnv` (Vite 8, `^8.0.12`) merges `process.env` keys matching the `VITE_` prefix into `import.meta.env`, prioritized over `.env` files — so the build arg reaches `src/core/config.ts` (`import.meta.env.VITE_API_BASE_URL`). No `src/`/`vite.config.ts` change needed, as planned.

**3. Build-time guard complements the runtime-only assertion — good catch.**
- `src/core/config.ts` throws only at browser module-load (Vite bundles, it does not execute), so a missing arg would otherwise ship a silently-broken image. The Dockerfile `test -n` guard (lines 11–12) converts that into a build failure. Correct fix for plan-review item #2.

**4. `node_modules` shadowing avoided.**
- `.dockerignore` excludes `node_modules/` (line 3), so `COPY . .` (Dockerfile line 30) cannot overwrite the freshly installed, SSH-cloned `node_modules`. `npm run build` (`tsc -b && vite build`) resolves because `npm ci` installs devDeps (no `--omit=dev`).

**5. nginx SPA config — correct.**
- Bare `server { … }` block (no `http{}` wrapper) matching the `COPY nginx.conf /etc/nginx/conf.d/default.conf` target (Dockerfile line 40); `try_files $uri $uri/ /index.html;` resolves client-side routes on refresh/direct-nav. `nginx.conf` is not matched by any `.dockerignore` pattern, so it is present in the build context for the production-stage `COPY`.

**6. Secret hygiene — clean.**
- No secret is persisted in any image layer: SSH via runtime mount, PAT fallback via `--mount=type=secret`. Production stage is `nginx:alpine` serving only `dist/` — no source, no `node_modules`, no `.git` (excluded by `.dockerignore`).

## Non-blocking observations (optional polish — no action required)

- **`.dockerignore:4` `node_modules/.cache` is redundant** — already covered by `node_modules/` on line 3. Cosmetic only.
- **`ssh-keyscan` is trust-on-first-use** (Dockerfile line 21) — it fetches GitHub's current host keys at build time rather than pinning them. Acceptable for this deploy path; pinning the known GitHub key fingerprints would be marginally stricter. Informational.
- **Plan rationale nuance (not a code issue):** the `.env.local` exclusion is framed as preventing the build arg from being shadowed, but in Vite's `loadEnv` the prefixed `process.env` value actually takes priority over `.env` files. Excluding `.env.local` is still correct hygiene (keeps local config/secrets out of the context) — the exclusion is right, only the stated precedence reasoning is slightly inverted.

## Verdict
No bugs, security issues, or correctness problems. The blocking issue from plan-review 1 (private `git+ssh` dependency) is fully and correctly addressed, the ARG→Vite→runtime chain is sound, and the SPA nginx config is right. The three observations above are optional polish, not defects.

REVIEW_PASS
