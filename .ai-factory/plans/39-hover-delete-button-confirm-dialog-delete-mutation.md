# Plan: Hover delete button + confirm dialog + delete mutation

## Context
Let users delete a session directly from the session list: a hover-revealed trash button opens a confirm dialog that runs a `DELETE /sessions/runs/:id` mutation, then refetches the list and navigates away from the detail panel if the deleted session was open.

**Backend prerequisite (blocking for verification):** This depends on **mind_api Phase 45** — `DELETE /sessions/runs/:id` returning `204 No Content` and cascading deletion of biometrics + instructions server-side. That endpoint does **not** exist yet (the controller currently exposes only `GET runs`, `GET runs/:id/biometrics`, `GET runs/:id/instructions`). The frontend can be built and type-checked in isolation, but the delete action will return **404** at runtime until the backend ships. Once it lands, confirm the assumed contract: status is `204` (not `200`) and the cascade actually removes both biometric data and instructions (the dialog copy promises permanent removal of both).

## Settings
- Testing: no
- Logging: minimal (one `logger.error` on delete failure via the `@/core/observe` facade)
- Docs: no

## Tasks

### Phase 1: API client

- [x] **Task 1: Guard `apiFetch` against empty 204 responses**
  Files: `src/core/api/client.ts`
  The `DELETE /sessions/runs/:id` endpoint returns `204 No Content`; the current `return res.json() as Promise<T>` would throw on an empty body. Add an empty-body guard immediately before the final return: `if (res.status === 204) return undefined as T;`. Keep all other behavior (auth header injection, tracing, 401 handling, `!res.ok` error path) unchanged. This is the single reusable HTTP path — do not add a separate delete helper.

### Phase 2: Delete mutation

- [x] **Task 2: Add `useDeleteSession` hook** (depends on Task 1)
  Files: `src/pages/SessionsPage/useDeleteSession.ts` (new)
  First `useMutation` in the app. Create a page-local hook (co-located under `pages/SessionsPage/`, allowed by the architecture for page-owned data). It takes the currently-selected route id (`selectedId?: string`) as an argument so it can run the navigate-away check. Implementation:
  - `const queryClient = useQueryClient();` and `const navigate = useNavigate();` (from `react-router-dom`).
  - `useMutation({ mutationFn: (id: string) => apiFetch<void>(`/sessions/runs/${id}`, { method: 'DELETE' }), onSuccess: (_data, id) => { queryClient.invalidateQueries({ queryKey: ['session-runs'] }); if (id === selectedId) navigate('/sessions'); }, onError: (err) => logger.error(`Failed to delete session: ${err instanceof Error ? err.message : String(err)}`) })`.
  - Return the mutation object so callers get `mutate`, `mutateAsync`, `isPending`, `error`, and `reset`.
  - **Imports:** import only `apiFetch` from `@/core/api/client` (do NOT import `ApiError` — the hook never references it, and `tsconfig.app.json` sets `noUnusedLocals: true`, so an unused import is a hard build break). Import `logger` from `@/core/observe`. `ApiError`-based message formatting happens at the render site (Task 5), not here.

### Phase 3: Confirm dialog UI

- [x] **Task 3: Add shared `DeleteConfirmDialog` component** (depends on Task 2)
  Files: `src/components/DeleteConfirmDialog.tsx` (new)
  Presentational-only confirm modal (receives all data as props — no `useQuery`/`apiFetch`, conforms to the shared-component rule). Props: `{ open: boolean; isPending: boolean; errorMessage?: string | null; onConfirm: () => void; onCancel: () => void; }`. Render nothing when `!open`. Layout: fixed full-screen overlay (`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4`) + centered card with `role="dialog"` and `aria-modal="true"` (`w-full max-w-sm rounded-2xl bg-white p-6 shadow-md dark:bg-gray-900`). Copy: heading/body text "Delete this session? Biometric data and instructions will be permanently removed." Two buttons:
  - Cancel: `type="button"`, gray outline style (reuse LoginPage secondary-button classes), `onClick={onCancel}`, disabled while `isPending`.
  - Delete: `type="button"`, red style (`bg-red-600 hover:bg-red-700 text-white ... disabled:opacity-50`), `onClick={onConfirm}`, disabled while `isPending`, showing the spinner span pattern from `LoginPage` (`<span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />`) when `isPending`.
  - When `errorMessage` is set, render `<p className="mt-3 text-sm text-red-600">{errorMessage}</p>` inside the card (do NOT auto-close on error).
  - **Dismissal:** overlay click calls `onCancel`; Escape key calls `onCancel` (add a `useEffect` keydown listener, active only while `open`). Both are ignored while `isPending`.

