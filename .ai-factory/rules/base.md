# Project Base Rules

> Auto-detected conventions from CLAUDE.md. Edit as needed.

## Naming Conventions

- CSS classes: TailwindCSS utility classes only — no custom CSS files outside `index.css`

## Error Handling

- API errors: throw typed `ApiError` with `status` and `message`; catch in React Query `onError` handlers
- 401 responses: clear `localStorage` token and redirect to `/login` from the API client layer
- Empty states: show placeholder text per page — never leave a blank render

## Logging

- Route all logs through the `logger` facade (`@/core/observe`) — never `console.*`, in development or production

## Environment

- All environment variables must be prefixed `VITE_` — an unprefixed var is silently invisible to client code

## Auth

- JWT stored in `localStorage` under key `mind_auth_token`
- Token injected as `Authorization: Bearer <token>` on every API call
- Protected routes redirect to `/login` when token is absent
