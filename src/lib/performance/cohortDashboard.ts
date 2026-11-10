// ─── Partner Cohort Dashboard — reader ────────────────────────────────────────
//
// Rebuilds the HubSpot cohort dashboards ("Wharton Winter 2027 Cohort
// Dashboard", "Fall 2026 Cohort Dashboard - AI") on the cohort performance
// doc instead of HubSpot. Two differences from HubSpot drive the numbers:
//   • Enrollments ("students") are the doc's enrollment count, not contacts
//     that entered HubSpot's Customer lifecycle stage. On 2026-11-06 the
//     Wharton doc had 22 Winter '27 enrollments where the HubSpot report showed
//     about 16.
//   • Sources are the doc's V2 original-source attribution (Channel
//     Definitions tab), not HubSpot's "Original Source" property.
//
// Everything comes from one tab: the doc's daily "<Term> Data" tab, one row per
// day from open to close, which Jon's ROAS doc (Wharton) and the CBS program
// docs feed by IMPORTRANGE. It carries leads and enrollments per day, per
// program (Wharton) and per ad platform. It is the tab the doc's own WoW table
// is built from. Verified 2026-11-06:
//   • Wharton Winter '27: daily per-program sums equal every "Overall WoW
//     Performance & Goals V2" week row (116/302/320/221 leads, 10/4/4/4
//     enrollments) and its Total row (959 / 22). The platform columns sum to
//     Channel Tables V2's current-cohort sub-channel rows exactly (Google 521,
//     Bing 3, Meta 60, LinkedIn 22 leads).
//   • CBS Fall '26: daily sums equal all 16 WoW week rows. The tab's "Overall
//     Leads" column EXCLUDES the Employer Test line (3,658 = the WoW tab's
//     "Total (Non-Test)" row), whose 462 leads sit in their own "Test" column.
//     "Overall Enrollments" INCLUDES the employer enrollments (307 = the WoW
//     "Total" row). Total leads are therefore Overall + Test, so both totals land
//     on the WoW "Total" row (4,120 / 307). The weekly rows mix those bases
//     (Non-Test leads, Total enrollments), and the week check compares like
//     with like.
//
// What the daily tab can NOT give is a per-day split of the non-PPC channels
// (organic, referral, direct, email, WSP, affiliates, sponsored content…).
// Those sit in contact-level exports inside the program docs, which the
// service account cannot open. So the by-source series here are the ad
// platforms plus "All other channels" (the remainder). The page shows the full
// V2 channel breakdown to date from Channel Tables V2 via /api/performance/channels.
//
// Layout traps (Wharton tab), all handled below:
//   • RDI's daily-LEADS column is headed "RDI Enrollments", and "RDI
//     Enrollments" appears three times. Program columns are resolved by
//     position from the "PE Overall Daily …" anchor and checked against the
//     running totals row by row, never found by name.
//   • AVI is "Buy" in the leads and platform columns and "AVI" in the daily
//     enrollment column.
//   • The total-enrollments-per-day column is headed "Daily Overall Leads".
//   • Rows run to the close date. Days after the last keyed day carry the running
//     totals forward with zero daily figures, so they are cut, not shown as zeros.
// CBS tab: a stray duplicate LinkedIn leads column sits BEFORE "LinkedIn
// Spend", so a platform's leads column is the one right AFTER its Spend
// column, never found by name (same rule as cbsPaidDaily.ts).

import { google } from 'googleapis';
import { resolveVersionedTab } from '@/lib/sheets';
import { COHORT_SHEETS, getActiveCohortSheet } from '@/lib/cohortSheets';
import {
  getPreviousCohort, nowET, todayET, type CohortWindow,
} from '@/lib/cohortCalendar';
import type { PartnerKey } from './partners';
import type { ProgramKey } from './channelTablesTypes';
import {
  SOURCE_ORDER, PROGRAM_COLORS,
  type CohortDashboardData, type DayRow, type ProgramMeta, type SourceCheck,
  type SourceCounts, type SourceKey, type WeekDef,
} from './cohortDashboardTypes';

export type CohortDashboardResult =
  | { ok: true; data: CohortDashboardData }
  | { ok: false; needsAccess: boolean; error: string; sheetId: string | null };

type Cell = string | number | boolean | null | undefined;
type Grid = Cell[][];

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

