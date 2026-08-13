// ─── Weekly report (L0.5) assembly ────────────────────────────────────────────
//
// Powers /weekly — the screenshot-shaped snapshot that goes out in Andrew's
// weekly email to Matan. The structure is his, from the Aug 11 1-1:
//   1. enrollments total + by program, relative to goal
//   2. lead volume by program + in total, relative to forecast
//   3. consults / TA / info sessions — in AGGREGATE, not by program
//   4. the enrollment team's outreach pipeline
//   5. a short callouts block, with everything else linking to the dashboards
//
// This file adds no new sheet readers. It reshapes what Cohort Command and the
// enrollment-team dashboard already read, so a number on the email can never
// disagree with the same number on the page it links to.

import { getCohortCommandLive, type CommandLive, type LeadsWeekLive } from '@/lib/pulseLive';
import { getEnrollmentTeamData } from '@/lib/enrollmentTeam';
import {
  getActiveCohort,
  getCohortWeek,
  endgameLabel,
  nowET,
  todayET,
  resolveAsOf,
  type AsOf,
} from '@/lib/cohortCalendar';

// ─── Lead pacing on COMPLETED weeks only ──────────────────────────────────────

/** A week counts as complete once its end date has passed. Comparing a
 *  part-week actual against a whole-week forecast is what made last cycle's
 *  leads read "40% behind" when the week simply wasn't over. */
function weekEnded(range: string, asOf: Date): boolean {
  const m = range.match(/-\s*(\d{1,2})\/(\d{1,2})/);
  if (!m) return true;
  const end = new Date(asOf.getFullYear(), parseInt(m[1]) - 1, parseInt(m[2]));
  // Cohorts straddle New Year, so a range parsed into the wrong year lands
  // ~6 months out; pull it back a year when it does.
  if (end.getTime() - asOf.getTime() > 182 * 86400000) end.setFullYear(end.getFullYear() - 1);
  return end.getTime() < new Date(asOf).setHours(0, 0, 0, 0);
}

export interface LeadPacing {
  /** Actual and forecast summed over completed weeks only. */
  actual: number;
  forecast: number;
  deltaPct: number | null;
  /** Highest completed week number included, for the "through wk N" label. */
  throughWeek: number | null;
  /** The most recent completed week on its own — the newest real signal. */
  lastWeek: { week: number; dateRange: string; actual: number; forecast: number; deltaPct: number | null } | null;
}

function leadPacing(weeks: LeadsWeekLive[] | undefined, asOf: Date): LeadPacing {
  const empty: LeadPacing = { actual: 0, forecast: 0, deltaPct: null, throughWeek: null, lastWeek: null };
  if (!weeks?.length) return empty;

  const complete = weeks.filter(w => w.leadsForecast !== null && weekEnded(w.dateRange, asOf));
  if (!complete.length) return empty;

  const actual = complete.reduce((s, w) => s + w.leads, 0);
  const forecast = complete.reduce((s, w) => s + (w.leadsForecast ?? 0), 0);
  const last = complete[complete.length - 1];

  return {
    actual,
    forecast,
    deltaPct: forecast > 0 ? +((actual - forecast) / forecast * 100).toFixed(1) : null,
    throughWeek: last.week,
    lastWeek: {
      week: last.week,
      dateRange: last.dateRange,
      actual: last.leads,
      forecast: last.leadsForecast ?? 0,
      deltaPct: last.leadsForecast ? +((last.leads - last.leadsForecast) / last.leadsForecast * 100).toFixed(1) : null,
    },
  };
}

// ─── Per-program rows ─────────────────────────────────────────────────────────

export interface WeeklyProgramRow {
  program: string;
  enrolls: number | null;
  /** Forecast-to-date, NOT the full-cohort goal — the per-program row of the
   *  WoW totals block. Its column sums to the cohort's vs-pace number. */
  enrollsPace: number | null;
  enrollDelta: number | null;
  /** Full-cohort goal for the program, from the doc's goals tab. */
  goal: number | null;
  pctOfGoal: number | null;
  leads: number | null;
  leadsForecast: number | null;
  leadsDeltaPct: number | null;
  cpl: number | null;
  cvr: number | null;
  cvrForecast: number | null;
}

function programRows(live: CommandLive): WeeklyProgramRow[] {
  const goalByProgram = new Map<string, number>();
  for (const g of live.programGoals?.rows ?? []) {
    if (g.goalEnrollments !== null) goalByProgram.set(g.program.trim().toUpperCase(), g.goalEnrollments);
  }

  return (live.leadsDetail?.programs ?? []).map(p => {
    const goal = goalByProgram.get(p.program.trim().toUpperCase()) ?? null;
    return {
      program: p.program,
      enrolls: p.enrolls,
      enrollsPace: p.enrollsF,
      enrollDelta: p.enrolls !== null && p.enrollsF !== null ? p.enrolls - p.enrollsF : null,
      goal,
      pctOfGoal: goal && goal > 0 && p.enrolls !== null ? +(p.enrolls / goal * 100).toFixed(1) : null,
      leads: p.leads,
      leadsForecast: p.leadsF,
      leadsDeltaPct: p.leads !== null && p.leadsF ? +((p.leads - p.leadsF) / p.leadsF * 100).toFixed(1) : null,
      cpl: p.cpl,
      cvr: p.cvr,
      cvrForecast: p.cvrF,
    };
  });
}

