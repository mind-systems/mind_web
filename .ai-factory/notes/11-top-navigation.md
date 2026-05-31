# Top Navigation Between Sessions and Calibrations

**Date:** 2026-05-31
**Source:** conversation context — UX review

## Key Findings

- `/calibrations` is unreachable from the UI. The only `<Link>`s in the app point to `/login` (MagicLinkPage) and `/sessions/:id` (SessionList rows). A user can only reach the calibrations page by typing the URL.
- `PageHeader` currently takes a `title` prop and renders just that title + a Log out button. It is the natural place for app navigation, since both pages already render it.

## Details

### Turn `PageHeader` into a top bar

`src/components/PageHeader.tsx` — replace the `title: string` prop with two `NavLink`s; drop the prop entirely (the nav labels double as the page identity).

```tsx
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/core/auth/AuthContext';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'text-sm font-medium transition-colors',
    isActive ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700',
  ].join(' ');

export function PageHeader() {
  const { logout } = useAuth();

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
      <nav className="flex items-center gap-5">
        <NavLink to="/sessions" className={linkClass}>Sessions</NavLink>
        <NavLink to="/calibrations" className={linkClass}>Calibrations</NavLink>
      </nav>
      <button
        type="button"
        onClick={logout}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Log out
      </button>
    </div>
  );
}
```

- `NavLink` resolves active state automatically; `/sessions/:id` keeps "Sessions" active because it is under the `/sessions` path (use `end` only on the root link if exact matching is needed — here prefix matching is the desired behavior so `/sessions/:id` highlights "Sessions").

### Update call sites

- `src/pages/SessionsPage/index.tsx` — `<PageHeader title="Sessions" />` → `<PageHeader />`.
- `src/pages/CalibrationPage/index.tsx` — `<PageHeader title="Calibrations" />` → `<PageHeader />`.

### Layout note

In `SessionsPage` the header sits inside the 280px left column. With two nav links + Log out, `px-6` is tight there. Either keep the bar full-width above the split panel (move `<PageHeader />` out of the left column to span the whole page, with the split panel below it), or reduce the left-column header padding. Spanning the full width is the cleaner top-bar layout and matches `CalibrationPage`, which is already a single full-width column; prefer that — render `<PageHeader />` once at the top of each page and put the split panel beneath it in `SessionsPage`.

## Backs roadmap task

- "Top navigation between Sessions and Calibrations"