export function getServiceAccountEmail(): string | null {
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    return raw ? (JSON.parse(raw).client_email ?? null) : null;
  } catch {
    return null;
  }
}

// ─── Cell helpers ─────────────────────────────────────────────────────────────

function num(v: Cell): number | null {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || s.startsWith('#')) return null;
  const n = parseFloat(s.replace(/[$,%\s]/g, ''));
  return isNaN(n) ? null : n;
}
const n0 = (v: Cell) => num(v) ?? 0;
const str = (v: Cell) => String(v ?? '').replace(/\s+/g, ' ').trim();

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The daily tab's date cell: a Sheets serial (unformatted read) or "M/D/YYYY". */
function cellDate(v: Cell): string | null {
  if (typeof v === 'number' && v > 30000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const m = str(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + days));
}

/** "10/14" → ISO, choosing the year that puts it inside the cohort window
 *  (Wharton's winter cohort runs October → February). */
function resolveMonthDay(md: string, win: { opens: string; closes: string }): string | null {
  const m = md.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const y0 = Number(win.opens.slice(0, 4));
  const lo = addDays(win.opens, -10);
  const hi = addDays(win.closes, 10);
  for (const y of [y0, y0 + 1, y0 - 1]) {
    const iso = `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    if (iso >= lo && iso <= hi) return iso;
  }
  return null;
}

// ─── Program / platform header grammar ────────────────────────────────────────

const WHARTON_PROGRAMS: ProgramKey[] = ['pe', 're', 'fpa', 'avi', 'rdi'];
const PROGRAM_LABEL: Partial<Record<ProgramKey, string>> = {
  pe: 'PE', re: 'RE', fpa: 'FP&A', avi: 'AVI', rdi: 'RDI', ai: 'AI',
};

/** First token of a daily-tab header → program. "Buy" is AVI. */
function programOfToken(token: string): ProgramKey | null {
  const t = token.trim().toUpperCase();
  const map: Record<string, ProgramKey> = {
    PE: 'pe', RE: 're', 'FP&A': 'fpa', FPA: 'fpa', BUY: 'avi', AVI: 'avi', RDI: 'rdi', RD: 'rdi',
  };
  return map[t] ?? null;
}

function platformOfToken(token: string): SourceKey | null {
  const t = token.trim().toLowerCase();
  if (t === 'google') return 'google';
  if (t === 'bing' || t === 'microsoft') return 'bing';
  if (t === 'fb' || t === 'facebook' || t === 'meta') return 'meta';
  if (t === 'li' || t === 'linkedin') return 'linkedin';
  if (t === 'twitter' || t === 'x') return 'twitter';
  if (t === 'open ai' || t === 'openai') return 'openai';
  if (t === 'test' || t === 'employer' || t === 'employer test') return 'employer';
  return null;
}

// ─── Parsed daily tab (partner-neutral) ───────────────────────────────────────

interface ParsedDay {
  date: string;
  /** Program totals for the day. For CBS leads, EXCLUDES the employer line. */
  leads: Partial<Record<ProgramKey, number>>;
  enrolls: Partial<Record<ProgramKey, number>>;
  /** program → platform → count. */
  platLeads: Partial<Record<ProgramKey, Partial<Record<SourceKey, number>>>>;
  platEnrolls: Partial<Record<ProgramKey, Partial<Record<SourceKey, number>>>>;
  /** CBS only: the employer line's leads, which sit OUTSIDE `leads`. */
  employerLeads: number;
}

interface ParsedTab {
  programs: ProgramKey[];
  days: ParsedDay[];
  checks: SourceCheck[];
  notes: string[];
}

/** Resolve N program columns starting at an anchor header, by first token. */
function programRun(header: string[], anchor: number, expect: ProgramKey[]): Map<ProgramKey, number> | null {
  const out = new Map<ProgramKey, number>();
  for (let i = anchor; i < Math.min(anchor + expect.length, header.length); i++) {
    const p = programOfToken(header[i].split(' ')[0] ?? '');
    if (!p || out.has(p)) return null;
    out.set(p, i);
  }
  return expect.every(p => out.has(p)) ? out : null;
}

function parseWhartonDaily(grid: Grid, tab: string): ParsedTab | string {
  const header = (grid[0] ?? []).map(str);
  const cDate = header.findIndex(h => /^date$/i.test(h));
  const leadAnchor = header.findIndex(h => /^pe overall daily leads$/i.test(h));
  const enrAnchor = header.findIndex(h => /^pe overall daily enrollments$/i.test(h));
  const cCumLeads = header.findIndex(h => /^total overall leads$/i.test(h));
  const cCumEnr = header.findIndex(h => /^total overall enrollments$/i.test(h));
  if (cDate < 0 || leadAnchor < 0 || enrAnchor < 0) {
    return `"${tab}" layout not recognised — no Date / "PE Overall Daily Leads" / "PE Overall Daily Enrollments" header`;
  }
  const leadCols = programRun(header, leadAnchor, WHARTON_PROGRAMS);
  const enrCols = programRun(header, enrAnchor, WHARTON_PROGRAMS);
  if (!leadCols || !enrCols) {
    return `"${tab}": the five program columns after "PE Overall Daily Leads/Enrollments" are not PE, RE, FP&A, AVI/Buy and RDI`;
  }

  // "<PROG> <Platform> Leads|Enrolls|Enroll" — unique names, safe to find by name.
  const platCols: Array<{ program: ProgramKey; source: SourceKey; kind: 'leads' | 'enrolls'; col: number }> = [];
  header.forEach((h, i) => {
    const m = h.match(/^(\S+)\s+(Google|Bing|FB|Facebook|Meta|LI|LinkedIn|Twitter|X)\s+(Leads|Enrolls?|Enrollments)$/i);
    if (!m) return;
    const program = programOfToken(m[1]);
    const source = platformOfToken(m[2]);
    if (!program || !source) return;
    platCols.push({ program, source, kind: /^lead/i.test(m[3]) ? 'leads' : 'enrolls', col: i });
  });

  const days: ParsedDay[] = [];
  const rowFails: string[] = [];
  let prevCumL = 0;
  let prevCumE = 0;
  for (const r of grid.slice(1)) {
    const date = cellDate(r?.[cDate]);
    if (!date) continue;
    const d: ParsedDay = { date, leads: {}, enrolls: {}, platLeads: {}, platEnrolls: {}, employerLeads: 0 };
    for (const p of WHARTON_PROGRAMS) {
      d.leads[p] = n0(r[leadCols.get(p)!]);
      d.enrolls[p] = n0(r[enrCols.get(p)!]);
    }
    for (const c of platCols) {
      const bucket = c.kind === 'leads' ? d.platLeads : d.platEnrolls;
      const per = (bucket[c.program] ??= {});
      per[c.source] = (per[c.source] ?? 0) + n0(r[c.col]);
    }
    // Row check: the five program columns must account for the day's movement
    // in the running totals. A shifted column fails here instead of drawing a
    // plausible-looking but wrong split.
    if (cCumLeads >= 0 && cCumEnr >= 0) {
      const cumL = num(r[cCumLeads]);
      const cumE = num(r[cCumEnr]);
      if (cumL !== null && cumE !== null) {
        const sL = WHARTON_PROGRAMS.reduce((s, p) => s + (d.leads[p] ?? 0), 0);
        const sE = WHARTON_PROGRAMS.reduce((s, p) => s + (d.enrolls[p] ?? 0), 0);
        if (Math.round(sL) !== Math.round(cumL - prevCumL) || Math.round(sE) !== Math.round(cumE - prevCumE)) {
          rowFails.push(date);
        }
        prevCumL = cumL;
        prevCumE = cumE;
      }
    }
    days.push(d);
  }

  const checks: SourceCheck[] = [];
  if (cCumLeads >= 0 && cCumEnr >= 0) {
    checks.push({
      label: 'Program columns add up to the running totals',
      ok: rowFails.length === 0,
      detail: rowFails.length === 0
        ? `Every row's PE + RE + FP&A + AVI + RDI equals the day's change in "Total Overall Leads" and "Total Overall Enrollments".`
        : `${rowFails.length} day(s) don't: ${rowFails.slice(0, 5).join(', ')}${rowFails.length > 5 ? '…' : ''}.`,
    });
  }
  const notes: string[] = [];
  if (platCols.length === 0) {
    notes.push(`"${tab}" has no per-platform columns, so every lead and enrollment is shown under "All other channels".`);
  }
  return { programs: WHARTON_PROGRAMS, days, checks, notes };
}

