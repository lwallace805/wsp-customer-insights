// Live paid-channel data layer for the performance dashboards (Paid
// Optimization, and the paid tiles/rows on Overview and Trends).
//
// Same shape as src/lib/performance/live.ts (the enrollment layer): read the
// current Wharton + Columbia performance docs via the service account once per
// day (unstable_cache, revalidate 86400, refreshed by the Vercel cron), parse
// the per-platform paid tables — cohort-to-date totals, Wharton's program rows
// and the per-platform weekly blocks — validate, and MERGE what parsed over the
// curated static snapshot. If credentials/env are missing, a fetch throws, or
// validation fails, STATIC_PAID_DATA's figures are served.
//
// Every PaidData carries `sources`, one entry per school, saying WHICH cohort
// the served channel figures describe and whether they are live: a page that
// puts paid spend beside live enrollment numbers must check it, because the
// snapshot is a different cohort (Spring 2026) from the one enrolling. A doc
// that parses but reads $0 on every platform is reported as 'unpopulated'
// (its actual columns aren't feeding yet — the Winter 2027 Wharton doc on
// Oct 29 2026, whose "Winter 2027 Data" tab did record daily spend) so pages
// can withhold the figure instead of showing $0 as spend to date.
//
// Sources (shared with live.ts — the same Wharton/Columbia docs): each school
// reads the active cohort's doc from src/lib/cohortSheets.ts, with
// WHARTON_COHORT_DOC_ID / COLUMBIA_COHORT_DOC_ID as the fallback for a cohort
// that has no registry entry yet; GOOGLE_SERVICE_ACCOUNT_KEY authenticates both.
//
// The page's per-school cohort context (the heading, days remaining, and the
// whole-cohort enrollments the blended CPE divides by) travels with the
// channels: when a school's channels came from its registry doc AND the
// enrollment layer (live.ts) read that same cohort, the context is rebuilt
// from the cohort window and the live snapshot. Otherwise the static context
// stays — never a live heading over snapshot denominators, or vice versa.
//
// LABEL-DRIVEN, NO GUESSING. In the "Paid WoW Performance & Goals" tab the four
// platform tables are laid out SIDE-BY-SIDE (Google in the left columns, then
// Bing, Meta, LinkedIn stretching out to ~col BY) — not stacked vertically.
// Each carries an explicit banner cell ("Google" / "Bing" / "Meta" /
// "LinkedIn"). We scan every cell for those banners and read each table at its
// own column offset; a channel is taken ONLY from an explicitly-labeled table,
// never inferred (CPL-goal fingerprinting caused the earlier Meta/Bing &
// Meta/LinkedIn mix-ups). A school goes live only when Google + Meta + LinkedIn
// all parse with sane economics; otherwise it keeps the snapshot. The block's
// total row is "Total" (CBS) or "Total (All)" (Wharton V2 docs, which also
// carry a "Total (No RDI)" restatement that must not be read as the total).
//
// Below each platform table sits an "Overall Performance by Week" block — one
// row per cohort week with a Date Range and the week's Spend / Leads /
// Enrollments (Actual). Each platform's weekly rows sum to its own Total row
// (checked on every read; a series that doesn't reconcile is not served), and
// the dashboards' "all paid" weekly line is their per-week sum.
//
// The CBS Fall '26 doc (V2) lays its blocks out the same way on its "Paid WoW
// Performance & Goals V2" tab, plus two blocks this reader deliberately skips:
// a "Total Paid" roll-up above the platform tables (not a platform banner) and
// an "Open AI" table, which is not a PaidChannel — $2.4K spend / 3 leads /
// 1 enrollment as of Oct 29 2026, and its CPL/CPE and goal cells are LinkedIn's
// copied over. The Columbia four-platform sum therefore sits just under the
// doc's own Total Paid row; /paid-aggregate is the surface that reports the
// Open AI line. The docs' "Overall Goals" and "Overall Performance Tables"
// tabs also list the platform names in a column, but their header rows carry
// no "(Actual)" columns, so they fail the header check and are passed over.

