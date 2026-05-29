# Project: Mind Web

## Overview

Browser-based dashboard for viewing historical session data collected by the Mind mobile app. Users authenticate with the same credentials as the mobile app — Google Sign-In or passwordless email OTP — and then browse past breathing sessions, inspect time-aligned biometric data charts (heart rate, EEG bands, emotions), and track NFB calibration history across BCI devices. Read-only view of data already stored in mind_api.

## Core Features

- Authentication via Google Sign-In and passwordless email OTP — same API endpoints and JWT token format as the mobile app
- Session history list: date, duration, complexity for each completed module session
- Session detail: breathing-phase instruction timeline aligned on a shared time axis with biometric streams (heart rate, EEG bands delta/theta/alpha/SMR/beta, emotions attention/relaxation/cognitiveLoad/cognitiveControl/selfControl)
- NFB calibration history per BCI device serial — trend charts for individual frequency, bandwidth, and normalized power across calibration runs

## Tech Stack

- **Language:** TypeScript
- **Framework:** React 18 + Vite
- **Styling:** TailwindCSS
- **Routing:** React Router v6
- **Data fetching:** TanStack Query (React Query)
- **Charts:** Recharts
- **Auth:** JWT in localStorage, same token format as mobile; Google Sign-In via Web OAuth redirect; email OTP via REST API

## Architecture

See `.ai-factory/ARCHITECTURE.md` for detailed architecture guidelines.
Pattern: Feature-Based Modules (React SPA)

## Architecture Notes

Single-page app with three protected pages and one public login page. No server-side rendering. API client is a typed fetch wrapper with an auth interceptor that injects the JWT token and redirects to `/login` on 401. All data is fetched on demand via React Query — no persistent local store.

The web dashboard is read-only and requires no new write endpoints on `mind_api`. It does require new REST endpoints for querying `module_sessions`, `bio_session_samples`, `session_stream_samples`, and `nfb_calibration_records` — these are defined in the roadmap under the API Additions phase.
