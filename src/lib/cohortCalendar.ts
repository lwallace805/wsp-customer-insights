// ─── Cohort calendar ──────────────────────────────────────────────────────────
//
// Source of truth for when cohorts cut over from active → previous, transcribed
// from the internal academic calendar docs (Wharton + Columbia, 2025–2027).
// Rules encoded in those docs:
//   - Enrollment opens the Tuesday after the previous cohort's term starts
//     (i.e., the day after the previous cohort's extended enrollment ends).
//   - Extended enrollment ends ~1 week after term start — that is the TRUE
//     cutover: a cohort stays "active" through its extension week.
//
// Note on naming: Columbia's marketing cohorts are named a season earlier than
// the academic term (marketing "Spring 2026" = academic term "Summer 2026").
// `label` is the marketing name used in docs/dashboards; `termLabel` is the
// academic-calendar name.

export interface CohortWindow {
  key: string;
  family: 'wharton' | 'columbia';
  label: string;        // marketing / dashboard name
  termLabel: string;    // academic calendar term name
  opens: string;        // enrollment opens (YYYY-MM-DD)
  eeEnds: string;       // early enrollment deadline
  termStart: string;    // term begins (final enrollment deadline)
  extEnds: string;      // extended enrollment ends — TRUE cutover date
}

export const COHORT_WINDOWS: CohortWindow[] = [
  // ── Wharton ── (marketing label = term label)
  { key: 'w-winter-26', family: 'wharton', label: "Winter '26", termLabel: 'Winter 2026', opens: '2025-10-14', eeEnds: '2026-01-12', termStart: '2026-02-09', extEnds: '2026-02-17' },
  { key: 'w-spring-26', family: 'wharton', label: "Spring '26", termLabel: 'Spring 2026', opens: '2026-02-18', eeEnds: '2026-05-11', termStart: '2026-06-08', extEnds: '2026-06-15' },
  { key: 'w-fall-26', family: 'wharton', label: "Fall '26", termLabel: 'Fall 2026', opens: '2026-06-16', eeEnds: '2026-09-08', termStart: '2026-10-05', extEnds: '2026-10-13' },
  { key: 'w-winter-27', family: 'wharton', label: "Winter '27", termLabel: 'Winter 2027', opens: '2026-10-14', eeEnds: '2027-01-11', termStart: '2027-02-08', extEnds: '2027-02-16' },
  { key: 'w-spring-27', family: 'wharton', label: "Spring '27", termLabel: 'Spring 2027', opens: '2027-02-16', eeEnds: '2027-05-10', termStart: '2027-06-07', extEnds: '2027-06-14' },
  { key: 'w-fall-27', family: 'wharton', label: "Fall '27", termLabel: 'Fall 2027', opens: '2027-06-15', eeEnds: '2027-09-06', termStart: '2027-10-04', extEnds: '2027-10-11' },

  // ── Columbia / CBSEE ── (marketing label is one season "behind" the term)
  { key: 'c-winter-26', family: 'columbia', label: "Winter '26", termLabel: 'Winter 2026', opens: '2025-11-18', eeEnds: '2026-02-17', termStart: '2026-03-16', extEnds: '2026-03-23' },
  { key: 'c-spring-26', family: 'columbia', label: "Spring '26", termLabel: 'Summer 2026', opens: '2026-03-24', eeEnds: '2026-06-15', termStart: '2026-07-13', extEnds: '2026-07-20' },
  { key: 'c-fall-26', family: 'columbia', label: "Fall '26", termLabel: 'Fall 2026', opens: '2026-07-21', eeEnds: '2026-10-12', termStart: '2026-11-09', extEnds: '2026-11-16' },
  { key: 'c-winter-27', family: 'columbia', label: "Winter '27", termLabel: 'Winter 2027', opens: '2026-11-17', eeEnds: '2027-02-16', termStart: '2027-03-15', extEnds: '2027-03-22' },
  { key: 'c-summer-27', family: 'columbia', label: "Spring '27", termLabel: 'Summer 2027', opens: '2027-03-23', eeEnds: '2027-06-14', termStart: '2027-07-12', extEnds: '2027-07-19' },
  { key: 'c-fall-27', family: 'columbia', label: "Fall '27", termLabel: 'Fall 2027', opens: '2027-07-20', eeEnds: '2027-10-11', termStart: '2027-11-08', extEnds: '2027-11-15' },
];

function toMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** "Now" in US Eastern time. The business day boundary is midnight ET
 *  (deadlines are 11:59pm ET) — on UTC servers (Vercel) a plain `new Date()`
 *  rolls to tomorrow at 8pm ET, which shifts every "today/yesterday" lookup. */
export function nowET(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

// ─── "As of" date ─────────────────────────────────────────────────────────────
// Every surface can be rewound to an earlier business day ("show me where pacing
// stood on Monday"). The date is carried as a YYYY-MM-DD string in the `asOf`
// query param and resolved here, once, so Pulse and the enrollment dashboard
// can't disagree about which day they're rendering.

/** Today in ET as YYYY-MM-DD. */
export function todayET(): string {
  const d = nowET();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface AsOf {
  /** Local-midnight Date for the requested day. */
  date: Date;
  /** YYYY-MM-DD, suitable for a date input's value. */
  ymd: string;
  /** False when the user has rewound to an earlier day. */
  isToday: boolean;
}

/** Resolve an `asOf` query param. Falls back to today (ET) when absent or
 *  unparseable, and clamps future dates to today — there is no data past the
 *  last keyed day, and a future date would silently render as "today" anyway. */
export function resolveAsOf(param?: string | null): AsOf {
  const today = todayET();
  let ymd = today;
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const [y, m, d] = param.split('-').map(Number);
    const parsed = new Date(y, m - 1, d);
    // Reject impossible dates ("2026-02-31" rolls over to March).
    const valid = parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
    if (valid && param <= today) ymd = param;
  }
  const [y, m, d] = ymd.split('-').map(Number);
  return { date: new Date(y, m - 1, d), ymd, isToday: ymd === today };
}

/** Days remaining to a cohort's final (extended) deadline as of `date` —
 *  the AN Summary's day index, which counts down to that same deadline. */
export function daysOutAt(w: CohortWindow, date: Date): number {
  const d = new Date(date).setHours(0, 0, 0, 0);
  return Math.round((toMs(w.extEnds) - d) / 86400000);
}

/** The cohort whose [opens, extEnds] window contains `date`. Windows tile
 *  exactly (each opens the day after the previous extEnds), so this is
 *  unambiguous. Returns null outside the transcribed range. */
export function getActiveCohort(family: 'wharton' | 'columbia', date: Date = nowET()): CohortWindow | null {
  const d = new Date(date).setHours(0, 0, 0, 0);
  return COHORT_WINDOWS.find(w => w.family === family && d >= toMs(w.opens) && d <= toMs(w.extEnds)) ?? null;
}

/** The most recently completed cohort for a family as of `date`. */
export function getPreviousCohort(family: 'wharton' | 'columbia', date: Date = nowET()): CohortWindow | null {
  const d = new Date(date).setHours(0, 0, 0, 0);
  const past = COHORT_WINDOWS.filter(w => w.family === family && toMs(w.extEnds) < d);
  return past.length ? past[past.length - 1] : null;
}

/** 1-based marketing-cycle week number (Aubrey's "Wharton Week 2 / Columbia Week 15"). */
export function getCohortWeek(w: CohortWindow, date: Date = nowET()): number {
  const d = new Date(date).setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((d - toMs(w.opens)) / (7 * 86400000)) + 1);
}

/** Days until the true cutover (extended enrollment end). */
export function daysUntilCutover(w: CohortWindow, date: Date = nowET()): number {
  const d = new Date(date).setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((toMs(w.extEnds) - d) / 86400000));
}

/** Human string for the enrollment endgame: "Ends Jul 13 · ext through Jul 20". */
export function endgameLabel(w: CohortWindow): string {
  const f = (ymd: string) => new Date(toMs(ymd)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Ends ${f(w.termStart)} · ext through ${f(w.extEnds)}`;
}

/** Marketing phase per the phase model used in the sheets. */
export function getPhase(w: CohortWindow, date: Date = nowET()): string {
  const d = new Date(date).setHours(0, 0, 0, 0);
  if (d <= toMs(w.eeEnds)) return 'Phase 2 · Early Enrollment';
  if (d <= toMs(w.termStart)) return 'Phase 3 · Enrollment Deadline';
  return 'Phase 4 · Extension Week';
}
