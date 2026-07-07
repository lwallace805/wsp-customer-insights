---
name: wsp-airtable-integration
description: This skill should be used when the user asks to "add a new Airtable field", "wire up a new NPS field", "add a field to the survey data", "pull a new column from Airtable", "add a new API route backed by Airtable", "hook up a new dashboard page to Airtable data", or reports that a field/filter is missing or blank on the /nps, /certificates, /surveys, or /insights pages of the WSP Analytics Hub. Applies to any change touching src/lib/airtable.ts or an API route under src/app/api/ that reads from Airtable.
---

# Adding or extending an Airtable-backed field

## Where the pieces live

`src/lib/airtable.ts` is a thin, generic client: lazily construct the Airtable client (`getBase()`), fetch all records from a table (`getAllRecords()`, which branches to synthetic data when `isDemo()` is true), plus the schema-introspection helpers behind `/explore` (`listTables()`, `getSampleRecords()`). It has **no knowledge of field names or programs** — that logic lives per-route. Don't add program- or field-specific logic to `airtable.ts`; it should stay generic.

Each API route (`src/app/api/{nps,certificates,surveys,learner-intelligence}/route.ts`) owns its own:
1. Field-name constants, one per Airtable column, each with an env-var override and a hardcoded fallback: `const SCORE_FIELD = process.env.NPS_SCORE_FIELD || 'Recommend Likelihood (Number)';`. This is why the base/table/field names are "driven by env vars" per `CLAUDE.md` — the fallback string is what's actually in Airtable today, and the env var exists so it can be repointed without a code change.
2. A local `lookup()` function, duplicated in every route file rather than imported from a shared module:
   ```ts
   function lookup(value: unknown): string {
     if (Array.isArray(value)) return String(value[0] ?? '');
     return String(value ?? '');
   }
   ```
   Airtable "linked record" / lookup fields come back as arrays even when there's conceptually one value. Follow the existing convention and copy this exact 3-line function into a new route rather than extracting a shared helper — four local copies are the established convention, so introducing a shared import would be an unrequested refactor of an established pattern.

## Adding a new field to an existing route

1. Add the constant: `const MY_FIELD = process.env.NPS_MY_FIELD || '<exact Airtable column name>';`. Get the exact column name right — Airtable field names are matched literally against `r.fields[MY_FIELD]`, and a typo silently returns `undefined` (which downstream renders as `''` or `0`, not an error).
2. Decide `lookup(r.fields[MY_FIELD])` vs `String(r.fields[MY_FIELD] || '')` vs `Number(r.fields[MY_FIELD])`: use `lookup()` only for linked-record/lookup fields (arrays); plain text/number fields don't need it. Check the field's actual Airtable type via `/explore` (the `/api/explore` route introspects the schema) if you're not sure which it is — guessing wrong is the most common way a new field renders blank.
3. If the field should be filterable (like `region`, `clientType` in `/api/nps`), add it to the query-param parsing at the top of `GET()`, the `.filter()` chain, and the "unique filter options" `[...new Set(...)]` block — all three, or the filter UI will have no options to select.

## Adding a brand-new API route

Follow the existing four routes as the template (`src/app/api/nps/route.ts` is the simplest). Each route is self-contained: imports `getAllRecords` from `@/lib/airtable`, defines its own field constants + `lookup()`, maps records, and wraps the whole body in try/catch returning `NextResponse.json({ error: message }, { status: 500 })` on failure — match this error-handling shape, since the frontend pages generally check for an `error` key in the response.

Pair the route with a page under `src/app/<name>/` per the table in `CLAUDE.md` — the codebase keeps a strict 1:1 page↔API convention. **Note**: `CLAUDE.md`'s Page/API table only lists 6 pages; the repo has since grown additional pages (`/pulse`, `/performance`, `/cohort-performance`, `/enrollment-team`, `/creative`, `/tools`) that aren't Airtable-backed (they use `src/lib/sheets.ts`, `src/lib/pulseLive.ts`, or static data) — don't assume every page follows the Airtable pattern; check which lib the page's API route actually imports before copying this skill's guidance.

## Demo mode — don't forget this or your field disappears in preview/demo deployments

`getAllRecords()` calls `getDemoRecords(tableName)` when `isDemo()` is true, which matches on table name against `NPS_TABLE_NAME` / `SURVEY_TABLE_NAME` and returns synthetic records from `src/lib/demo/npsData.ts` — **any table not matched by name falls through to `return []`**. If you add a route against a new/different table name, demo mode will silently return zero records for it (not an error — an empty-but-valid response), which looks like "no data" rather than "broken," and is easy to miss in a quick smoke test. If the new field is on an existing table (`Course Survey Results` / `SurveyMonkey Surveys`), check whether `generateNpsRecords()`/`generateSurveyRecords()` need a synthetic value added for the new field, or it'll come back `undefined` in demo mode even though it works against live Airtable.

## Verification

Don't just confirm the page renders without a console error — that passes even when a field is silently blank. Instead:
1. Hit the API route directly (`curl localhost:3000/api/<route>` or the preview tools' network inspector) and check the new field actually has non-empty values in the JSON.
2. If demo mode is enabled for the deployment you're testing against, verify the field renders there too, not just against live Airtable.
3. Cross-check the value against what's actually in the Airtable base (via `/explore` or the Airtable UI) for at least one record — a field that "renders something" isn't the same as a field that renders the *right* something.
