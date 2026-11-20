// ─── Pulse (L0) live data readers ─────────────────────────────────────────────
//
// The Pulse page always shows the CURRENT active cohort for each family, as
// resolved by the cohort calendar (src/lib/cohortCalendar.ts), reading the doc
// registered for it in src/lib/cohortSheets.ts.
//
// Sources (Jon's intake tabs — manual-first, every reader fails soft):
//  - Wharton active cohort: its cohort performance doc:
//    Deadline Pacing Table V2 (enrollments, daily goals) + Overall WoW (leads)
//  - Columbia active cohort: the pacing sheet (enrollment summary) + the
//    Columbia cohort doc (deadline table daily goals + Overall WoW leads)

import { google } from 'googleapis';
import {
  getPacingData,
  getPacingDataV2,
  readDocGoal,
  readDeadlineTable,
  resolveVersionedTab,
  readProgramGoals,
  readChannelTable,
  readPaidWoW,
  readCohortFinals,
  type CohortSummary,
  type TodayCard,
  type ProgramGoals,
  type ChannelTable,
  type PaidWoW,
  type CohortFinals,
} from '@/lib/sheets';
import {
  getActiveCohort,
  getCohortWeek,
  endgameLabel,
  getPhase,
  resolveAsOf,
  daysOutAt,
  type CohortWindow,
  type AsOf,
} from '@/lib/cohortCalendar';
import { COHORT_SHEETS } from '@/lib/cohortSheets';
import { readDailyLeadTotals, resolveWeekRange, type DailyLeadTotals } from '@/lib/performance/cohortDashboard';

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