import { google } from 'googleapis';
import { unstable_cache } from 'next/cache';
import {
  STATIC_PAID_DATA, PROGRAMS_BY_SCHOOL, MATRIX_CHANNELS,
  type PaidData, type ChannelTotal, type PaidChannel, type CohortContext,
  type PaidWeekPoint, type WeeklySeries, type ProgramChannelLeaf, type PaidSchoolSource,
} from '@/data/performance/paidOptimization';
import { PROGRAM_SCHOOL, type CurrentSnapshot, type School } from '@/data/performance/types';
import { isDemo } from '@/lib/demo/flag';
import { getActiveCohortSheet } from '@/lib/cohortSheets';
import { dateOf, daysUntilCutover, type CohortWindow } from '@/lib/cohortCalendar';
import { getLiveSnapshotOrNull } from './live';

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

// Strip $, commas, %, parse to number; null on blank/error.
function N(v: unknown): number | null {
  if (v == null || String(v).trim() === '') return null;
  const s = String(v);
  if (s === '#DIV/0!' || s === '#REF!' || s === '#VALUE!') return null;
  const n = parseFloat(s.replace(/[$,%]/g, '').replace(/,/g, '').trim());
  return isNaN(n) ? null : n;
}

/** Which doc each school's paid tables come from: the active cohort's registry
 *  entry (the doc Pulse, /channels and the partner page read), with the
 *  school's env var as the fallback for a cohort that isn't wired yet — in
 *  which case the cohort window is unknown (`win: null`) and the page keeps
 *  its static cohort context. Resolved per call so a rotation needs no restart. */
function docFor(school: School): { docId: string; win: CohortWindow | null } | null {
  const active = getActiveCohortSheet(school);
  if (active) return { docId: active.sheetId, win: active.win };
  const envId = school === 'wharton'
    ? process.env.WHARTON_COHORT_DOC_ID
    : process.env.COLUMBIA_COHORT_DOC_ID;
  return envId ? { docId: envId, win: null } : null;
}

/** "Mar 24 – Jul 20, 2026", or "Oct 14, 2026 – Feb 16, 2027" across a year end. */
function formatRange(opens: string, ends: string): string {
  const a = dateOf(opens), b = dateOf(ends);
  const md = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return a.getFullYear() === b.getFullYear()
    ? `${md(a)} – ${md(b)}, ${b.getFullYear()}`
    : `${md(a)}, ${a.getFullYear()} – ${md(b)}, ${b.getFullYear()}`;
}

/** The page's cohort context for one school, from the cohort window, the
 *  school's live channels and the live enrollment snapshot — all three
 *  describing the same cohort (the caller checks the snapshot's label). */
function buildCohortContext(
  school: School, win: CohortWindow, channels: ChannelTotal[], snapshot: CurrentSnapshot,
): CohortContext {
  const programs = snapshot.programs.filter(p => PROGRAM_SCHOOL[p.program] === school);
  const sum = (f: (p: CurrentSnapshot['programs'][number]) => number) => programs.reduce((a, p) => a + f(p), 0);
  return {
    school,
    cohort: win.termLabel,
    dateRange: formatRange(win.opens, win.extEnds),
    daysRemaining: daysUntilCutover(win),
    enrollsRealTime: sum(p => p.enrolls.realTime),
    enrollsGoal: sum(p => p.enrolls.finalTarget),
    leadsRealTime: sum(p => p.leads.realTime),
    leadsGoal: sum(p => p.leads.finalTarget),
    totalPaidSpend: channels.reduce((a, c) => a + c.spend, 0),
    paidEnrolls: channels.reduce((a, c) => a + c.enrolls, 0),
  };
}

type Grid = unknown[][];
interface Tab { title: string; rows: Grid }

