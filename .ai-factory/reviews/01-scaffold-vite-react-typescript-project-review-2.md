# Code Review 2 — Scaffold Vite + React + TypeScript

**Plan:** `.ai-factory/plans/01-scaffold-vite-react-typescript-project.md`
**Prior review:** `.ai-factory/reviews/01-scaffold-vite-react-typescript-project-review-1.md`
**Scope reviewed:** the working-tree changes shown by `git diff HEAD` / `git status` against `ba63989` (initial commit) — 17 scaffold files plus `.ai-factory/` artifacts.

## Summary

Risk level: 🟢 Low

Review-1's two critical issues are resolved. `public/icons.svg` (the unrelated Bluesky icon sprite) has been deleted — only `public/favicon.svg` remains in `public/`. `index.html`'s `<title>` has been restored to the Vite template default `Vite + React + TS`, eliminating the `Mind Web` vs `Mind` collision with the next milestone's directive.

All four acceptance gates pass cleanly under Node 24.13.1: `npm run lint` (zero errors, zero warnings), `npm run typecheck` (zero TS errors), `npm run build` (`vite v8.0.14 ... ✓ built in 178ms`, 16 modules → `dist/index.html` 0.46 kB + `dist/assets/*` 190.43 kB JS + 0.00 kB CSS), `npm run dev` (`ready in 198 ms` on `http://localhost:5173/`).

Two carry-forward notes from review-1 (I2, I3) remain as documentation / project-direction items, neither of which blocks this milestone or introduces a runtime defect.

---

## Resolved from review-1

- **C1 (deleted).** `public/icons.svg` no longer exists. `public/` now contains only `favicon.svg` (verified `ls public/`).
- **C2 (title restored).** `index.html` line 7 reads `<title>Vite + React + TS</title>` — the Vite template default. The next milestone's `Replace index.html title with Mind` instruction now applies to a known baseline.
- **I1 (resolved by consistency).** `public/favicon.svg` (Mind logo glyph, 9 522 bytes) remains, and `index.html` line 5 still references it via `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`. This is a reasonable resolution of an internal plan contradiction — Task 8 deletes `public/vite.svg`, and leaving the default `<link rel="icon" href="/vite.svg" />` untouched would produce a 404 in the dev server console (violating the "no warnings" acceptance criterion). The implementer kept the icon-link change and the matching asset rather than dropping the link entirely. The pair is internally consistent; downstream milestones can leave it in place or replace as desired.

## Carry-forward notes (non-blocking)

### N1. React 19 / React Router 7 / TypeScript 6 / Vite 8 still diverge from docs

`package.json` ships React 19.2.6, React Router 7.16.0, TypeScript 6.0.2, Vite 8.0.12, ESLint 10.3.0 — driven by `create-vite@9`'s current `react-ts` template. `mind_web/CLAUDE.md` and `.ai-factory/DESCRIPTION.md` still document "React 18 + Vite" and "React Router v6". The milestone's acceptance criteria are met regardless, but downstream milestones written against React 18 / Router v6 semantics (`Configure React Router and page shells`, the Sessions/Charts work) will need either an API/version reconciliation or a docs update before they're planned. Flagging as a project-direction question, not a defect in this milestone.

### N2. `@types/node` already in devDependencies

The Vite 8 template now includes `@types/node@^24.12.3` via `tsconfig.node.json`'s `"types": ["node"]`. The next milestone (`Configure project structure and environment`) plans to install it via `npm install -D @types/node`; that step is now a no-op. Worth a single sentence in that milestone's plan so the agent doesn't bump the pin redundantly.

---

## Verification (Node 24.13.1)

| Gate | Result |
|------|--------|
| `npm run lint` | clean — zero errors, zero warnings |
| `npm run typecheck` | clean — zero TS errors |
| `npm run build` | `✓ built in 178ms`, 16 modules, `dist/index.html` 0.46 kB, JS 190.43 kB, CSS 0.00 kB |
| `npm run dev` | `VITE v8.0.14 ready in 198 ms` on `http://localhost:5173/` |

## Final read on each delivered file

- `src/App.tsx` — exactly the four-line spec from constraint #4. No `useState`, no asset imports, no `App.css` import.
- `src/index.css` — empty (0 bytes), as required by Task 8 for the deterministic blank-page baseline.
- `src/main.tsx` — Vite template default, unchanged.
- `package.json` — `"name": "mind-web"`, `"engines": { "node": ">=20" }`, `"scripts.typecheck": "tsc --noEmit"` added; runtime deps (`react-router-dom`, `@tanstack/react-query`, `echarts`, `echarts-for-react`) installed; ESLint uses unified `typescript-eslint`, not the deprecated split packages.
- `.gitignore` — appended `dist-ssr`, `*.local`, `*.tsbuildinfo`, `node_modules/.cache` under a `# Vite` section; pre-existing entries preserved without reordering.
- `eslint.config.js`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — Vite template defaults, unchanged.
- `index.html` — template default `<title>`; icon link points at the in-tree `favicon.svg` (consistent with `public/` contents).
- `public/favicon.svg` — Mind project logo, referenced from `index.html`; no dangling references.
- Project metadata (`CLAUDE.md`, `AGENTS.md`, `.ai-factory/`, `.claude/`, `.mcp.json`, `.idea/`) untouched.

REVIEW_PASS
