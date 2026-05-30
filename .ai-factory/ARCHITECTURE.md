# Architecture: Feature-Based Modules (React SPA)

## Overview

`mind_web` is a read-only browser SPA. The architecture is a lightweight feature-based module structure adapted for React: each top-level page is a self-contained feature module that fetches its own data and composes shared UI components. A thin `core/` layer provides the API client, auth context, and shared types. There are no write operations, no local state beyond the auth token, and no domain logic — data arrives from `mind_api` and is displayed.

This pattern sits between flat Layered Architecture and full Structured Modules. It was chosen because the project has a small number of well-isolated pages, low domain complexity, and a single data source (REST API). Introducing module boundaries heavier than `pages/` + `core/` would be premature.

## Decision Rationale

- **Project type:** Read-only browser dashboard — no mutations, no offline, no local persistence
- **Tech stack:** React 18, Vite, TypeScript, TailwindCSS, React Query, ECharts
- **Key factor:** Four independent pages with minimal shared logic; React Query replaces the repository/service layer; no domain models needed beyond DTOs

## Folder Structure

```
src/
├── core/                         ← SHARED INFRASTRUCTURE
│   ├── api/
│   │   └── client.ts             ← apiFetch<T>(), ApiError, auth interceptor
│   ├── auth/
│   │   └── AuthContext.tsx        ← AuthProvider, useAuth(), token storage
│   ├── types/
│   │   └── index.ts              ← shared TS types (DTO shapes mirroring mind_api)
│   └── config.ts                 ← reads VITE_API_BASE_URL, startup assertion
│
├── pages/                        ← FEATURE MODULES (one per route)
│   ├── LoginPage/
│   │   └── index.tsx             ← email OTP flow + Google Sign-In
│   ├── SessionsPage/
│   │   ├── index.tsx             ← split-panel host: session list (left) + charts panel (right)
│   │   ├── InstructionTimeline.tsx
│   │   └── BiometricCharts.tsx
│   └── CalibrationPage/
│       ├── index.tsx             ← NFB calibration history grouped by device
│       └── CalibrationTrends.tsx
│
├── components/                   ← SHARED UI (stateless or local state only)
│   ├── ProtectedRoute.tsx        ← redirects to /login when token absent
│   ├── SkeletonLoader.tsx
│   └── ErrorMessage.tsx
│
├── router.tsx                    ← React Router v6 createBrowserRouter config
└── main.tsx                      ← entry point: RouterProvider + QueryClientProvider (AuthProvider is inside the router via AuthLayout)
```

## Dependency Rules

```
pages/     →  core/api, core/auth, core/types, components/
components/ →  core/types only (no direct API calls)
core/api    →  core/config, core/types
core/auth   →  (no imports from other src/ folders)
```

- ✅ Pages import from `core/` and `components/`
- ✅ Components import from `core/types` only
- ✅ `core/api` is the only place that calls `fetch` — no raw HTTP in pages
- ✅ `core/auth` is the only place that reads/writes `localStorage`
- ❌ Components must not call `apiFetch` directly — data flows down as props from pages
- ❌ `core/` must not import from `pages/` or `components/`
- ❌ Pages must not read `localStorage` directly — use `useAuth()` and `useQuery()`

## Layer Communication

- **Data fetching:** pages use React Query `useQuery` hooks that call `apiFetch`. No data fetching in components.
- **Auth state:** pages and `ProtectedRoute` access auth via `useAuth()`. The API client reads the token from `localStorage` at call time (no React dependency).
- **Props down:** pages pass pre-fetched data to chart/timeline sub-components as typed props. Sub-components are pure render functions.

## Key Principles

1. **Single fetch point:** All HTTP calls go through `core/api/client.ts`. This is the only place where the base URL is prepended, the auth header is injected, and 401s are handled.
2. **Auth is a context, not a prop:** Components never receive the JWT token as a prop. They call `useAuth()` or simply render data passed down from the page.
3. **Pages own data, components own presentation:** A page fetches and transforms data; it passes shaped data to chart/list components. Components must not know about API shapes — they receive typed view-model props.
4. **No domain logic:** There are no validators, business rules, or state machines. Data arrives from `mind_api` and is displayed as-is. Transformations (unit conversion, flattening jsonb arrays) happen inside the `useQuery` `select` option, close to the fetch site.
5. **React Query is the cache:** No Redux, no Zustand. `QueryClient` holds all server state. Local UI state (form inputs, pagination offset) lives in `useState` inside the page component.

## Code Examples

### apiFetch — typed fetch wrapper

```typescript
// src/core/api/client.ts
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('mind_auth_token');
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('mind_auth_token');
    window.location.href = '/login';
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? 'Request failed');
  }

  return res.json() as Promise<T>;
}
```

### Page fetching data, component rendering it

```typescript
// src/pages/SessionsPage/index.tsx  ← page owns the query
export function SessionsPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['session-biometrics', id],
    queryFn: () => apiFetch<BioSampleDto[]>(`/sessions/runs/${id}/biometrics`),
    select: flattenBioSamples,           // transform close to the fetch site
  });

  if (isLoading) return <SkeletonLoader />;
  return <BiometricCharts samples={data ?? []} />;  // passes shaped props
}

// src/pages/SessionsPage/BiometricCharts.tsx  ← component only renders
interface Props { samples: BioSampleDto[] }

export function BiometricCharts({ samples }: Props) {
  const heartRate = samples
    .filter(s => s.sampleType === 'heart_rate')
    .map(s => ({ value: s.data.value }));
  const option = {
    xAxis: { type: 'category' },
    yAxis: { type: 'value' },
    series: [{ data: heartRate, type: 'line', color: '#f88d8d' }],
  };
  return <ReactECharts option={option} />;
}
```

### ProtectedRoute

```typescript
// src/components/ProtectedRoute.tsx
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

## Anti-Patterns

- ❌ **Fetch in components** — calling `apiFetch` or `useQuery` inside a shared component. Data flows down as props; only pages initiate fetches.
- ❌ **Raw localStorage access** — reading or writing `mind_auth_token` outside `core/auth/AuthContext.tsx` and `core/api/client.ts`.
- ❌ **Inline chart data shaping** — transforming raw API responses inside JSX. Shape data in the `select` option of `useQuery` or a named transform function above the return statement.
- ❌ **Cross-page imports** — `SessionsPage` importing a component defined inside `CalibrationPage`. Move shared components to `components/`.
- ❌ **God page component** — a single 500-line `SessionsPage`. Extract `InstructionTimeline` and `BiometricCharts` as sibling files inside `pages/SessionsPage/`.
