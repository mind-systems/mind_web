# Mind Web

Browser dashboard for viewing historical session data from the Mind mobile app.

## Setup

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

Before running, create `.env.local` in the project root:

```
VITE_API_BASE_URL=http://localhost:3000
```

See `.env.example` for the full list of variables.

## Commands

```bash
npm run dev       # Dev server
npm run build     # Production build into dist/
npm run preview   # Serve the production build locally
npm run lint      # ESLint
npm run typecheck # tsc --noEmit
```

## Stack

React 18 + Vite + TypeScript + TailwindCSS + TanStack Query + ECharts
