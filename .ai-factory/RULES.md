# Project Rules

> Short, actionable rules and conventions for this project. Loaded automatically by /aif-implement.

## Auth

- Protected routes redirect to `/login` when token is absent.

## Error Handling

- API errors: typed `ApiError` with `status` and `message`, thrown and caught in React Query `onError` handlers.

## Naming

- CSS classes: TailwindCSS utility classes only — no custom CSS files outside `index.css`.
