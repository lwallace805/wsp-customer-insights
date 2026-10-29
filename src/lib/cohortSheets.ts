// ─── Cohort → source doc registry ─────────────────────────────────────────────
//
// Single place that maps a cohort key from the calendar (src/lib/cohortCalendar.ts)
// to the Google doc that tracks it. Pulse, Cohort Command, the enrollment
// dashboard, the partner page, /channels and the performance dashboards all
// resolve their sources through here, so a cohort can never be wired on one
// surface and stale on another.
//
// When a new cohort doc is created: share it with the service account
// (wsp-dashboard@onyx-philosophy-496115-b5.iam.gserviceaccount.com), then add an
// entry below. The doc id is recorded HERE, with the env var as an override —
// a rotation is then one reviewed code change that reaches Production, Preview
// and the dev alias together, instead of a per-environment env edit that is
// easy to apply to one and forget on another.
//
// Tab names are NOT consistent across docs — Wharton's deadline tab is
// "Deadline Pacing Table V2" and its goals tab "Overall Goals"; CBS used
// "Deadline Pacing Table" + "Goals" for Spring '26 and "Overall Goals" for
// Fall '26 — so both are recorded per cohort rather than assumed.

import { getActiveCohort, nowET, type CohortWindow } from '@/lib/cohortCalendar';

export interface CohortSheet {
  /** Resolved lazily so an env override is read at request time, not module load. */
  sheetId: () => string | undefined;
  deadlineTab: string;
  goalsTab: string;
}

export const COHORT_SHEETS: Record<string, CohortSheet | undefined> = {
  // Wharton — Winter 2027 Cohort Performance Doc V2 (opened Oct 14 2026,
  // extended close Feb 16 2027). V2 doc: only the "… V2" tabs exist, no V1 ones.
  'w-winter-27': {
    sheetId: () => process.env.WINTER27_PACING_SHEET_ID ?? '1PI3euN7O1W-wwW7djCCpL153yMAsdUItaDPvdhFfAk0',
    deadlineTab: 'Deadline Pacing Table V2',
    goalsTab: 'Overall Goals',
  },
  // Wharton — Fall 2026 Cohort Performance Doc (closed Oct 13 2026). Kept wired
  // so the partner page can hold on it between cohorts and the closed-cohort
  // readers can still reach its tables.
  'w-fall-26': {
    sheetId: () => process.env.FALL26_PACING_SHEET_ID ?? '1pUVvHARYuZaOLwUqkAtRbOdTkDvt4WRinWX2cd--5Kw',
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

/** The doc tracking the cohort open for enrollment in `family` as of `at`, or
 *  null when that cohort has no entry above yet (the days between a close and
 *  the new doc being wired). Callers that need SOME doc — the channel tables,
 *  the performance dashboards — fall back to their env var from here, so a
 *  gap in the registry degrades to "last configured doc", never to nothing. */
export function getActiveCohortSheet(
  family: 'wharton' | 'columbia',
  at: Date = nowET(),
): { key: string; sheetId: string; wiring: CohortSheet; win: CohortWindow } | null {
  const win = getActiveCohort(family, at);
  const wiring = win ? COHORT_SHEETS[win.key] : undefined;
  const sheetId = wiring?.sheetId();
  return win && wiring && sheetId ? { key: win.key, sheetId, wiring, win } : null;
}
