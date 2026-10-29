// Live paid-channel data layer for the Paid Optimization dashboard.
//
// Same shape as src/lib/performance/live.ts (the enrollment layer): read the
// current Wharton + Columbia performance docs via the service account once per
// day (unstable_cache, revalidate 86400, refreshed by the Vercel cron), parse
// the per-platform paid tables, validate, and MERGE the parsed channels over
// the curated static snapshot. If credentials/env are missing, a fetch throws,
// or validation fails, STATIC_PAID_DATA is served — the page always renders
// correct numbers.
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
// all parse with sane economics; otherwise it keeps the snapshot.
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
  STATIC_PAID_DATA,
  type PaidData, type ChannelTotal, type PaidChannel, type CohortContext,
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

type Grid = string[][];

/** Read every tab as one flattened row list. Wide (to col CB) so the
 *  side-by-side platform tables (LinkedIn reaches ~col BY) aren't cut off. */
async function readAllTabs(
  sheets: ReturnType<typeof google.sheets>,
  docId: string,
): Promise<Grid> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: docId });
  const titles = (meta.data.sheets ?? [])
    .map(s => s.properties?.title)
    .filter((t): t is string => !!t);
  if (!titles.length) return [];
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: docId,
    ranges: titles.map(t => `'${t}'!A1:CB400`),
  });
  const out: Grid = [];
  for (const vr of res.data.valueRanges ?? []) {
    for (const row of (vr.values ?? []) as string[][]) out.push(row);
  }
  return out;
}

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

/** Parse per-platform channel totals from the side-by-side, banner-labeled
 *  tables. For each banner at (r,c): header is row r+1 (columns ≥ c), and the
 *  "Total" row sits a few rows below with its label at col c or c+1. */
function parseChannels(grid: Grid): ChannelTotal[] {
  const found: ChannelTotal[] = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const channel = bannerCell(String(row[c] ?? ''));
      if (!channel || found.some(f => f.channel === channel)) continue;

      const hdr = grid[r + 1] ?? [];
      const findCol = (pred: (h: string) => boolean) => {
        for (let k = c; k < Math.min(c + 25, hdr.length); k++) {
          if (pred(String(hdr[k] ?? '').toLowerCase())) return k;
        }
        return -1;
      };
      const cSpend = findCol(h => h.includes('spend') && h.includes('actual'));
      const cLeads = findCol(h => h.includes('lead') && h.includes('actual'));
      const cEnroll = findCol(h => h.includes('enroll') && h.includes('actual'));
      if (cSpend < 0 || cLeads < 0 || cEnroll < 0) continue; // not a paid table
      const cCplGoal = findCol(h => h.includes('cpl') && h.includes('goal'));
      const cCpeGoal = findCol(h => h.includes('cpe') && h.includes('goal'));

      for (let j = r + 2; j < Math.min(r + 9, grid.length); j++) {
        const rr = grid[j] ?? [];
        const label = (String(rr[c] ?? '').trim() || String(rr[c + 1] ?? '').trim()).toLowerCase();
        if (label !== 'total') continue;
        const spend = N(rr[cSpend]);
        const leads = N(rr[cLeads]);
        const enrolls = N(rr[cEnroll]);
        if (spend == null || leads == null || enrolls == null) break;
        found.push({
          channel, spend, leads, enrolls,
          cplGoal: cCplGoal >= 0 ? (N(rr[cCplGoal]) ?? undefined) : undefined,
          cpeGoal: cCpeGoal >= 0 ? (N(rr[cCpeGoal]) ?? undefined) : undefined,
        });
        break;
      }
    }
  }
  return found;
}

/** Accept a school's live channels only if the core ad platforms are all present
 *  and every channel's economics are sane (guards column misreads). */
function validateChannels(channels: ChannelTotal[]): boolean {
  const have = new Set(channels.map(c => c.channel));
  if (!(have.has('google') && have.has('meta') && have.has('linkedin'))) return false;
  for (const c of channels) {
    if (!(c.spend > 0 && c.leads > 0 && c.enrolls >= 0)) return false;
    const cpl = c.spend / c.leads;
    if (cpl < 1 || cpl > 2000) return false;
    if (c.enrolls > 0) {
      const cpe = c.spend / c.enrolls;
      if (cpe < 50 || cpe > 60000) return false;
    }
  }
  return true;
}

async function fetchLivePaid(): Promise<PaidData | null> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return null;
  const sheets = google.sheets({ version: 'v4', auth: getAuth() });

  const channelsBySchool = { ...STATIC_PAID_DATA.channelsBySchool };
  const cohortContext = { ...STATIC_PAID_DATA.cohortContext };
  // Cohort window per school whose channels came live from its registry doc.
  const liveWin: Partial<Record<School, CohortWindow>> = {};
  let anyLive = false;

  for (const school of ['wharton', 'columbia'] as School[]) {
    const src = docFor(school);
    if (!src) continue;
    try {
      const grid = await readAllTabs(sheets, src.docId);
      const parsed = parseChannels(grid);
      if (validateChannels(parsed)) {
        // Order channels by parsed spend desc; keep any snapshot channel we
        // didn't parse (none expected once all four are labeled).
        const byKey = new Map(parsed.map(c => [c.channel, c] as const));
        const merged = STATIC_PAID_DATA.channelsBySchool[school].map(c => byKey.get(c.channel) ?? c);
        for (const c of parsed) if (!merged.some(m => m.channel === c.channel)) merged.push(c);
        channelsBySchool[school] = merged.sort((a, b) => b.spend - a.spend);
        anyLive = true;
        if (src.win) liveWin[school] = src.win;
      }
    } catch (err) {
      console.error(`[paidLive] ${school} parse failed, using snapshot:`, err);
    }
  }

  if (!anyLive) return null;

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
    cohortContext,
    asOf: new Date().toISOString().slice(0, 10),
    live: true,
  };
}

// Bump the key when the parse/shape changes so stale cache doesn't persist.
const cachedFetch = unstable_cache(fetchLivePaid, ['paid-perf-v5'], {
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