function parseCbsDaily(grid: Grid, tab: string): ParsedTab | string {
  const header = (grid[0] ?? []).map(str);
  const cDate = header.findIndex(h => /^date$/i.test(h));
  // First occurrence: a later "Overall Leads" column is something else.
  const cLeads = header.findIndex(h => /^overall leads$/i.test(h));
  const cEnr = header.findIndex(h => /^overall enrollments$/i.test(h));
  if (cDate < 0 || cLeads < 0 || cEnr < 0) {
    return `"${tab}" layout not recognised — no Date / "Overall Leads" / "Overall Enrollments" header`;
  }
  // Leads: the column right after "<Platform> Spend".
  const leadCols: Array<{ source: SourceKey; col: number }> = [];
  header.forEach((h, i) => {
    const m = h.match(/^(.+?)\s+spend$/i);
    if (!m) return;
    const source = platformOfToken(m[1]);
    if (!source || leadCols.some(c => c.source === source)) return;
    if (!/leads$/i.test(header[i + 1] ?? '')) return;
    leadCols.push({ source, col: i + 1 });
  });
  const enrCols: Array<{ source: SourceKey; col: number }> = [];
  header.forEach((h, i) => {
    const m = h.match(/^(.+?)\s+enrollments$/i);
    if (!m || /^overall$/i.test(m[1])) return;
    const source = platformOfToken(m[1]);
    if (source && !enrCols.some(c => c.source === source)) enrCols.push({ source, col: i });
  });

  const days: ParsedDay[] = [];
  for (const r of grid.slice(1)) {
    const date = cellDate(r?.[cDate]);
    if (!date) continue;
    const d: ParsedDay = { date, leads: {}, enrolls: {}, platLeads: { ai: {} }, platEnrolls: { ai: {} }, employerLeads: 0 };
    d.leads.ai = n0(r[cLeads]);
    d.enrolls.ai = n0(r[cEnr]);
    for (const c of leadCols) {
      const v = n0(r[c.col]);
      if (c.source === 'employer') d.employerLeads += v;
      else d.platLeads.ai![c.source] = v;
    }
    for (const c of enrCols) d.platEnrolls.ai![c.source] = n0(r[c.col]);
    days.push(d);
  }
  const notes: string[] = [];
  if (leadCols.length === 0) {
    notes.push(`"${tab}" has no per-platform lead columns, so every lead is shown under "All other channels".`);
  }
  return { programs: ['ai'], days, checks: [], notes };
}

