# Plan: Configure TailwindCSS

## Context
Install and configure TailwindCSS v3 with PostCSS in the Vite + React project so utility classes work in JSX and the production build, and rename the document title to `Mind`.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

> All shell commands run from `mind_web/` unless stated otherwise.

### Phase 1: Install and configure Tailwind

- [x] **Task 1: Install Tailwind v3 toolchain**
  Files: `package.json`, `package-lock.json`
  Run `npm install -D tailwindcss@3 postcss autoprefixer`. The version must be pinned to `tailwindcss@3` — a bare `tailwindcss` install resolves v4, which uses an incompatible `@tailwindcss/vite` plugin instead of the PostCSS pipeline this project uses. Do NOT install `@tailwindcss/vite`. Verify `package.json` lists `tailwindcss` with a `^3.x.x` range under `devDependencies` alongside `postcss` and `autoprefixer`.

- [x] **Task 2: Generate Tailwind and PostCSS config files, reconcile ESM** (depends on Task 1)
  Files: `tailwind.config.js`, `postcss.config.js` (possibly renamed to `postcss.config.cjs`)
  Run `npx tailwindcss init -p`. This creates both `tailwind.config.js` and `postcss.config.js` at the project root.

  Because `package.json` declares `"type": "module"` (line 5), Node treats every `.js` file as ESM. Tailwind v3's `init -p` has historically emitted CommonJS (`module.exports = …`), which fails under ESM with `ReferenceError: module is not defined in ES module scope`. After running `init -p`, open `postcss.config.js`:
  - If it already uses `export default { … }`, leave it as-is.
  - If it begins with `module.exports = `, rewrite it to ESM:
    ```js
    export default {
      plugins: {
        tailwindcss: {},
        autoprefixer: {},
      },
    }
    ```
    (Alternative: rename the file to `postcss.config.cjs` to keep the CJS form — Node loads `.cjs` as CommonJS regardless of `"type": "module"`. Either form is acceptable; the ESM rewrite is preferred for consistency with the rest of the project.)

  `tailwind.config.js` is fully replaced by Task 3 (which uses `export default`), so no separate ESM conversion is needed for the Tailwind config itself.

- [x] **Task 3: Set Tailwind content globs** (depends on Task 2)
  Files: `tailwind.config.js`
  Replace the generated `tailwind.config.js` with:
  ```js
  /** @type {import('tailwindcss').Config} */
  export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: { extend: {} },
    plugins: [],
  }
  ```
  Both globs are required — omitting either purges classes used only in that location from the production build. The file must be ESM (`export default`) because `package.json` declares `"type": "module"`.

### Phase 2: Wire Tailwind into the app

- [x] **Task 4: Add Tailwind directives to global stylesheet** (depends on Task 3)
  Files: `src/index.css`
  Prepend the three Tailwind v3 directives as separate lines at the top of `src/index.css`, before any existing styles:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```
  They must be three separate directives — a single combined `@tailwind base/components/utilities` line is not valid v3 syntax. The file is currently empty, so the directives become its only content. `src/main.tsx` already imports `./index.css` (line 3) — no change there.

- [x] **Task 5: Update document title to `Mind`** (depends on Task 2)
  Files: `index.html`
  In `index.html`, replace `<title>Vite + React + TS</title>` with `<title>Mind</title>`. Leave the rest of the file unchanged.

- [x] **Task 6: Verify Tailwind output in production build** (depends on Tasks 3, 4, 5)
  Files: none modified
  Run `npm run build`. The build must succeed (no PostCSS load error, no Tailwind config error). Then verify Tailwind actually emitted utility CSS into the bundle:
  ```bash
  grep -E 'box-sizing:border-box|--tw-' dist/assets/*.css
  ```
  At least one match must appear — this proves the three directives compiled and Tailwind's preflight/base layer is in the bundle, which in turn proves the PostCSS pipeline picked up `tailwind.config.js` and processed `src/index.css`. No `src/App.tsx` edits are required for this check; the acceptance criterion from the roadmap (a `className="text-blue-500"` element rendering blue) is satisfied implicitly because the same pipeline scans `./src/**/*.{ts,tsx}` for class names and would emit `text-blue-500` if used. The operator may perform a manual `npm run dev` browser check after the agent completes, but it is not part of the agent's gate.

## Commit Plan
- **Commit 1** (after tasks 1–6): "Configure TailwindCSS v3 and set document title"
