# Plan Review: 04-configure-project-structure-and-environment

**Risk Level:** 🟢 Low

## Context Gates

- **ARCHITECTURE.md** — ✅ Aligned. Plan creates exactly the `src/core/{api,auth,types}/`, `src/pages/`, `src/components/` skeleton documented in `.ai-factory/ARCHITECTURE.md` (lines 17–46) and places `config.ts` directly under `src/core/` as specified.
- **RULES.md (`rules/base.md`)** — ✅ Aligned. Plan respects: env vars prefixed `VITE_`, `VITE_API_BASE_URL` as the single required var, `.env.local` gitignored, `.env.example` committed (lines 35–38 of `base.md`).
- **ROADMAP.md** — ✅ Aligned. Plan implements the unchecked Phase 1 item "Configure project structure and environment" verbatim (port `3002`, alias `@`, `paths` in `tsconfig.app.json` not root `tsconfig.json`).

## Recon Accuracy

All recon notes were verified against the working tree:
- `@types/node ^24.12.3` present in `devDependencies` ✓
- `.gitignore` excludes `.env.local` and `.env.*.local` ✓
- Root `tsconfig.json` contains only `references`; compiler options live in `tsconfig.app.json` ✓
- `tsconfig.app.json` already has `"types": ["vite/client"]` (typed `import.meta.env`) ✓
- `vite.config.ts` is minimal with `defineConfig` ✓
- `src/` contains only `App.tsx`, `index.css`, `main.tsx` ✓
- `package.json` has `"type": "module"` — ESM `fileURLToPath` form is the correct choice ✓

## Task-Level Findings

### Task 1 — Directory skeleton
No issues. `.gitkeep` placeholders are the standard idiom; skipping `.gitkeep` for `src/core/` is correct since `config.ts` will keep that directory tracked.

### Task 2 — `.env.local` / `.env.example`
No issues. Port `3002` matches the roadmap and the mind_api convention.

### Task 3 — `src/core/config.ts`
No issues. The proposed snippet is compatible with the strict flags already set in `tsconfig.app.json`:
- `verbatimModuleSyntax: true` — fine; no type-only imports involved.
- `erasableSyntaxOnly: true` — fine; no enums/namespaces.
- `noUnusedLocals: true` — `value` is used in both the guard and the export. ✓
- `import.meta.env.VITE_API_BASE_URL` is typed via `vite/client`'s `ImportMetaEnv` index signature, so the `as string | undefined` cast is correct.

### Task 4 — `vite.config.ts`
No issues. The `fileURLToPath(new URL('./src', import.meta.url))` form is the right choice under `"type": "module"`. The plan correctly preserves the existing `react()` plugin and `defineConfig` wrapper.

Minor nit (non-blocking): `import { fileURLToPath } from 'url'` is correct, but `'node:url'` is the more modern spelling. Either works.

### Task 5 — `tsconfig.app.json`
No issues. `paths` with `"moduleResolution": "bundler"` is supported. Adding `baseUrl: "."` and `paths: { "@/*": ["src/*"] }` to `compilerOptions` is correct. Not touching root `tsconfig.json` (references-only) is the right call.

### Task 6 — Verification
**WARN (non-blocking):** The claim that "the alias is exercised by `typecheck` against `config.ts`'s own resolution and by Vite's resolver during `build`" is slightly inaccurate:
- `tsc --noEmit` over `src/` will compile `config.ts`, but `config.ts` itself does not import via `@`, so the alias mapping is not actually exercised by the type checker.
- `vite build` tree-shakes `config.ts` (nothing imports it yet), so Vite's resolver also will not exercise the alias during build.

The plan's instinct to avoid a "throwaway import in `App.tsx`" is good, but the verification step is effectively only structural: it confirms the config files parse without errors, not that `@/core/config` actually resolves. End-to-end resolution will first be proven by the next roadmap task ("Configure React Router and page shells") when stub pages import via `@`. This is acceptable for this plan's scope.

## Commit Plan

Reasonable split. Commit 1 (tasks 1–3) leaves the working tree in a state where `config.ts` exists but is unreferenced — that compiles cleanly, so the commit is independently buildable. Commit 2 (tasks 4–6) finishes the alias wiring.

## Critical Issues
None.

## Positive Notes
- Excellent recon discipline — every assumption (Node typings, `.gitignore`, tsconfig project-references layout, `"type": "module"`) was verified against the actual repo and cited explicitly.
- Correctly identifies `tsconfig.app.json` (not root `tsconfig.json`) as the home for `paths`/`baseUrl`, avoiding a common pitfall with the modern Vite template.
- Fail-fast assertion in `config.ts` matches `ARCHITECTURE.md` line 26 ("reads VITE_API_BASE_URL, startup assertion").
- ESM-safe `fileURLToPath` choice over `resolve(__dirname, ...)` correctly avoids CJS interop hacks under `"type": "module"`.
- Commits are scoped to logical units and leave the tree in a buildable state between them.

PLAN_REVIEW_PASS
