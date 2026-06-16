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
// Env vars (shared with live.ts — these are the same Wharton/Columbia docs):
//   WHARTON_COHORT_DOC_ID, COLUMBIA_COHORT_DOC_ID, GOOGLE_SERVICE_ACCOUNT_KEY
//
// LABEL-DRIVEN, NO GUESSING. The source sheets only label the Google platform
// table; Meta/LinkedIn/Bing tables are unlabeled and (for Wharton) have nearly
// identical CPL goals, so there is no safe way to infer them. This parser reads
// a platform's numbers ONLY when its table carries an explicit banner label
// (Google / Meta / LinkedIn / Bing / Affiliates) — it never guesses. So today
// (only Google labeled) a school fails validation and keeps the snapshot; the
// moment the sheet owner adds the other banner labels, the full per-channel
// split goes live automatically. This eliminates the earlier Meta/Bing mix-up.

import { google } from 'googleapis';
import { unstable_cache } from 'next/cache';
import {
  STATIC_PAID_DATA,
  type PaidData, type ChannelTotal, type PaidChannel,
} from '@/data/performance/paidOptimization';
import type { School } from '@/data/performance/types';
import { isDemo } from '@/lib/demo/flag';

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

const DOC_ENV: Record<School, string | undefined> = {
  wharton: process.env.WHARTON_COHORT_DOC_ID,
  columbia: process.env.COLUMBIA_COHORT_DOC_ID,
};

type Grid = string[][];

/** Read every tab of a doc as one flattened row list. Deep range so per-platform
 *  tables (which sit well below row 400 in the paid tab) aren't cut off. */
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
    ranges: titles.map(t => `'${t}'!A1:AZ1200`),
  });
  const out: Grid = [];
  for (const vr of res.data.valueRanges ?? []) {
    for (const row of (vr.values ?? []) as string[][]) out.push(row);
  }
  return out;
}

// A per-platform/per-program table header carries Spend/Leads/Enroll/CPL + a
// "CPL Goal" column. Weekly tables also match, so they're filtered separately.
function isPaidHeader(row: string[]): boolean {
  const joined = row.join(' ').toLowerCase();
  return (
    joined.includes('spend') && joined.includes('lead') &&
    joined.includes('enroll') && joined.includes('cpl') &&
    /cpl\s*goal/i.test(joined)
  );
}
function isWeeklyHeader(row: string[]): boolean {
  const joined = row.join(' ').toLowerCase();
  return joined.includes('week start') || joined.includes('date range') || joined.includes('week ');
}

// Map an explicit banner label → channel. LABEL ONLY — never inferred.
function labelToChannel(text: string): PaidChannel | null {
  const t = text.toLowerCase();
  if (/\bgoogle\b/.test(t)) return 'google';
  if (/\bmeta\b|facebook|instagram/.test(t)) return 'meta';
  if (/linked\s*in/.test(t)) return 'linkedin';
  if (/\bbing\b|microsoft/.test(t)) return 'bing';
  if (/affiliate/.test(t)) return 'affiliates';
  return null;
}

/** Look up to 2 rows above a table header for a platform banner (col 0 or 1). */
function bannerChannel(grid: Grid, headerIdx: number): PaidChannel | null {
  for (let k = headerIdx - 1; k >= Math.max(0, headerIdx - 2); k--) {
    const r = grid[k] ?? [];
    const text = `${r[0] ?? ''} ${r[1] ?? ''}`.trim();
    if (!text) continue;            // blank spacer row — keep looking up
    return labelToChannel(text);    // matched platform, or null (some other header)
  }
  return null;
}

