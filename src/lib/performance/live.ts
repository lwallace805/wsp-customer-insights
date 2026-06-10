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
//   PERFORMANCE_DASHBOARD_TAB — tab to scan in each doc (default "Dashboard")
//
// Parsing strategy: label-driven scan rather than fixed cells. The cohort
// docs' dashboard tabs list programs (AI / PE / RE / FP&A / AVI / RDI) in
// rows followed by Real Time · Forecast · Final Target numerics; the first
// matching block is enrollments, the second is leads. Label scanning
// survives row insertions, which break index-based parsing.

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

/** Scan a tab's rows for program-labelled Real Time / Forecast / Target triples. */
function scanProgramTriples(rows: string[][]): Record<ProgramKey, Triple[]> {
  const found = {} as Record<ProgramKey, Triple[]>;
  for (const row of rows) {
    if (!row?.length) continue;
    const label = String(row[0] ?? '').trim().toLowerCase();
    const program = PROGRAM_ALIASES[label];
    if (!program) continue;
    // First three numeric cells after the label
    const nums: number[] = [];
    for (let i = 1; i < row.length && nums.length < 3; i++) {
      const n = N(row[i]);
      if (n !== null) nums.push(n);
    }
    if (nums.length === 3) {
      (found[program] ??= []).push({ realTime: nums[0], forecast: nums[1], finalTarget: nums[2] });
    }
  }
  return found;
}

async function readDocTriples(docId: string): Promise<Record<ProgramKey, Triple[]>> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const tab = process.env.PERFORMANCE_DASHBOARD_TAB || 'Dashboard';
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: docId,
    range: `'${tab}'!A1:Z300`,
  });
  return scanProgramTriples((res.data.values ?? []) as string[][]);
}

async function fetchLiveSnapshot(): Promise<CurrentSnapshot | null> {
  const whartonId = process.env.WHARTON_COHORT_DOC_ID;
  const columbiaId = process.env.COLUMBIA_COHORT_DOC_ID;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return null;
  if (!whartonId && !columbiaId) return null;

  const results = await Promise.allSettled([
    whartonId ? readDocTriples(whartonId) : Promise.resolve({} as Record<ProgramKey, Triple[]>),
    columbiaId ? readDocTriples(columbiaId) : Promise.resolve({} as Record<ProgramKey, Triple[]>),
  ]);

  const merged = {} as Record<ProgramKey, Triple[]>;
  let anySuccess = false;
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const [k, v] of Object.entries(r.value)) {
      if (v.length) { merged[k as ProgramKey] = v; anySuccess = true; }
    }
  }
  if (!anySuccess) return null;

  // Merge over static snapshot: triple[0] = enrollments, triple[1] = leads.
  const programs = CURRENT_SNAPSHOT.programs.map(p => {
    const triples = merged[p.program];
    if (!triples?.length) return p;
    const enrolls = triples[0] ?? p.enrolls;
    const leads = triples[1] ?? p.leads;
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

const cachedFetch = unstable_cache(fetchLiveSnapshot, ['performance-live-v1'], {
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
