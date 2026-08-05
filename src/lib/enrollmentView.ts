// ─── /enrollment cohort views ─────────────────────────────────────────────────
//
// The dashboard's cohort selector picks between two views, both covering Wharton
// and CBSEE:
//
//   current  — the cohorts enrolling right now. Wharton comes from its own cohort
//              doc (V2 deadline table); CBSEE's curves come from the shared AN
//              Summary pacing sheet with its headline numbers from the CBS cohort
//              doc, so /enrollment, /pulse and /cohort-performance agree.
//   previous — the pair that closed most recently, read entirely from the AN
//              Summary and pinned by label so a later cohort's columns can't be
//              picked up as "active".
//
// Both are resolved from the cohort calendar as of the requested day, so this
// doesn't need editing on rotation day — only src/lib/cohortSheets.ts does, when
// a new doc appears.
//
// Every view also honours an "as of" date. The two data sources index time
// differently — the cohort docs by calendar date, the AN Summary by days-out —
// so the same instant is passed both ways (`asOf` and `asOfDay`).

import { getPacingData, getPacingDataCurrent } from '@/lib/sheets';
import {
  getActiveCohort,
  getPreviousCohort,
  daysOutAt,
  nowET,
  type AsOf,
} from '@/lib/cohortCalendar';
import { getCohortSheet } from '@/lib/cohortSheets';

export type EnrollmentView = 'current' | 'previous';

/** `?cohort=` values. The literal cohort names are kept as aliases so existing
 *  links (and bookmarks) into the dashboard keep working. */
export function parseView(param: string | undefined): EnrollmentView {
  return param === 'spring26' || param === 'previous' ? 'previous' : 'current';
}

/** Labels for the selector, derived from the calendar rather than hardcoded. */
export function viewLabels(at: Date = nowET()): Array<{ id: EnrollmentView; label: string }> {
  const active = getActiveCohort('wharton', at);
  const prev = getPreviousCohort('wharton', at);
  return [
    { id: 'current', label: active?.label ?? 'Current' },
    { id: 'previous', label: prev?.label ?? 'Previous' },
  ];
}

export async function getEnrollmentView(view: EnrollmentView, asOf: AsOf) {
  const summarySheetId = process.env.GOOGLE_PACING_SHEET_ID;
  const at = asOf.date;

  if (view === 'previous') {
    const w = getPreviousCohort('wharton', at);
    const c = getPreviousCohort('columbia', at);
    // CBSEE columns in the AN Summary carry the ACADEMIC term name ("Summer '26"),
    // not the marketing label ("Spring '26") — pin on the term.
    return getPacingData(summarySheetId, {
      pins: { wharton: w?.label, cbsee: c?.termLabel.replace(/(\w+)\s+20(\d\d)/, "$1 '$2") },
      // A closed cohort is already fully in the past; rewinding inside its window
      // still works because the cutoff is its own days-out at that date.
      asOfDay: {
        wharton: w ? Math.max(0, daysOutAt(w, at)) : undefined,
        cbsee: c ? Math.max(0, daysOutAt(c, at)) : undefined,
      },
    });
  }

  const wWin = getActiveCohort('wharton', at);
  const cWin = getActiveCohort('columbia', at);
  const wSheet = getCohortSheet(wWin?.key);
  const cSheet = getCohortSheet(cWin?.key);
  const whartonDocId = wSheet?.sheetId() ?? process.env.FALL26_PACING_SHEET_ID;
  if (!whartonDocId) throw new Error('No active Wharton cohort doc wired — see src/lib/cohortSheets.ts');

  return getPacingDataCurrent(whartonDocId, {
    whartonGoalsTab: wSheet?.goalsTab,
    whartonCohortLabels: wWin ? [wWin.termLabel, wWin.label] : undefined,
    summarySheetId,
    asOf: at,
    asOfDay: {
      wharton: wWin ? Math.max(0, daysOutAt(wWin, at)) : undefined,
      cbsee: cWin ? Math.max(0, daysOutAt(cWin, at)) : undefined,
    },
    cbseeDoc:
      cSheet && cSheet.sheetId() && cWin
        ? {
            sheetId: cSheet.sheetId()!,
            deadlineTab: cSheet.deadlineTab,
            goalsTab: cSheet.goalsTab,
            goalLabels: [cWin.termLabel, cWin.label],
          }
        : undefined,
  });
}
