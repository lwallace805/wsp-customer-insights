// ─── Pulse (L0) live data readers ─────────────────────────────────────────────
//
// The Pulse page always shows the CURRENT active cohort for each family, as
// resolved by the cohort calendar (src/lib/cohortCalendar.ts). Today that is
// Wharton Fall '26 (opened Jun 16) and CBS Spring '26 (term begins Jul 13,
// extension through Jul 20 — the true cutover).
//
// Sources (Jon's intake tabs — manual-first, every reader fails soft):
//  - Wharton active cohort: the Fall '26 cohort doc (FALL26_PACING_SHEET_ID):
//    Deadline Pacing Table V2 (enrollments, daily goals) + Overall WoW (leads)
//  - Columbia active cohort: the pacing sheet (enrollment summary) + the
//    Columbia cohort doc (deadline table daily goals + Overall WoW leads)

import { google } from 'googleapis';
import { getPacingData, getPacingDataV2 } from '@/lib/sheets';
import {
  getActiveCohort,
  getCohortWeek,
  endgameLabel,
  getPhase,
  nowET,
  type CohortWindow,
} from '@/lib/cohortCalendar';

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

function N(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === '' || s === '#DIV/0!' || s === '#REF!' || s === '#VALUE!' || s === '#NUM!') return null;
  const n = parseFloat(s.replace(/[$,%]/g, '').replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function dayMs(raw: string | undefined): number | null {
  if (!raw) return null;
  const ms = new Date(raw).setHours(0, 0, 0, 0);
  return isNaN(ms) ? null : ms;
}

// Per-cohort sheet wiring. When a new cohort doc is created (e.g. CBS Fall '26),
// share it with the service account and add its entry here.
const COHORT_SHEETS: Record<string, { sheetId: () => string | undefined; deadlineTab: string } | undefined> = {
  'w-fall-26': { sheetId: () => process.env.FALL26_PACING_SHEET_ID, deadlineTab: 'Deadline Pacing Table V2' },
  'c-spring-26': { sheetId: () => '1EfNBwZYYObVU3XSiW1VPC_Fi13ZLaQdq_tZZyPxZy14', deadlineTab: 'Deadline Pacing Table' },
};

// ─── Deadline Pacing Table reader ─────────────────────────────────────────────
// Columns: 0 Current Date · 3 Daily Goals (per-day) · 4 Total Daily Enrollments
// Actuals (per-day) · 21 cumulative Total Enrollments (Wharton V2 only).

export interface TodayCard {
  cohortLabel: string;
  todayGoal: number;
  yesterdayGoal: number;
  yesterdayActual: number | null;
  cohortToDate: number | null;
  updatedThrough: string | null;
}

async function readDeadlineTable(sheetId: string, tab: string, cohortLabel: string): Promise<TodayCard | null> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${tab}'!A1:AF250`,
    });
    const rows = res.data.values ?? [];
    const hIdx = rows.findIndex(r => (r[0] ?? '').toString().trim() === 'Current Date');
    if (hIdx < 0) return null;
    const dataRows = rows.slice(hIdx + 1).filter(r => dayMs(r[0]) !== null);

    // Business day boundary is midnight ET, not server-local (UTC on Vercel)
    const todayMs = nowET().setHours(0, 0, 0, 0);
    const yesterdayMs = todayMs - 86400000;
    const rowAt = (ms: number) => dataRows.find(r => dayMs(r[0]) === ms) ?? null;

    const todayRow = rowAt(todayMs);
    const yRow = rowAt(yesterdayMs);

    let updatedThrough: string | null = null;
    let updatedMs = -Infinity;
    let cohortToDate: number | null = null;
    for (const r of dataRows) {
      const ms = dayMs(r[0])!;
      if (ms > todayMs) continue;
      if (N(r[4]) !== null && ms > updatedMs) {
        updatedMs = ms;
        updatedThrough = new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const cumulative = N(r[21]);
        if (cumulative !== null) cohortToDate = cumulative;
      }
    }

    return {
      cohortLabel,
      todayGoal: N(todayRow?.[3]) ?? 0,
      yesterdayGoal: N(yRow?.[3]) ?? 0,
      yesterdayActual: N(yRow?.[4]),
      cohortToDate,
      updatedThrough,
    };
  } catch {
    return null;
  }
}

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

export interface LeadsLive {
  cohortLabel: string;
  weeks: LeadsWeekLive[];
  cohortLeads: number | null;
  cohortLeadsForecast: number | null;
  totals: WoWTotals | null;
  programs: WoWProgramRow[];
  updatedThrough: string | null;
}