// ─── WoW tab: week definitions + the totals to reconcile against ──────────────

interface WowFigures { leads: number | null; enrolls: number | null }
interface WowTab {
  weeks: Array<WeekDef & { total: WowFigures; byProgram: Partial<Record<ProgramKey, WowFigures>> }>;
  /** Summary block rows by label, e.g. "Total", "Total (Non-Test)", "PE". */
  summary: Map<string, WowFigures>;
}

function parseWow(grid: Grid, win: { opens: string; closes: string }): WowTab | null {
  const isLeads = (h: string) => /^leads\s*\(actual\)$/i.test(h);
  const isEnr = (h: string) => /^enrollments\s*\(?actual\)?$/i.test(h);
  const summary = new Map<string, WowFigures>();
  const weeks: WowTab['weeks'] = [];

  // Summary block: header row with "Program", rows below until a blank label.
  const sumHdr = grid.findIndex(r => (r ?? []).some(c => /^program$/i.test(str(c))));
  if (sumHdr >= 0) {
    const h = (grid[sumHdr] ?? []).map(str);
    const cLabel = h.findIndex(x => /^program$/i.test(x));
    const cL = h.findIndex(isLeads);
    const cE = h.findIndex(isEnr);
    for (let i = sumHdr + 1; i < grid.length; i++) {
      const label = str(grid[i]?.[cLabel]);
      if (!label) break;
      summary.set(label.toLowerCase(), { leads: num(grid[i]?.[cL]), enrolls: num(grid[i]?.[cE]) });
    }
  }

  // Weekly block: header row with "Date Range".
  const wkHdr = grid.findIndex(r => (r ?? []).some(c => /^date range$/i.test(str(c))));
  if (wkHdr < 0) return summary.size ? { weeks, summary } : null;
  const h = (grid[wkHdr] ?? []).map(str);
  const cWeek = h.findIndex(x => /^week$/i.test(x));
  const cRange = h.findIndex(x => /^date range$/i.test(x));
  const cL = h.findIndex(isLeads);
  const cE = h.findIndex(isEnr);
  if (cRange < 0 || cL < 0 || cE < 0) return { weeks, summary };
  let cur: WowTab['weeks'][number] | null = null;
  for (let i = wkHdr + 1; i < grid.length; i++) {
    const r = grid[i] ?? [];
    const range = str(r[cRange]);
    const m = range.match(/^(\d{1,2}\/\d{1,2})\s*-\s*(\d{1,2}\/\d{1,2})$/);
    if (m) {
      const start = resolveMonthDay(m[1], win);
      const end = resolveMonthDay(m[2], win);
      if (!start || !end) { cur = null; continue; }
      cur = {
        week: num(r[cWeek]) ?? weeks.length + 1,
        start, end,
        total: { leads: num(r[cL]), enrolls: num(r[cE]) },
        byProgram: {},
      };
      weeks.push(cur);
      continue;
    }
    const p = programOfToken(range);
    if (cur && p) cur.byProgram[p] = { leads: num(r[cL]), enrolls: num(r[cE]) };
    else if (!range && !str(r[cL])) {
      // A fully blank row ends the table once at least one week has been read.
      if (weeks.length) break;
    }
  }
  return { weeks, summary };
}

