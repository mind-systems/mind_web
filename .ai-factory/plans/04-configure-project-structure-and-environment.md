# Plan: Configure project structure and environment

## Context
Set up the feature-based module skeleton (`src/core/*`, `src/pages/`, `src/components/`), wire up environment variables for the API base URL, and configure the `@` path alias so that `import { API_BASE_URL } from '@/core/config'` resolves in both Vite and TypeScript.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Notes from recon
- `@types/node` is already a devDependency (`^24.12.3`) — no `npm install` required for `resolve` from `'path'`.
- `.gitignore` already excludes `.env.local` and `.env.*.local` — no gitignore changes needed.
- The repo uses the modern Vite template with project references: `tsconfig.json` only contains `references`; the real app compiler options live in `tsconfig.app.json` — `baseUrl`/`paths` must go there.
- `tsconfig.app.json` already has `"types": ["vite/client"]`, so `import.meta.env` is typed.
- Current `vite.config.ts` is minimal (just the react plugin) and uses `defineConfig` already.
- `src/` currently contains only `App.tsx`, `index.css`, `main.tsx` — no `core/`, `pages/`, or `components/` directories yet.
- Empty directories are not tracked by git; use `.gitkeep` placeholders so the structure survives a fresh clone.

## Tasks

### Phase 1: Directory skeleton

- [x] **Task 1: Create feature-based module directories with .gitkeep placeholders**
  Files: `src/core/api/.gitkeep`, `src/core/auth/.gitkeep`, `src/core/types/.gitkeep`, `src/pages/.gitkeep`, `src/components/.gitkeep`
  Create the five directories required by `.ai-factory/ARCHITECTURE.md`. Add an empty `.gitkeep` file in each so git tracks the empty folder. Do NOT add a `.gitkeep` to `src/core/` itself (it will be populated by `config.ts` in Task 3).

### Phase 2: Environment variables

- [x] **Task 2: Create environment files for the API base URL** (depends on Task 1)
  Files: `.env.local`, `.env.example`
  Create `.env.local` (already covered by `.gitignore`) with a single line:
  ```
  VITE_API_BASE_URL=http://localhost:3002
  ```
  Create `.env.example` (committed) with the same key and an empty value:
  ```
  VITE_API_BASE_URL=
  ```
  Both files must end with a trailing newline. Do not add comments — keep them minimal.

### Phase 3: Config module and path alias

- [x] **Task 3: Create `src/core/config.ts` with startup assertion** (depends on Task 2)
  Files: `src/core/config.ts`
  Export `API_BASE_URL` read from `import.meta.env.VITE_API_BASE_URL`. Add a startup-time assertion that throws if the value is missing or empty. Exact shape:
  ```ts
  const value = import.meta.env.VITE_API_BASE_URL as string | undefined

  if (!value || value.trim() === '') {
    throw new Error(
      'VITE_API_BASE_URL is not set. Define it in .env.local (see .env.example).',
    )
  }

  export const API_BASE_URL: string = value
  ```
  No other exports. This file is imported at startup via the API client, so the assertion fails fast on misconfiguration.

- [x] **Task 4: Add `@` path alias to `vite.config.ts`** (depends on Task 3)
  Files: `vite.config.ts`
  Import `resolve` from `'path'` and `fileURLToPath` from `'url'` (Vite ESM config). Add a `resolve.alias` entry mapping `'@'` to the absolute path of `src/`. Use `fileURLToPath(new URL('./src', import.meta.url))` to stay ESM-safe (the config file is ESM — `"type": "module"` in `package.json`). Final shape:
  ```ts
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'
  import { fileURLToPath } from 'url'

  export default defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  })
  ```
  (Equivalent `resolve(__dirname, 'src')` would require CJS interop tricks under `"type": "module"` — prefer the URL form. `@types/node` is already installed for any `path`/`url` typing needs.)

- [x] **Task 5: Add `baseUrl` and `paths` to `tsconfig.app.json`** (depends on Task 4)
  Files: `tsconfig.app.json`
  Inside `compilerOptions`, add:
  ```json
  "baseUrl": ".",
  "paths": {
    "@/*": ["src/*"]
  }
  ```
  Do NOT modify root `tsconfig.json` — it only holds project references. The app code is compiled under `tsconfig.app.json`, so the alias must live there for `tsc --noEmit` / `npm run typecheck` to resolve `@/core/config`.

### Phase 4: Verify

- [x] **Task 6: Verify the alias resolves end-to-end** (depends on Task 5)
  Files: (no file changes)
  Run:
  ```
  npm run typecheck
  npm run lint
  npm run build
  ```
  All three must pass. The task is complete only when `import { API_BASE_URL } from '@/core/config'` would resolve cleanly from any file under `src/` for both the TypeScript compiler and the Vite bundler. If `npm run build` fails because `App.tsx` does not yet import `@/core/config`, that is fine — do not add a throwaway import; the alias is exercised by `typecheck` against `config.ts`'s own resolution and by Vite's resolver during `build`.

## Commit Plan
- **Commit 1** (after tasks 1–3): "Add feature-based module skeleton and env config"
- **Commit 2** (after tasks 4–6): "Wire @ path alias in Vite and tsconfig.app"
