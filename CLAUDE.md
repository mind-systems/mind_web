# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

React 18 + Vite + TypeScript + TailwindCSS + React Router v6 + TanStack Query + Recharts

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

`mind_api` REST endpoints. Base URL: `VITE_API_BASE_URL` env var (`.env.local` for development, gitignored). `.env.example` is committed with an empty value.

## Rules

- All files in English
- `mind_auth_token` — do not rename this localStorage key
- Never write to `mind_api` proto files — proto ownership is in `mind_api/proto/`
- All HTTP calls go through `core/api/client.ts` — no raw `fetch` in pages or components
- `localStorage` access only in `core/auth/AuthContext.tsx` and `core/api/client.ts`
- Components receive data as props from pages — no `useQuery` inside shared components

## AI Context

`.ai-factory/DESCRIPTION.md` — project overview and features
`.ai-factory/ROADMAP.md` — six-phase implementation roadmap
`.ai-factory/ARCHITECTURE.md` — architecture pattern, dependency rules, code examples
