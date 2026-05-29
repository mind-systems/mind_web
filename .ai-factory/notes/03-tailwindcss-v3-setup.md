# TailwindCSS v3 Setup

**Date:** 2026-05-30
**Source:** conversation context — roadmap review session

## Key Findings

- Pin explicitly to v3 (`tailwindcss@3`) — bare `npm install tailwindcss` resolves v4, which has completely different setup mechanics
- v3 uses `tailwind.config.js` + PostCSS; v4 uses `@tailwindcss/vite` and no config file — incompatible setups
- The three CSS directives are separate lines, not a single `@tailwind base/components/utilities` line

## Details

### Why pin to v3

TailwindCSS v4 (released 2025) is a breaking redesign:
- No `tailwind.config.js` — config lives in CSS via `@theme`
- No PostCSS dependency — requires a Vite plugin (`@tailwindcss/vite`)
- CSS import is `@import "tailwindcss"`, not the three-directive form
- `npx tailwindcss init -p` does not exist in v4

The ROADMAP describes v3 setup. Pin explicitly.

### Installation

```bash
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

Creates `tailwind.config.js` and `postcss.config.js`.

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

`content` must cover both `./index.html` and `./src/**/*.{ts,tsx}` — omitting either means classes used only in that location will be purged from the production build.

### src/index.css — three separate directives

Add at the **top** of `src/index.css`, before any existing styles:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

These must be three separate lines. A single `@tailwind base/components/utilities` directive is not valid Tailwind v3 syntax.

### index.html — title update

Change `<title>Vite + React + TS</title>` → `<title>Mind</title>`.

### Acceptance criterion

Add `className="text-blue-500"` to any visible element in `src/App.tsx` temporarily. Start `npm run dev` and confirm the text renders in Tailwind's `#3b82f6` (blue-500). Remove the test class afterward.

### What NOT to do

- ❌ `npm install tailwindcss` without `@3` — installs v4
- ❌ `npm install @tailwindcss/vite` — v4 Vite plugin, incompatible with this setup
- ❌ `@import "tailwindcss"` in CSS — v4 syntax
- ❌ Single `@tailwind base/components/utilities` — not valid v3 syntax
