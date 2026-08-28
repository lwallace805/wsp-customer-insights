// ─── Wharton partner view (external) ──────────────────────────────────────────
//
// The one dataset behind /wharton. Scope was set in the Aug 11 1-1, widened in
// the Aug 25 1-1 after Wharton asked for a goal, a forecast and cohort
// comparisons — and is still deliberately narrow:
//   • enrollments ONLY — no leads, spend, CVR, consults or pipeline
//   • Wharton ONLY — no Columbia/CBS figures anywhere in the payload
//   • the goal shown defaults to FLAT to the prior cohort's own final, read
//     live from the pacing sheet, with an optional per-cohort round-number
//     override below — NEVER the internal budget / plan trajectory (the
//     "Forecast Enrollments" column, whose endpoint is a bigger number).
//     The only pace baseline is the prior cohort's own curve.
//
// Those exclusions are enforced HERE, in the shape of the payload, rather than
// by a component choosing not to render a field. Anything absent from
// WhartonPartnerData cannot leak onto the partner page by a later UI edit.
//
// Source: the active Wharton cohort doc's deadline pacing table, read through
// the same readDeadlineTable() every internal surface uses — so this page and
// /pulse, /weekly and /cohort-performance cannot disagree about the number, the
// split, or which day the data runs through. The prior cohort's curve comes
// from the AN Summary sheet through getClosedWhartonCurve() — the same source
// the internal cohort comparison reads.

import { readDeadlineTable, getClosedWhartonCohorts } from '@/lib/sheets';
import { COHORT_SHEETS } from '@/lib/cohortSheets';
import { getActiveCohort, getPreviousCohort, nowET, daysUntilCutover } from '@/lib/cohortCalendar';

export interface WhartonProgramRow {
  /** Program code as the cohort doc states it (PE, RE, FP&A, AVI, RDI). Rows
   *  keep the doc's column order — see the note where they're built. */
  program: string;
  enrolls: number;
  /** Cumulative enrollments per day, through the last keyed day. */
  series: Array<{ date: string; total: number }>;
}

export interface WhartonPriorCohort {
  /** "Spring 2026" — the prior cohort's academic term name. */
  cohort: string;
  /** The prior cohort's final enrollment — the flat-goal baseline. Equals
   *  `goal` unless a PARTNER_GOAL_OVERRIDES entry rounds the goal. */
  final: number;
  /** The days-to-close both cohorts are compared at: how many days the active
   *  cohort's last KEYED day (`dataThrough`) is before its extended close.
   *  Computed from the keyed day, not today — the running total is that day's
   *  number, and grading it against today's day count would compare
   *  yesterday's total to a later point on the prior curve. */
  daysToClose: number | null;
  /** The prior cohort's running total when IT had `daysToClose` days left.
   *  Null when no prior row lands within 2 days of that point — withheld
   *  rather than nearest-neighbored into a misaligned comparison. */
  totalAtSamePoint: number | null;
  /** The prior cohort's full curve re-dated onto this cohort's calendar (each
   *  point placed at the date with the same days-to-close), ending at `final`
   *  on the close date — i.e. the pace required to match the flat goal. */
  series: Array<{ date: string; total: number }>;
}

export interface WhartonCohortComparisons {
  /** Days-to-close every row is measured at — the active cohort's keyed day. */
  daysOut: number;
  /** The most recent closed cohorts (up to three), newest first. Finals are
   *  each cohort's OWN closing total — the internal per-cohort goals are
   *  deliberately absent from this shape. */
  rows: Array<{
    /** "Spring 2026" — academic term name, matching the rest of the page. */
    cohort: string;
    /** Running total when that cohort had `daysOut` days left; null when no
     *  row lands within 2 days (withheld, not approximated). */
    totalAtSamePoint: number | null;
    final: number;
  }>;
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
  /** The cohort's enrollment goal — a per-cohort override when one is set
   *  (PARTNER_GOAL_OVERRIDES), otherwise the prior cohort's final total (the
   *  goal is held flat cohort-over-cohort, per the Aug 25 1-1), read live from
   *  the pacing sheet. Null when neither exists; the page then shows
   *  enrollments without a goal rather than substituting a number. */
  goal: number | null;
  prior: WhartonPriorCohort | null;
  /** Table of recent closed cohorts at the same days-to-close. Null when the
   *  history sheet can't be read or the active cohort has no keyed day yet. */
  comparisons: WhartonCohortComparisons | null;
  generatedAt: string;
}

export interface WhartonPartnerUnavailable {
  ok: false;
  /** Shown verbatim to an external reader, so it says what to do, not what broke. */
  reason: string;
}

