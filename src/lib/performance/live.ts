// Live current-cohort data layer for the Performance Dashboards.
//
// Reads the current Wharton + Columbia cohort performance docs once per day
// (unstable_cache, revalidate 86400) and merges the parsed numbers over the
// static fallback snapshot. If credentials/env vars are missing or parsing
// fails, the static snapshot from src/data/performance/currentSnapshot.ts is
// served — pages always render.
//
// Env vars:
//   WHARTON_COHORT_DOC_ID   — current Wharton cohort performance tracker
//   COLUMBIA_COHORT_DOC_ID  — current Columbia/CBS cohort performance tracker
//
// Parsing strategy: label-driven scan rather than fixed cells. The cohort
// docs' marketing-dashboard tabs (Wharton: "Marketing Dashboard Data",
// CBS: "Marketing Dashboard" — resolved by metadata lookup) list programs
// (AI / PE / RE / FP&A / AVI / RDI) one per row with two triples on the
// same row: enrollments Real Time · Forecast · Final Target, then leads
// Real Time · vs Forecast · Final Target. Label scanning survives row
// insertions, which break index-based parsing.

import { google } from 'googleapis';
import { unstable_cache } from 'next/cache';
import { CURRENT_SNAPSHOT } from '@/data/performance/currentSnapshot';
import type { CurrentSnapshot, ProgramKey } from '@/data/performance/types';
import { isDemo } from '@/lib/demo/flag';

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

function N(v: string | undefined | null): number | null {
  if (!v || String(v).trim() === '' || v === '#DIV/0!' || v === '#REF!' || v === '#VALUE!') return null;
  const n = parseFloat(String(v).replace(/[$,%]/g, '').replace(/,/g, '').trim());
  return isNaN(n) ? null : n;
}

const PROGRAM_ALIASES: Record<string, ProgramKey> = {
  ai: 'ai', pe: 'pe', re: 're', 'fp&a': 'fpa', fpa: 'fpa', avi: 'avi', rdi: 'rdi',
};

type Triple = { realTime: number; forecast: number; finalTarget: number };
type ProgramRow = { enrolls: Triple; leads: Triple | null };

/** Scan a tab's rows for program-labelled rows.
 *  Layout per row: [label, …, enrolls RT, forecast, target, …, leads RT, vs forecast, target]
 *  First numeric triple = enrollments; second (if present) = leads.
 *  Only the first matching row per program is used — later sections (e.g.
 *  the QTD B2B block) repeat program labels with empty/irrelevant cells. */
function scanProgramRows(rows: string[][]): Partial<Record<ProgramKey, ProgramRow>> {
  const found: Partial<Record<ProgramKey, ProgramRow>> = {};
  for (const row of rows) {
    if (!row?.length) continue;
    const label = String(row[0] ?? '').trim().toLowerCase();
    const program = PROGRAM_ALIASES[label];
    if (!program || found[program]) continue;
    const nums: number[] = [];
    for (let i = 1; i < row.length && nums.length < 6; i++) {
      const n = N(row[i]);
      if (n !== null) nums.push(n);
    }
    if (nums.length >= 3) {
      found[program] = {
        enrolls: { realTime: nums[0], forecast: nums[1], finalTarget: nums[2] },
        leads: nums.length >= 6 ? { realTime: nums[3], forecast: nums[4], finalTarget: nums[5] } : null,
      };
    }
  }
  return found;
}

/** Find the marketing-dashboard tab in a cohort doc by title. */
async function resolveDashboardTab(
  sheets: ReturnType<typeof google.sheets>,
  docId: string
): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: docId });
  const titles = (meta.data.sheets ?? []).map(s => s.properties?.title ?? '');
  return (
    titles.find(t => /marketing dashboard/i.test(t)) ??
    titles.find(t => /^dashboard$/i.test(t)) ??
    titles[0]
  );
}

async function readDocPrograms(docId: string): Promise<Partial<Record<ProgramKey, ProgramRow>>> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const tab = await resolveDashboardTab(sheets, docId);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: docId,
    range: `'${tab}'!A1:Z300`,
  });
  return scanProgramRows((res.data.values ?? []) as string[][]);
}

async function fetchLiveSnapshot(): Promise<CurrentSnapshot | null> {
  const whartonId = process.env.WHARTON_COHORT_DOC_ID;
  const columbiaId = process.env.COLUMBIA_COHORT_DOC_ID;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return null;
  if (!whartonId && !columbiaId) return null;

  const empty: Partial<Record<ProgramKey, ProgramRow>> = {};
  const results = await Promise.allSettled([
    whartonId ? readDocPrograms(whartonId) : Promise.resolve(empty),
    columbiaId ? readDocPrograms(columbiaId) : Promise.resolve(empty),
  ]);

  const merged: Partial<Record<ProgramKey, ProgramRow>> = {};
  let anySuccess = false;
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const [k, v] of Object.entries(r.value)) {
      if (v) { merged[k as ProgramKey] = v; anySuccess = true; }
    }
  }
  if (!anySuccess) return null;

  const programs = CURRENT_SNAPSHOT.programs.map(p => {
    const row = merged[p.program];
    if (!row) return p;
    const enrolls = row.enrolls;
    // Sanity guard: a doc reporting 0 leads alongside real enrollments has a
    // broken leads block — keep the snapshot leads rather than zeros.
    const leadsValid = row.leads && (row.leads.realTime > 0 || enrolls.realTime === 0);
    const leads = leadsValid ? row.leads! : p.leads;
    const leadCvr = leads.realTime > 0 ? +((enrolls.realTime / leads.realTime) * 100).toFixed(1) : p.leadCvr;
    return { ...p, enrolls, leads, leadCvr };
  });

  return {
    ...CURRENT_SNAPSHOT,
    programs,
    asOf: new Date().toISOString().slice(0, 10),
    live: true,
  };
}

// Bump the cache key whenever the CurrentSnapshot shape changes — cached
// values persist across deploys and would otherwise serve the old shape.
const cachedFetch = unstable_cache(fetchLiveSnapshot, ['performance-live-v4'], {
  revalidate: 86400, // single daily update
  tags: ['performance'],
});

export async function getCurrentSnapshot(): Promise<CurrentSnapshot> {
  if (isDemo()) {
    const { getDemoSnapshot } = await import('@/lib/demo/performance');
    return getDemoSnapshot();
  }
  try {
    const live = await cachedFetch();
    if (live) return live;
  } catch (err) {
    console.error('[performance/live] falling back to static snapshot:', err);
  }
  return CURRENT_SNAPSHOT;
}
