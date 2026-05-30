# Plan Review 1 — Scaffold Vite + React + TypeScript

**Plan:** `01-scaffold-vite-react-typescript-project.md`
**Source spec:** `notes/02-scaffold-vite-react-typescript-project.md`

## Summary

**Risk Level:** 🟡 Medium

The plan faithfully implements the spec note and correctly captures the three hard-won constraints (no `--overwrite`, no deprecated `@typescript-eslint/*` split packages, Node ≥ 20.19/≥ 22.12). Phasing, dependency order, and commit boundaries are sensible. Two real gaps would cause Task 8 verification to fail or leave the next milestone with an incorrect baseline: the default Vite `index.css` does not produce a "blank white page", and the acceptance check relies on `npm run dev` for what is fundamentally a lint-time concern.

### Context Gates

- **Architecture gate — PASS.** No structural work happens in this milestone (no `core/`, `pages/`, `components/` creation). That work is correctly deferred to the next roadmap item ("Configure project structure and environment"). The plan creates nothing that violates `.ai-factory/ARCHITECTURE.md` dependency rules.
- **Rules gate — PASS.** `.ai-factory/rules/base.md` is respected: `App.css` is removed (custom CSS only allowed in `index.css`), no `console.log` added, no `localStorage` access outside `core/auth` (none added at all yet), `mind_auth_token` constant is untouched.
- **Roadmap gate — PASS.** Matches Phase 1 first item exactly. The plan also calls out the ROADMAP/note discrepancy on `@typescript-eslint/*` and resolves in favor of the note — correct.

---

## Critical Issues

### C1. "Blank white page" acceptance is incorrect — default Vite `index.css` renders dark background

Task 8 verification step 2 says: _"The browser shows a blank white page — no broken-image icons, no React error overlay."_

Task 7 explicitly preserves `src/index.css` untouched. The default `create-vite react-ts` template's `src/index.css` sets:

```css
:root {
  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;
}
```

