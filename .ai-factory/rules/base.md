# Project Base Rules

> Auto-detected conventions from DESCRIPTION.md and CLAUDE.md. Edit as needed.

## Naming Conventions

- Files: `PascalCase` for React components (e.g. `LoginPage.tsx`, `SessionsPage.tsx`), `camelCase` for utilities and hooks
- Variables and functions: `camelCase`
- React components: `PascalCase`
- Types and interfaces: `PascalCase`
- CSS classes: TailwindCSS utility classes only — no custom CSS files outside `index.css`

## Module Structure

- `src/core/api/` — API client and typed fetch wrapper
- `src/core/auth/` — AuthContext, token storage, `useAuth` hook
- `src/core/types/` — shared TypeScript types mirroring `mind_api` response shapes
- `src/pages/` — top-level route components (one file per page)
- `src/components/` — shared UI components (charts, layout, loaders)
- `src/router.tsx` — React Router config and `ProtectedRoute` guard
- `src/main.tsx` — app entry point

## Error Handling

- API errors: throw typed `ApiError` with `status` and `message`; catch in React Query `onError` handlers
- 401 responses: clear `localStorage` token and redirect to `/login` from the API client layer
- Empty states: show placeholder text per page — never leave a blank render

## Logging

- No console.log in production code — use browser DevTools during development only

## Environment

- All environment variables prefixed with `VITE_`
- `VITE_API_BASE_URL` is the only required env var
- `.env.local` is gitignored; `.env.example` is committed

## Auth

- JWT stored in `localStorage` under key `mind_auth_token`
- Token injected as `Authorization: Bearer <token>` on every API call
- Protected routes redirect to `/login` when token is absent
