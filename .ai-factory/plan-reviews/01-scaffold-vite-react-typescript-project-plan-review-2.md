# Plan Review 2 — Scaffold Vite + React + TypeScript

**Plan:** `01-scaffold-vite-react-typescript-project.md` (v2)
**Source spec:** `notes/02-scaffold-vite-react-typescript-project.md`
**Previous review:** `plan-review-1.md`

## Code Review Summary

**Files Reviewed:** 1 plan + spec note + ROADMAP + ARCHITECTURE + base rules
**Risk Level:** 🟢 Low

The v2 plan addresses every issue raised in plan-review-1. All five "Recommended Edits Before Implementation" have been folded in, the three hard-won constraints from the spec note (interactive TTY, no deprecated `@typescript-eslint/*` split, Node version floor) are preserved verbatim, and the new Preflight phase (Tasks 1–2) cleanly handles the pre-existing `node_modules/` that the v1 plan's Assumptions section missed. No blocking gaps remain.

### Context Gates

- **Architecture gate — PASS (WARN-free).** No `core/`, `pages/`, `components/` are created — that's correctly deferred to the next roadmap item ("Configure project structure and environment"). Nothing in the plan violates `.ai-factory/ARCHITECTURE.md` dependency rules.
- **Rules gate — PASS.** `.ai-factory/rules/base.md` respected: no custom CSS outside `index.css` (in fact `App.css` is deleted and `index.css` is emptied), no `console.log`, no `localStorage` access introduced, `mind_auth_token` untouched. TailwindCSS-only styling rule is not violated because no styling is added.
- **Roadmap gate — PASS.** Plan matches Phase 1's first item exactly. The ROADMAP/note discrepancy on `@typescript-eslint/*` is correctly resolved in favor of the note (Task 7), and the `index.css` emptying in Task 8 is forward-compatible with the next milestone's `@tailwind` directives.

---

### v1 Issues — Resolution Status

| v1 ID | Recommendation | v2 Status |
|-------|----------------|-----------|
| C1 | Reset `src/index.css` to empty for deterministic blank baseline | ✅ Fixed in Task 8 (explicit "truncate `src/index.css` to an empty file" with rationale) |
| C2 | Add `npm run lint` to verification | ✅ Fixed in Task 9 (lint + typecheck + build + dev, in order, "zero errors and zero warnings") |
| I1 | Add `"typecheck": "tsc --noEmit"` script | ✅ Fixed in Task 5 |
| I2 | Tighten `.gitignore` diff list (`dist-ssr`, `*.local`, `*.tsbuildinfo`, `node_modules/.cache`) | ✅ Fixed in Task 4 with explicit "do not deduplicate against broader patterns" note |
| I3 | Be explicit about setting `name` regardless of Vite's slugification | ✅ Fixed in Task 5 ("regardless of what Vite generated") |
| I4 | Precondition check for pre-existing `package.json` / `package-lock.json` / `node_modules/` | ✅ Fixed by new Task 2 ("Reset stale scaffold artifacts") |
| I5 | Reword to "left untouched by the scaffolder" | ✅ Fixed in Task 3 |

---

### Critical Issues

_None._

---

### Issues

_None blocking. Two minor notes below — neither warrants a v3._

---

### Nits

**N1. Task 2 leaves stale `node_modules/` if neither `package.json` nor `package-lock.json` is present.**
Current state on disk: `node_modules/` exists (≈ 120 packages including `react`, `vite`, `eslint`, `echarts`, `@tanstack`, `typescript`), but no `package.json` / `package-lock.json`. Task 2's wording — "If `package.json` or `package-lock.json` exist, delete both **and** delete `node_modules/`" — means with the current on-disk state, `node_modules/` will *not* be cleaned up (the trigger condition is false). `npm install` in Task 6 will then reconcile against the new `package.json` and the stale tree will mostly self-heal, but extras (packages no longer required) will linger until a future `npm prune`.

Not a blocker — `npm install` is correct against the new lockfile and the leftover packages are inert — but worth tightening to: "If `node_modules/` exists without a matching `package.json`, delete `node_modules/` as well." One-line change.

**N2. No global CWD note.**
Tasks 3, 6, 7, 9 implicitly assume CWD is `mind_web/`. Task 3 says "From inside `mind_web/`"; the rest don't. An agent invoked from the monorepo root could run Task 6 (`npm install …`) in the wrong directory. Recommend a one-line preamble: "All shell commands run from `mind_web/` unless stated otherwise." Cosmetic.

---

### Positive Notes

- Every v1 recommendation has a corresponding concrete edit in v2 — no hand-waving.
- New Task 2 directly addresses the on-disk drift I4 flagged, with an explicit "no-op if absent" branch and an explicit denylist of files NOT to touch (`CLAUDE.md`, `AGENTS.md`, `.ai-factory/`, `.claude/`, `.mcp.json`, `.idea/`, `.gitignore`, `src/`, `public/`). Hard to misinterpret.
- Task 9's four-stage verification (lint → typecheck → build → dev) is well-ordered: each stage's failure surface narrows the bug location (lint catches stray imports, typecheck catches type drift, build catches bundler issues, dev catches runtime). Each stage has explicit pass criteria.
- Task 8 spells out *every* default import to remove, including the easy-to-miss `useState`, and now also explicitly empties `index.css` with rationale.
- Phase structure (Preflight → Scaffold → Configure & install → Strip & verify) maps cleanly onto risk: preflight is reversible, scaffold is one-shot, configure is text-only, strip is text-only.
- Commit boundaries align with logical units and the Vite-template-name discussion is preempted (`"mind-web"` is set regardless of slugification).
- The plan correctly forward-anticipates the next milestone (TailwindCSS) — emptying `index.css` now means TailwindCSS setup can write directives without conflict.

---

PLAN_REVIEW_PASS
