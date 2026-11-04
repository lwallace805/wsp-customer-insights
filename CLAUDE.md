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

- **Cohort performance docs** (one Google Sheet per cohort, Jon's intake tabs) — registered in `src/lib/cohortSheets.ts`, keyed by the cohort calendar's cohort key. The doc id lives in code with an env var as an override (`WINTER27_PACING_SHEET_ID`, `FALL26_PACING_SHEET_ID`, `CBS_FALL26_COHORT_DOC_ID`, …), so a rotation is one code change that reaches every environment. Every surface resolves the active cohort's doc through `getActiveCohortSheet()` — Pulse, Cohort Command, `/enrollment`, `/wharton`, `/channels` and the performance dashboards — so a new cohort is wired once. New docs must be shared with the service account (`wsp-dashboard@onyx-philosophy-496115-b5.iam.gserviceaccount.com`) or every reader degrades to "unavailable".

- **Wharton budget workbook** (`src/lib/performance/budgetPlan.ts`) — the marketing team's per-cohort "Paid Marketing Channels Budget Plan" (Winter 2027: `13Ze0z8c_2-lA5xFRoVSiH6kDDD7ycyrX_zsRk78qngI`, owner kta@), registered by cohort key in `BUDGET_PLAN_DOCS` with `WINTER27_BUDGET_PLAN_DOC_ID` as the override. It is a budget **plan**, not the funnel doc `/paid-aggregate` reads, and only `/budget-pacing` (`/api/performance/budget-pacing`) reads it — **internal only; nothing from it may reach `src/lib/whartonPartner.ts` or `/wharton`.** The reader takes the highest-numbered "Budget Pacing (Wharton V<n>)" and "Summary Dashboard (Wharton V<n>)" tabs (V1/V2 are hidden); the unversioned "Budget Pacing (Wharton) - Budgeting 17 Weeks" and "… - Budgting " tabs are working drafts that do not reconcile to the Executive Budget Summary ($972,854 and a different channel split on 2026-10-29) and are never read. Everything is located by label ("Weekly Spend"/"Daily Spend" anchors, "<Channel> Ads" block titles, "Program" headers, "TOTAL" rows); daily cells read "OFF" for a campaign not yet live, which is a planned $0. Every block is checked against its own TOTAL row, the four channel blocks against the All Paid row week by week, and the pacing totals against the summary's channel mix and "Total Budget" cell; a block that fails is withheld with a note rather than shown. The join to actuals: planned spend through yesterday (whole weeks ended + the current week's daily plan × elapsed days) vs the active cohort doc's Paid WoW cohort-to-date "Total (All)" rows via `readPaidWoW(…, { unformatted: true })`. Alignment is **week-from-open as both sheets key it** — week 1 is the partial opening week (10/14-10/19 for Winter 2027), then Monday–Sunday — and the plan's own date ranges decide the current week, because the calendar's `getCohortWeek()` counts 7-day blocks from the open date and lags the sheet by a day on Mondays. The Executive Summary's "Fall 2026 Actual" column is a full-cohort final, shown as the reference the plan was set against, never as a pace benchmark. The doc's raw "Ad Spend" tab (Date | Google | Bing | Facebook, daily) is summed to the same date purely as a cross-check: on 2026-10-29 Paid WoW V2 reported $0 to date while Ad Spend carried $6,197 of Google spend, so the page flags the disagreement rather than silently showing a $0 actual — and never substitutes the Ad Spend figure for the Paid WoW one.

A third static data source lives in `src/data/historicalNPS.json` — pre-Airtable NPS scores that are merged into live data in the `/api/certificates` and homepage stats.

### Auth

NextAuth v4 with Google OAuth, JWT sessions. `src/middleware.ts` protects every route except static assets and redirects unauthenticated users to `/login`. Required env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.

**Who may sign in** is decided by `isAllowedEmail()` in `src/lib/allowedEmails.ts`: any `@wallstreetprep.com` account, plus every Google account on a partner domain listed in the optional `ALLOWED_EXTERNAL_DOMAINS` env var (comma-separated bare domains such as `ibhero.com`, exact match, so no subdomains), plus specific outside Google accounts listed in the optional `ALLOWED_EXTERNAL_EMAILS` env var (comma-separated, matched case-insensitively against the address Google reports for the account). The predicate runs in the `signIn` callback in `src/lib/auth.ts` **and** in middleware on every request, so removing an address or domain from the env vars and redeploying revokes access on the guest's next request rather than when their 30-day JWT expires. Guest access is to the whole hub — for single-page access use the partner gate below instead. Outside accounts also need the Google Cloud OAuth consent screen set to **External** (an Internal consent screen rejects non-Workspace accounts before our callback runs), and while that screen is in Testing status the guest must be listed there as a test user — per account, even on an allowed domain, so domain-wide access only works unattended once the screen is published (Branding needs a homepage and privacy-policy URL first).

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
- **Between cohorts** the page holds on the cohort that just closed. When the
  cohort open for enrollment has no entry in `COHORT_SHEETS` yet (or its env var
  is unset), `resolveShownCohort()` falls back to the previous cohort if THAT is
  wired, reads its doc as of its close date (the history sheet's day-0 "final"
  basis), and sets `closed: true` plus `nextCohort` so the UI shows a closed
  banner, "final enrollment" wording and a Closed badge. It never reaches back
  more than one cohort; two cohorts stale shows the "not connected" message
  instead. Wiring the new cohort's doc into `COHORT_SHEETS` flips the page over.
  The AN Summary history sheet lags a rotation too: its newest "- actual" column
  stays Fall '26 until Andrew adds a Winter '27 column, so `fetchHistoricalWhartonMap()`
  treats that column as closed once the calendar says the cohort has ended — otherwise the
  cohort that just finished would be the one missing from the flat goal and every
  "last 3 cohorts" comparison.
  A held cohort's **headline is the reconciled final** from the tracker's
  "Summary" tab (`readTrackerCohortFinals()`, "Total Enrollments" row, B2B
  included — 957 for Fall 2026), because the doc's deadline table stops at its
  daily-keyed day-0 total (944) and is never reconciled. The running total and
  program split stay on the doc's keyed basis and the page footnotes the gap.
  Note the finals used for the goal and the comparison table are still the AN
  Summary's day-0 values (closer to the tracker's excl.-B2B row), so bases are
  mixed by a few enrollments; moving everything to one basis is a deliberate
  scope decision, not a quick edit.
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
- **Per-program pace** (the running total's program selector) needs the PRIOR
  cohort split day by day, which only exists on the active cohort doc's
  "<Term> Data" tab — `readPriorCohortProgramCurves()`. That tab names AVI "Buy"
  and repeats the header "RDI Enrollments" three times, so its columns are
  resolved inside a window anchored on "PE Overall Enroll" and checked against
  its own total row. Its basis is the cohort doc's Grand Total (Spring 2026 ends
  at 1,002, vs 997 on the AN Summary and 993 on the tracker), so it is only ever
  drawn program-against-same-program; the all-programs view keeps the AN Summary
  curve, and the two are never summed or shown together. The tab's day-0 total must
  also land within 5% of the cohort's AN Summary final or the per-program comparisons
  are withheld — the Winter 2027 doc's "Fall 2026 Data" tab ends at 686 against
  Fall 2026's 953, a narrower enrollment basis that would have drawn every program
  ~28% under where it really closed.
- **Cross-cohort program history** (the Programs' Performance stack) is the one
  figure NOT from the cohort doc: `readProgramMixByCohort()` reads the tracker's
  "Program ROAS Analysis" tab, enrollment block only. Two traps live there — it
  is **B2C only** (so a cohort can land a few under the final shown elsewhere on
  the page; Spring 2026 is 993 here vs 997 there, and the section footnotes the
  difference), and its rows include Columbia's **AI** program, filtered out in
  `COLUMBIA_PROGRAMS` before the payload is built. Each column is checked against
  the sheet's own "Cohort Total" row and dropped if it no longer reconciles.

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
| `/budget-pacing` | `/api/performance/budget-pacing` | Wharton budget workbook + cohort doc Paid WoW (internal) |
| `/wharton` | `/api/wharton/enrollments` | Wharton cohort doc (external, password-gated) |

Pages are a mix of Server Components (homepage) and client components that fetch their own `/api/*` routes. The root layout sets `export const dynamic = 'force-dynamic'` to prevent static caching.

### Key Lib Files

- `src/lib/nps.ts` — `calculateNPS()`, `groupByPeriod()`, `categorize()` — pure NPS math, no I/O.
- `src/lib/certPrograms.ts` — `CERT_PROGRAMS` array (regex patterns to match Airtable survey names to programs), `COHORT_ORDER`, `THEMES` (keyword-based theme extraction), and helpers like `matchProgram()` and `extractThemes()`. Update this file when new certificate programs launch.
- `src/lib/sheets.ts` — `getPacingData()` returns `{ summary, pacing, comparison }`. The column index constants (`COL`) must stay in sync with the Google Sheet layout.

### Deployment

Deployed on Vercel. Pushes to the `dev` branch auto-deploy to `wsp-analytics-dev.vercel.app` via `.github/workflows/preview-dev.yml`. Production deploys from `main`.

### Airtable Field Name Conventions

Airtable "linked record" fields return arrays — all API routes use a `lookup()` helper to safely extract the first element as a string. When adding new Airtable fields, follow this pattern.