/** Local-date YYYY-MM-DD of an as-of Date (local midnight, see resolveAsOf). */
function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function N(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === '' || s === '#DIV/0!' || s === '#REF!' || s === '#VALUE!' || s === '#NUM!') return null;
  const n = parseFloat(s.replace(/[$,%]/g, '').replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

// Per-cohort sheet wiring. When a new cohort doc is created (e.g. CBS Fall '26),
// share it with the service account and add its entry here.
// `goalsTab` is the tab that holds the cohort's enrollment goal — the authoritative
// target, read live so a change in the doc flows through every surface (see
// readDocGoal in sheets.ts). Wharton calls it "Overall Goals", CBS calls it "Goals".
// Which doc tracks which cohort lives in one registry (src/lib/cohortSheets.ts),
// shared with the enrollment dashboard. The deadline-table reader lives in
// sheets.ts for the same reason — every surface reads enrollments the same way.
export type { TodayCard };

// ─── Overall WoW leads reader ─────────────────────────────────────────────────

export interface LeadsWeekLive {
  week: number;
  dateRange: string;
  leads: number;
  leadsForecast: number | null;
  enrolls: number | null;
  enrollForecast: number | null;
}

export interface WoWTotals {
  spend: number | null;
  leads: number | null;
  enrolls: number | null;
  cpl: number | null;
  cpe: number | null;
  roas: number | null;
  cvr: number | null;   // %
  // Forecast counterparts (same totals block)
  spendF: number | null;
  leadsF: number | null;
  enrollsF: number | null;
  cplF: number | null;
  cpeF: number | null;
  cvrF: number | null;
}

// Per-program row from the WoW totals block (PE / RE / FP&A / AVI / RDI for
// Wharton; Columbia's doc has only the Total row — one program).
export interface WoWProgramRow {
  program: string;
  spend: number | null;
  leads: number | null;
  leadsF: number | null;
  enrolls: number | null;
  enrollsF: number | null;
  cpl: number | null;
  cpe: number | null;
  cvr: number | null;
  cvrF: number | null;
}

/** The current week's leads against a straight-line share of its forecast:
 *  week forecast ÷ days in the week × days keyed so far. */
export interface LeadsWeekToDate {
  week: number;
  dateRange: string;
  /** Last day counted — the daily tab's last keyed day, never the as-of day
   *  itself (a half-keyed today would read as behind). ISO. */
  keyedThrough: string;
  daysElapsed: number;
  /** 7, except a partial first/last week (Wharton Winter '27 wk 1 is 6 days). */
  daysInWeek: number;
  leads: number;
  weekForecast: number;
  expected: number;
  /** Daily-tab sum disagrees with the WoW tab's partial week row. */
  note: string | null;
}

export interface LeadsLive {
  cohortLabel: string;
  weeks: LeadsWeekLive[];
  cohortLeads: number | null;
  cohortLeadsForecast: number | null;
  totals: WoWTotals | null;
  programs: WoWProgramRow[];
  updatedThrough: string | null;
  /** Every week's forecast, including weeks a rewound view drops from `weeks`
   *  (the week in progress on the as-of day is one of them). No actuals. */
  schedule: Array<{ week: number; dateRange: string; leadsForecast: number | null; leads: number | null }>;
  weekToDate: LeadsWeekToDate | null;
}

/** Week N of a cohort starts N-1 weeks after enrollment opened. Deriving the
 *  start this way avoids parsing the sheet's year-less "7/28-8/3" ranges, and
 *  it matches them exactly (Wharton wk 7 = opens Jun 16 + 42d = Jul 28). */
function weekStartMs(opens: string, week: number): number {
  const [y, m, d] = opens.split('-').map(Number);
  return new Date(y, m - 1, d).getTime() + (week - 1) * 7 * 86400000;
}

export async function readWoWLeads(
  sheetId: string,
  cohortLabel: string,
  /** When rewinding, weeks starting after this day are dropped and the cohort
   *  totals are recomputed from the weeks that remain — otherwise a past-dated
   *  view would show enrollments as of that day beside leads through today. */
  rewind?: { asOf: Date; opens: string },
): Promise<LeadsLive | null> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      // Same versioned-tab trap as Paid WoW: the Fall 2026 doc carries both
      // "Overall WoW Performance & Goals" and "… V2" with identical actuals but
      // different forecasts (total leads forecast 9,082 vs 9,954). Read the
      // newest.
      range: `'${await resolveVersionedTab(sheetId, 'Overall WoW Performance & Goals')}'!A1:R150`,
    });
    const rows = res.data.values ?? [];

    // Totals block: columns are looked up by header name because the two
    // cohort docs (Wharton multi-program vs Columbia single-program) don't
    // share exact column positions.
    let cohortLeads: number | null = null;
    let cohortLeadsForecast: number | null = null;
    let totals: WoWTotals | null = null;
    const programs: WoWProgramRow[] = [];
    const tIdx = rows.findIndex(r => (r[1] ?? '').toString().trim() === 'Program');
    if (tIdx >= 0) {
      const header = rows[tIdx].map(c => String(c ?? '').trim().toLowerCase());
      const col = (...needles: string[]) =>
        header.findIndex(h => h !== '' && needles.every(n => h.includes(n)));
      const at = (r: (string | undefined)[], i: number) => (i >= 0 ? N(r[i]) : null);
      const pctAt = (r: (string | undefined)[], i: number) => {
        const v = at(r, i);
        return v !== null && v >= 0 && v <= 100 ? v : null;
      };

      const c = {
        spend: col('spend', 'actual') >= 0 ? col('spend', 'actual') : col('spend'),
        spendF: col('spend', 'forecast'),
        leads: col('leads', 'actual'),
        leadsF: col('leads', 'forecast'),
        enrolls: col('enrollments', 'actual'),
        enrollsF: col('enrollment', 'forecast'),
        cpl: col('cpl', 'actual'),
        cplF: col('cpl', 'forecast'),
        cpe: col('cpe', 'actual'),
        cpeF: col('cpe', 'forecast'),
        roas: col('roas', 'actual'),
        cvr: col('cvr', 'actual'),
        cvrF: col('cvr', 'forecast'),
      };

      const totalRow = rows.slice(tIdx + 1, tIdx + 4).find(r => (r[1] ?? '').toString().trim() === 'Total');
      if (totalRow) {
        cohortLeads = at(totalRow, c.leads);
        cohortLeadsForecast = at(totalRow, c.leadsF);
        totals = {
          spend: at(totalRow, c.spend),
          leads: cohortLeads,
          enrolls: at(totalRow, c.enrolls),
          cpl: at(totalRow, c.cpl),
          cpe: at(totalRow, c.cpe),
          roas: at(totalRow, c.roas),
          // CVR is a percent — anything outside 0–100 is a mis-mapped column
          cvr: pctAt(totalRow, c.cvr),
          spendF: at(totalRow, c.spendF),
          leadsF: cohortLeadsForecast,
          enrollsF: at(totalRow, c.enrollsF),
          cplF: at(totalRow, c.cplF),
          cpeF: at(totalRow, c.cpeF),
          cvrF: pctAt(totalRow, c.cvrF),
        };
      }

      // Per-program rows: everything between the header and the weekly section
      // whose label isn't a Total/blank/footnote row.
      for (const r of rows.slice(tIdx + 1, tIdx + 12)) {
        const label = (r[1] ?? '').toString().trim();
        if (!label) break;
        if (/^total/i.test(label) || /^\*/.test(label) || label.length > 30) continue;
        programs.push({
          program: label,
          spend: at(r, c.spend),
          leads: at(r, c.leads),
          leadsF: at(r, c.leadsF),
          enrolls: at(r, c.enrolls),
          enrollsF: at(r, c.enrollsF),
          cpl: at(r, c.cpl),
          cpe: at(r, c.cpe),
          cvr: pctAt(r, c.cvr),
          cvrF: pctAt(r, c.cvrF),
        });
      }
    }

    const wIdx = rows.findIndex(r => (r[0] ?? '').toString().trim() === 'Week Start');
    if (wIdx < 0) return null;
    const weeks: LeadsWeekLive[] = [];
    for (const r of rows.slice(wIdx + 1)) {
      const weekNum = N(r[1]);
      const range = (r[2] ?? '').toString().trim();
      if (weekNum === null || !/\d+\/\d+\s*-\s*\d+\/\d+/.test(range)) continue;
      weeks.push({
        week: weekNum,
        dateRange: range,
        leads: N(r[5]) ?? 0,
        leadsForecast: N(r[6]),
        enrolls: N(r[7]),
        enrollForecast: N(r[8]),
      });
    }
    if (weeks.length === 0) return null;

    // Rewound: drop future weeks and rebuild the cohort totals from what's left.
    // The sheet's Total row is a whole-cohort figure, so it can't be reused here.
    let outWeeks = weeks;
    if (rewind) {
      // Only weeks that had FULLY closed by the as-of day. A week merely having
      // started still spans days after it (wk 7 = 7/28-8/3 on a Jul 28 view), and
      // counting those leaks exactly the future data the rewind exists to hide.
      // Leads therefore rewind to the last complete week while enrollments rewind
      // to the day — that's the grain of each source, and the card names the week.
      const cutoff = new Date(rewind.asOf).setHours(0, 0, 0, 0);
      outWeeks = weeks.filter(w => weekStartMs(rewind.opens, w.week) + 6 * 86400000 <= cutoff);
      const sum = (fn: (w: LeadsWeekLive) => number | null) =>
        outWeeks.reduce((s, w) => s + (fn(w) ?? 0), 0);
      cohortLeads = sum(w => w.leads);
      cohortLeadsForecast = sum(w => w.leadsForecast);
      const enrolls = sum(w => w.enrolls);
      if (totals) {
        // ROAS needs revenue, which isn't in the weekly grain — null rather than
        // carry today's whole-cohort figure onto a past-dated view.
        totals = {
          ...totals,
          leads: cohortLeads,
          leadsF: cohortLeadsForecast,
          enrolls,
          enrollsF: sum(w => w.enrollForecast),
          spend: null, spendF: null, cpl: null, cplF: null, cpe: null, cpeF: null, roas: null,
          cvr: cohortLeads > 0 ? +(enrolls / cohortLeads * 100).toFixed(2) : null,
          cvrF: null,
        };
      }
    }

    // Rewinding to before the cohort's first week closed legitimately leaves no
    // weeks. That's "nothing has closed yet", not "the tab is missing" — return
    // the shell so the UI can say which.
    const lastWithData = [...outWeeks].reverse().find(w => w.leads > 0);
    return {
      cohortLabel,
      weeks: outWeeks,
      cohortLeads,
      cohortLeadsForecast,
      totals,
      programs: rewind ? [] : programs,
      updatedThrough: lastWithData?.dateRange ?? null,
      // Week actuals only on a live view: a rewound one must not carry
      // figures keyed after its as-of day.
      schedule: weeks.map(w => ({
        week: w.week, dateRange: w.dateRange, leadsForecast: w.leadsForecast, leads: rewind ? null : w.leads,
      })),
      weekToDate: null,
    };
  } catch {
    return null;
  }
}