// Version suffix the docs put on reworked tabs ("… V2"); the highest wins so a
// doc carrying both the original and the V2 (the Fall 2026 Wharton doc does —
// same actuals, superseded forecasts/goals in the original) is read from V2.
function paidWowVersion(title: string): number {
  const m = title.trim().match(/^paid wow performance & goals(?:\s+(?:-\s*)?v(\d+))?$/i);
  return m ? (m[1] ? parseInt(m[1], 10) : 1) : 0;
}

/** Read every tab, each as its own grid, with the "Paid WoW Performance &
 *  Goals" tabs first (newest version first). Wide (to col CB) so the
 *  side-by-side platform tables (LinkedIn reaches ~col BY) aren't cut off.
 *  Unformatted, so spend arrives to the cent rather than as the cell's rounded
 *  display string. Tabs stay separate: a block parser that walks downward from
 *  a banner must stop at the end of that tab, not run into the next one. */
async function readAllTabs(
  sheets: ReturnType<typeof google.sheets>,
  docId: string,
): Promise<{ title: string; tabs: Tab[] }> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: docId });
  const titles = (meta.data.sheets ?? [])
    .map(s => s.properties?.title)
    .filter((t): t is string => !!t);
  const docTitle = meta.data.properties?.title ?? '';
  if (!titles.length) return { title: docTitle, tabs: [] };
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: docId,
    ranges: titles.map(t => `'${t}'!A1:CB400`),
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const tabs: Tab[] = (res.data.valueRanges ?? []).map((vr, i) => ({
    title: titles[i],
    rows: (vr.values ?? []) as Grid,
  }));
  return {
    title: docTitle,
    tabs: tabs.sort((a, b) => paidWowVersion(b.title) - paidWowVersion(a.title)),
  };
}

/** "Fall 2026" out of a doc title like "CBS Certificate - Fall 2026 Cohort
 *  Performance Doc" — the cohort label when the registry gave us no window. */
function cohortFromTitle(title: string): string | null {
  const m = title.match(/(Fall|Spring|Winter|Summer)\s*(20\d\d)/i);
  return m ? `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2]}` : null;
}

const S = (v: unknown) => String(v ?? '').trim();

// A cell is a platform banner only if it's EXACTLY the platform name (avoids
// matching "Ads - Google / FB / LI / Other" or "Google Ads Catch-Up …").
function bannerCell(s: string): PaidChannel | null {
  const t = s.trim().toLowerCase();
  if (t === 'google') return 'google';
  if (t === 'meta' || t === 'facebook') return 'meta';
  if (t === 'linkedin' || t === 'linked in') return 'linkedin';
  if (t === 'bing' || t === 'microsoft' || t === 'microsoft ads') return 'bing';
  return null;
}

// The block's cohort-to-date row. CBS labels it "Total"; the Wharton V2 docs
// "Total (All)" with a "Total (No RDI)" restatement beside it that must never
// be taken for the total.
const isTotalLabel = (s: string) => /^total(\s*\(all\))?$/i.test(s.trim());

const WHARTON_PROGRAMS = new Set(PROGRAMS_BY_SCHOOL.wharton);
const DATE_RANGE = /^\d{1,2}\/\d{1,2}\s*-\s*\d{1,2}\/\d{1,2}$/;

/** Column finder scoped to one block's header row, so "Spend (Actual)" in the
 *  Meta table can't be satisfied by the Google table's identically named column. */
function headerCols(hdr: unknown[], base: number) {
  return (pred: (h: string) => boolean) => {
    for (let k = base; k < Math.min(base + 25, hdr.length); k++) {
      if (pred(S(hdr[k]).toLowerCase())) return k;
    }
    return -1;
  };
}

/** One platform table found under an exact banner cell, with the rows of the
 *  tab that hang off it: its Total row, its program rows (Wharton lists
 *  PE / RE / FP&A / AVI / RDI under the total) and the "Overall Performance by
 *  Week" block that sits below it in the same column. */