async function readWoWLeads(sheetId: string, cohortLabel: string): Promise<LeadsLive | null> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'Overall WoW Performance & Goals'!A1:R150`,
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

    const lastWithData = [...weeks].reverse().find(w => w.leads > 0);
    return {
      cohortLabel,
      weeks,
      cohortLeads,
      cohortLeadsForecast,
      totals,
      programs,
      updatedThrough: lastWithData?.dateRange ?? null,
    };
  } catch {
    return null;
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
    forecastToDate: number;
    daysRemaining: number;
    wired: boolean;        // false when the cohort doc doesn't exist / isn't shared
  };
  today: TodayCard | null;
  leads: LeadsLive | null;
}

export interface PulseLive {
  asOf: string;
  families: PulseFamilyLive[];
  freshness: Array<{ source: string; updatedThrough: string; cadence: string; lagging: boolean }>;
}

export async function getPulseLive(): Promise<PulseLive> {
  const now = nowET();
  const asOf = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const wWindow = getActiveCohort('wharton', now);
  const cWindow = getActiveCohort('columbia', now);

  const [wharton, columbia, teamPulled] = await Promise.all([
    buildWharton(wWindow, now),
    buildColumbia(cWindow, now),
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

  return { asOf, families: [wharton, columbia], freshness };
}

async function buildWharton(w: CohortWindow | null, now: Date): Promise<PulseFamilyLive> {
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

  const [{ summary }, today, leads] = await Promise.all([
    getPacingDataV2(sheetId).catch(() => ({ summary: [] as Array<{ enrolled: number; goal: number; forecast: number; daysRemaining: number }> })),
    readDeadlineTable(sheetId, wiring.deadlineTab, label),
    readWoWLeads(sheetId, label),
  ]);
  const s = summary[0];

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
      forecastToDate: s?.forecast ?? 0,
      daysRemaining: s?.daysRemaining ?? 0,
      wired: !!s,
    },
    today,
    leads,
  };
}

async function buildColumbia(c: CohortWindow | null, now: Date): Promise<PulseFamilyLive> {
  const label = c ? `CBS ${c.label}` : 'CBS';
  const wiring = c ? COHORT_SHEETS[c.key] : undefined;
  const sheetId = wiring?.sheetId();

  // Enrollment summary comes from the pacing sheet (AN Summary), which tracks
  // the active Columbia cohort; daily goals + leads come from the cohort doc.
  const pacingSheetId = process.env.GOOGLE_PACING_SHEET_ID;
  const [pacing, today, leads] = await Promise.all([
    getPacingData(pacingSheetId).catch(() => null),
    sheetId ? readDeadlineTable(sheetId, wiring!.deadlineTab, label) : Promise.resolve(null),
    sheetId ? readWoWLeads(sheetId, label) : Promise.resolve(null),
  ]);
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
      enrolls: s?.enrolled ?? 0,
      goal: s?.goal ?? 0,
      forecastToDate: s?.forecast ?? 0,
      daysRemaining: s?.daysRemaining ?? 0,
      wired: !!s || !!today,
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
  isActive: boolean;
}

// Adapt sheets.ts ComparisonRow (pctOfGoal / pctComplete, post-split) to the
// history-row shape: % of the true goal is the figure the history table shows.
function toHistoryRow(r: { label: string; enrolled: number; goal: number; pctOfGoal: number }, isActive = false): CommandHistoryRow {
  return { label: r.label, enrolled: r.enrolled, goal: r.goal, pctDone: r.pctOfGoal, isActive };
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
  keyedThrough: string | null;
  history: CommandHistoryRow[];
}

export async function getCohortCommandLive(family: 'wharton' | 'columbia'): Promise<CommandLive | null> {
  const now = nowET();
  const win = getActiveCohort(family, now);
  const wiring = win ? COHORT_SHEETS[win.key] : undefined;
  const sheetId = wiring?.sheetId();

  if (family === 'wharton') {
    if (!sheetId || !wiring) return null;
    const [pacing, today, leads] = await Promise.all([
      getPacingDataV2(sheetId).catch(() => null),
      readDeadlineTable(sheetId, wiring.deadlineTab, win!.label),
      readWoWLeads(sheetId, win!.label),
    ]);
    const s = pacing?.summary[0];
    if (!s) return null;
    const cmp = pacing!.comparison.wharton;
    return {
      family,
      label: win!.label,
      enrolls: today?.cohortToDate ?? s.enrolled,
      goal: s.goal,
      forecastToDate: s.forecast,
      daysRemaining: s.daysRemaining,
      totals: leads?.totals ?? null,
      leadsDetail: leads,
      keyedThrough: today?.updatedThrough ?? null,
      history: [
        { label: win!.label, enrolled: today?.cohortToDate ?? s.enrolled, goal: s.goal, pctDone: s.goal > 0 ? +((today?.cohortToDate ?? s.enrolled) / s.goal * 100).toFixed(1) : 0, isActive: true },
        ...cmp.closedRows.map(r => toHistoryRow(r)),
      ],
    };
  }

  // Columbia: enrollment summary from the pacing sheet; WoW + daily from the doc
  const pacingSheetId = process.env.GOOGLE_PACING_SHEET_ID;
  const [pacing, today, leads] = await Promise.all([
    getPacingData(pacingSheetId).catch(() => null),
    sheetId && wiring ? readDeadlineTable(sheetId, wiring.deadlineTab, win?.label ?? 'CBS') : Promise.resolve(null),
    sheetId ? readWoWLeads(sheetId, win?.label ?? 'CBS') : Promise.resolve(null),
  ]);
  const s = pacing?.summary.find(x => x.program === 'CBSEE');
  if (!s || !win) return null;
  const cmp = pacing!.comparison.cbsee;
  return {
    family,
    label: win.label,
    enrolls: s.enrolled,
    goal: s.goal,
    forecastToDate: s.forecast,
    daysRemaining: s.daysRemaining,
    totals: leads?.totals ?? null,
    leadsDetail: leads,
    keyedThrough: today?.updatedThrough ?? null,
    history: [
      { label: win.label, enrolled: s.enrolled, goal: s.goal, pctDone: s.goal > 0 ? +(s.enrolled / s.goal * 100).toFixed(1) : 0, isActive: true },
      ...(cmp?.closedRows ?? []).map(r => toHistoryRow(r)),
    ],
  };
}
