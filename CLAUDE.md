## Commands

```bash
npm run dev       # Dev server on http://localhost:5173 (Vite)
npm run build     # Production build into dist/
npm run preview   # Serve the production build locally
npm run lint      # ESLint
npm run typecheck # tsc --noEmit
```

## Project

Browser-based read-only dashboard for viewing historical session data from the Mind mobile app. Users authenticate with Google Sign-In or passwordless email OTP and browse past breathing sessions, biometric time-series charts, and NFB calibration history.

## Tech Stack

React 18 + Vite + TypeScript + TailwindCSS + React Router v6 + TanStack Query + ECharts

## Architecture

See `.ai-factory/ARCHITECTURE.md` for full rules and examples. Pattern: Feature-Based Modules.

```
src/
  core/
    api/          ← typed fetch wrapper + auth interceptor (apiFetch, ApiError)
    auth/         ← AuthContext, token storage, useAuth hook (mind_auth_token)
    types/        ← shared TypeScript types mirroring mind_api response shapes
    config.ts     ← reads VITE_API_BASE_URL, startup assertion
  pages/
    LoginPage     ← email OTP + Google Sign-In
    SessionsPage  ← session history list with pagination
    SessionPage   ← session detail (instruction timeline + biometric charts)
    CalibrationPage ← NFB calibration history per BCI device
  components/     ← shared UI components (charts, layout, loaders)
  router.tsx      ← React Router config + ProtectedRoute guard
  main.tsx        ← entry point (RouterProvider + QueryClientProvider + AuthProvider)
```

Key entry points: `src/main.tsx`, `src/router.tsx`, `src/core/auth/AuthContext.tsx`, `src/core/api/client.ts`

## Auth

JWT stored in `localStorage` under `mind_auth_token`. All API requests include `Authorization: Bearer <token>`. On 401: clear token, redirect to `/login`. Token format is identical to the mobile app.

## API

`mind_api` REST endpoints. Base URL: `VITE_API_BASE_URL` env var (`.env.development.local` for development, gitignored). `.env.example` is committed with an empty value.

## Logging

- Write all logs through the `logger` facade from `@/core/observe` — `logger.info | warn | error(message)`. Never use `console.*` or any other logger.

## Rules

- `mind_auth_token` — do not rename this localStorage key
- All HTTP calls go through `core/api/client.ts` — no raw `fetch` in pages or components
- Browser storage (`localStorage`/`sessionStorage`) access only in `core/auth/AuthContext.tsx`, `core/api/client.ts`, and `core/auth/oauthState.ts` — no direct storage reads/writes anywhere else
- Components receive data as props from pages — no `useQuery` inside shared components

## AI Context

`.ai-factory/ROADMAP.md` — phased implementation roadmap
`.ai-factory/ARCHITECTURE.md` — architecture pattern, dependency rules, code examples
`docs/observability.md` — OTLP log destination modes, VITE_ prefix requirement, dev proxy