// ─── Assembly ─────────────────────────────────────────────────────────────────

function sumDays(days: ParsedDay[], from: string, to: string, f: (d: ParsedDay) => number): number {
  let s = 0;
  for (const d of days) if (d.date >= from && d.date <= to) s += f(d);
  return s;
}

/** The cohort to show: the one open for enrollment if its doc is wired, else
 *  the one that just closed (the gap days between a close and the new doc
 *  being registered), never further back. */
function resolveCohort(partner: PartnerKey): { win: CohortWindow; sheetId: string; closed: boolean } | null {
  const family = partner === 'cbs' ? 'columbia' : 'wharton';
  const active = getActiveCohortSheet(family);
  if (active) return { win: active.win, sheetId: active.sheetId, closed: false };
  const prev = getPreviousCohort(family, nowET());
  const id = prev ? COHORT_SHEETS[prev.key]?.sheetId() : undefined;
  return prev && id ? { win: prev, sheetId: id, closed: true } : null;
}

export async function getCohortDashboard(partner: PartnerKey): Promise<CohortDashboardResult> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return { ok: false, needsAccess: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY is not set', sheetId: null };
  }
  const resolved = resolveCohort(partner);
  if (!resolved) {
    return {
      ok: false, needsAccess: false, sheetId: null,
      error: `No cohort doc is wired for the current ${partner === 'cbs' ? 'CBS' : 'Wharton'} cohort or the one before it (src/lib/cohortSheets.ts).`,
    };
  }
  const { win, sheetId, closed } = resolved;
  const expanded = win.label.replace(/'(\d\d)/, '20$1'); // "Fall '26" → "Fall 2026"

  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const [meta, wowTab] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: 'properties.title,sheets.properties.title' }),
      resolveVersionedTab(sheetId, 'Overall WoW Performance & Goals'),
    ]);
    const titles = (meta.data.sheets ?? []).map(s => s.properties?.title ?? '');
    // CBS names daily tabs by the marketing label ("Spring 2026 Data" for the
    // cohort whose academic term is Summer 2026); Wharton's two labels agree.
    const dailyTab = [`${expanded} Data`, `${win.termLabel} Data`].find(t => titles.includes(t));
    if (!dailyTab) {
      return {
        ok: false, needsAccess: false, sheetId,
        error: `No "${expanded} Data" tab in ${meta.data.properties?.title ?? 'the cohort doc'}.`,
      };
    }
    const hasWow = titles.includes(wowTab);
    const values = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges: [`'${dailyTab}'!A1:FZ260`, ...(hasWow ? [`'${wowTab}'!A1:Z200`] : [])],
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const dailyGrid = (values.data.valueRanges?.[0]?.values ?? []) as Grid;
    const wowGrid = (values.data.valueRanges?.[1]?.values ?? []) as Grid;

    const parsed = partner === 'cbs' ? parseCbsDaily(dailyGrid, dailyTab) : parseWhartonDaily(dailyGrid, dailyTab);
    if (typeof parsed === 'string') return { ok: false, needsAccess: false, error: parsed, sheetId };

    const today = todayET();
    // Days after the last keyed day carry zeros (the running totals are only
    // carried forward), so cut there. Today is kept if it already has data.
    const inWindow = parsed.days
      .filter(d => d.date >= win.opens && d.date <= win.extEnds && d.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    const active = (d: ParsedDay) =>
      parsed.programs.some(p => (d.leads[p] ?? 0) !== 0 || (d.enrolls[p] ?? 0) !== 0) || d.employerLeads !== 0;
    const lastKeyed = [...inWindow].reverse().find(active)?.date ?? null;
    const days = lastKeyed ? inWindow.filter(d => d.date <= lastKeyed) : [];

    const notes = [...parsed.notes];
    const checks = [...parsed.checks];

    // ── Build the source split: platforms + remainder, per program per day.
    const seen = new Set<SourceKey>();
    const negatives: string[] = [];
    const rows: DayRow[] = days.map(d => {
      const leads: DayRow['leads'] = {};
      const enrolls: DayRow['enrolls'] = {};
      for (const p of parsed.programs) {
        const split = (total: number, plats: Partial<Record<SourceKey, number>> | undefined, kind: string): SourceCounts => {
          const out: SourceCounts = {};
          let platSum = 0;
          for (const [k, v] of Object.entries(plats ?? {}) as Array<[SourceKey, number]>) {
            if (!v) continue;
            out[k] = v;
            platSum += v;
          }
          const rest = total - platSum;
          if (rest < 0) negatives.push(`${d.date} ${PROGRAM_LABEL[p] ?? p} ${kind}`);
          if (rest !== 0) out.other = rest;
          return out;
        };
        leads[p] = split(d.leads[p] ?? 0, d.platLeads[p], 'leads');
        enrolls[p] = split(d.enrolls[p] ?? 0, d.platEnrolls[p], 'enrollments');
        // CBS: the employer line's leads sit outside "Overall Leads" — added
        // on top so the day's total lands on the WoW "Total" basis.
        if (d.employerLeads) leads[p]!.employer = (leads[p]!.employer ?? 0) + d.employerLeads;
        for (const k of Object.keys(leads[p]!) as SourceKey[]) seen.add(k);
        for (const k of Object.keys(enrolls[p]!) as SourceKey[]) seen.add(k);
      }
      return { date: d.date, leads, enrolls };
    });
    if (negatives.length) {
      notes.push(
        `On ${negatives.length} program-day(s) the ad-platform columns exceed the day's total ` +
        `(${negatives.slice(0, 4).join('; ')}${negatives.length > 4 ? '…' : ''}), so "All other channels" ` +
        `goes negative there. The totals are unaffected; the source split for those days is not reliable.`);
    }

    // ── Reconcile against the doc's own WoW tab.
    const wow = hasWow && wowGrid.length ? parseWow(wowGrid, { opens: win.opens, closes: win.extEnds }) : null;
    let weeks: WeekDef[] = [];
    if (!wow || wow.weeks.length === 0) {
      notes.push(
        `"${wowTab}" couldn't be read, so weeks here are Monday–Sunday and can't be checked ` +
        `against the doc's weekly table.`);
    } else {
      weeks = wow.weeks.map(({ week, start, end }) => ({ week, start, end }));
      // CBS weekly LEADS rows are on the Non-Test basis (= the daily
      // "Overall Leads" column); enrollments include the employer line.
      const dayLeads = (d: ParsedDay) => parsed.programs.reduce((s, p) => s + (d.leads[p] ?? 0), 0);
      const dayEnr = (d: ParsedDay) => parsed.programs.reduce((s, p) => s + (d.enrolls[p] ?? 0), 0);
      const through = lastKeyed ?? win.opens;
      const fails: string[] = [];
      let compared = 0;
      for (const w of wow.weeks) {
        if (w.start > through) continue;
        compared++;
        const to = w.end < through ? w.end : through;
        const L = sumDays(days, w.start, to, dayLeads);
        const E = sumDays(days, w.start, to, dayEnr);
        const bad: string[] = [];
        if (w.total.leads !== null && Math.round(L) !== Math.round(w.total.leads)) bad.push(`leads ${L} vs ${w.total.leads}`);
        if (w.total.enrolls !== null && Math.round(E) !== Math.round(w.total.enrolls)) bad.push(`enrollments ${E} vs ${w.total.enrolls}`);
        for (const [p, f] of Object.entries(w.byProgram) as Array<[ProgramKey, WowFigures]>) {
          if (!parsed.programs.includes(p)) continue;
          const pl = sumDays(days, w.start, to, d => d.leads[p] ?? 0);
          const pe = sumDays(days, w.start, to, d => d.enrolls[p] ?? 0);
          if (f.leads !== null && Math.round(pl) !== Math.round(f.leads)) bad.push(`${PROGRAM_LABEL[p]} leads ${pl} vs ${f.leads}`);
          if (f.enrolls !== null && Math.round(pe) !== Math.round(f.enrolls)) bad.push(`${PROGRAM_LABEL[p]} enrollments ${pe} vs ${f.enrolls}`);
        }
        if (bad.length) fails.push(`week ${w.week} (${bad.join(', ')})`);
      }
      checks.push({
        label: `Weekly sums match "${wowTab}"`,
        ok: fails.length === 0,
        detail: fails.length === 0
          ? `All ${compared} week${compared === 1 ? '' : 's'} to date agree${partner === 'wharton' ? ', in total and per program' : ''}` +
            (partner === 'cbs' ? ' (leads on the tab\'s Non-Test basis, enrollments on its Total basis).' : '.')
          : `Mismatch in ${fails.join('; ')}. The doc's weekly row may have been edited by hand or the daily tab re-keyed since.`,
      });

      // Cohort totals vs the summary block.
      const sumL = days.reduce((s, d) => s + dayLeads(d), 0);
      const sumEmp = days.reduce((s, d) => s + d.employerLeads, 0);
      const sumE = days.reduce((s, d) => s + dayEnr(d), 0);
      const tot = wow.summary.get('total');
      if (tot) {
        const parts: string[] = [];
        let ok = true;
        const shownLeads = sumL + sumEmp;
        if (tot.leads !== null) {
          ok &&= Math.round(shownLeads) === Math.round(tot.leads);
          parts.push(`leads ${shownLeads.toLocaleString('en-US')} vs ${tot.leads.toLocaleString('en-US')}`);
        }
        if (tot.enrolls !== null) {
          ok &&= Math.round(sumE) === Math.round(tot.enrolls);
          parts.push(`enrollments ${sumE.toLocaleString('en-US')} vs ${tot.enrolls.toLocaleString('en-US')}`);
        }
        const emp = wow.summary.get('employer test');
        if (partner === 'cbs' && emp?.leads !== null && emp?.leads !== undefined) {
          const empOk = Math.round(sumEmp) === Math.round(emp.leads);
          ok &&= empOk;
          parts.push(`Employer Test leads ${sumEmp} vs ${emp.leads}`);
        }
        checks.push({
          label: 'Cohort totals match the WoW tab\'s "Total" row',
          ok,
          detail: `${parts.join('; ')}.` + (lastKeyed ? ` Daily tab keyed through ${lastKeyed}.` : ''),
        });
      }
    }

    if (closed) {
      notes.push(
        `${win.label} has closed and the next cohort's doc isn't wired in src/lib/cohortSheets.ts yet, ` +
        `so this shows ${win.label}'s final numbers.`);
    }

    const programs: ProgramMeta[] = parsed.programs.map(p => ({
      key: p,
      label: PROGRAM_LABEL[p] ?? p,
      color: PROGRAM_COLORS[p] ?? '#9ca3af',
    }));

    return {
      ok: true,
      data: {
        partner,
        cohort: { key: win.key, label: win.label, termLabel: win.termLabel, opens: win.opens, closes: win.extEnds },
        docTitle: meta.data.properties?.title ?? 'Cohort Performance Doc',
        sheetId,
        dailyTab,
        wowTab: hasWow ? wowTab : null,
        throughDate: lastKeyed,
        asOf: today,
        programs,
        sources: SOURCE_ORDER.filter(k => seen.has(k)),
        days: rows,
        weeks,
        checks,
        notes,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    const e = err as { code?: number; status?: number; message?: string };
    const code = e?.code ?? e?.status;
    return { ok: false, needsAccess: code === 403 || code === 404, error: e?.message ?? String(err), sheetId };
  }
}
