# Scaffold Vite + React + TypeScript — Implementation Spec

**Date:** 2026-05-30
**Source:** two plan-review rounds (plan-review-1, plan-review-2); plan v2 reached PLAN_REVIEW_PASS

## Goal

Bootstrap the empty `mind_web/` directory with a working Vite + React + TypeScript scaffold, install required runtime and dev dependencies, configure `package.json` metadata, and remove generated boilerplate. Task ends when `npm run dev` serves a blank page with no console errors.

## Critical constraints (caused two plan-review failures)

### 1. Scaffolder requires interactive TTY — no `--force` or `--overwrite`

The directory is **not empty**: it contains `CLAUDE.md`, `AGENTS.md`, `.ai-factory/`, `.claude/`, `.mcp.json`, `.idea/`, `.gitignore`. These must be preserved.

Run the scaffolder **interactively** (requires a TTY — do not background):

```
npm create vite@latest . -- --template react-ts
```

When Vite prompts "Current directory is not empty…", select **"Ignore files and continue"**.

- ❌ Do NOT select "Remove existing files and continue"
- ❌ Do NOT pass `--overwrite` — it wipes `.ai-factory/`, `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.mcp.json`, `.idea/`
- ❌ `--force` is not a valid `create-vite` flag and is silently ignored by `npm create`

With "Ignore files and continue" Vite skips every file that already exists, so the existing `.gitignore` and all project config files are preserved untouched. After scaffold, diff Vite's default `.gitignore` entries against the existing file and append only any missing lines; otherwise leave it as-is.

### 2. Do NOT install the deprecated `@typescript-eslint` legacy packages

The `create-vite react-ts` template ships a **flat ESLint config** (`eslint.config.js`) that uses the **unified `typescript-eslint` package** — not the deprecated split pair `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`.

- ✅ The unified package is already wired into `eslint.config.js` and `devDependencies` by the template
- ❌ Do NOT run `npm install @typescript-eslint/eslint-plugin @typescript-eslint/parser`
- **Note:** The ROADMAP milestone text lists these two packages — that text is wrong. Ignore it; the note supersedes it.

Task 4 is a verification-only step: run `npm install` with no arguments to confirm `@types/react`, `@types/react-dom`, and `eslint` are locked in the lockfile. No additional installs.

### 3. Node version must be ≥ 20.19 or ≥ 22.12

`create-vite@9` requires `node ^20.19.0 || >=22.12.0`. Lower versions (including 20.0–20.18) fail with `EBADENGINE` and a `SyntaxError` from `node:util`'s `styleText` export.

Before running the scaffolder: run `node --version` and verify. If lower, switch with `nvm use 22` (or equivalent).

### 4. `App.tsx` cleanup must remove ALL imports including `useState`

Replace the **entire contents** of `src/App.tsx` with:

```tsx
function App() {
  return <div />;
}
export default App;
```

This must remove: `import './App.css'`, `import reactLogo from './assets/react.svg'`, `import viteLogo from '/vite.svg'`, **`import { useState } from 'react'`**, the `useState` state variable, and the full JSX block. Leaving `useState` behind produces an unused-import lint warning that violates the "no console errors or warnings" acceptance criterion.

## Task breakdown

### Task 0: Verify Node version
Run `node --version`. Confirm `≥ 20.19` or `≥ 22.12`. If lower: `nvm use 22`.

### Task 1: Run Vite scaffolder
Inside `mind_web/`, run `npm create vite@latest . -- --template react-ts` interactively. Select "Ignore files and continue". See constraint #1 above.

After scaffold: diff existing `.gitignore` against Vite defaults and append missing lines only.

### Task 2: Update `package.json` metadata
- Set `"name": "mind-web"`
- Add `"engines": { "node": ">=20" }`
- Leave all other Vite-generated fields (scripts, deps, `"private"`, `"type"`) untouched

### Task 3: Install dependencies
1. `npm install` — resolves template devDependencies and creates the lockfile
2. `npm install react-router-dom @tanstack/react-query echarts echarts-for-react`

### Task 4: Verify dev dependencies (no new installs)
Run `npm install` (no-op). Confirm `@types/react`, `@types/react-dom`, `eslint` are present in `devDependencies`. Do NOT install `@typescript-eslint/eslint-plugin` or `@typescript-eslint/parser` — see constraint #2.

### Task 5: Strip boilerplate
Delete: `src/App.css`, `src/assets/` (entire directory), `public/vite.svg`.

Replace entire `src/App.tsx` with the minimal component from constraint #4.

Leave `src/index.css`, `src/main.tsx`, and all other Vite-generated files untouched.

### Task 6: Verify
Run `npm run dev`. Confirm:
1. Vite starts on `http://localhost:5173` (auto-bumps to 5174/5175 if busy — acceptable)
2. Browser shows a blank white page — no broken-image icons, no React error overlay
3. DevTools console shows no errors or warnings from application code (Vite HMR messages and React DevTools hint are acceptable noise)

Stop the dev server. If any warning appears, check for leftover imports in `App.tsx`.

## Acceptance criteria

`npm run dev` starts successfully and the browser renders a blank page with no console errors or warnings from application code.
