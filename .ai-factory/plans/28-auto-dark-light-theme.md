# Plan: Auto dark/light theme

## Context
Add OS-preference-driven dark mode to the web dashboard so all UI and ECharts canvases follow the user's `prefers-color-scheme` with no manual toggle.

> **Review note (M1):** Tailwind v3 (`tailwindcss@^3.4.19` is installed) already defaults `darkMode` to `'media'`, so `dark:` variants resolve from `prefers-color-scheme` even without Task 1. Setting it explicitly is kept for clarity of intent, but the *enabling* work is the global background backstop (Task 1) and the `dark:` sweep (Tasks 5–8), not the config flag alone.

## Settings
- Testing: no
- Logging: minimal
- Docs: no

## Tasks

### Phase 1: Theme foundation

- [x] **Task 1: Make dark mode explicit and add a global theme backstop**
  Files: `tailwind.config.js`, `src/index.css`
  1. Add `darkMode: 'media'` to the exported Tailwind config object (alongside `content`, `theme`, `plugins`) to make intent explicit.
  2. The app shell has several transparent containers with no `bg-*` class; they render over the browser-default white `<body>` (`index.html` and `index.css` set no background). A `dark:` sweep that only rewrites existing classes leaves these white in dark mode (review **C2**). Add a global backstop to `src/index.css` after the `@tailwind` directives so the document base always follows the theme:
     ```css
     @layer base {
       :root { color-scheme: light dark; }
       body { @apply bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100; }
     }
     ```
     `color-scheme: light dark` makes native scrollbars/form chrome follow the OS theme; the `body` rule guarantees no white flash on overscroll or behind transparent shells.

- [x] **Task 2: Make EChart canvas follow OS theme** (depends on Task 1)
  Files: `src/components/EChart/index.tsx`
  ECharts is canvas-based and ignores CSS `dark:` classes, so the theme must be passed to `echarts.init()`. Implement:
  1. Track the current preference in `useState` (`isDark`), initialized from `window.matchMedia('(prefers-color-scheme: dark)').matches`.
  2. In the init `useEffect`, pass `isDark ? 'dark' : undefined` as the second arg to `echarts.init()`. Add `isDark` to that effect's dependency array so the existing dispose/re-init cleanup re-creates the chart when the OS theme switches at runtime. Keep the `ResizeObserver` setup.
  3. **(review C1)** The two effects are independent: re-running the init effect does **not** re-run the separate `setOption` effect (its deps `[option, notMerge]` are unchanged — `option` is a stable `useMemo` in both `SessionCharts` and `CalibrationChart`), so after a theme switch the chart would re-init to a blank canvas. Fix by calling `chart.setOption(option, notMerge ?? false)` inside the init effect immediately after `echarts.init(...)`, and add `option`/`notMerge` to the init effect's deps. (The standalone `setOption` effect may then be removed, or kept — but the init effect must apply the option itself so the chart is never left empty after re-init.)
  4. **(review M3)** The bundled `'dark'` theme paints its own dark-navy background (`#100C2A`), which clashes with the `gray-900/950` surfaces. Add `backgroundColor: 'transparent'` so charts blend with the panel. Do this once at the wrapper level — when calling `setOption`, merge a `{ backgroundColor: 'transparent' }` default under the passed `option` (e.g. `chart.setOption({ backgroundColor: 'transparent', ...(option as object) }, notMerge ?? false)`), so the two consuming `chartOption.ts` builders need no change.
  5. Subscribe to the media query `change` event in its own `useEffect` (with matching `removeEventListener` cleanup; `addEventListener('change', …)` is correct for current targets) to update `isDark`.
  Do not change the `EChartProps` interface or the consuming call sites.

### Phase 2: Shared components

- [x] **Task 3: Add dark variants to ModuleBadge styles** (depends on Task 1)
  Files: `src/components/moduleMeta.ts`, `src/components/ModuleBadge.tsx`
  Shift each colored badge background to a 900-level dark variant. In `MODULE_STYLES`: `breath` → `bg-sky-50 text-sky-700 dark:bg-sky-900 dark:text-sky-300`; `meditation` → `bg-violet-50 text-violet-700 dark:bg-violet-900 dark:text-violet-300`. In `ModuleBadge.tsx`, the fallback string `bg-gray-100 text-gray-600` → add `dark:bg-gray-800 dark:text-gray-400`.

- [x] **Task 4: Add dark variant to SkeletonLoader pulse** (depends on Task 1)
  Files: `src/components/SkeletonLoader.tsx`
  The pulse placeholders use `bg-gray-200`; add `dark:bg-gray-700` to both placeholder `div`s.

- [x] **Task 5: Add dark variants to PageHeader** (depends on Task 1)
  Files: `src/components/PageHeader.tsx`
  **(review C2)** The header has **no surface `bg-*` class** today (only `border-b border-gray-200`) — there is nothing to "convert", so a surface background must be *added*. On the root `<div>`: add `bg-white dark:bg-gray-900` and map the border `border-gray-200 → add dark:border-gray-700`. Map the nav/links/button text per the mapping table: active link `text-gray-900 → add dark:text-gray-100`; inactive/logout `text-gray-500 → add dark:text-gray-400`, `hover:text-gray-700 → add dark:hover:text-gray-300`.

