---
name: wsp-cert-program-launch
description: This skill should be used when the user asks to "add a new certificate program", "onboard a new cohort", "a new program just launched", "add Wharton Cohort IV", "the new program isn't showing up in the NPS trend", "add a new cert to the dashboard", or reports that a certificate program's data is missing, incomplete, or not trending correctly on the /certificates page. Applies to changes touching src/lib/certPrograms.ts, src/data/historicalNPS.json, or src/app/api/certificates/route.ts.
---

# Onboarding a new certificate program or cohort

## The three places a program has to be registered

A new cert program (or a new cohort of an existing program) has to be added in up to three places — missing any one of them produces a partial, confusing result rather than a clean failure:

1. **`CERT_PROGRAMS` in `src/lib/certPrograms.ts`** — one entry per program:
   ```ts
   { id: 'private-equity', label: 'Private Equity', pattern: /private equity/i,
     historicalLabel: 'Private Equity', color: 'text-violet-600', hex: '#7c3aed' }
   ```
   - `pattern` matches the **live Airtable survey name** (`matchProgram()` tests it against the `Survey Name` field) — write it loose enough to catch naming variants but specific enough not to false-match a different program. Look at the Wharton cohort entries for the failure mode to avoid: `wharton cohort i\b`, `wharton cohort ii\b`, `wharton cohort iii\b` all need the `\b` word boundary, or `wharton cohort i` would also match inside "wharton cohort ii" and "wharton cohort iii" (substring match, not exact match).
   - `historicalLabel` matches the `program` field in `historicalNPS.json` via `matchProgramByLabel()` — which also falls back to matching `label` (`p.historicalLabel === label || p.label === label`). It's allowed to differ from `label` (see the Wharton cohorts, which have `historicalLabel: ''` because they have no historical/pre-Airtable data) — leave it `''` rather than guessing a label that doesn't exist in the historical file. Latent trap in the `''` convention: a historical row whose `program` field is an *empty string* will match the first program with an empty `historicalLabel` (currently Wharton Cohort I) instead of being rejected — don't let blank `program` values into the historical file.
   - Pick an unused `color`/`hex` pair — these render as the program's line color on every chart. Check the existing list isn't already using a near-identical hue for a program that will appear on the same chart.

2. **`COHORT_ORDER` in the same file** — an explicit oldest→newest array of cohort labels (e.g. `'Fall 2024'`, `'Spring 2026'`). This is the trap: `/api/certificates` derives per-program *overall* stats (`byProgram`) directly from `CERT_PROGRAMS`, so a new program shows up there with zero extra steps. But the **trend/sparkline data** (`cohortData`, `trendByProgram`) is built by iterating `COHORT_ORDER` and filtering responses into each slot — a cohort label that exists in the data but isn't in `COHORT_ORDER` is silently dropped from every trend chart while still counting toward the overall NPS score. This produces the specific, confusing symptom of "the program's NPS number is right but its trend line is missing or truncated." Add every new cohort label here as soon as it starts producing data, not after someone notices the chart looks wrong.

3. **`src/data/historicalNPS.json`** — only needed if you're backfilling pre-Airtable data for the new program. Each row's `program` field must exactly string-match some `CERT_PROGRAMS[].historicalLabel` (via `matchProgramByLabel`), and `cohort` must exactly string-match an entry in `COHORT_ORDER` — both are exact-string lookups, not fuzzy, so a stray trailing space or a "2024" vs "'24" mismatch silently excludes the row rather than erroring.

## How a live survey response actually gets a cohort label

Live Airtable responses don't carry an explicit cohort field — `dateToCohort()` in `src/app/api/certificates/route.ts` derives it from the response date (`Winter`/`Spring`/`Summer`/`Fall` + year, by calendar month). If a program's cohort naming doesn't follow the calendar seasons (e.g. a cohort that runs Nov–Feb and should count as one cohort, not split across Fall and Winter), `dateToCohort()` will silently split its responses across two `COHORT_ORDER` buckets. Check this before assuming a cohort's data is "missing" — it may be present but split. Also note the silent fallback: a record with **no date** returns the hardcoded `'Spring 2026'`, permanently misfiling dateless responses into a fixed (now past) cohort — exactly the silent-fallback class to make loud rather than extend.

## Sequence for adding a new program

1. Confirm the exact live Airtable survey name (check `/explore` or a sample record) before writing `pattern` — don't guess from the marketing name.
2. Add the `CERT_PROGRAMS` entry.
3. Add every cohort label the program has ever run (past or upcoming) to `COHORT_ORDER`, in chronological position.
4. If backfilling history, add matching rows to `historicalNPS.json` with exact-matching `program`/`cohort` strings.
5. Verify with real data, not just "no errors" — see below.

## Verification

Hit `/api/certificates` directly (or use the preview tools) and check, for the new program specifically:
- `byProgram` includes it with a non-zero `totalResponses`.
- `trend` and `trendByProgram` show a data point for **every cohort** the program has responses for — this is the check that catches the `COHORT_ORDER` omission, since `byProgram` alone won't reveal it.
- If historical data was added, `totalHistorical` increased by the expected count and at least one historical response for the new program appears in `responses`.
- Load the actual `/certificates` page and visually confirm the new program's line appears on the trend chart with a distinct color from its neighbors — a program silently dropped from `COHORT_ORDER` renders as "chart looks the same as before," which won't trip a console error or a JSON schema check.
