// ─── Channel Performance — live reader ────────────────────────────────────────
//
// Reads two tabs of the Wharton cohort performance doc (the doc Pulse and
// Cohort Command already read):
//
//   "Channel Tables" — channel × cohort matrices, one block per program on a
//   6-column stride (Overall | Overall (No RDI) | Private Equity | Real Estate
//   | FP&A | AVI | RDI). Each block stacks Leads / Enrollments / Conversions
//   sections; each section is
//       Channel | Fall 2025 | Winter 2026 | Spring 2026 | Current Cohort
//   ending in a Totals row. RDI (launched Spring 2026) carries only two cohort
//   columns, so cohort labels are read per block, never assumed.
//
//   "Overall Performance Tables" — the current cohort's channel economics
//   (leads, enrolls, spend, CPL, CPE, CVR), one table per program.
//
// IMPORTANT semantics, carried through to the UI:
//   • Prior-cohort columns in "Channel Tables" are STATIC week-aligned
//     snapshots maintained by hand; only the Current Cohort column is formula-
//     driven off "Overall Performance Tables". Verified 8/21/26 by reading the
//     tab with valueRenderOption=FORMULA.
//   • The tab's own PPC/Non-PPC rollup block is NOT reproduced here: its
//     ranges skip the AI Referral row entirely and (for Spring enrollments)
//     the Offline/Direct row, so it understates. Paid/Non-paid rollups are
//     computed in code from the channel rows instead, so Paid + Non-paid
//     always equals the column total.
//   • A blank cell inside a populated cohort column is a zero (the sheet
//     leaves 0-enrollment cells empty); a cohort column whose Totals cell is
//     also blank is treated as absent (null) so "no data" never reads as 0.
//   • The Conversions section is not read — CVR is derived as
//     enrollments ÷ leads, which is exactly what the sheet's own block does.

import { google } from 'googleapis';
import type {
  ChannelTablesData, ProgramChannelBlock, ChannelSeriesRow,
  ProgramEconBlock, ChannelEconRow,
} from './channelTablesTypes';
import { programKeyFor } from './channelTablesTypes';
export type {
  ChannelTablesData, ProgramChannelBlock, ChannelSeriesRow,
  ProgramEconBlock, ChannelEconRow,
} from './channelTablesTypes';

export const CHANNEL_TABLES_DOC_ID =
  process.env.FALL26_PACING_SHEET_ID ??
  process.env.WHARTON_COHORT_DOC_ID ??
  '1pUVvHARYuZaOLwUqkAtRbOdTkDvt4WRinWX2cd--5Kw';
const MATRIX_TAB = 'Channel Tables';
const ECON_TAB = 'Overall Performance Tables';

export type ChannelsResult =
  | { ok: true; data: ChannelTablesData }
  | { ok: false; needsAccess: boolean; error: string };

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
    if (!raw) return null;
    return JSON.parse(raw).client_email ?? null;
  } catch {
    return null;
  }
}

/** Unformatted cells arrive as numbers already; `#DIV/0!`, "-" and blanks → null. */
function N(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === '' || s === '-' || s.startsWith('#')) return null;
  const n = parseFloat(s.replace(/[$,%]/g, ''));
  return isNaN(n) ? null : n;
}

function S(v: unknown): string {
  return String(v ?? '').trim();
}

type Grid = unknown[][];
const cell = (g: Grid, r: number, c: number): unknown => g[r]?.[c];

/** PPC is the only channel counted as paid — the house definition used in the
 *  funnel doc and in every number already quoted to leadership. */
function isPaidChannel(label: string): boolean {
  return /^ppc\b/i.test(label.trim());
}

/** Channels that carry direct spend without being in the paid (PPC) rollup. */
function carriesSpend(label: string): boolean {
  return /^(sponsored|paid affiliate)/i.test(label.trim());
}

/** Join key for a channel label across the Leads/Enrollments sections, which
 *  don't always agree ("SEO" vs "WSP SEO", "WSP Customers" vs "WSP Customer"). */
function channelKey(label: string): string {
  return label.trim().toLowerCase().replace(/^wsp\s+/, '').replace(/s$/, '');
}

// ─── "Channel Tables" matrix parsing ──────────────────────────────────────────

/** Program banners: cells in the top rows that have a "Channel" header below
 *  them in the same column within the next 6 rows. */
function findMatrixPrograms(grid: Grid): { name: string; col: number }[] {
  for (let r = 0; r < Math.min(grid.length, 4); r++) {
    const row = grid[r] ?? [];
    const found: { name: string; col: number }[] = [];
    for (let c = 0; c < row.length; c++) {
      const name = S(row[c]);
      if (!name) continue;
      for (let j = r + 1; j < Math.min(r + 7, grid.length); j++) {
        if (S(cell(grid, j, c)).toLowerCase() === 'channel') {
          found.push({ name, col: c });
          break;
        }
      }
    }
    if (found.length >= 2) return found;
  }
  return [];
}