// ─── Family block ─────────────────────────────────────────────────────────────

export interface WeeklyFamily {
  family: 'wharton' | 'columbia';
  label: string;            // "Wharton Fall '26"
  week: number;
  endgame: string;
  daysRemaining: number;
  enrolls: number;
  goal: number;
  pace: number;             // forecast-to-date
  vsPace: number;
  pctOfGoal: number;
  cvr: number | null;
  cvrForecast: number | null;
  spend: number | null;
  spendForecast: number | null;
  cpl: number | null;
  /** Cohort-to-date leads from the WoW Total ROW — the same basis as the
   *  per-program rows (it carries the current partial week), unlike `leads`
   *  below which is completed-weeks-only. Kept separate so the two never get
   *  mixed in one table: the sheet's own Total is authoritative where the
   *  per-program column carries rounding that doesn't always close. */
  leadsCtd: number | null;
  leadsCtdForecast: number | null;
  leads: LeadPacing;
  programs: WeeklyProgramRow[];
  /** Prior cohorts at the SAME days-remaining, with how each one finished —
   *  "in line with history" means little when the cohort we match missed. */
  history: Array<{ label: string; enrolled: number; goal: number; pctOfGoal: number; finalEnrolls: number | null; finalGoal: number | null; hitGoal: boolean | null }>;
  keyedThrough: string | null;
}

function buildFamily(
  family: 'wharton' | 'columbia',
  live: CommandLive,
  asOf: Date,
): WeeklyFamily {
  const win = getActiveCohort(family, asOf);
  const prefix = family === 'wharton' ? 'Wharton' : 'CBS';
  const t = live.totals;

  // Closed rows carry same-day-out pace; finals carry how the cohort ended.
  // Joined here so the email can say "matched the cohort that missed".
  const finalsByLabel = new Map(live.finals.map(f => [f.label, f]));

  return {
    family,
    label: `${prefix} ${live.label}`,
    week: win ? getCohortWeek(win, asOf) : 0,
    endgame: win ? endgameLabel(win) : '',
    daysRemaining: live.daysRemaining,
    enrolls: live.enrolls,
    goal: live.goal,
    pace: live.forecastToDate,
    vsPace: live.enrolls - live.forecastToDate,
    pctOfGoal: live.goal > 0 ? +(live.enrolls / live.goal * 100).toFixed(1) : 0,
    cvr: t?.cvr ?? null,
    cvrForecast: t?.cvrF ?? null,
    spend: t?.spend ?? null,
    spendForecast: t?.spendF ?? null,
    cpl: t?.cpl ?? null,
    leadsCtd: t?.leads ?? null,
    leadsCtdForecast: t?.leadsF ?? null,
    leads: leadPacing(live.leadsDetail?.weeks, asOf),
    programs: programRows(live),
    history: live.history
      .filter(h => !h.isActive)
      .map(h => {
        const f = finalsByLabel.get(h.label) ?? null;
        // Closed-cohort goals aren't on the finals row, so the history row's own
        // goal is the denominator for "did it hit".
        const hitGoal = f?.enrolls != null && h.goal > 0 ? f.enrolls >= h.goal : null;
        return {
          label: h.label,
          enrolled: h.enrolled,
          goal: h.goal,
          pctOfGoal: h.pctDone,
          finalEnrolls: f?.enrolls ?? null,
          finalGoal: f ? h.goal : null,
          hitGoal,
        };
      }),
    keyedThrough: live.keyedThrough,
  };
}

// ─── Enrollment team, in aggregate ────────────────────────────────────────────

export interface WeeklyTeam {
  dataPulled: string | null;
  consults: { completed: number | null; baseline: number | null; enrollees: number | null; baselineEnrollees: number | null; cvr: number | null; baselineCvr: number | null; comparisonNote: string | null } | null;
  ta: { apps: number | null; baselineApps: number | null; enrollees: number | null; baselineEnrollees: number | null; cvr: number | null; baselineCvr: number | null; dataPulled: string | null } | null;
  infoSessions: { held: number; registrations: number; attendance: number; priorLabel: string | null; priorAttendance: number | null } | null;
  /** The advisors' live close list, from the Funnel Health tab. Replaces the
   *  old outreach-volume tile: emails-sent said how busy the team was, not who
   *  is actually in play. */
  pipeline: { forecastToClose: number | null; forecastClosed: number | null; forecastCvr: number | null; contacted: number | null; dateRange: string | null } | null;
}

/** Combines Wharton + Columbia into the single aggregate figure Andrew asked
 *  for. TA has no pre-combined column, so it's summed here; consults DO have a
 *  "Wharton + Columbia" column that is de-duplicated in the sheet (it does not
 *  equal W + C), so that column is used rather than adding the two. */
