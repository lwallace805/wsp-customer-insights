# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build (type-checks + compiles)
npm run lint     # ESLint
```

There is no test runner configured in this project.

## Quality Gates (mandatory)

Two gates run on every task, without being asked:

1. **Before declaring any task complete** ("done", "built", "fixed", "ready"), run the `qa-verification-loop` skill: restate the original ask and diff the result against it; verify by executing and observing (hit the API route, load the page, exercise filters/toggles — never hand off from the diff); re-derive at least one headline number by an independent path; do a human-sense pass on the literal output (labels, units, time boundaries, impossible values); then report **what was verified and how**, not just what changed. For bug fixes, reproduce the symptom first and confirm it's gone after.
2. **Before presenting any analysis, diagnostic, or recommendation as final**, run the `critical-thinking-analysis-review` skill: define the metric (numerator/denominator/where/window), audit time-alignment and cohort maturity, sweep confounds before assigning a cause, state absolute counts behind percentages and check moves against historical variance, and steelman the "this is a measurement artifact" counter-conclusion.

Both skills are user-global (`~/.claude/skills/`). If they're unavailable in this environment, follow the summaries above directly. Domain playbooks for this repo's recurring work live in `.claude/skills/` (`wsp-enrollment-pacing`, `wsp-airtable-integration`, `wsp-cert-program-launch`) — consult the relevant one before touching `src/lib/sheets.ts`, Airtable-backed routes, or `src/lib/certPrograms.ts`.

## Architecture

**WSP Analytics Hub** is an internal Next.js 16 (App Router) dashboard for Wall Street Prep. It aggregates NPS survey data, enrollment pacing, and certificate program analytics in one place, restricted to `@wallstreetprep.com` Google accounts.

### Data Sources

Two external data sources power the app:

- **Airtable** (`src/lib/airtable.ts`) — NPS survey responses and SurveyMonkey survey metadata. The base/table/field names are all driven by env vars (e.g. `AIRTABLE_BASE_ID`, `NPS_TABLE_NAME`, `NPS_SCORE_FIELD`) so the defaults in each API route can be overridden without code changes.
- **Google Sheets** (`src/lib/sheets.ts`) — Enrollment pacing data read from a specific tab (`Overall Cohort - AN Summary`) using a service account. Column indices are hardcoded in the `COL` constant. Requires `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON string) and `GOOGLE_PACING_SHEET_ID`.

A third static data source lives in `src/data/historicalNPS.json` — pre-Airtable NPS scores that are merged into live data in the `/api/certificates` and homepage stats.

### Auth

NextAuth v4 with Google OAuth, JWT sessions. `src/middleware.ts` protects every route except static assets and redirects unauthenticated users to `/login`. The `signIn` callback in `src/lib/auth.ts` blocks any email not ending in `@wallstreetprep.com`. Required env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.

### The Wharton partner surface (`/wharton`)

One external, password-gated dashboard for the Wharton Online team — enrollments
for the current Wharton cohort, total and by program. It is the **only** route
outside the internal Google gate, and it is deliberately narrow:

- **Scope is enforced in the payload**, not the UI. `src/lib/whartonPartner.ts`
  returns enrollments plus (since the Aug 25 1-1) a goal held **flat to the
  prior cohort's final** and cohort comparisons aligned by days-to-close (pace
  vs. the prior cohort, plus a last-3-closed-cohorts table showing each
  cohort's own final — never the internal per-cohort goals).
  Still excluded: leads, spend, CVR, Columbia data, and — critically — the
  **internal budget/plan trajectory** (the cohort doc's "Forecast Enrollments"
  column and its endpoint). The only pace baseline shown externally is the prior
  cohort's own curve, which ends at the flat goal by definition. Anything absent
  from the payload cannot leak onto the page through a later UI edit. Keep it
  that way when adding to this surface.
- **Access** (`src/lib/partnerAccess.ts`): a shared password is exchanged at
  `POST /api/wharton/session` for an HMAC-signed, HttpOnly cookie
  (`wsp_partner_wharton`) valid 30 days. The token embeds a fingerprint of the
  password that minted it, so **changing `WHARTON_ACCESS_PASSWORD` immediately
  revokes every cookie already issued** — that is the revocation mechanism.
  The gate fails closed: no password or no signing secret configured → nobody in.
- **Middleware** runs the partner branch before NextAuth. The partner cookie is
  accepted on `/wharton` and `/api/wharton` only; an internal Google session also
  works, so staff following the nav link aren't asked for the partner password.
- **Env vars**: `WHARTON_ACCESS_PASSWORD` (required), `WHARTON_COOKIE_SECRET`
  (recommended; falls back to `NEXTAUTH_SECRET`), `WHARTON_HOST` (optional — a
  hostname that serves only this dashboard, e.g. `wharton.example.com`, with `/`
  mapped to `/wharton` and every other path mapped into it).
- **Data** comes from `readDeadlineTable()` — the same reader Pulse, Weekly and
  Cohort Command use — so the partner page cannot disagree with an internal
  surface. Per-program figures are the table's own `<PROGRAM> Total Enrollment`
  columns; the reader asserts they sum to the cohort total and the page withholds
  the breakdown rather than showing a split that doesn't reconcile.

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
| `/wharton` | `/api/wharton/enrollments` | Wharton cohort doc (external, password-gated) |

Pages are a mix of Server Components (homepage) and client components that fetch their own `/api/*` routes. The root layout sets `export const dynamic = 'force-dynamic'` to prevent static caching.

### Key Lib Files

- `src/lib/nps.ts` — `calculateNPS()`, `groupByPeriod()`, `categorize()` — pure NPS math, no I/O.
- `src/lib/certPrograms.ts` — `CERT_PROGRAMS` array (regex patterns to match Airtable survey names to programs), `COHORT_ORDER`, `THEMES` (keyword-based theme extraction), and helpers like `matchProgram()` and `extractThemes()`. Update this file when new certificate programs launch.
- `src/lib/sheets.ts` — `getPacingData()` returns `{ summary, pacing, comparison }`. The column index constants (`COL`) must stay in sync with the Google Sheet layout.

### Deployment

Deployed on Vercel. Pushes to the `dev` branch auto-deploy to `dev.wsp-customer-insights.vercel.app` via `.github/workflows/preview-dev.yml`. Production deploys from `main`.

### Airtable Field Name Conventions

Airtable "linked record" fields return arrays — all API routes use a `lookup()` helper to safely extract the first element as a string. When adding new Airtable fields, follow this pattern.
