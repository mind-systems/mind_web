# Shared Format Utility + Query Co-location Refactor

**Date:** 2026-05-30
**Source:** Code review — reuse scan + altitude scan

## Key Findings

- `formatSessionDate` and `formatCalibrationDate` produce identical output (`"DD MMM, HH:mm"`) with different implementations — one uses `toLocaleString`, the other a manual MONTHS array; any display change must be applied to both
- The page header (title + Log out button) is copy-pasted between `SessionsPage` and `CalibrationPage` with no shared component
- Instructions and biometrics queries belong in `SessionCharts`, not `SessionsPage` — they are the chart panel's concern, and their fetching re-renders shouldn't propagate to `SessionList`

## Fix 1 — Shared date formatter in core

**Create `src/core/format.ts`** (new file):

```typescript
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Formats an ISO timestamp as "DD MMM, HH:mm" (24-hour, zero-padded, local time). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const day     = String(d.getDate()).padStart(2, '0');
  const month   = MONTHS[d.getMonth()];
  const hours   = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${hours}:${minutes}`;
}

/** Formats a duration in whole seconds as "mm:ss" (zero-padded). */
export function formatDuration(totalSeconds: number): string {
  const secs = Math.floor(totalSeconds);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
```

**Delete** `src/pages/SessionsPage/format.ts` and `src/pages/CalibrationPage/format.ts`.

**Update imports** in 4 files:

| File | Old import | New import |
|---|---|---|
| `src/pages/SessionsPage/SessionList.tsx` | `./format` → `formatSessionDate, formatDuration` | `@/core/format` → `formatDate, formatDuration` |
| `src/pages/SessionsPage/SessionCharts.tsx` | `./format` → `formatSessionDate` | `@/core/format` → `formatDate` |
| `src/pages/CalibrationPage/CalibrationChart.tsx` | *(no format import currently)* | — |
| `src/pages/CalibrationPage/chartOption.ts` | `./format` → `formatCalibrationDate` | `@/core/format` → `formatDate` |

Rename all call sites: `formatSessionDate(x)` → `formatDate(x)`, `formatCalibrationDate(x)` → `formatDate(x)`.

## Fix 2 — Shared PageHeader component

Both `SessionsPage/index.tsx` (lines 62–71) and `CalibrationPage/index.tsx` (lines 50–59) contain:

```tsx
<div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
  <span className="text-lg font-semibold text-gray-900">{title}</span>
  <button type="button" onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
    Log out
  </button>
</div>
```

**Create `src/components/PageHeader.tsx`**:

```tsx
import { useAuth } from '@/core/auth/AuthContext';

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  const { logout } = useAuth();
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
      <span className="text-lg font-semibold text-gray-900">{title}</span>
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

Replace the header block in `SessionsPage/index.tsx` with `<PageHeader title="Sessions" />` and in `CalibrationPage/index.tsx` with `<PageHeader title="Calibrations" />`. Remove the `const { logout } = useAuth()` lines from both pages (unless `logout` is used elsewhere in each page — check before removing).

## Fix 3 — Move queries from SessionsPage into SessionCharts

**Why:** The instructions and biometrics queries are the chart panel's data. When they resolve, they re-render `SessionsPage`, which reconciles `SessionList` with all session rows. Moving the queries down eliminates that unnecessary coupling.

**In `src/pages/SessionsPage/index.tsx`:**

Remove:
- The two `useQuery` calls for `session-instructions` and `session-biometrics` (lines 36–56)
- The computed `from` and `to` variables (lines 33–34)
- The `instructionsData`, `biometricsData`, `instructionsLoading`, `biometricsLoading`, `instructionsError`, `biometricsError` variables
- The corresponding props from `<SessionCharts>` — leave only `session={selectedSession}`

Change `<SessionCharts>` call to:
```tsx
<SessionCharts session={selectedSession} />
```

**In `src/pages/SessionsPage/SessionCharts.tsx`:**

Update `SessionChartsProps`:
```typescript
interface SessionChartsProps {
  session: SessionRun;
}
```

Add the two `useQuery` calls inside the component (using `session.id`, `session.startedAt`, `session.endedAt`):

```typescript
const from = encodeURIComponent(session.startedAt);
const to   = encodeURIComponent(session.endedAt);

const { data: instructions = [], isLoading: instructionsLoading, isError: instructionsError } =
  useQuery({
    queryKey: ['session-instructions', session.id],
    queryFn: () => apiFetch<InstructionDto[]>(
      `/sessions/runs/${session.id}/instructions?from=${from}&to=${to}`
    ),
  });

const { data: biometrics = [], isLoading: biometricsLoading, isError: biometricsError } =
  useQuery({
    queryKey: ['session-biometrics', session.id],
    queryFn: () => apiFetch<BioSampleDto[]>(
      `/sessions/runs/${session.id}/biometrics?from=${from}&to=${to}`
    ),
  });
```

Note: `enabled` is no longer needed — `SessionCharts` is only rendered when `selectedSession` is defined (the parent guards this), so `session.id` is always valid.

Add imports for `useQuery`, `apiFetch`, `InstructionDto`, `BioSampleDto` to `SessionCharts.tsx`. Remove them from `SessionsPage/index.tsx` if no longer needed there.
