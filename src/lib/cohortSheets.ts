// ─── Cohort → source doc registry ─────────────────────────────────────────────
//
// Single place that maps a cohort key from the calendar (src/lib/cohortCalendar.ts)
// to the Google doc that tracks it. Pulse, Cohort Command and the enrollment
// dashboard all resolve their sources through here, so a cohort can never be
// wired on one surface and stale on another.
//
// When a new cohort doc is created: share it with the service account
// (wsp-dashboard@onyx-philosophy-496115-b5.iam.gserviceaccount.com), then add an
// entry below. Tab names are NOT consistent across docs — Wharton's deadline tab
// is "Deadline Pacing Table V2" and its goals tab "Overall Goals"; CBS used
// "Deadline Pacing Table" + "Goals" for Spring '26 and "Overall Goals" for
// Fall '26 — so both are recorded per cohort rather than assumed.

export interface CohortSheet {
  /** Resolved lazily so an env override is read at request time, not module load. */
  sheetId: () => string | undefined;
  deadlineTab: string;
  goalsTab: string;
}

export const COHORT_SHEETS: Record<string, CohortSheet | undefined> = {
  // Wharton — Fall 2026 Cohort Performance Doc
  'w-fall-26': {
    sheetId: () => process.env.FALL26_PACING_SHEET_ID,
    deadlineTab: 'Deadline Pacing Table V2',
    goalsTab: 'Overall Goals',
  },
  // CBS Certificate — Spring 2026 Cohort Performance Doc (closed Jul 20)
  'c-spring-26': {
    sheetId: () => process.env.CBS_SPRING26_COHORT_DOC_ID ?? '1EfNBwZYYObVU3XSiW1VPC_Fi13ZLaQdq_tZZyPxZy14',
    deadlineTab: 'Deadline Pacing Table',
    goalsTab: 'Goals',
  },
  // CBS Certificate — Fall 2026 Cohort Performance Doc (opened Jul 21, deadline Nov 16)
  'c-fall-26': {
    sheetId: () => process.env.CBS_FALL26_COHORT_DOC_ID ?? '1qHj4jZauhseusZIYrzVa_byhtkqR7GnZgUZetyo32cE',
    deadlineTab: 'Deadline Pacing Table',
    goalsTab: 'Overall Goals',
  },
};

export function getCohortSheet(key: string | undefined): CohortSheet | undefined {
  return key ? COHORT_SHEETS[key] : undefined;
}