interface PlatformBlock {
  total: ChannelTotal;
  programs: ProgramChannelLeaf[];
  weekly: PaidWeekPoint[] | null;
  tab: string;
}

/** The weekly block under a platform table: a marker cell in the banner's own
 *  column a few rows down, a header row, then one row per cohort week carrying
 *  a "Date Range" like "7/21-7/27". Wharton interleaves per-program sub-rows
 *  ("   PE") that have no date range and are skipped; CBS closes the block with
 *  a "Forecast Assumptions" section. Rows run from the cohort's open week
 *  through its last planned week, so future weeks arrive as zeros. */
function parseWeekly(rows: Grid, r: number, c: number): PaidWeekPoint[] | null {
  let mr = -1;
  for (let j = r + 2; j < Math.min(r + 40, rows.length); j++) {
    if (/^overall performance by week$/i.test(S(rows[j]?.[c]))) { mr = j; break; }
  }
  if (mr < 0) return null;
  const find = headerCols(rows[mr + 1] ?? [], c);
  const cDate = find(h => h === 'date range');
  const cSpend = find(h => h.includes('spend') && h.includes('actual'));
  const cLeads = find(h => h.includes('lead') && h.includes('actual'));
  const cEnroll = find(h => h.includes('enroll') && h.includes('actual'));
  if (cDate < 0 || cSpend < 0 || cLeads < 0 || cEnroll < 0) return null;

  const out: PaidWeekPoint[] = [];
  for (let j = mr + 2; j < Math.min(mr + 200, rows.length); j++) {
    const row = rows[j] ?? [];
    if (/^forecast assumptions$/i.test(S(row[c]))) break;
    const range = S(row[cDate]);
    if (!DATE_RANGE.test(range)) continue;
    out.push({
      week: range.split('-')[0].trim(),
      spend: N(row[cSpend]) ?? 0,
      leads: N(row[cLeads]) ?? 0,
      enrolls: N(row[cEnroll]) ?? 0,
    });
  }
  return out.length ? out : null;
}

/** Parse the side-by-side, banner-labelled platform tables of one tab. For
 *  each banner at (r,c): the header is row r+1 (columns ≥ c) and must carry
 *  "(Actual)" spend / leads / enrollment columns — the docs' "Overall Goals"
 *  and "Overall Performance Tables" tabs also list the platform names in a
 *  column but fail that check and are passed over. The Total row and any
 *  program rows sit within the next ten rows, labelled at col c or c+1. */
function parsePlatformBlocks(tab: Tab): PlatformBlock[] {
  const rows = tab.rows;
  const found: PlatformBlock[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const channel = bannerCell(S(row[c]));
      if (!channel || found.some(f => f.total.channel === channel)) continue;

      const find = headerCols(rows[r + 1] ?? [], c);
      const cSpend = find(h => h.includes('spend') && h.includes('actual'));
      const cLeads = find(h => h.includes('lead') && h.includes('actual'));
      const cEnroll = find(h => h.includes('enroll') && h.includes('actual'));
      if (cSpend < 0 || cLeads < 0 || cEnroll < 0) continue; // not a paid table
      const cCplGoal = find(h => h.includes('cpl') && h.includes('goal'));
      const cCpeGoal = find(h => h.includes('cpe') && h.includes('goal'));
      // Goals are quoted in whole dollars ($175 CPL, $2,067 CPE); the cells hold
      // the unrounded formula result ($174.9435…) now that reads are unformatted.
      const goal = (v: unknown) => { const n = N(v); return n == null ? undefined : Math.round(n); };
      const goals = (rr: unknown[]) => ({
        cplGoal: cCplGoal >= 0 ? goal(rr[cCplGoal]) : undefined,
        cpeGoal: cCpeGoal >= 0 ? goal(rr[cCpeGoal]) : undefined,
      });

      let total: ChannelTotal | null = null;
      const programs: ProgramChannelLeaf[] = [];
      for (let j = r + 2; j < Math.min(r + 12, rows.length); j++) {
        const rr = rows[j] ?? [];
        const label = S(rr[c]) || S(rr[c + 1]);
        if (!label) break;
        const spend = N(rr[cSpend]), leads = N(rr[cLeads]), enrolls = N(rr[cEnroll]);
        if (isTotalLabel(label) && !total) {
          if (spend == null || leads == null || enrolls == null) break;
          total = { channel, spend, leads, enrolls, ...goals(rr) };
        } else if (WHARTON_PROGRAMS.has(label) && spend != null && leads != null && enrolls != null) {
          programs.push({ program: label, channel, spend, leads, enrolls, ...goals(rr) });
        }
      }
      if (!total) continue;
      found.push({ total, programs, weekly: parseWeekly(rows, r, c), tab: tab.title });
    }
  }
  return found;
}