export type WhartonPartnerResult = WhartonPartnerData | WhartonPartnerUnavailable;

// Date math on YYYY-MM-DD strings in UTC, so a day count can't shift across the
// server-local/ET boundary the way `new Date(ymd)` arithmetic can.
const DAY_MS = 86400000;
const utcOf = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const ymdAt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The sheet's short label ("Spring '26") → the academic term name the rest of
 *  the page uses ("Spring 2026"). Cohorts older than the calendar's transcribed
 *  range still format correctly this way. */
const termName = (label: string) => label.replace(/^(\w+)\s*'(\d{2})$/, '$1 20$2');

/** Per-cohort goal overrides, keyed by the calendar's cohort key. The default
 *  goal is the prior cohort's final held flat; an entry here replaces it with a
 *  deliberately chosen round number — still never the internal plan. Fall '26
 *  was set to 1,000 on Aug 28 2026, in line with Spring '26's 997 final. */
const PARTNER_GOAL_OVERRIDES: Record<string, number> = {
  'w-fall-26': 1000,
};

/** Cumulative value at `day`, accepting a row up to 2 days away (exact first).
 *  Beyond that the value belongs to a visibly different point in the countdown,
 *  so null is returned and the caller withholds the comparison. */
function atDayNear(byDay: Map<number, number>, day: number): number | null {
  for (const delta of [0, 1, -1, 2, -2]) {
    const v = byDay.get(day + delta);
    if (v !== undefined) return v;
  }
  return null;
}

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

  // The closed cohorts' curves ride along with the main read. A missing history
  // is NOT an error for the page — the goal and comparisons are simply withheld
  // — so it must never take the enrollment figures down with it.
  const prevWin = getPreviousCohort('wharton', asOf);
  const historySheetId = process.env.GOOGLE_PACING_SHEET_ID;
  const [card, closedCohorts] = await Promise.all([
    readDeadlineTable(sheetId, wiring.deadlineTab, win.termLabel, asOf),
    historySheetId ? getClosedWhartonCohorts(historySheetId) : Promise.resolve([]),
  ]);
  if (!card || card.cohortToDate === null) {
    return { ok: false, reason: `${win.termLabel} enrollment data is temporarily unavailable. Please try again shortly.` };
  }

  // Withhold rather than reshape: if the program columns don't sum to the cohort
  // total, the split is wrong in a way we can't correct here, and a partner
  // reading a wrong-by-a-few breakdown is worse than reading no breakdown.
  const reconciles = card.programsSumToTotal === true;

  // ── Flat goal + cohort comparisons ──
  // Aligned on days-to-close: the AN Summary's day index and the cohort doc's
  // "Day before Deadline" column both count down to the extended close, so "the
  // same point" is the day a closed cohort had as many days left as the active
  // cohort's keyed day has now.
  const closeMs = utcOf(win.extEnds);
  const daysToClose = card.updatedThroughYmd
    ? Math.round((closeMs - utcOf(card.updatedThroughYmd)) / DAY_MS)
    : null;

  const priorCurve = prevWin ? closedCohorts.find(c => c.label === prevWin.label) ?? null : null;
  let prior: WhartonPriorCohort | null = null;
  if (prevWin && priorCurve) {
    // Days beyond this cohort's own span would re-date to before it opened —
    // dropped, so a longer prior cohort can't draw a tail off the left edge.
    const spanDays = Math.round((closeMs - utcOf(win.opens)) / DAY_MS);
    prior = {
      cohort: prevWin.termLabel,
      final: priorCurve.final,
      daysToClose,
      totalAtSamePoint: daysToClose !== null ? atDayNear(priorCurve.byDay, daysToClose) : null,
      series: [...priorCurve.byDay.entries()]
        .filter(([day]) => day >= 0 && day <= spanDays)
        .sort(([a], [b]) => b - a)
        .map(([day, total]) => ({ date: ymdAt(closeMs - day * DAY_MS), total })),
    };
  }

  // The last three closed cohorts, newest first — the partner cut of the
  // internal cohort table, carrying each cohort's own final and same-day total
  // but no internal goals.
  const comparisons: WhartonCohortComparisons | null =
    daysToClose !== null && closedCohorts.length > 0
      ? {
          daysOut: daysToClose,
          rows: closedCohorts.slice(-3).reverse().map(c => ({
            cohort: termName(c.label),
            totalAtSamePoint: atDayNear(c.byDay, daysToClose),
            final: c.final,
          })),
        }
      : null;

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
    goal: PARTNER_GOAL_OVERRIDES[win.key] ?? prior?.final ?? null,
    prior,
    comparisons,
    generatedAt: new Date().toISOString(),
  };
}