// ─── Week-to-date lead pacing ─────────────────────────────────────────────────

function isoAddDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}
const dayCount = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;

/** The week containing the as-of day, its leads from Monday (or the cohort's
 *  open) through the last keyed day before the as-of day, and a flat daily
 *  share of that week's forecast for the same days. */
export function leadsWeekToDate(
  leads: LeadsLive | null,
  daily: DailyLeadTotals | null,
  win: CohortWindow,
  asOfYmd: string,
): LeadsWeekToDate | null {
  if (!leads || !daily) return null;
  const range = { opens: win.opens, closes: win.extEnds };
  const cur = leads.schedule
    .map(w => ({ ...w, ...resolveWeekRange(w.dateRange, range) }))
    .find(w => w.start && w.end && w.start <= asOfYmd && asOfYmd <= w.end);
  if (!cur || !cur.start || !cur.end || !cur.leadsForecast) return null;

  const yesterday = isoAddDays(asOfYmd, -1);
  const lastKeyed = daily.lastKeyed;
  const through = lastKeyed && lastKeyed < yesterday ? lastKeyed : yesterday;
  const daysInWeek = dayCount(cur.start, cur.end);
  const daysElapsed = through < cur.start ? 0 : Math.min(daysInWeek, dayCount(cur.start, through));
  const actual = daily.days
    .filter(d => d.date >= cur.start! && d.date <= through)
    .reduce((s, d) => s + d.leads, 0);

  // The WoW row is built from this tab, so on a live view where nothing past
  // yesterday is keyed the two must agree. Say so when they don't.
  let note: string | null = null;
  if (cur.leads !== null && lastKeyed === through && Math.round(cur.leads) !== Math.round(actual)) {
    note = `Daily tab sums to ${actual.toLocaleString()} for wk ${cur.week}; the WoW row shows ${cur.leads.toLocaleString()}.`;
  }
  return {
    week: cur.week,
    dateRange: cur.dateRange,
    keyedThrough: through,
    daysElapsed,
    daysInWeek,
    leads: actual,
    weekForecast: cur.leadsForecast,
    expected: (cur.leadsForecast / daysInWeek) * daysElapsed,
    note,
  };
}