- [x] **Task 4: Add hover-revealed trash button + dialog state to `SessionList`** (depends on Task 3)
  Files: `src/pages/SessionsPage/SessionList.tsx`
  Keep `SessionList` presentational by adding callback/state props rather than fetching. Extend `SessionListProps` with: `onDelete: (id: string) => Promise<unknown>;` (the hook's `mutateAsync`), `isDeleting: boolean;`, `deleteError?: string | null;`, `onDeleteErrorReset?: () => void;`. Add local `const [confirmId, setConfirmId] = useState<string | null>(null);`.

  **Row restructure (valid HTML — button must NOT nest inside the `<Link>`/`<a>`):** Replace the current `<Link>`-wraps-everything row with a `group relative` container that carries the selected/hover background + `border-l-2` classes. Inside it:
  - A stretched-link `<Link to={`/sessions/${session.id}`} className="absolute inset-0 z-0" aria-label={sessionTitle(session)} />` as the whole-card click target.
  - The text content block as a sibling with `pointer-events-none` (so clicks fall through to the stretched Link) and right padding to leave room for the button.
  - The trash `<button type="button">` as a sibling positioned top-right (`absolute right-2 ... z-10`), classes `opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-red-600`, with an inline trash SVG and `aria-label="Delete session"`. `onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmId(session.id); }}` so it neither navigates nor selects.

  **Close mechanism (drive from the mutation result — no fragile prop-transition effect):** the dialog's `onConfirm` runs the delete and closes only on success:
  ```ts
  const handleConfirm = async () => {
    if (!confirmId) return;
    try {
      await onDelete(confirmId);   // mutateAsync — rejects on 403/404/network
      setConfirmId(null);          // success: close
    } catch {
      // leave dialog open; error is surfaced via deleteError prop
    }
  };
  ```
  Render one `<DeleteConfirmDialog open={confirmId !== null} isPending={isDeleting} errorMessage={deleteError} onConfirm={handleConfirm} onCancel={() => { setConfirmId(null); onDeleteErrorReset?.(); }} />` at the end of the list. Cancel clears `confirmId` and resets the mutation error. Note: when the deleted row was the open session, the hook navigates to `/sessions`, unmounting/clearing selection; the `setConfirmId(null)` on success still runs harmlessly.

- [x] **Task 5: Wire `useDeleteSession` into `SessionsPage`** (depends on Task 4)
  Files: `src/pages/SessionsPage/index.tsx`
  Call `const { mutateAsync: deleteSession, isPending: isDeleting, error: deleteError, reset: resetDelete } = useDeleteSession(id);`. Pass to `SessionList`: `onDelete={deleteSession}`, `isDeleting={isDeleting}`, `deleteError={deleteError instanceof ApiError ? deleteError.message : deleteError ? 'Something went wrong' : null}`, `onDeleteErrorReset={resetDelete}`. Import `useDeleteSession` from `./useDeleteSession` and `ApiError` from `@/core/api/client`. Existing `useInfiniteQuery(['session-runs'])` is the cache key invalidated by the hook — no query changes needed.

## Commit Plan
- **Commit 1** (after tasks 1-2): "Add 204 guard to apiFetch and useDeleteSession mutation hook"
- **Commit 2** (after tasks 3-5): "Add hover delete button and confirm dialog to session list"
