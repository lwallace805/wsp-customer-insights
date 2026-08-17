// ─── Wharton partner view (external) ──────────────────────────────────────────
//
// The one dataset behind /wharton. Scope was set in the Aug 11 1-1 and is
// deliberately narrow:
//   • enrollments ONLY — no leads, spend, CVR, consults or pipeline
//   • Wharton ONLY — no Columbia/CBS figures anywhere in the payload
//   • NOT relative to goal — no goal, no pace, no forecast, no % of target
//   • no cohort-over-cohort comparison (add later if Wharton asks)
//
// Those exclusions are enforced HERE, in the shape of the payload, rather than
// by a component choosing not to render a field. Anything absent from
// WhartonPartnerData cannot leak onto the partner page by a later UI edit.
//
// Source: the active Wharton cohort doc's deadline pacing table, read through
// the same readDeadlineTable() every internal surface uses — so this page and
// /pulse, /weekly and /cohort-performance cannot disagree about the number, the
// split, or which day the data runs through.

import { readDeadlineTable } from '@/lib/sheets';
import { COHORT_SHEETS } from '@/lib/cohortSheets';
import { getActiveCohort, nowET, daysUntilCutover } from '@/lib/cohortCalendar';

export interface WhartonProgramRow {
  /** Program code as the cohort doc states it (PE, RE, FP&A, AVI, RDI). Rows
   *  keep the doc's column order — see the note where they're built. */
  program: string;
  enrolls: number;
  /** Cumulative enrollments per day, through the last keyed day. */
  series: Array<{ date: string; total: number }>;
}

export interface WhartonPartnerData {
  ok: true;
  /** "Fall 2026" — the academic term name, which is what Wharton calls it. */
  cohort: string;
  /** Enrollment opened / final deadline / extended close, YYYY-MM-DD. */
  opened: string;
  deadline: string;
  extendedClose: string;
  /** Days from today (ET) to the extended close — the countdown the cohort doc
   *  itself runs on. Zero once enrollment has closed. */
  daysRemaining: number;
  /** Cumulative enrollments for the cohort as of `dataThrough`. */
  total: number;
  programs: WhartonProgramRow[];
  /** Cohort-level running total, one point per day. */
  series: Array<{ date: string; total: number }>;
  /** Last day the cohort doc has genuinely been keyed through — NOT today. The
   *  table pre-fills zeroes into days nobody has entered yet, so labelling this
   *  as today would present yesterday's number as today's. */
  dataThrough: string | null;
  /** False when the per-program columns don't reconcile to the cohort total; the
   *  page then shows the total alone rather than a split that doesn't add up. */
  breakdownReconciles: boolean;
  generatedAt: string;
}

export interface WhartonPartnerUnavailable {
  ok: false;
  /** Shown verbatim to an external reader, so it says what to do, not what broke. */
  reason: string;
}

export type WhartonPartnerResult = WhartonPartnerData | WhartonPartnerUnavailable;

export async function getWhartonPartnerData(asOf: Date = nowET()): Promise<WhartonPartnerResult> {
  const win = getActiveCohort('wharton', asOf);
  if (!win) {
    return { ok: false, reason: 'No Wharton cohort is currently open for enrollment.' };
  }

  const wiring = COHORT_SHEETS[win.key];
  const sheetId = wiring?.sheetId();
  if (!wiring || !sheetId) {
    // Deliberately not falling back to the previous cohort's doc: a partner
    // reading a stale cohort as the live one is worse than an empty page.
    return {
      ok: false,
      reason: `The ${win.termLabel} cohort tracker isn't connected yet. Your Wall Street Prep contact has been able to see this too.`,
    };
  }

  const card = await readDeadlineTable(sheetId, wiring.deadlineTab, win.termLabel, asOf);
  if (!card || card.cohortToDate === null) {
    return { ok: false, reason: `${win.termLabel} enrollment data is temporarily unavailable. Please try again shortly.` };
  }

  // Withhold rather than reshape: if the program columns don't sum to the cohort
  // total, the split is wrong in a way we can't correct here, and a partner
  // reading a wrong-by-a-few breakdown is worse than reading no breakdown.
  const reconciles = card.programsSumToTotal === true;

  return {
    ok: true,
    cohort: win.termLabel,
    opened: win.opens,
    deadline: win.termStart,
    extendedClose: win.extEnds,
    daysRemaining: daysUntilCutover(win, asOf),
    total: card.cohortToDate,
    // Left in the cohort doc's own column order, NOT sorted by size: the UI
    // colours each program by its position here, and a rank-ordered list would
    // repaint every program the day two of them swap places.
    programs: reconciles
      ? card.programs.map(p => ({ program: p.program, enrolls: p.total ?? 0, series: p.series }))
      : [],
    series: card.series,
    dataThrough: card.updatedThroughYmd,
    breakdownReconciles: reconciles,
    generatedAt: new Date().toISOString(),
  };
}