type Verdict = 'ok' | 'unpopulated' | 'invalid';

/** Accept a school's platform tables only if the core ad platforms are all
 *  present and every channel's economics are sane (guards column misreads).
 *  A platform with no spend yet is allowed — Bing and LinkedIn start weeks
 *  into a CBS cohort — but a doc whose every platform reads zero is reported
 *  as unpopulated: its actual columns aren't feeding, and $0 must not be
 *  shown as spend to date. */
function validateChannels(channels: ChannelTotal[]): Verdict {
  const have = new Set(channels.map(c => c.channel));
  if (!(have.has('google') && have.has('meta') && have.has('linkedin'))) return 'invalid';
  if (channels.every(c => c.spend === 0 && c.leads === 0 && c.enrolls === 0)) return 'unpopulated';
  for (const c of channels) {
    if (c.spend < 0 || c.leads < 0 || c.enrolls < 0) return 'invalid';
    if (c.spend > 0 && c.leads > 0) {
      const cpl = c.spend / c.leads;
      if (cpl < 1 || cpl > 2000) return 'invalid';
    }
    if (c.spend > 0 && c.enrolls > 0) {
      const cpe = c.spend / c.enrolls;
      if (cpe < 50 || cpe > 60000) return 'invalid';
    }
  }
  return 'ok';
}

const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/** A platform's weekly rows must sum to its own Total row — they are built
 *  from the same daily data, and in both docs they do to the cent. */
function weeklyReconciles(weekly: PaidWeekPoint[], total: ChannelTotal): boolean {
  const sum = (f: (p: PaidWeekPoint) => number) => weekly.reduce((a, p) => a + f(p), 0);
  return close(sum(p => p.spend), total.spend, Math.max(1, total.spend * 0.005))
    && close(sum(p => p.leads), total.leads, 1)
    && close(sum(p => p.enrolls), total.enrolls, 1);
}

/** The school's weekly series: one per platform plus "all" = their per-week
 *  sum, aligned on the shared week labels. All or nothing — a chart with
 *  Google's weeks but not Meta's would under-read "all paid" — and only when
 *  every series reconciles to its channel total. */
function buildWeekly(blocks: PlatformBlock[]): WeeklySeries | null {
  if (!blocks.length || !blocks.every(b => b.weekly && weeklyReconciles(b.weekly, b.total))) return null;
  const google = blocks.find(b => b.total.channel === 'google')?.weekly;
  if (!google) return null;
  const labels: string[] = [];
  for (const b of blocks) for (const p of b.weekly!) if (!labels.includes(p.week)) labels.push(p.week);
  const all = labels.map(week => {
    const pts = blocks.map(b => b.weekly!.find(p => p.week === week)).filter((p): p is PaidWeekPoint => !!p);
    return {
      week,
      spend: pts.reduce((a, p) => a + p.spend, 0),
      leads: pts.reduce((a, p) => a + p.leads, 0),
      enrolls: pts.reduce((a, p) => a + p.enrolls, 0),
    };
  });
  const series: WeeklySeries = { all, google };
  for (const b of blocks) {
    const ch = b.total.channel;
    if (ch === 'meta' || ch === 'linkedin' || ch === 'bing') series[ch] = b.weekly!;
  }
  return series;
}

