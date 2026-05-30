# Code Review 1 — Scaffold Vite + React + TypeScript

**Plan:** `.ai-factory/plans/01-scaffold-vite-react-typescript-project.md`
**Scope reviewed:** the working-tree changes shown by `git diff HEAD` / `git status` against `ba63989` (initial commit) — 18 added/modified files.

## Summary

Risk level: 🟡 Medium

The core scaffold is correct and the milestone acceptance gates (lint, typecheck, build, dev) all pass cleanly under Node 24 (`vite v8.0.14 ready in 198 ms`, `built in 183ms`, zero lint warnings, zero TS errors). The three hard constraints from `notes/02-scaffold-vite-react-typescript-project.md` were respected — `.ai-factory/`, `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.mcp.json`, `.idea/`, `.gitignore` are all intact; no deprecated `@typescript-eslint/*` split packages were installed; `src/App.tsx` was correctly reduced to the minimal blank component with no leftover imports; `src/index.css` was truncated to empty for a deterministic blank baseline.

Two real issues exist, both in `public/` + `index.html`: an unrelated icon sprite was added that has no business being in this project, and `index.html` was modified in ways the plan explicitly forbade — including a title change that conflicts with the next milestone's stated requirement.

---

## Critical Issues

### C1. `public/icons.svg` is an unrelated Bluesky icon sprite — should be deleted

`public/icons.svg` (24 lines) defines an SVG `<symbol id="bluesky-icon">` containing the Bluesky logo. Nothing in this project references it (`grep -rn "icons.svg" src/ index.html` returns no matches), it is unrelated to the dashboard's domain (breathing sessions, EEG, NFB calibration), and it was not produced by `create-vite` — the template only ships `public/vite.svg`.

This file is dead weight that will be copied into every `dist/` build. It appears to be cross-contamination from another project (perhaps a previous scratch dir). Plan Task 8 explicitly lists `public/vite.svg` as the only file to delete from `public/`; no addition is sanctioned.

**Fix:** Delete `public/icons.svg`. Confirm no source file imports it (already verified — none does).

### C2. `index.html` was modified, violating plan Task 8 "leave `index.html`…untouched"

`index.html` contains two unauthorized edits versus the Vite-generated default:

1. `<title>` changed from the template default `Vite + React + TS` → `Mind Web`.
2. `<link rel="icon" type="image/svg+xml" href="/vite.svg" />` changed to `href="/favicon.svg"`.

Plan Task 8 ends with: _"Leave `src/main.tsx`, `src/vite-env.d.ts`, **`index.html`**, `eslint.config.js`, `vite.config.ts`, and all `tsconfig*.json` files untouched."_ Both edits violate this.

The title change is also forward-incompatible: the very next ROADMAP item (`Configure TailwindCSS`) explicitly says _"Replace `index.html` title with `Mind`"_. The current value (`Mind Web`) is neither the template default this milestone should ship nor the value the next milestone will overwrite — it's a third choice that creates churn in the next plan-review.

**Fix:** Restore `index.html` to the Vite template defaults. Either:
- Re-run the template's `index.html` content (title `Vite + React + TS`, `href="/vite.svg"`), then accept that the next milestone will set the title to `Mind` and reintroduce the favicon; OR
- If the favicon swap is intentional project branding for this milestone, add a "Customize index.html title and favicon" sub-task to the plan and call out the conflict with the next milestone's title directive.

---

## Issues

### I1. `public/favicon.svg` is out-of-scope for this milestone

`public/favicon.svg` (1 line, a purple star/logo glyph — apparently Mind branding) was added without being in the plan. The plan only contemplated deleting `public/vite.svg`. This is paired with the `index.html` icon-link change in C2.

It is harmless at runtime (it's a real Mind logo, referenced from `index.html`, served correctly), but it is plan drift — the file was not authorized by any plan task and was not present in the initial commit (`git log --all -- public/favicon.svg` returns nothing). Either remove it (and revert C2's icon-link change) or fold both into a sanctioned plan task.

### I2. Installed React 19 / TypeScript 6 / Vite 8 / ESLint 10 diverge from documented stack

`package.json` ships:
- `react@^19.2.6`, `react-dom@^19.2.6`
- `typescript@~6.0.2`
- `vite@^8.0.12`
- `eslint@^10.3.0`, `typescript-eslint@^8.59.2`
- `react-router-dom@^7.16.0`