### Phase 3: Page modules

- [x] **Task 6: Add dark variants to auth pages** (depends on Task 1)
  Files: `src/pages/LoginPage/index.tsx`, `src/pages/MagicLinkPage/index.tsx`, `src/pages/GoogleCallbackPage/index.tsx`
  Apply the color mapping to the card surfaces, inputs (add `dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500`), divider, and buttons in `LoginPage`; card/background surfaces in `MagicLinkPage` and `GoogleCallbackPage`. Where a card/page container lacks an explicit `bg-*`, *add* a base + dark background (e.g. `bg-white dark:bg-gray-900` for cards) rather than only rewriting existing classes. Keep blue accent classes unchanged.

- [x] **Task 7: Add dark variants to SessionsPage module** (depends on Task 1)
  Files: `src/pages/SessionsPage/index.tsx`, `src/pages/SessionsPage/SessionList.tsx`, `src/pages/SessionsPage/SessionCharts.tsx`, `src/pages/SessionsPage/ModuleFilter.tsx`
  **(review C2)** The page root and right panel are transparent (`flex h-screen flex-col overflow-hidden`, etc.) — *add* backgrounds, don't just rewrite. Specifically:
  - `index.tsx` root `<div>`: add `bg-gray-50 dark:bg-gray-950`. Left-column divider `border-r border-gray-200 → add dark:border-gray-700`. "Select a session" placeholder `text-gray-400 → add dark:text-gray-500`.
  - `SessionList.tsx`: list rows, selected state, hover, and any borders/text per the mapping table; add explicit backgrounds where rows rely on a transparent ancestor.
  - `SessionCharts.tsx`: panel header surface/border, section text, and empty states per the mapping.
  - `ModuleFilter.tsx`: segmented-control surfaces and active state per the mapping.
  Do not touch `chartOption.ts`/`transforms.ts`/`sessionTitle.ts` — chart series colors are handled by the ECharts dark theme + transparent background from Task 2.

- [x] **Task 8: Add dark variants to CalibrationPage module** (depends on Task 1)
  Files: `src/pages/CalibrationPage/index.tsx`, `src/pages/CalibrationPage/CalibrationChart.tsx`
  - `index.tsx`: page root `<div>` (`flex h-screen flex-col overflow-hidden`) — *add* `bg-gray-50 dark:bg-gray-950`. Empty-state `text-gray-400 → add dark:text-gray-500`; "Loading…" `text-gray-400 → add dark:text-gray-500`. (The `text-red-500` error keeps reading on both themes — leave as-is.)
  - `CalibrationChart.tsx` **(review M2 — widen beyond the section container)**: section border `border-gray-100 → add dark:border-gray-800`; device serial `text-gray-800 → add dark:text-gray-200`; valid-count pill `bg-gray-100 → add dark:bg-gray-800` and `text-gray-500 → add dark:text-gray-400`.
  Leave `chartOption.ts`/`transforms.ts` alone.

## Color mapping reference (apply consistently in Tasks 5–8)

| Light class | Dark variant |
|---|---|
| `bg-white` | `dark:bg-gray-900` |
| `bg-gray-50` | `dark:bg-gray-950` |
| `bg-gray-100` | `dark:bg-gray-800` |
| `bg-gray-200` | `dark:bg-gray-700` |
| `text-gray-900` | `dark:text-gray-100` |
| `text-gray-800` | `dark:text-gray-200` |
| `text-gray-700` | `dark:text-gray-300` |
| `text-gray-600` / `text-gray-500` | `dark:text-gray-400` |
| `text-gray-400` | `dark:text-gray-500` |
| `border-gray-300` | `dark:border-gray-600` |
| `border-gray-200` | `dark:border-gray-700` |
| `border-gray-100` | `dark:border-gray-800` |
| `shadow-md` | `dark:shadow-gray-900/50` |
| Input `bg-white` | `dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500` |

Notes:
- Blue accent classes (`bg-blue-600`, focus rings) and `text-red-500` errors read on both themes — leave unchanged.
- **Add, don't only rewrite:** containers that have *no* `bg-*` class today (page roots, `PageHeader`, transparent panels/rows) must get a base + dark background added, not just a `dark:` variant on a class that isn't there. The global `body` backstop from Task 1 covers the document base, but per-surface backgrounds are still needed wherever a panel must contrast with the page.

## Verification
- Switch macOS to dark mode → entire UI (shell, page roots, header, cards, list rows) switches; no white shell, no white flash on overscroll.
- ECharts charts render with the dark theme and a transparent background that blends into the gray panel (no navy rectangle).
- Toggle OS theme at runtime while a chart is visible → chart re-renders populated (not blank) in the new theme.
- Switch back to light → all reverts.
- `npm run lint` and `npm run typecheck` pass.

## Commit Plan
- **Commit 1** (after tasks 1-2): "Add media dark mode config, global theme backstop, and ECharts dark theme support"
- **Commit 2** (after tasks 3-5): "Add dark variants to shared components"
- **Commit 3** (after tasks 6-8): "Add dark variants to auth, sessions, and calibration pages"