/** Wharton's program × channel leaves, accepted only when every matrix
 *  channel's program rows reconcile to that channel's Total: leads and
 *  enrollments are fully program-attributed and sum exactly; spend may sum to
 *  LESS (Google brand/generic search isn't tagged to a program), never more. */
function buildProgramLeaves(blocks: PlatformBlock[]): ProgramChannelLeaf[] | null {
  const leaves: ProgramChannelLeaf[] = [];
  for (const ch of MATRIX_CHANNELS) {
    const b = blocks.find(x => x.total.channel === ch);
    if (!b || b.programs.length < PROGRAMS_BY_SCHOOL.wharton.length) return null;
    const sum = (f: (l: ProgramChannelLeaf) => number) => b.programs.reduce((a, l) => a + f(l), 0);
    if (!close(sum(l => l.leads), b.total.leads, 1) || !close(sum(l => l.enrolls), b.total.enrolls, 1)) return null;
    if (sum(l => l.spend) > b.total.spend * 1.005 + 1) return null;
    leaves.push(...b.programs);
  }
  // Bing's program rows ride along when present — the matrix shows the three
  // MATRIX_CHANNELS, the per-program ROAS signal sums every leaf.
  const bing = blocks.find(x => x.total.channel === 'bing');
  if (bing && bing.programs.length === PROGRAMS_BY_SCHOOL.wharton.length) leaves.push(...bing.programs);
  return leaves;
}

const SCHOOLS: School[] = ['wharton', 'columbia'];

function snapshotSource(school: School, docCohort: string | null, state: 'unpopulated' | 'snapshot', note: string): PaidSchoolSource {
  return {
    state,
    cohort: STATIC_PAID_DATA.cohortContext[school].cohort,
    docCohort,
    weeklyLive: false,
    programsLive: false,
    note,
  };
}

