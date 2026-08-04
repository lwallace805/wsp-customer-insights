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
// Both cohorts are resolved from the calendar, so this doesn't need editing on
// rotation day — only src/lib/cohortSheets.ts does, when a new doc appears.

import { getPacingData, getPacingDataCurrent } from '@/lib/sheets';
import { getActiveCohort, getPreviousCohort } from '@/lib/cohortCalendar';
import { getCohortSheet } from '@/lib/cohortSheets';

export type EnrollmentView = 'current' | 'previous';

/** `?cohort=` values. The literal cohort names are kept as aliases so existing
 *  links (and bookmarks) into the dashboard keep working. */
export function parseView(param: string | undefined): EnrollmentView {
  return param === 'spring26' || param === 'previous' ? 'previous' : 'current';
}

/** Labels for the selector, derived from the calendar rather than hardcoded. */
export function viewLabels(): Array<{ id: EnrollmentView; label: string }> {
  const active = getActiveCohort('wharton');
  const prev = getPreviousCohort('wharton');
  return [
    { id: 'current', label: active?.label ?? 'Current' },
    { id: 'previous', label: prev?.label ?? 'Previous' },
  ];
}

export async function getEnrollmentView(view: EnrollmentView) {
  const summarySheetId = process.env.GOOGLE_PACING_SHEET_ID;

  if (view === 'previous') {
    const w = getPreviousCohort('wharton');
    const c = getPreviousCohort('columbia');
    // CBSEE columns in the AN Summary carry the ACADEMIC term name ("Summer '26"),
    // not the marketing label ("Spring '26") — pin on the term.
    return getPacingData(summarySheetId, {
      pins: { wharton: w?.label, cbsee: c?.termLabel.replace(/(\w+)\s+20(\d\d)/, "$1 '$2") },
    });
  }

  const wWin = getActiveCohort('wharton');
  const cWin = getActiveCohort('columbia');
  const wSheet = getCohortSheet(wWin?.key);
  const cSheet = getCohortSheet(cWin?.key);
  const whartonDocId = wSheet?.sheetId() ?? process.env.FALL26_PACING_SHEET_ID;
  if (!whartonDocId) throw new Error('No active Wharton cohort doc wired — see src/lib/cohortSheets.ts');

  return getPacingDataCurrent(whartonDocId, {
    whartonGoalsTab: wSheet?.goalsTab,
    whartonCohortLabels: wWin ? [wWin.termLabel, wWin.label] : undefined,
    summarySheetId,
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
