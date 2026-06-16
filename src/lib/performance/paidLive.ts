// Live paid-channel data layer for the Paid Optimization dashboard.
//
// Same shape as src/lib/performance/live.ts (the enrollment layer): read the
// current Wharton + Columbia performance docs via the service account once per
// day (unstable_cache, revalidate 86400, refreshed by the Vercel cron), parse
// the paid tables, run sanity checks, and MERGE the parsed numbers over the
// curated static snapshot. If credentials/env are missing, a fetch throws, or a
// sanity check fails, the static STATIC_PAID_DATA is served — the page always
// renders correct numbers.
//
// Env vars (shared with live.ts — these are the same Wharton/Columbia docs):
//   WHARTON_COHORT_DOC_ID, COLUMBIA_COHORT_DOC_ID, GOOGLE_SERVICE_ACCOUNT_KEY
//
// SCOPE / VERIFICATION NOTE: the live parse refreshes the per-channel totals
// and the cohort pace (the figures that move day-to-day — e.g. the Meta spend).
// The program×channel matrix and weekly series are served from the curated
// snapshot (lower-velocity, and the unlabeled per-platform weekly grids are not
// worth parsing blind). Because the paid tables are hand-maintained and only
// the Google table is labeled at the source, the per-channel parse is
// CONSERVATIVE: it only overrides the snapshot for a school when its channels
// reconcile to that school's combined paid total; otherwise that school keeps
// the snapshot. This needs one verification pass against the live sheet in prod
// before the auto-update is fully trusted — until then it degrades to snapshot.

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

/** Read every tab of a doc as one flattened row list (label-driven parsing,
 *  resilient to tab renames / row insertions — same philosophy as live.ts). */
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
    ranges: titles.map(t => `'${t}'!A1:AZ400`),
  });
  const out: Grid = [];
  for (const vr of res.data.valueRanges ?? []) {
    for (const row of (vr.values ?? []) as string[][]) out.push(row);
  }
  return out;
}

// The per-platform tables share this header; we locate a table by it, then read
// the row labelled "Total" beneath it. Column order is fixed in the source.
const PAID_HEADER = ['spend', 'leads', 'enroll', 'cpl', 'cpe'];
function isPaidHeader(row: string[]): boolean {
  const joined = row.join(' ').toLowerCase();
  return PAID_HEADER.every(k => joined.includes(k)) && /cpl\s*goal/i.test(joined);
}

/** Identify which platform an unlabeled table is, from its CPL goal + spend.
 *  Only Google is explicitly labelled in the source; the rest are inferred by
 *  fingerprint (documented in paidOptimization.ts). Returns null if unsure. */
function classifyChannel(label: string | null, cplGoal: number | null, spend: number): PaidChannel | null {
  if (label && /google/i.test(label)) return 'google';
  if (label && /linked/i.test(label)) return 'linkedin';
  if (label && /meta|facebook/i.test(label)) return 'meta';
  if (label && /bing|microsoft/i.test(label)) return 'bing';
  if (label && /affil/i.test(label)) return 'affiliates';
  // Fingerprint fallback (unlabeled tables): LinkedIn ~$200 CPL goal; the large
  // cheap-CPL line is Meta; a tiny line is Bing. Conservative — null if murky.
  if (cplGoal == null) return null;
  if (cplGoal >= 150) return 'linkedin';
  if (cplGoal <= 60 && spend > 5000) return 'meta';
  if (spend < 5000) return 'bing';
  return null;
}

/** Best-effort parse of per-channel totals for one school from its grid. */
function parseChannels(grid: Grid): ChannelTotal[] | null {
  const found: ChannelTotal[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (!isPaidHeader(grid[i] ?? [])) continue;
    // Map header columns → indices.
    const header = grid[i].map(c => c.toLowerCase());
    const col = (pred: (h: string) => boolean) => header.findIndex(pred);
    const cSpend = col(h => h.includes('spend') && h.includes('actual'));
    const cLeads = col(h => h.includes('lead') && h.includes('actual'));
    const cEnroll = col(h => h.includes('enroll') && h.includes('actual'));
    const cCplGoal = col(h => h.includes('cpl') && h.includes('goal'));
    const cCpeGoal = col(h => h.includes('cpe') && h.includes('goal'));
    if (cSpend < 0 || cLeads < 0 || cEnroll < 0) continue;
    // A banner label may sit a row above the header.
    const banner = (grid[i - 1]?.[0] ?? '').trim() || null;
    // Find the "Total" row within the next few rows.
    for (let j = i + 1; j < Math.min(i + 8, grid.length); j++) {
      const row = grid[j] ?? [];
      if (!/^total$/i.test((row[0] ?? '').trim())) continue;
      const spend = N(row[cSpend]);
      const leads = N(row[cLeads]);
      const enrolls = N(row[cEnroll]);
      if (spend == null || leads == null || enrolls == null) break;
      const cplGoal = cCplGoal >= 0 ? N(row[cCplGoal]) : null;
      const channel = classifyChannel(banner, cplGoal, spend);
      if (channel && !found.some(f => f.channel === channel)) {
        found.push({
          channel, spend, leads, enrolls,
          cplGoal: cplGoal ?? undefined,
          cpeGoal: cCpeGoal >= 0 ? (N(row[cCpeGoal]) ?? undefined) : undefined,
        });
      }
      break;
    }
  }
  return found.length >= 1 ? found : null;
}

/** Sanity check: a school's parsed channels must reconcile to a combined paid
 *  total we can find in the same grid (within 2%). Otherwise reject (→ static). */
function channelsReconcile(channels: ChannelTotal[], grid: Grid): boolean {
  if (!channels.length) return false;
  const sum = channels.reduce((a, c) => a + c.spend, 0);
  if (sum <= 0) return false;
  // Look for the attribution row "Ads - Google / FB / LI / Other" with a spend.
  for (const row of grid) {
    const label = (row[0] ?? '').toLowerCase();
    if (label.includes('ads') && label.includes('google')) {
      for (const cell of row) {
        const v = N(cell);
        if (v != null && v > sum * 0.5 && Math.abs(v - sum) / v <= 0.05) return true;
      }
    }
  }
  // No anchor found → can't verify → reject conservatively.
  return false;
}

async function fetchLivePaid(): Promise<PaidData | null> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return null;
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const channelsBySchool = { ...STATIC_PAID_DATA.channelsBySchool };
  let anyLive = false;

  for (const school of ['wharton', 'columbia'] as School[]) {
    const docId = DOC_ENV[school];
    if (!docId) continue;
    try {
      const grid = await readAllTabs(sheets, docId);
      const parsed = parseChannels(grid);
      if (parsed && channelsReconcile(parsed, grid)) {
        // Preserve the static channel ordering + any channels we didn't parse.
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
const cachedFetch = unstable_cache(fetchLivePaid, ['paid-perf-v1'], {
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