// ─── Yesterday: a real zero vs a row nobody has keyed yet ─────────────────────
//
// The deadline table pre-fills 0 into every day's actual, so on its own a 0
// for yesterday can't be told from "not entered yet" — and the card read every
// unkeyed morning as "missed yesterday". The daily "<Term> Data" tab settles
// it: leads land there every day, so a day with leads keyed is a day that was
// entered. Yesterday's 0 stands only when that tab has yesterday keyed AND
// also shows 0 enrollments for it; anything else is "not keyed yet". Applied
// to Pulse's copy only — readDeadlineTable's keyed-through day also aligns the
// partner page's comparisons and stays on its own (conservative) rule.
export function settleYesterday(today: TodayCard | null, daily: DailyLeadTotals | null, asOfYmd: string): void {
  if (!today || !daily || today.yesterdayActual !== 0) return;
  const yesterday = isoAddDays(asOfYmd, -1);
  const row = daily.days.find(d => d.date === yesterday);
  const keyed = daily.lastKeyed !== null && daily.lastKeyed >= yesterday;
  if (!keyed || !row || row.enrolls !== 0) {
    today.yesterdayActual = null;
    return;
  }
  // Confirmed zero day: the cumulative total doesn't move, so only the label
  // advances to the day that was actually keyed.
  if (!today.updatedThroughYmd || today.updatedThroughYmd < yesterday) {
    const [y, m, d] = yesterday.split('-').map(Number);
    today.updatedThroughYmd = yesterday;
    today.updatedThrough = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// ─── Assembled Pulse payload ──────────────────────────────────────────────────

export interface PulseFamilyLive {
  family: 'wharton' | 'columbia';
  cohort: {
    key: string;
    label: string;
    week: number;          // marketing-cycle week (calendar-derived)
    phase: string;
    endgame: string;       // "Ends Jul 13 · ext through Jul 20"
    enrolls: number;
    goal: number;
    goalSource?: string;     // where `goal` was read from (cohort doc goals tab, or fallback)
    goalPlanTotal?: number;  // total of the deadline table's daily-goal curve, when it differs
    forecastToDate: number;
    daysRemaining: number;
    wired: boolean;        // false when the cohort doc doesn't exist / isn't shared
  };
  today: TodayCard | null;
  leads: LeadsLive | null;
}

export interface PulseLive {
  /** Human-readable rendering date, e.g. "August 4, 2026". */
  asOf: string;
  /** The same date as YYYY-MM-DD, for the date picker's value. */
  asOfDate: string;
  /** False when the view has been rewound to an earlier day. */
  isToday: boolean;
  families: PulseFamilyLive[];
  freshness: Array<{ source: string; updatedThrough: string; cadence: string; lagging: boolean }>;
}

export async function getPulseLive(asOfInput?: AsOf): Promise<PulseLive> {
  const at = asOfInput ?? resolveAsOf(null);
  const now = at.date;
  const asOf = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const wWindow = getActiveCohort('wharton', now);
  const cWindow = getActiveCohort('columbia', now);

  const [wharton, columbia, teamPulled] = await Promise.all([
    buildWharton(wWindow, now, at.isToday),
    buildColumbia(cWindow, now, at.isToday),
    import('@/lib/enrollmentTeam').then(m => m.getTeamDataPulledDate()).catch(() => null),
  ]);

  const freshness = [
    {
      source: `Wharton deadline pacing table (${wharton.cohort.label})`,
      updatedThrough: wharton.today?.updatedThrough ?? 'unavailable',
      cadence: 'Daily · manual (Jon + Andrew)',
      lagging: !wharton.today?.updatedThrough,
    },
    {
      source: `Columbia deadline pacing table (${columbia.cohort.label})`,
      updatedThrough: columbia.today?.updatedThrough ?? 'unavailable',
      cadence: 'Daily · manual (Jon + Andrew)',
      lagging: !columbia.today?.updatedThrough,
    },
    {
      source: 'Overall WoW — leads actual vs forecast (both docs)',
      updatedThrough: [wharton.leads?.updatedThrough, columbia.leads?.updatedThrough].filter(Boolean).map(w => `wk ${w}`).join(' · ') || 'unavailable',
      cadence: 'Weekly · manual (Jon)',
      lagging: !wharton.leads?.updatedThrough && !columbia.leads?.updatedThrough,
    },
    {
      source: 'Enrollment team dashboard (L2 lower funnel)',
      updatedThrough: teamPulled ? `pulled ${teamPulled}` : 'unavailable',
      cadence: 'Weekly · Aubrey',
      lagging: !teamPulled,
    },
  ];

  return { asOf, asOfDate: at.ymd, isToday: at.isToday, families: [wharton, columbia], freshness };
}

async function buildWharton(w: CohortWindow | null, now: Date, isToday: boolean): Promise<PulseFamilyLive> {
  const label = w ? `Wharton ${w.label}` : 'Wharton';
  const wiring = w ? COHORT_SHEETS[w.key] : undefined;
  const sheetId = wiring?.sheetId();

  if (!w || !wiring || !sheetId) {
    return {
      family: 'wharton',
      cohort: { key: w?.key ?? 'w-unknown', label, week: w ? getCohortWeek(w, now) : 0, phase: w ? getPhase(w, now) : '', endgame: w ? endgameLabel(w) : '', enrolls: 0, goal: 0, forecastToDate: 0, daysRemaining: 0, wired: false },
      today: null,
      leads: null,
    };
  }

  const [{ summary }, today, leads, daily] = await Promise.all([
    getPacingDataV2(sheetId, { goalsTab: wiring.goalsTab, cohortLabels: [w.termLabel, w.label], asOf: now })
      .catch(() => ({ summary: [] as CohortSummary[] })),
    readDeadlineTable(sheetId, wiring.deadlineTab, label, now),
    readWoWLeads(sheetId, label, isToday ? undefined : { asOf: now, opens: w.opens }),
    readDailyLeadTotals(sheetId, w),
  ]);
  const s = summary[0];
  if (leads) leads.weekToDate = leadsWeekToDate(leads, daily, w, ymdOf(now));
  settleYesterday(today, daily, ymdOf(now));

  return {
    family: 'wharton',
    cohort: {
      key: w.key,
      label,
      week: getCohortWeek(w, now),
      phase: getPhase(w, now),
      endgame: endgameLabel(w),
      enrolls: s?.enrolled ?? 0,
      goal: s?.goal ?? 0,
      goalSource: s?.goalSource,
      goalPlanTotal: s?.goalPlanTotal,
      forecastToDate: s?.forecast ?? 0,
      daysRemaining: s?.daysRemaining ?? 0,
      wired: !!s,
    },
    today,
    leads,
  };
}

async function buildColumbia(c: CohortWindow | null, now: Date, isToday: boolean): Promise<PulseFamilyLive> {
  const label = c ? `CBS ${c.label}` : 'CBS';
  const wiring = c ? COHORT_SHEETS[c.key] : undefined;
  const sheetId = wiring?.sheetId();

  // Headline numbers come from the cohort doc's deadline pacing table — the same
  // source Pulse's Today card and the enrollment dashboard use, so the surfaces
  // can't disagree. The AN Summary pacing sheet is the fallback (and remains the
  // source for the day-by-day historical comparison curves elsewhere).
  const pacingSheetId = process.env.GOOGLE_PACING_SHEET_ID;
  const [pacing, today, leads, docGoal, daily] = await Promise.all([
    getPacingData(pacingSheetId, { asOfDay: { cbsee: c ? Math.max(0, daysOutAt(c, now)) : undefined } }).catch(() => null),
    sheetId ? readDeadlineTable(sheetId, wiring!.deadlineTab, label, now) : Promise.resolve(null),
    sheetId && c ? readWoWLeads(sheetId, label, isToday ? undefined : { asOf: now, opens: c.opens }) : Promise.resolve(null),
    sheetId && wiring && c
      ? readDocGoal(sheetId, wiring.goalsTab, [c.termLabel, c.label])
      : Promise.resolve(null),
    sheetId && c ? readDailyLeadTotals(sheetId, c) : Promise.resolve(null),
  ]);
  if (leads && c) leads.weekToDate = leadsWeekToDate(leads, daily, c, ymdOf(now));
  settleYesterday(today, daily, ymdOf(now));
  const s = pacing?.summary.find(x => x.program === 'CBSEE');

  if (today && today.cohortToDate === null && s) today.cohortToDate = s.enrolled;

  return {
    family: 'columbia',
    cohort: {
      key: c?.key ?? 'c-unknown',
      label,
      week: c ? getCohortWeek(c, now) : 0,
      phase: c ? getPhase(c, now) : '',
      endgame: c ? endgameLabel(c) : '',
      enrolls: today?.cohortToDate ?? s?.enrolled ?? 0,
      goal: docGoal?.goal ?? s?.goal ?? 0,
      goalSource: docGoal?.source ?? 'No cohort-doc goals tab wired — built-in CBSEE goal map',
      forecastToDate: today?.goalYesterday ?? today?.goalToDate ?? s?.forecast ?? 0,
      daysRemaining: today?.daysRemaining ?? s?.daysRemaining ?? 0,
      wired: !!today?.cohortToDate || !!s,
    },
    today,
    leads,
  };
}

// ─── Cohort Command live overview ────────────────────────────────────────────
// Powers the active cohort's Overview on /cohort-performance/* so its headline
// numbers come from the SAME sources as Pulse (deadline pacing table +
// Overall WoW totals) instead of the pro forma demo data.

export interface CommandHistoryRow {
  label: string;
  enrolled: number;
  goal: number;
  pctDone: number;
  /** The cohort's finishing total from the AN-summary distribution (day 0 of
   *  its own curve) — the pacing sheet's basis, which excludes the B2B
   *  enrollments the tracker doc's Grand Total folds in. Null for the active
   *  cohort and for CBSEE closed rows, whose sheet backfills goals as finals. */
  finalTotal: number | null;
  isActive: boolean;
}

// Adapt sheets.ts ComparisonRow (pctOfGoal / pctComplete, post-split) to the
// history-row shape: % of the true goal is the figure the history table shows.
function toHistoryRow(r: { label: string; enrolled: number; goal: number; pctOfGoal: number; finalTotal?: number | null }, isActive = false): CommandHistoryRow {
  return { label: r.label, enrolled: r.enrolled, goal: r.goal, pctDone: r.pctOfGoal, finalTotal: r.finalTotal ?? null, isActive };
}

export interface CommandLive {
  family: 'wharton' | 'columbia';
  label: string;            // active cohort label, e.g. "Fall '26"
  enrolls: number;          // deadline-table cumulative (same as Pulse)
  goal: number;
  forecastToDate: number;
  daysRemaining: number;
  totals: WoWTotals | null; // spend / leads / CPL / CPE / ROAS / CVR (WoW basis)
  leadsDetail: LeadsLive | null; // weekly rows + per-program totals (WoW)
  // Per-program targets from the cohort doc's goals tab. Paired with the WoW
  // per-program actuals in leadsDetail.programs to give the By Program view a
  // real goal instead of a hardcoded one.
  programGoals: ProgramGoals | null;
  // Channel attribution from the doc's "Overall Performance Tables". Its Grand
  // Total is keyed on its own cadence and can trail the deadline table by a day,
  // so the UI reconciles the two rather than presenting them as one figure.
  channels: ChannelTable | null;
  // Paid-only performance. Its leads/enrollments are a SUBSET of the all-source
  // figures everywhere else on the dashboard, by design — the Paid Media tab
  // says so rather than letting the smaller numbers read as a discrepancy.
  paid: PaidWoW | null;
  // Closed-cohort FINALS from the summary tracker. Deliberately separate from
  // `history`, whose closed rows are same-day-out pace values — putting final
  // economics on a pace row would divide a whole cohort's spend by a fraction
  // of its enrollments.
  finals: CohortFinals[];
  keyedThrough: string | null;
  /** Last genuinely keyed day as YYYY-MM-DD, so a date control can default to
   *  the last COMPLETE day rather than to a today the sheet hasn't reached. */
  keyedThroughYmd: string | null;
  history: CommandHistoryRow[];
  // What closed-cohort history rows represent: true finals (Wharton V2 doc
  // summary) vs enrollment at the same day-out (Columbia AN-summary panel).
  historyBasis: 'finals' | 'same-day-out';
}

export async function getCohortCommandLive(family: 'wharton' | 'columbia', asOfInput?: AsOf): Promise<CommandLive | null> {
  const asOfRes = asOfInput ?? resolveAsOf(null);
  const now = asOfRes.date;
  const win = getActiveCohort(family, now);
  const wiring = win ? COHORT_SHEETS[win.key] : undefined;
  const sheetId = wiring?.sheetId();

  if (family === 'wharton') {
    if (!sheetId || !wiring) return null;
    const [pacing, today, leads, programGoals, channels, paid] = await Promise.all([
      getPacingDataV2(sheetId, { goalsTab: wiring.goalsTab, cohortLabels: [win!.termLabel, win!.label], asOf: now }).catch(() => null),
      readDeadlineTable(sheetId, wiring.deadlineTab, win!.label, now),
      readWoWLeads(sheetId, win!.label, asOfRes.isToday ? undefined : { asOf: now, opens: win!.opens }),
      readProgramGoals(sheetId, wiring.goalsTab),
      readChannelTable(sheetId),
      readPaidWoW(sheetId),
    ]);
    const s = pacing?.summary[0];
    if (!s) return null;
    const cmp = pacing!.comparison.wharton;
    // Which cohorts to look up isn't known until the comparison panel resolves,
    // so this can't join the batch above.
    const finals = await readCohortFinals(cmp.closedRows.map(r => r.label), 'wharton');
    return {
      family,
      label: win!.label,
      enrolls: today?.cohortToDate ?? s.enrolled,
      goal: s.goal,
      forecastToDate: s.forecast,
      daysRemaining: s.daysRemaining,
      totals: leads?.totals ?? null,
      leadsDetail: leads,
      programGoals,
      channels,
      paid,
      finals,
      keyedThrough: today?.updatedThrough ?? null,
      keyedThroughYmd: today?.updatedThroughYmd ?? null,
      // The comparison reader says which basis its closed rows are on — early in
      // a cycle they are same-day-out pace values, not the cohorts' finals, and
      // mislabeling them makes "Spring '26: 91" read as a finished total of 91.
      historyBasis: cmp.basis,
      history: [
        { label: win!.label, enrolled: today?.cohortToDate ?? s.enrolled, goal: s.goal, pctDone: s.goal > 0 ? +((today?.cohortToDate ?? s.enrolled) / s.goal * 100).toFixed(1) : 0, finalTotal: null, isActive: true },
        ...cmp.closedRows.map(r => toHistoryRow(r)),
      ],
    };
  }

  // Columbia: enrollment summary from the pacing sheet; WoW + daily from the doc
  const pacingSheetId = process.env.GOOGLE_PACING_SHEET_ID;
  const [pacing, today, leads, docGoal, programGoals, channels, paid] = await Promise.all([
    getPacingData(pacingSheetId, { asOfDay: { cbsee: win ? Math.max(0, daysOutAt(win, now)) : undefined } }).catch(() => null),
    sheetId && wiring ? readDeadlineTable(sheetId, wiring.deadlineTab, win?.label ?? 'CBS', now) : Promise.resolve(null),
    sheetId && win ? readWoWLeads(sheetId, win.label, asOfRes.isToday ? undefined : { asOf: now, opens: win.opens }) : Promise.resolve(null),
    sheetId && wiring && win
      ? readDocGoal(sheetId, wiring.goalsTab, [win.termLabel, win.label])
      : Promise.resolve(null),
    sheetId && wiring ? readProgramGoals(sheetId, wiring.goalsTab) : Promise.resolve(null),
    sheetId ? readChannelTable(sheetId) : Promise.resolve(null),
    sheetId ? readPaidWoW(sheetId) : Promise.resolve(null),
  ]);
  const s = pacing?.summary.find(x => x.program === 'CBSEE');
  if (!win) return null;
  const enrolls = today?.cohortToDate ?? s?.enrolled ?? null;
  if (enrolls === null) return null;
  // Cohort doc's goals tab wins over the built-in CBSEE goal map, same as Wharton.
  const goal = docGoal?.goal ?? s?.goal ?? 0;

  // Note: the AN-summary comparison panel's closedRows are SAME-DAY-OUT pace
  // values (not finals), and C_GOALS backfills finals as goals for closed
  // CBSEE cohorts — so true finals aren't reconstructable from this sheet.
  // We pass the pace values through and label the basis honestly in the UI
  // via historyBasis.
  const cmp = pacing?.comparison.cbsee;
  // finalTotal is stripped here, not passed through: C_GOALS backfills finals
  // as goals for closed CBSEE cohorts, so the sheet's "final" is the goal
  // echoed back, not what the cohort actually finished with.
  const closedRows = (cmp?.closedRows ?? []).map(r => toHistoryRow({ ...r, finalTotal: null }));
  const finals = await readCohortFinals(closedRows.map(r => r.label), 'columbia');

  return {
    family,
    label: win.label,
    enrolls,
    goal,
    forecastToDate: today?.goalYesterday ?? today?.goalToDate ?? s?.forecast ?? 0,
    daysRemaining: today?.daysRemaining ?? s?.daysRemaining ?? 0,
    totals: leads?.totals ?? null,
    leadsDetail: leads,
    programGoals,
    channels,
    paid,
    finals,
    keyedThrough: today?.updatedThrough ?? null,
    keyedThroughYmd: today?.updatedThroughYmd ?? null,
    historyBasis: cmp?.basis ?? 'same-day-out',
    history: [
      { label: win.label, enrolled: enrolls, goal, pctDone: goal > 0 ? +(enrolls / goal * 100).toFixed(1) : 0, finalTotal: null, isActive: true },
      ...closedRows,
    ],
  };
}