`mind_web/CLAUDE.md` ("Tech Stack: React 18 + Vite + TypeScript…") and `.ai-factory/DESCRIPTION.md` ("React 18 + Vite") both say React 18, and `mind` repo's coordination CLAUDE.md likewise. The plan did not pin versions, so this is template-driven — `create-vite@9` now ships React 19. The milestone still meets its acceptance gates, but:

- React 19 has breaking changes vs 18 that will affect later work: removed `defaultProps` for function components, `act()` is now in `react` (not `react-dom/test-utils`), the new `use` hook, stricter Suspense reveal behavior, removed `propTypes`. The Sessions/Charts pages later in the roadmap may need React-19-aware patterns.
- React Router 7 has its own breaking changes vs the v6 the project docs and ROADMAP assume (e.g. `createBrowserRouter` API is stable but loaders/actions semantics shifted; CLAUDE.md says "React Router v6"). The "Configure React Router and page shells" milestone is written against v6 expectations.

Not a blocker for this milestone. Two reasonable resolutions, either of which should happen before the next milestone starts:
- (a) Update the docs (`CLAUDE.md`, `DESCRIPTION.md`, root coordination doc) to reflect the actually-installed major versions and re-spec downstream milestones accordingly.
- (b) Downgrade to React 18 + React Router 6 + matching `@types/react@^18` + `@types/react-dom@^18` to match the docs.

This is a project-direction question, not a bug — flag for the human to decide.

### I3. `@types/node` is in `devDependencies` already, slightly ahead of plan

`package.json` shows `"@types/node": "^24.12.3"` under `devDependencies`. The plan never installs it; the next milestone ("Configure project structure and environment") plans to install it via `npm install -D @types/node` for `import { resolve } from 'path'` in `vite.config.ts`. It's already there because the Vite 8 react-ts template now includes it (`tsconfig.node.json` has `"types": ["node"]`).

No action needed — this is template-driven and the next milestone's task just becomes a no-op. Worth a one-line note when that milestone's plan is written so the agent doesn't redundantly run `npm install -D @types/node` and bump the version.

---

## Positive Notes

- All four acceptance gates (`npm run lint`, `npm run typecheck`, `npm run build`, `npm run dev`) pass cleanly under Node 24.13.1 — no errors, no warnings, dev server reaches `ready in 198 ms`, production build emits 16 modules and ~190 kB JS.
- `src/App.tsx` is exactly the four-line spec from constraint #4: no `useState`, no `App.css` import, no asset imports — the easy-to-miss case the prior plan-review failures were predicated on.
- `src/index.css` is empty (0 bytes confirmed), so the dark `#242424` background from the Vite template default is gone — the deterministic-blank fix from plan-review-1 was applied correctly.
- `.gitignore` reconciliation is clean: appended `dist-ssr`, `*.local`, `*.tsbuildinfo`, `node_modules/.cache` under a `# Vite` section without reordering pre-existing entries (verified with `git diff HEAD -- .gitignore`).
- `eslint.config.js` uses the unified `typescript-eslint` package via `tseslint.configs.recommended`, not the deprecated `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` split — constraint #2 respected.
- `package.json` correctly sets `"name": "mind-web"`, `"engines": { "node": ">=20" }`, and adds `"typecheck": "tsc --noEmit"`; all other Vite-generated fields are untouched.
- Project metadata directories (`CLAUDE.md`, `AGENTS.md`, `.ai-factory/`, `.claude/`, `.mcp.json`, `.idea/`) were preserved — the "Ignore files and continue" path through the scaffolder worked as planned.
- `vite.config.ts` is minimal and template-default — no premature `resolve.alias` config that would belong in the next milestone.

---

## Required Actions Before Merge

1. **Delete `public/icons.svg`** — unrelated artifact (C1).
2. **Decide on `index.html` + `public/favicon.svg`** — either revert both to template defaults (C2 + I1) or amend the plan to sanction the favicon swap and resolve the `Mind Web` vs `Mind` title conflict with the next milestone.
3. **Resolve the React 19 / Router 7 / TS 6 divergence from docs** (I2) — either update docs or downgrade. Not strictly required for this milestone to land, but the decision should be made before the next plan is written.