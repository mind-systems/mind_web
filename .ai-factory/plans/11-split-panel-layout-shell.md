# Plan: Split-panel layout shell

## Context
Turn the placeholder `SessionsPage` into a two-column split-panel shell — a fixed-width, independently-scrollable left column (header + future session list) and a flex-fill right panel that shows an empty state until a session is selected. This is the structural host that the next two milestones (session list, charts panel) plug into.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Layout shell

- [x] **Task 1: Replace SessionsPage placeholder with split-panel layout**
  Files: `src/pages/SessionsPage/index.tsx`
  Replace the current centered placeholder with a two-column flex layout. Root: `<div className="flex h-screen overflow-hidden">`. 
  - **Left column:** fixed width `w-[280px] shrink-0`, full height, own vertical scroll (`flex flex-col` so the header stays pinned and only the list area scrolls), right border to separate from the panel (e.g. `border-r border-gray-200`). Inside, a header row containing the "Sessions" title and a logout button (extracted in Task 2), then a scrollable region (`flex-1 overflow-y-auto`) reserved for the session list — leave a placeholder comment `{/* session list — next milestone */}` since the list is implemented in the following milestone.
  - **Right panel:** `flex-1 overflow-y-auto`, fills remaining width and scrolls independently. Read `id` from `useParams<{ id?: string }>()` (already wired in the component). When `id` is absent, render the empty state from Task 3. When `id` is present, render a placeholder for the charts panel (`{/* session charts — next milestone */}`) so the selected-session branch is ready to be filled in later.
  Keep `useParams` import; follow the existing Tailwind gray/blue palette used in `LoginPage`.

- [x] **Task 2: Left-column header with logout button**
  Files: `src/pages/SessionsPage/index.tsx`
  In the left-column header, render the "Sessions" title (`text-lg font-semibold text-gray-900`) and a logout button on the same row (`flex items-center justify-between`, padding `px-4 py-4`, `border-b border-gray-200`). Wire the button to `useAuth().logout()` (import `useAuth` from `@/core/auth/AuthContext` — same hook `LoginPage` uses). Style as a subtle secondary action (e.g. small text button `text-sm text-gray-500 hover:text-gray-700`). `logout()` already clears the token and navigates to `/login`, so no extra navigation is needed.

- [x] **Task 3: Right-panel empty state**
  Files: `src/pages/SessionsPage/index.tsx`
  When no session is selected, center an empty-state message inside the right panel: a wrapper `flex h-full items-center justify-center` with muted text `text-gray-400` reading "Select a session". Keep it as a small inline block within the same file (no separate component needed for this milestone).

## Notes
- Single file change — the whole shell lives in `src/pages/SessionsPage/index.tsx`. Sub-components (`SessionList`, `BiometricCharts`) are introduced by later Phase 3 milestones, so do not create them now.
- Architecture: this page owns layout and (later) data fetching; keep `localStorage`/token access out of it — use `useAuth()` only. No `apiFetch` calls in this milestone.
- Single commit at the end: "Add split-panel layout shell to SessionsPage".