function buildTeam(data: Awaited<ReturnType<typeof getEnrollmentTeamData>>): WeeklyTeam | null {
  if (!data.ok) return null;
  const { consults, ta, infoSessions, funnelHealth } = data.data;

  const total = consults?.advisors.find(a => a.advisor.toLowerCase() === 'total') ?? null;
  const sum = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));
  const pct = (n: number | null, d: number | null) => (n !== null && d !== null && d > 0 ? +(n / d * 100).toFixed(1) : null);

  const taApps = ta ? sum(ta.wharton.apps[1], ta.columbia.apps[1]) : null;
  const taBaseApps = ta ? sum(ta.wharton.apps[0], ta.columbia.apps[0]) : null;
  const taEnr = ta ? sum(ta.wharton.enrollees[1], ta.columbia.enrollees[1]) : null;
  const taBaseEnr = ta ? sum(ta.wharton.enrollees[0], ta.columbia.enrollees[0]) : null;

  const held = infoSessions?.weeks.filter(w => (w.registrations ?? 0) > 0 || (w.attendance ?? 0) > 0) ?? [];
  // Prior-cohort rows list attendance at the same session slots; compare only
  // the slots this cohort has actually held.
  const prior = infoSessions?.comparisons[0] ?? null;
  const priorAttendance = prior
    ? prior.values.slice(0, held.length).reduce<number | null>((s, v) => (v === null ? s : (s ?? 0) + v), null)
    : null;

  return {
    dataPulled: consults?.dataPulled ?? null,
    consults: total
      ? {
          completed: total.combined.completed[1],
          baseline: total.combined.completed[0],
          enrollees: total.combined.enrollees[1],
          baselineEnrollees: total.combined.enrollees[0],
          cvr: total.combined.cvr[1],
          baselineCvr: total.combined.cvr[0],
          comparisonNote: consults?.comparisonNote ?? null,
        }
      : null,
    ta: ta
      ? {
          apps: taApps,
          baselineApps: taBaseApps,
          enrollees: taEnr,
          baselineEnrollees: taBaseEnr,
          cvr: pct(taEnr, taApps),
          baselineCvr: pct(taBaseEnr, taBaseApps),
          dataPulled: ta.dataPulled,
        }
      : null,
    infoSessions: infoSessions
      ? {
          held: held.length,
          registrations: held.reduce((s, w) => s + (w.registrations ?? 0), 0),
          attendance: held.reduce((s, w) => s + (w.attendance ?? 0), 0),
          priorLabel: prior?.label ?? null,
          priorAttendance,
        }
      : null,
    pipeline: funnelHealth
      ? {
          forecastToClose: funnelHealth.forecastToClose,
          forecastClosed: funnelHealth.forecastClosed,
          forecastCvr: funnelHealth.forecastCvr,
          contacted: funnelHealth.contacted,
          dateRange: funnelHealth.dateRange,
        }
      : null,
  };
}

// ─── Assembled report ─────────────────────────────────────────────────────────

export interface WeeklyReport {
  asOf: string;
  asOfDate: string;
  /** Today in ET, YYYY-MM-DD — the date picker's ceiling. Resolved server-side
   *  so a viewer in another timezone can't be offered a day with no data. */
  today: string;
  isToday: boolean;
  families: WeeklyFamily[];
  team: WeeklyTeam | null;
  teamNeedsAccess: boolean;
  /** Sources that failed this request. This page exists to be SCREENSHOT into an
   *  exec email, so a reader must never be shown a section that is quietly empty
   *  because a sheet read timed out — the UI banners these instead. */
  unavailable: string[];
}

function hintsFor(label: string | undefined): string[] {
  if (!label) return [];
  const m = label.match(/(Fall|Spring|Winter|Summer)\s*'(\d\d)/i);
  if (!m) return [label];
  return [`${m[1]} 20${m[2]}`, `${m[1].slice(0, 2).toUpperCase()}${m[2]}`];
}

export async function getWeeklyReport(asOfInput?: AsOf): Promise<WeeklyReport> {
  const at = asOfInput ?? resolveAsOf(null);
  const now = at.date ?? nowET();

  const wWin = getActiveCohort('wharton', now);
  const cWin = getActiveCohort('columbia', now);
  const hints = [...hintsFor(wWin?.label), ...hintsFor(cWin?.label)];

  const [wharton, columbia, team] = await Promise.all([
    getCohortCommandLive('wharton', at).catch(() => null),
    getCohortCommandLive('columbia', at).catch(() => null),
    getEnrollmentTeamData(hints).catch(() => ({ ok: false as const, needsAccess: false, error: 'unreachable' })),
  ]);

  const unavailable: string[] = [];
  const families: WeeklyFamily[] = [];
  if (wharton) families.push(buildFamily('wharton', wharton, now));
  else unavailable.push('Wharton cohort doc');
  if (columbia) families.push(buildFamily('columbia', columbia, now));
  else unavailable.push('Columbia cohort doc');
  if (!team.ok) unavailable.push('Enrollment-team sheet');

  return {
    unavailable,
    asOf: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    asOfDate: at.ymd,
    today: todayET(),
    isToday: at.isToday,
    families,
    team: buildTeam(team),
    teamNeedsAccess: !team.ok && team.needsAccess,
  };
}
