# Delete a session from the list (hover button + confirm dialog)

**Date:** 2026-06-21
**Source:** conversation context

## Key Findings

- Delete affordance lives **in the session list row** (`SessionList.tsx`), revealed on row hover, not in the detail panel. Click → confirmation dialog → on confirm, call `DELETE /sessions/runs/:id`.
- The list is an `useInfiniteQuery` with key `['session-runs']` in `SessionsPage/index.tsx`. After a successful delete, **invalidate `['session-runs']`** so the list refetches.
- Each row is currently a `<Link to={/sessions/:id}>` wrapping the whole card — the delete button must **not** trigger navigation (stop propagation / not be a nested anchor).
- If the user is currently viewing the session being deleted (`useParams().id === deletedId`), **navigate to `/sessions`** after delete so the detail panel doesn't show a stale/missing session.
- No modal or toast component exists in the project — build a small Tailwind confirm dialog inline. Styling is TailwindCSS (`darkMode: 'media'`), gray palette, button pattern from `LoginPage`.

## Details

### Scope — single atomic milestone

Backend `DELETE /sessions/runs/:id` (mind_api Phase 45) must land first. Frontend change is one shippable unit: hover-reveal delete button + confirm dialog + delete mutation + cache invalidation + navigate-away guard.

### API client — `src/core/api/client.ts`

`apiFetch<T>(path, options)` already supports any method and returns `res.json()`. The DELETE returns 204 (no body) → `res.json()` would throw. Either:
- have the backend return 204 and call via a thin wrapper that tolerates an empty body, or
- simplest: `await apiFetch<void>(\`/sessions/runs/\${id}\`, { method: 'DELETE' })` only if `apiFetch` tolerates empty bodies — it currently does `return res.json()` unconditionally, so **add an empty-body guard** in `apiFetch` (`if (res.status === 204) return undefined as T;` before `return res.json()`), or add a dedicated `deleteSession(id)` helper that uses `fetch` semantics without parsing JSON. Prefer the small `apiFetch` 204-guard — it's reusable and keeps one HTTP path.

### Mutation — React Query

First mutation in the app (no existing `useMutation`). Pattern:

```ts
const queryClient = useQueryClient();
const { mutate, isPending } = useMutation({
  mutationFn: (id: string) => apiFetch<void>(`/sessions/runs/${id}`, { method: 'DELETE' }),
  onSuccess: (_data, id) => {
    queryClient.invalidateQueries({ queryKey: ['session-runs'] });
    if (id === selectedId) navigate('/sessions');
  },
});
```

Where to own it: simplest is a small `useDeleteSession()` hook (`src/pages/SessionsPage/useDeleteSession.ts`) that takes the current route `id` for the navigate-away check, or lift the mutation into `SessionsPage` and pass an `onDelete(id)` callback down to `SessionList`. Either is fine; keep `SessionList` mostly presentational by passing a callback.

### List row — `src/pages/SessionsPage/SessionList.tsx`

Current row is `<Link to={/sessions/${session.id}} className="… group hover:bg-…">`. Add a delete button that appears on hover:
- Add `group` to the row container (Link already has hover styling — add `group` to it or wrap so the button can use `group-hover:opacity-100 opacity-0`).
- The button must not be a descendant `<a>` issue: put a `<button>` with `onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmId(session.id); }}` so clicking it neither navigates nor selects. (Nested interactive element inside an anchor is acceptable here as long as the click is stopped; if it causes issues, restructure the row so the anchor and button are siblings.)
- Position: trailing icon (trash) on the right of the row, `opacity-0 group-hover:opacity-100 transition-opacity`, red on hover (`text-gray-400 hover:text-red-600`).

### Confirm dialog

Small Tailwind modal (fixed overlay + centered card). Two buttons: Cancel and Delete. Delete button shows a spinner while `isPending` (reuse the spinner span pattern from `LoginPage`). Copy: "Delete this session? Biometric data and instructions will be permanently removed." (matches what the backend cascade does). On confirm → `mutate(confirmId)`; close on success/cancel.

### Navigate-away — `useParams` / `useNavigate`

`SessionsPage` reads `const { id } = useParams()`. Pass it down (or read in the hook). After successful delete of that `id`, `navigate('/sessions')`.

### Guards / verify

- Clicking the trash button does NOT navigate to the session or change selection (preventDefault + stopPropagation).
- After delete: row disappears from the list (invalidation refetch); if it was the open session, the detail panel clears (route → `/sessions`).
- 403/404/network error from the backend → surface an inline error in the dialog (reuse the `text-red-600` error pattern); do not silently close.
- Button hidden until hover (keyboard focus should still reveal it — `focus:opacity-100` alongside `group-hover:opacity-100`).

## Open Questions

None — placement (list row, hover), interaction (confirm dialog), and post-delete behavior (invalidate + navigate-away) are settled.