interface Section {
  cohorts: string[];
  rows: { channel: string; values: Array<number | null> }[];
  totals: Array<number | null>;
}

/** Locate the Leads and Enrollments "Channel" header rows of one program
 *  block. Every block stacks its sections in the fixed order
 *  Leads → Enrollments → Conversions, but the little section label above each
 *  header is present inconsistently (PE carries "Leads" and "Conversions" but
 *  not "Enrollments"; "Overall (No RDI)" carries everything but "Leads"), so
 *  position assigns the sections and any label that IS present must agree —
 *  a contradiction fails the block instead of misfiling a section. */
function findSectionHeaders(grid: Grid, col: number): { leads: number; enrolls: number } | null {
  const headers: { row: number; label: string }[] = [];
  for (let r = 0; r < grid.length; r++) {
    if (S(cell(grid, r, col)).toLowerCase() !== 'channel') continue;
    // Nearest non-empty cell above is the section label when it names one;
    // anything else there (a Totals row, the program banner) is not a label.
    let label = '';
    for (let j = r - 1; j >= Math.max(0, r - 3); j--) {
      const t = S(cell(grid, j, col)).toLowerCase();
      if (!t) continue;
      if (/^(leads|enrollments?|conversions?)$/.test(t)) label = t;
      break;
    }
    headers.push({ row: r, label });
  }
  if (headers.length < 2) return null;
  const expected = [/^leads$/, /^enrollments?$/, /^conversions?$/];
  for (let i = 0; i < Math.min(headers.length, 3); i++) {
    if (headers[i].label && !expected[i].test(headers[i].label)) return null;
  }
  return { leads: headers[0].row, enrolls: headers[1].row };
}

/** Read one metric section given its "Channel" header row. */
function readSection(grid: Grid, col: number, hdr: number): Section | null {
  const cohorts: string[] = [];
  for (let c = col + 1; c < col + 7; c++) {
    const l = S(cell(grid, hdr, c));
    if (!l) break;
    cohorts.push(l);
  }
  if (cohorts.length === 0) return null;

  const rows: Section['rows'] = [];
  let totals: Array<number | null> | null = null;
  for (let r = hdr + 1; r < Math.min(hdr + 20, grid.length); r++) {
    const ch = S(cell(grid, r, col));
    if (!ch) break;
    const values = cohorts.map((_, i) => N(cell(grid, r, col + 1 + i)));
    if (/^totals?$/i.test(ch)) { totals = values; break; }
    rows.push({ channel: ch, values });
  }
  if (!totals || rows.length === 0) return null;

  // A populated column leaves blanks for zeroes; a column whose Totals cell is
  // blank has no data at all — keep those cells null so absence stays visible.
  const populated = totals.map(t => t !== null);
  for (const row of rows) {
    row.values = row.values.map((v, i) => (v === null && populated[i] ? 0 : v));
  }
  return { cohorts, rows, totals };
}

function parseMatrixBlock(grid: Grid, name: string, col: number): ProgramChannelBlock | null {
  const program = programKeyFor(name);
  if (!program) return null;
  const headers = findSectionHeaders(grid, col);
  if (!headers) return null;
  const leads = readSection(grid, col, headers.leads);
  const enrolls = readSection(grid, col, headers.enrolls);
  if (!leads || !enrolls) return null;
  // The two sections must describe the same cohorts, or the join below would
  // silently misalign columns.
  if (leads.cohorts.join('|') !== enrolls.cohorts.join('|')) return null;
  // Enrollments are always a small fraction of leads — a column where the
  // "enrollments" total exceeds the "leads" total means the positional section
  // assignment above landed on the wrong tables.
  for (let i = 0; i < leads.cohorts.length; i++) {
    const l = leads.totals[i];
    const e = enrolls.totals[i];
    if (l !== null && e !== null && e > l) return null;
  }

  const enrollByChannel = new Map(enrolls.rows.map(r => [channelKey(r.channel), r.values]));
  const rows: ChannelSeriesRow[] = [];
  for (const r of leads.rows) {
    const enrollments = enrollByChannel.get(channelKey(r.channel));
    // Every leads channel must have an enrollments row — a rename that breaks
    // the join fails the block visibly instead of misreporting a channel as
    // having no enrollments.
    if (!enrollments) return null;
    rows.push({
      channel: r.channel,
      paid: isPaidChannel(r.channel),
      hasSpend: carriesSpend(r.channel),
      leads: r.values,
      enrollments,
    });
  }

  return {
    program,
    displayName: name,
    cohorts: leads.cohorts,
    rows,
    totals: { leads: leads.totals, enrollments: enrolls.totals },
  };
}

