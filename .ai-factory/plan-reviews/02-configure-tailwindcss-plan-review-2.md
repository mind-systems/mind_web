# Plan Review 2 — Configure TailwindCSS

**Plan:** `02-configure-tailwindcss.md` (v2)
**Source spec:** `notes/03-tailwindcss-v3-setup.md`
**Roadmap item:** Phase 1 — "Configure TailwindCSS"

## Plan Review Summary

**Files Reviewed:** plan v2 + spec note + ROADMAP + base rules + on-disk state (`package.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `vite.config.ts`)
**Risk Level:** 🟢 Low

V2 cleanly resolves every concern from review 1. The ESM-vs-CJS reconciliation is now explicit in Task 2 (with both the rewrite form and the `.cjs` rename as an acceptable alternative), Task 6's verification was replaced with a deterministic post-build grep, the `App.tsx` transient edit was dropped, and a "All shell commands run from `mind_web/`" preamble was added at the top of Tasks. On-disk facts the plan relies on still hold: `package.json` line 5 declares `"type": "module"`, `src/index.css` is empty (1 line), `src/main.tsx` line 3 imports `./index.css`, `index.html` line 7 has the Vite default title, `src/App.tsx` is `<div />`, `vite.config.ts` has no Tailwind wiring.

### Context Gates

- **Architecture gate — PASS.** Touches only project-root config (`tailwind.config.js`, `postcss.config.js`), `index.html`, and `src/index.css`. No `core/`, `pages/`, or `components/` files; no dependency-rule violations from `.ai-factory/ARCHITECTURE.md`.
- **Rules gate — PASS.** `.ai-factory/rules/base.md`: TailwindCSS-only styling rule is what this milestone *establishes* (no custom CSS beyond the three directives); no `console.log`, no `localStorage`, no `mind_auth_token` rename, no `VITE_*` env changes.
- **Roadmap gate — PASS.** Matches Phase 1's second item — v3 pin, three separate directives, both content globs, title rename. The roadmap's stated acceptance ("a `className="text-blue-500"` element renders in the correct color") is replaced by an equivalent build-artifact check (preflight + `--tw-` markers in `dist/assets/*.css`); the plan correctly notes this is implicit equivalence rather than the literal roadmap wording.

---

### Critical Issues

_None._

---

### Issues

_None._

---

### Nits

**N1. Task 6's grep depends on Vite's default minified-CSS output naming.**
`grep -E 'box-sizing:border-box|--tw-' dist/assets/*.css` assumes Vite emits at least one `.css` file under `dist/assets/`. With a current `src/App.tsx` of `<div />` and no other imports, Vite still emits the CSS bundle from `src/index.css` (imported by `main.tsx`), so a `dist/assets/*.css` glob will resolve. The `box-sizing:border-box` substring from Tailwind v3 preflight survives esbuild minification as a literal — so the OR with `--tw-` is belt-and-suspenders (good). If the glob ever resolves to zero files (e.g., future refactor extracts CSS differently), the grep exits 1 with "No such file or directory" rather than "no match," which still surfaces as a failure. No change required; calling out for awareness.

**N2. Task 5 dependency is technically over-stated.**
Task 5 (title rename in `index.html`) is marked `depends on Task 2`. The title edit has no real dependency on Tailwind at all — it could ship independently. Bundling it into this milestone is fine for commit hygiene, but the dependency annotation is cosmetic. Non-blocking.

**N3. The "either form is acceptable" clause in Task 2 leaves the agent a coin flip.**
Task 2 lets the agent pick between ESM rewrite and `.cjs` rename, with "ESM rewrite is preferred for consistency." Agents handle a single instruction more reliably than a preference between two paths. If you want determinism, drop the alternative and say "rewrite to ESM `export default { … }`." Current wording is still safe — both branches produce a working build — so this is a style nit, not a correctness issue.

---

### Positive Notes

- I1 from review 1 is fully closed: Task 2 now spells out the failure mode (`ReferenceError: module is not defined in ES module scope`), the trigger (`"type": "module"` at `package.json:5`), the inspection step (look at `postcss.config.js`), and both acceptable remediations with code.
- I2 is fully closed: Task 6's check is deterministic and headless-agent-compatible. The chosen markers (`box-sizing:border-box` from preflight, `--tw-` custom-prop prefix) are both stable across Tailwind v3 minor versions and survive Vite's default esbuild minification as literal substrings.
- N1 from review 1 is closed: no more transient `App.tsx` edit/revert. Verification lives entirely in build artifacts; no risk of a forgotten revert leaking into the commit.
- N2 from review 1 is closed: the "All shell commands run from `mind_web/` unless stated otherwise." preamble sits at the top of Tasks where it actually scopes Tasks 1, 2, and 6.
- Task 3 notes that the full `tailwind.config.js` rewrite makes a separate Tailwind-config ESM-conversion step unnecessary — which is correct and removes a redundant operation the agent might otherwise insert.
- Commit message complies with global rules (sentence case, no type prefix, no trailing period).

---

PLAN_REVIEW_PASS
