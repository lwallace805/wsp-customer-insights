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
// LABEL-DRIVEN, NO GUESSING. In the "Paid WoW Performance & Goals" tab the four
// platform tables are laid out SIDE-BY-SIDE (Google in the left columns, then
// Bing, Meta, LinkedIn stretching out to ~col BY) — not stacked vertically.
// Each carries an explicit banner cell ("Google" / "Bing" / "Meta" /
// "LinkedIn"). We scan every cell for those banners and read each table at its
// own column offset; a channel is taken ONLY from an explicitly-labeled table,
// never inferred (CPL-goal fingerprinting caused the earlier Meta/Bing &
// Meta/LinkedIn mix-ups). A school goes live only when Google + Meta + LinkedIn
// all parse with sane economics; otherwise it keeps the snapshot.

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
  let anyLive = false;

  for (const school of ['wharton', 'columbia'] as School[]) {
    const docId = DOC_ENV[school];
    if (!docId) continue;
    try {
      const grid = await readAllTabs(sheets, docId);
      const parsed = parseChannels(grid);
      if (validateChannels(parsed)) {
        // Order channels by parsed spend desc; keep any snapshot channel we
        // didn't parse (none expected once all four are labeled).
        const byKey = new Map(parsed.map(c => [c.channel, c] as const));
        const merged = STATIC_PAID_DATA.channelsBySchool[school].map(c => byKey.get(c.channel) ?? c);
        for (const c of parsed) if (!merged.some(m => m.channel === c.channel)) merged.push(c);
        channelsBySchool[school] = merged.sort((a, b) => b.spend - a.spend);
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
const cachedFetch = unstable_cache(fetchLivePaid, ['paid-perf-v3'], {
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
// Read-only introspection used by /api/performance/paid-debug. Remove once the
// parser is verified live.

interface SchoolDebug {
  docId: string | null;
  skipped?: string;
  tabCount?: number;
  totalRows?: number;
  banners?: { row: number; col: number; channel: PaidChannel }[];
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
      s.tabCount = (meta.data.sheets ?? []).length;
      const grid = await readAllTabs(sheets, docId);
      s.totalRows = grid.length;
      const banners: { row: number; col: number; channel: PaidChannel }[] = [];
      for (let r = 0; r < grid.length; r++) {
        const row = grid[r] ?? [];
        for (let c = 0; c < row.length; c++) {
          const ch = bannerCell(String(row[c] ?? ''));
          if (ch) banners.push({ row: r, col: c, channel: ch });
        }
      }
      s.banners = banners.slice(0, 20);
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