// ─── "Overall Performance Tables" economics parsing ───────────────────────────

function parseEcon(grid: Grid): ProgramEconBlock[] {
  const out: ProgramEconBlock[] = [];
  for (let r = 0; r < grid.length; r++) {
    const banner = S(cell(grid, r, 0));
    // A table banner ("Overall Performance", "PE Fall 2026 Marketing
    // Performance", …) is immediately followed by its Channel header row.
    if (!/performance/i.test(banner)) continue;
    if (S(cell(grid, r + 1, 0)).toLowerCase() !== 'channel') continue;

    const name = banner
      .replace(/(fall|spring|winter|summer)\s*20\d\d/i, '')
      .replace(/marketing performance|performance/i, '')
      .trim() || 'Overall';
    const program = programKeyFor(name);
    if (!program) continue;

    const header = (grid[r + 1] ?? []).map(c => S(c).toLowerCase());
    const col = (...needles: string[]) =>
      header.findIndex(h => h !== '' && needles.every(n => h.includes(n)));
    const c = {
      enrolls: col('enroll'),
      pct: col('%'),
      leads: header.findIndex(h => h === 'leads'),
      spend: col('spend'),
      cpl: col('cost per lead'),
      cpe: col('cost per enrollment'),
      cvr: col('lead:enroll'),
    };
    if (c.enrolls < 0 || c.leads < 0) continue;

    const at = (row: unknown[], i: number) => (i >= 0 ? N(row[i]) : null);
    const build = (row: unknown[], label: string): ChannelEconRow => ({
      channel: label,
      paid: /^(ads\b|ppc\b)/i.test(label.trim()),
      enrolls: at(row, c.enrolls),
      pct: at(row, c.pct),
      leads: at(row, c.leads),
      spend: at(row, c.spend),
      cpl: at(row, c.cpl),
      cpe: at(row, c.cpe),
      cvr: at(row, c.cvr),
    });

    const rows: ChannelEconRow[] = [];
    let total: ChannelEconRow | null = null;
    for (let j = r + 2; j < Math.min(r + 30, grid.length); j++) {
      const label = S(cell(grid, j, 0));
      if (!label) break;
      // First Grand Total closes the table; the "Excl. B2B" restatement that
      // follows is the same cohort again, not another channel.
      if (/^grand total/i.test(label)) { total = build(grid[j] ?? [], label); break; }
      rows.push(build(grid[j] ?? [], label));
    }
    if (rows.length > 0) out.push({ program, displayName: name, rows, total });
  }
  return out;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function getChannelTables(): Promise<ChannelsResult> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return { ok: false, needsAccess: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY is not set' };
  }
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const [meta, values] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: CHANNEL_TABLES_DOC_ID, fields: 'properties.title' }),
      sheets.spreadsheets.values.batchGet({
        spreadsheetId: CHANNEL_TABLES_DOC_ID,
        ranges: [`'${MATRIX_TAB}'!A1:BZ70`, `'${ECON_TAB}'!A1:J120`],
        valueRenderOption: 'UNFORMATTED_VALUE',
      }),
    ]);

    const matrixGrid = (values.data.valueRanges?.[0]?.values ?? []) as Grid;
    const econGrid = (values.data.valueRanges?.[1]?.values ?? []) as Grid;
    if (!matrixGrid.length) {
      return { ok: false, needsAccess: false, error: `"${MATRIX_TAB}" tab is empty` };
    }

    const banners = findMatrixPrograms(matrixGrid);
    const programs = banners
      .map(b => parseMatrixBlock(matrixGrid, b.name, b.col))
      .filter((p): p is ProgramChannelBlock => p !== null);
    if (programs.length === 0) {
      return { ok: false, needsAccess: false, error: `"${MATRIX_TAB}" tab layout not recognised` };
    }

    const currentLabel =
      programs[0].cohorts[programs[0].cohorts.length - 1] ?? 'Current Cohort';

    return {
      ok: true,
      data: {
        programs,
        econ: parseEcon(econGrid),
        currentLabel,
        docTitle: meta.data.properties?.title ?? 'Cohort Performance Doc',
        sheetId: CHANNEL_TABLES_DOC_ID,
        tab: MATRIX_TAB,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    const e = err as { code?: number; status?: number; message?: string };
    const code = e?.code ?? e?.status;
    const needsAccess = code === 403 || code === 404;
    return { ok: false, needsAccess, error: e?.message ?? String(err) };
  }
}