async function fetchLivePaid(): Promise<PaidData | null> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return null;
  const sheets = google.sheets({ version: 'v4', auth: getAuth() });

  const channelsBySchool = { ...STATIC_PAID_DATA.channelsBySchool };
  const weekly = { ...STATIC_PAID_DATA.weekly };
  const cohortContext = { ...STATIC_PAID_DATA.cohortContext };
  const sources = { ...STATIC_PAID_DATA.sources };
  let whartonProgramChannel = STATIC_PAID_DATA.whartonProgramChannel;
  // Cohort window per school whose channels came live from its registry doc.
  const liveWin: Partial<Record<School, CohortWindow>> = {};
  let anyLive = false;

  for (const school of SCHOOLS) {
    const src = docFor(school);
    if (!src) {
      sources[school] = snapshotSource(school, null, 'snapshot', 'No cohort doc is configured for this school.');
      continue;
    }
    const docCohort = src.win?.termLabel ?? null;
    try {
      const doc = await readAllTabs(sheets, src.docId);
      const cohort = docCohort ?? cohortFromTitle(doc.title);
      const blocks: PlatformBlock[] = [];
      for (const tab of doc.tabs) {
        for (const b of parsePlatformBlocks(tab)) {
          if (!blocks.some(x => x.total.channel === b.total.channel)) blocks.push(b);
        }
      }
      const parsed = blocks.map(b => b.total);
      const verdict = validateChannels(parsed);
      const docName = `The ${cohort ?? 'current'} cohort doc`;

      if (verdict === 'ok') {
        // Order channels by parsed spend desc; keep any snapshot channel we
        // didn't parse (none expected once all four are labeled).
        const byKey = new Map(parsed.map(c => [c.channel, c] as const));
        const merged = STATIC_PAID_DATA.channelsBySchool[school].map(c => byKey.get(c.channel) ?? c);
        for (const c of parsed) if (!merged.some(m => m.channel === c.channel)) merged.push(c);
        channelsBySchool[school] = merged.sort((a, b) => b.spend - a.spend);
        anyLive = true;
        if (src.win) liveWin[school] = src.win;

        const wk = buildWeekly(blocks);
        if (wk) weekly[school] = wk;
        else console.warn(`[paidLive] ${school}: weekly blocks missing or not reconciling to the channel totals; weekly series stays on the snapshot`);

        let programsLive = false;
        if (school === 'wharton') {
          const leaves = buildProgramLeaves(blocks);
          if (leaves) { whartonProgramChannel = leaves; programsLive = true; }
          else console.warn('[paidLive] wharton: program rows missing or not reconciling to the channel totals; program × channel matrix stays on the snapshot');
        }
        sources[school] = {
          state: 'live',
          cohort: cohort ?? STATIC_PAID_DATA.cohortContext[school].cohort,
          docCohort,
          weeklyLive: !!wk,
          programsLive,
          note: null,
        };
      } else if (verdict === 'unpopulated') {
        const tab = blocks[0]?.tab ?? 'Paid WoW Performance & Goals';
        const note = `${docName}'s "${tab}" tab parses, but every platform's Total row reads $0 spend / 0 leads / 0 enrollments — its actual columns are not populated yet, so ${cohort ?? 'current-cohort'} paid figures are withheld rather than shown as $0.`;
        console.warn(`[paidLive] ${school}: ${note}`);
        sources[school] = snapshotSource(school, docCohort, 'unpopulated', note);
      } else {
        const note = parsed.length
          ? `${docName}'s platform tables (${parsed.map(c => c.channel).join(', ')}) did not pass the reader's checks, so the snapshot is shown.`
          : `${docName} has no platform tables this reader recognises (Google / Meta / LinkedIn banners over "(Actual)" columns with a Total row), so the snapshot is shown.`;
        console.warn(`[paidLive] ${school}: ${note}`);
        sources[school] = snapshotSource(school, docCohort, 'snapshot', note);
      }
    } catch (err) {
      console.error(`[paidLive] ${school} parse failed, using snapshot:`, err);
      const msg = err instanceof Error ? err.message : String(err);
      sources[school] = snapshotSource(school, docCohort, 'snapshot', `The ${docCohort ?? 'current'} cohort doc could not be read (${msg}), so the snapshot is shown.`);
    }
  }

  if (Object.keys(liveWin).length) {
    const snapshot = await getLiveSnapshotOrNull();
    for (const [school, win] of Object.entries(liveWin) as [School, CohortWindow][]) {
      // Same cohort on both layers, or the static context stays.
      if (snapshot?.cohortLabels[school] !== win.termLabel) continue;
      cohortContext[school] = buildCohortContext(school, win, channelsBySchool[school], snapshot);
    }
  }

  return {
    ...STATIC_PAID_DATA,
    channelsBySchool,
    whartonProgramChannel,
    weekly,
    cohortContext,
    sources,
    asOf: anyLive ? new Date().toISOString().slice(0, 10) : STATIC_PAID_DATA.asOf,
    live: anyLive,
  };
}

// Bump the key when the parse/shape changes so stale cache doesn't persist.
const cachedFetch = unstable_cache(fetchLivePaid, ['paid-perf-v6'], {
  revalidate: 86400,
  tags: ['performance'],
});

export async function getPaidPerformance(): Promise<PaidData> {
  if (isDemo()) return STATIC_PAID_DATA;
  try {
    const live = await cachedFetch();
    if (live) return live;
  } catch (err) {
    console.error('[paidLive] falling back to static snapshot:', err);
  }
  return STATIC_PAID_DATA;
}
