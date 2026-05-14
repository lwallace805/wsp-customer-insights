# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build (type-checks + compiles)
npm run lint     # ESLint
```

There is no test runner configured in this project.

## Architecture

**WSP Analytics Hub** is an internal Next.js 16 (App Router) dashboard for Wall Street Prep. It aggregates NPS survey data, enrollment pacing, and certificate program analytics in one place, restricted to `@wallstreetprep.com` Google accounts.

### Data Sources

Two external data sources power the app:

- **Airtable** (`src/lib/airtable.ts`) — NPS survey responses and SurveyMonkey survey metadata. The base/table/field names are all driven by env vars (e.g. `AIRTABLE_BASE_ID`, `NPS_TABLE_NAME`, `NPS_SCORE_FIELD`) so the defaults in each API route can be overridden without code changes.
- **Google Sheets** (`src/lib/sheets.ts`) — Enrollment pacing data read from a specific tab (`Overall Cohort - AN Summary`) using a service account. Column indices are hardcoded in the `COL` constant. Requires `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON string) and `GOOGLE_PACING_SHEET_ID`.

A third static data source lives in `src/data/historicalNPS.json` — pre-Airtable NPS scores that are merged into live data in the `/api/certificates` and homepage stats.

### Auth

NextAuth v4 with Google OAuth, JWT sessions. `src/middleware.ts` protects every route except static assets and redirects unauthenticated users to `/login`. The `signIn` callback in `src/lib/auth.ts` blocks any email not ending in `@wallstreetprep.com`. Required env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.

### Page / API Structure

Each dashboard section has a page under `src/app/` and a corresponding API route under `src/app/api/`:

| Page | Route | Data source |
|------|-------|-------------|
| `/` | — | Direct lib calls (server component) |
| `/nps` | `/api/nps` | Airtable NPS table |
| `/certificates` | `/api/certificates` | Airtable + `historicalNPS.json` |
| `/enrollment` | `/api/enrollment` | Google Sheets |
| `/surveys` | `/api/surveys` | Airtable survey meta table |
| `/insights` | `/api/learner-intelligence` | Airtable NPS (cert programs only) |
| `/explore` | `/api/explore` | Airtable schema introspection |

Pages are a mix of Server Components (homepage) and client components that fetch their own `/api/*` routes. The root layout sets `export const dynamic = 'force-dynamic'` to prevent static caching.

### Key Lib Files

- `src/lib/nps.ts` — `calculateNPS()`, `groupByPeriod()`, `categorize()` — pure NPS math, no I/O.
- `src/lib/certPrograms.ts` — `CERT_PROGRAMS` array (regex patterns to match Airtable survey names to programs), `COHORT_ORDER`, `THEMES` (keyword-based theme extraction), and helpers like `matchProgram()` and `extractThemes()`. Update this file when new certificate programs launch.
- `src/lib/sheets.ts` — `getPacingData()` returns `{ summary, pacing, comparison }`. The column index constants (`COL`) must stay in sync with the Google Sheet layout.

### Deployment

Deployed on Vercel. Pushes to the `dev` branch auto-deploy to `dev.wsp-customer-insights.vercel.app` via `.github/workflows/preview-dev.yml`. Production deploys from `main`.

### Airtable Field Name Conventions

Airtable "linked record" fields return arrays — all API routes use a `lookup()` helper to safely extract the first element as a string. When adding new Airtable fields, follow this pattern.