So with a dark-mode system preference (and on most CI/dev machines), the page will render **dark gray (#242424)**, not white. With light-mode preference it switches to white via `@media (prefers-color-scheme: light)`. The criterion as written is non-deterministic and will fail on a dark-mode machine.

**Fix:** Loosen the criterion to "renders a blank page (color depends on system color-scheme preference)" OR — better — also reset `src/index.css` to an empty file in Task 7. The next milestone (TailwindCSS setup) will overwrite `index.css` with `@tailwind` directives anyway, so emptying it now costs nothing and gives a deterministic baseline.

### C2. Acceptance check uses `npm run dev` to detect a lint-time problem

Task 7's stated motivation for stripping `useState` is: _"Leaving `useState` behind triggers an unused-import lint warning that violates the 'no warnings' acceptance criterion."_

Task 8 then verifies by running `npm run dev` and watching the **browser DevTools console**. The browser DevTools console does not show ESLint warnings — Vite's dev server doesn't run ESLint by default. A leftover unused import would compile and run silently; the verification would pass even if the cleanup were incomplete.

**Fix:** Add an explicit `npm run lint` step to Task 8 (or insert a Task 7.5). The plan already promises ESLint will be in place (`eslint.config.js`, `eslint` in devDependencies); use it.

---

## Issues

### I1. `npm run typecheck` is referenced in `CLAUDE.md` but the plan never adds the script

`mind_web/CLAUDE.md` lists `npm run typecheck` (→ `tsc --noEmit`) as a project command. The default `create-vite react-ts` template only generates `dev`, `build`, `lint`, `preview`. The plan says "Leave all other Vite-generated fields untouched" — so `typecheck` will not exist after this milestone.

This is a small mismatch between docs and reality. Options:
- Add `"typecheck": "tsc --noEmit"` to `scripts` in Task 4, OR
- Punt to a later milestone and accept the doc drift for now (mention in review of next milestone).

Recommend option 1 — one-line addition, removes friction immediately, and adds a second verification surface for Task 8.

### I2. `.gitignore` reconciliation diff list is incomplete

Task 3 lists "typical additions: `node_modules`, `dist`, `dist-ssr`, `*.local`, `.vite`, `*.log`, editor caches". The existing `.gitignore` already covers `node_modules/`, `dist/`, `.vite/`, `*.log`, `.idea/`, `.vscode/`, `.env.local`, `.env.*.local`.

After diffing, the actual additions from Vite's default will likely be:
- `dist-ssr` ← genuinely missing
- `*.local` ← broader than existing `.env.local` / `.env.*.local`; deduplication needed
- `node_modules/.cache` ← may be in Vite default
- `*.tsbuildinfo` ← Vite default ships this

Plan wording is fine ("append only missing lines") but the parenthetical list under-specifies. Not blocking — the executing agent will diff the actual files — but worth tightening so the agent does not skip `*.tsbuildinfo`.

### I3. Vite-generated `package.json` "name" handling

With `npm create vite@latest . -- --template react-ts`, the scaffolder takes the project name from the directory name (here `mind_web` → likely `"mind_web"` or `"mind-web"` depending on Vite's slugification). Task 4 sets it to `"mind-web"`. Either way, the result is the same — fine — but it's worth being explicit that the agent should set it regardless of what Vite generates, so a transient Vite behavior change does not cause the agent to skip the step.

### I4. Pre-existing `node_modules/` in the target directory

`mind_web/node_modules/` already exists (≈ 120 entries including `echarts`, `@tanstack`, `vite`, `eslint`). The plan's "Assumptions" section says the directory contains only project metadata; that no longer matches reality. This may be leftover from an earlier scaffold attempt.

Consequences for the plan:
- `npm create vite@latest .` will detect the non-empty dir and prompt — handled.
- "Ignore files and continue" will skip files that exist; for `node_modules/` and any pre-existing `package.json`/`package-lock.json` this may produce a stale lockfile.
- Task 5's `npm install` will reconcile against whatever `package.json` Vite writes, but a pre-existing lockfile or `node_modules` from a different `package.json` is a known source of resolution drift.

**Fix:** Before Task 2, add a precondition check: if `package.json` or `package-lock.json` exists in `mind_web/`, the agent should either (a) confirm they match what Vite would produce or (b) delete them (but **not** `node_modules` blindly — and definitely not the metadata files). Safest minimal addition: `rm -rf node_modules package-lock.json` before Task 2 if either exists, then let Task 5 rebuild from scratch.

### I5. Task 2 says "leave `.gitignore` untouched", Task 3 then modifies it

Task 2 instructions say Vite's "Ignore files and continue" leaves "every pre-existing file (including `.gitignore`) is left untouched." Task 3 then appends missing lines to `.gitignore`. The two are consistent (Task 3 is the explicit reconciliation step), but on first read Task 2's wording implies finality. Cosmetic — consider rewording Task 2 to "left untouched **by the scaffolder**".

---

## Positive Notes

- The three hard constraints from the spec note (interactive scaffolder, no deprecated ESLint packages, Node version floor) are reproduced verbatim — these caused two prior plan-review failures and the plan author clearly absorbed that lesson.
- Explicit dependency order with `(depends on Task N)` annotations.
- Commit boundaries are sensible and align with logical units (scaffold / deps + metadata / boilerplate strip).
- Task 7 enumerates every default import to remove, including the easy-to-miss `useState` — exactly matching constraint #4 of the note.
- Plan correctly identifies the ROADMAP/note conflict on `@typescript-eslint/*` and resolves in favor of the note.
- Phase structure (Preflight → Scaffold → Configure & install → Strip & verify) is clean and reflects the actual risk gradient.

---

## Recommended Edits Before Implementation

1. **Task 7:** also reset `src/index.css` to empty (or accept dark background in Task 8 acceptance).
2. **Task 8:** add `npm run lint` (and ideally `npm run build`) as verification steps; do not rely on the browser console alone.
3. **Task 4:** add `"typecheck": "tsc --noEmit"` to `scripts` so `CLAUDE.md`'s documented commands all work after this milestone.
4. **Task 2 (preamble):** add a precondition — if `package.json` or `package-lock.json` already exists in `mind_web/`, delete them (and `node_modules/`) before running the scaffolder, since the directory state has drifted from the plan's "Assumptions" section.
5. **Task 3:** tighten the "typical additions" list to explicitly include `dist-ssr`, `*.local`, `*.tsbuildinfo`.

None of these are individually scaffold-breaking, but C1 + C2 mean the Task 8 acceptance gate would not actually verify the things it claims to verify. Worth addressing in a v2 of the plan before implementation.
