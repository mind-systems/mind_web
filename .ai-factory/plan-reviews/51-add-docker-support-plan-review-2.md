# Plan Review 2: Add Docker support (51)

## Code Review Summary

**Files Reviewed:** plan `51-add-docker-support.md` + targets (`package.json`, `package-lock.json`, `vite.config.ts`, `.gitignore`, `.env.example`, `.env.local`, `src/core/config.ts`, note `44-docker-support.md`, `ROADMAP.md`) + prior review `…-plan-review-1.md`
**Risk Level:** 🟢 Low — the blocking issue from review #1 is fully resolved; only minor hardening notes remain.

### Context Gates
- **Architecture** (`ARCHITECTURE.md` present): No boundary or dependency-rule impact — pure infra addition, no `src/` changes. PASS.
- **Rules** (`.ai-factory/RULES.md` absent; `CLAUDE.md` + `rules/base.md` present): Plan respects all rules — no `vite.config.ts` change, no `src/` change, no proto touch, no `mind_auth_token` rename, no raw `fetch`. PASS.
- **Roadmap** (`ROADMAP.md` present): Maps directly to **Phase 25 — Docker deployment / "Add Docker support"** (line 169), with explicit spec linkage to `notes/44-docker-support.md`. PASS.

---

### Resolution of Review #1

The single blocking issue from review #1 — `npm ci` failing because `observe-js` is a private **git+ssh** dependency on a `git`-less, key-less `node:20-alpine` — is now fully addressed:

- ✅ Builder stage installs `git` + `openssh-client` (`apk add --no-cache`).
- ✅ `ssh-keyscan github.com >> ~/.ssh/known_hosts` seeds the host key, avoiding the interactive host-key prompt.
- ✅ `RUN --mount=type=ssh npm ci` forwards the agent socket, keeping no secret in any layer.
- ✅ Verify block uses `DOCKER_BUILDKIT=1 docker build --ssh default …`.
- ✅ Cross-repo implication (root compose needs `ssh: [default]` + `args: VITE_API_BASE_URL`) is explicitly flagged and correctly scoped **out** of `mind_web`.
- ✅ PAT-secret fallback documented (not implemented) with a correct `insteadOf` rewrite — the lockfile pins `git+ssh://git@github.com/…`, so npm strips `git+` to `ssh://git@github.com/…`, which matches the rewrite key exactly.
- ✅ Review #1's non-blocking points #2 (build-time `test -n "$VITE_API_BASE_URL"` assertion) and #3 (`.env.local` exclusion as load-bearing) are both folded in.

I independently re-verified the lockfile (`package-lock.json:2911` → `git+ssh://git@github.com/mind-systems/observe-js.git#a42a85c…`) and the host `.env.local` (`VITE_API_BASE_URL=http://localhost:3001`) — both match the plan's claims.

---

### Critical Issues
None.

---

### Non-Blocking Notes

#### 1. 🟡 Add a `# syntax=docker/dockerfile:1` directive
`RUN --mount=type=ssh` and `--mount=type=secret` are Dockerfile-frontend features. Modern Docker Engine with BuildKit generally accepts them via the built-in frontend, but pinning `# syntax=docker/dockerfile:1` as the **first line** of the Dockerfile guarantees the frontend that supports these mounts is used across all Docker versions a deployer might have. Cheap insurance; recommend adding it.

#### 2. 🟢 `.dockerignore` excludes `.git` — confirmed harmless
The build clones `observe-js` fresh over SSH; it does not need the host repo's `.git`. Excluding it is correct and keeps the context small. No conflict with the private-dependency install path.

#### 3. 🟢 Vite env precedence — the `.env.local` exclusion is the right call regardless
There is no committed `.env`, `.env.production`, or `.env.production.local`, so once `.env.local` is excluded from the build context the only `VITE_API_BASE_URL` source is the injected `ARG`. This sidesteps Vite's `.env.local`-vs-`process.env` precedence entirely — correct.

#### 4. 🟢 Optional nginx polish (future, not a gap)
Given "Logging: minimal / Docs: no", omitting `gzip`, long-lived `Cache-Control` for hashed `/assets/`, and security headers is acceptable. The bare `server { … }` block with `try_files $uri $uri/ /index.html;` is correct for the `conf.d/default.conf` COPY target (no `http {}` wrapper). Future polish only.

---

### Positive Notes
- Correctly keeps `VITE_API_BASE_URL` build-time (Vite-baked), not runtime — the most common Dockerized-SPA mistake, avoided.
- `node:20-alpine` matches `"engines": { "node": ">=20" }`; `npm ci` installs `typescript` devDep so `tsc -b` in `npm run build` resolves.
- Layer split (`COPY package*.json` → `npm ci` → `COPY . .`) preserves cache; `node_modules` dockerignore prevents the host copy from shadowing the SSH-cloned `observe-js`.
- Fail-fast build-arg assertion prevents a silently-broken bundle that would only throw in the user's browser.
- Task dependency ordering (Task 3 depends on 1 & 2) and the executable verify block are correct.
- Root-repo compose wiring correctly scoped out, consistent with the monorepo's per-repo boundary.

---

### Verdict
The plan is accurate, implementable, and fully resolves the prior blocking issue. The remaining items are optional hardening (notably the `# syntax` directive), none of which prevent a successful build.

PLAN_REVIEW_PASS
