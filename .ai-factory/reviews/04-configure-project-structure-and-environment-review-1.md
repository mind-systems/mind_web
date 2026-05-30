# Code Review: 04-configure-project-structure-and-environment

**Status:** No blocking issues. Minor deviations and one environment-related verification gap noted below.

## Scope

Reviewed all files in `git diff HEAD` and `git status`:

- `.env.example` (new, committed)
- `.env.local` (new, untracked because `.gitignore`d — verified on disk)
- `src/components/.gitkeep`, `src/core/api/.gitkeep`, `src/core/auth/.gitkeep`, `src/core/types/.gitkeep`, `src/pages/.gitkeep` (new, empty)
- `src/core/config.ts` (new)
- `tsconfig.app.json` (modified)
- `vite.config.ts` (modified)

Plus auxiliary plan/review artifacts under `.ai-factory/` — not application code, skipped.

## File-by-file review

### `.env.example`
```
VITE_API_BASE_URL=
```
Correct: same key as `.env.local`, empty value, trailing newline (size 19 bytes = 18 chars + LF). No secrets committed. ✅

### `.env.local`
```
VITE_API_BASE_URL=http://localhost:3002
```
Matches the milestone description verbatim. Excluded by existing `.gitignore` entry `.env.local`. ✅

### `src/**/.gitkeep`
Five empty placeholder files at the exact paths called out in the plan and `ARCHITECTURE.md` (`src/core/api/`, `src/core/auth/`, `src/core/types/`, `src/pages/`, `src/components/`). `src/core/` itself is anchored by `config.ts`, so no placeholder is needed there. ✅

### `src/core/config.ts`
```ts
const value = import.meta.env.VITE_API_BASE_URL as string | undefined

if (!value || value.trim() === '') {
  throw new Error(
    'VITE_API_BASE_URL is not set. Define it in .env.local (see .env.example).',
  )
}

export const API_BASE_URL: string = value
```

Behavior is correct:
- The module-level `throw` fail-fast pattern matches `.ai-factory/ARCHITECTURE.md` line 26 ("reads `VITE_API_BASE_URL`, startup assertion") and the plan.
- TypeScript narrowing: after the `if (!value || value.trim() === '')` guard, `value` is narrowed to `string` (the `undefined` branch always throws), so `export const API_BASE_URL: string = value` typechecks under `strict` semantics.
- The `as string | undefined` cast is defensive but fine: `vite/client` augments `ImportMetaEnv` with an index signature returning `any`, so without the cast `value` would be `any` and the guard would still be correct, just less typed. The cast does not hide any bug.
- No `.trim()` on the exported value — callers will see the literal string. Not a defect (none of the plan or rules require trimming for actual use), but if a future `.env.local` line is `VITE_API_BASE_URL= http://...` with a leading space, the assertion passes and the exported value retains the space. Out of scope to fix here; flagging as a latent gotcha for the API client task to consider.
- No emoji, no comment clutter, matches global doc/code style. ✅

### `vite.config.ts`
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

Correctness:
- ESM-safe under `"type": "module"` in `package.json` — `__dirname` is not available, so `import.meta.url` is the right anchor. ✅
- `fileURLToPath(new URL('./src', import.meta.url))` produces an absolute, OS-correct path on macOS, Linux, and Windows. ✅
- The `// https://vite.dev/config/` template comment was removed — harmless, matches the project's no-noise comment policy.

Minor nits (non-blocking):
- `'url'` works but the modern Node spec is `'node:url'`. Either is accepted; the plan reviewer noted the same nit. Not worth changing now.
- `import { resolve } from 'path'` is mentioned in the plan recon but not actually imported here — that's correct because the chosen implementation uses `fileURLToPath` instead. No dead import. ✅

### `tsconfig.app.json`
```jsonc
"baseUrl": ".",
"paths": {
  "@/*": ["src/*"]
},
"ignoreDeprecations": "6.0"
```

Correctness:
- `baseUrl: "."` + `paths: { "@/*": ["src/*"] }` correctly maps `@/core/config` → `src/core/config.ts` for `tsc --noEmit`. Placed in `tsconfig.app.json`, not the root `tsconfig.json` — matches plan, matches the project's "modern Vite template" reality. ✅
- `moduleResolution: "bundler"` supports `paths`. ✅