/** Parse per-platform channel totals — only from explicitly-labeled tables. */
function parseChannels(grid: Grid): ChannelTotal[] {
  const found: ChannelTotal[] = [];
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i] ?? [];
    if (!isPaidHeader(row) || isWeeklyHeader(row)) continue;

    const channel = bannerChannel(grid, i);
    if (!channel || found.some(f => f.channel === channel)) continue;

    const header = row.map(c => String(c).toLowerCase());
    const findCol = (pred: (h: string) => boolean) => header.findIndex(pred);
    const cSpend = findCol(h => h.includes('spend') && h.includes('actual'));
    const cLeads = findCol(h => h.includes('lead') && h.includes('actual'));
    const cEnroll = findCol(h => h.includes('enroll') && h.includes('actual'));
    const cCplGoal = findCol(h => h.includes('cpl') && h.includes('goal'));
    const cCpeGoal = findCol(h => h.includes('cpe') && h.includes('goal'));
    if (cSpend < 0 || cLeads < 0 || cEnroll < 0) continue;

    // "Total" row sits a few rows below; label is in col 0 OR col 1.
    for (let j = i + 1; j < Math.min(i + 12, grid.length); j++) {
      const r = grid[j] ?? [];
      const label = (String(r[0] ?? '').trim() || String(r[1] ?? '').trim()).toLowerCase();
      if (label !== 'total') continue;
      const spend = N(r[cSpend]);
      const leads = N(r[cLeads]);
      const enrolls = N(r[cEnroll]);
      if (spend == null || leads == null || enrolls == null) break;
      found.push({
        channel, spend, leads, enrolls,
        cplGoal: cCplGoal >= 0 ? (N(r[cCplGoal]) ?? undefined) : undefined,
        cpeGoal: cCpeGoal >= 0 ? (N(r[cCpeGoal]) ?? undefined) : undefined,
      });
      break;
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
  let anyLive = false;

  for (const school of ['wharton', 'columbia'] as School[]) {
    const docId = DOC_ENV[school];
    if (!docId) continue;
    try {
      const grid = await readAllTabs(sheets, docId);
      const parsed = parseChannels(grid);
      if (validateChannels(parsed)) {
        // Preserve the static channel ordering; live values where parsed.
        const byKey = new Map(parsed.map(c => [c.channel, c] as const));
        channelsBySchool[school] = STATIC_PAID_DATA.channelsBySchool[school].map(
          c => byKey.get(c.channel) ?? c,
        );
        anyLive = true;
      }
    } catch (err) {
      console.error(`[paidLive] ${school} parse failed, using snapshot:`, err);
    }
  }

  if (!anyLive) return null;

  return {
    ...STATIC_PAID_DATA,
    channelsBySchool,
    asOf: new Date().toISOString().slice(0, 10),
    live: true,
  };
}

// Bump the key when the parse/shape changes so stale cache doesn't persist.
const cachedFetch = unstable_cache(fetchLivePaid, ['paid-perf-v2'], {
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

// ── Diagnostics ───────────────────────────────────────────────────────────────
// Read-only introspection used by /api/performance/paid-debug to see why the
// live parse is or isn't engaging in production (no secrets returned). Remove
// once the parser is verified live.

interface SchoolDebug {
  docId: string | null;
  skipped?: string;
  tabCount?: number;
  tabs?: string[];
  totalRows?: number;
  paidTableCount?: number;
  paidTables?: { row: number; banner: string; channel: PaidChannel | null }[];
  parsedChannels?: ChannelTotal[];
  valid?: boolean;
  error?: string;
}

export interface PaidDebug {
  env: { serviceAccount: boolean; whartonDocId: string | null; columbiaDocId: string | null };
  fatal?: string;
  schools: Record<string, SchoolDebug>;
}

export async function debugPaidParse(): Promise<PaidDebug> {
  const out: PaidDebug = {
    env: {
      serviceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      whartonDocId: process.env.WHARTON_COHORT_DOC_ID ?? null,
      columbiaDocId: process.env.COLUMBIA_COHORT_DOC_ID ?? null,
    },
    schools: {},
  };
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    out.fatal = 'GOOGLE_SERVICE_ACCOUNT_KEY not set';
    return out;
  }
  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  for (const school of ['wharton', 'columbia'] as School[]) {
    const docId = DOC_ENV[school];
    const s: SchoolDebug = { docId: docId ?? null };
    if (!docId) {
      s.skipped = `${school.toUpperCase()}_COHORT_DOC_ID not set`;
      out.schools[school] = s;
      continue;
    }
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: docId });
      s.tabs = (meta.data.sheets ?? []).map(x => x.properties?.title ?? '');
      s.tabCount = s.tabs.length;
      const grid = await readAllTabs(sheets, docId);
      s.totalRows = grid.length;
      // Every non-weekly paid-style table + the banner we detect above it.
      const tables: { row: number; banner: string; channel: PaidChannel | null }[] = [];
      for (let i = 0; i < grid.length; i++) {
        if (!isPaidHeader(grid[i] ?? []) || isWeeklyHeader(grid[i] ?? [])) continue;
        const r1 = grid[i - 1] ?? [];
        const r2 = grid[i - 2] ?? [];
        const banner = (`${r1[0] ?? ''} ${r1[1] ?? ''}`.trim() || `${r2[0] ?? ''} ${r2[1] ?? ''}`.trim());
        tables.push({ row: i, banner, channel: bannerChannel(grid, i) });
      }
      s.paidTableCount = tables.length;
      s.paidTables = tables.slice(0, 20);
      const parsed = parseChannels(grid);
      s.parsedChannels = parsed;
      s.valid = validateChannels(parsed);
    } catch (e) {
      s.error = e instanceof Error ? e.message : String(e);
    }
    out.schools[school] = s;
  }
  return out;
}