**Deviation (non-blocking) — `ignoreDeprecations: "6.0"`:**
This key is *not* in the plan. It was added to suppress a TS 6.0 deprecation warning. The deprecated option is almost certainly `baseUrl` itself — TypeScript 6.0 has deprecated `baseUrl` for path-mapping use (it remains valid, will be removed in 7.0). The cleaner alternative would have been to drop `baseUrl` entirely, since TS 6.0 resolves `paths` relative to the tsconfig location by default. However:

1. The plan explicitly required `baseUrl: "."`, so the implementer was caught between the plan and a compiler warning.
2. `ignoreDeprecations: "6.0"` is a documented escape hatch and works as intended.
3. `npm run typecheck` and `npm run lint` both run cleanly with this configuration (verified).

Decision: accept the deviation. A follow-up task (e.g. when TS 7.0 lands) should remove both `baseUrl` and `ignoreDeprecations` together. Not a defect now.

## Verification

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ Passes cleanly |
| `npm run lint` | ✅ Passes cleanly |
| `npm run build` | ⚠️ Fails — but for an environment reason, not a code defect |

The `npm run build` failure is:
```
You are using Node.js 18.15.0. Vite requires Node.js version 20.19+ or 22.12+.
ReferenceError: CustomEvent is not defined
```

`package.json` declares `"engines": { "node": ">=20" }`, and the Vite version pinned here (`^8.0.12`) requires Node ≥ 20.19. The local shell is on Node 18.15.0, so `vite build` cannot run at all. This is an environment problem, not a problem with anything this milestone produced. The plan's verification step (Task 6) cannot be fully exercised in this sandbox; the configuration itself is correct, and `tsc --noEmit` already confirms the alias resolves under TypeScript. Recommendation: switch to Node 20+ (e.g. `nvm use 20`) before running the dev server or `vite build`. No code change required.

## Cross-cutting checks

- **Auth / secrets:** `.env.local` is gitignored, only the schema `.env.example` is committed with an empty value. No credentials leak. ✅
- **`localStorage` access:** none introduced; `core/auth/` is still empty. Respects the project rule that only `core/auth/AuthContext.tsx` and `core/api/client.ts` may touch `localStorage`. ✅
- **Raw `fetch`:** none introduced. ✅
- **English-only files:** all new file content is English. ✅
- **`mind_auth_token` key:** not renamed. ✅
- **Proto files:** none touched. ✅
- **Plan-mandated directory layout vs `ARCHITECTURE.md` (lines 17–46):** exact match. ✅
- **Dependency rules from `ARCHITECTURE.md`:** `config.ts` imports nothing from `src/` (only `import.meta.env`), respecting `core/auth → (no imports from other src/ folders)`-style isolation principles. ✅
- **Commit plan:** the working tree shows everything staged as a single set; the planned two-commit split has not been executed yet. Not a defect — committing is the user's gate per project rules ("NEVER commit without explicit permission").

## Findings summary

| # | Severity | File | Note |
|---|---|---|---|
| 1 | Info | `tsconfig.app.json` | `ignoreDeprecations: "6.0"` added beyond plan to silence TS 6.0 `baseUrl` deprecation. Acceptable; revisit when TS 7.0 lands. |
| 2 | Info | `vite.config.ts` | `'url'` could be `'node:url'`; stylistic only. |
| 3 | Info | environment | `vite build` cannot run on Node 18.15.0 in this sandbox; requires Node ≥ 20.19. Configuration itself is correct; `tsc --noEmit` and `eslint` confirm. |
| 4 | Info | `src/core/config.ts` | No `.trim()` on the exported value — a leading/trailing space in `.env.local` would survive. Out of scope to fix; flag for the upcoming API client task. |

No correctness bugs, no security issues, no race conditions, no missing migrations (none applicable to a frontend env-config milestone), no type mismatches. The alias is structurally correct under both Vite and TypeScript; end-to-end resolution will be exercised the first time an `import '@/core/...'` appears in `App.tsx` or a new page (next roadmap milestone).

REVIEW_PASS
