// ─── Channel Performance — live reader ────────────────────────────────────────
//
// Reads two tabs of a cohort performance doc — Wharton's (the doc Pulse and
// Cohort Command already read) or the CBS AI certificate's, selected by the
// `partner` argument. Both docs use the same tab names and block shapes; CBS
// carries a single program block instead of seven, so nothing here may assume
// more than one:
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
import { readPaidWoW, resolveVersionedTab } from '@/lib/sheets';
import { readWoWLeads } from '@/lib/pulseLive';
import type {
  ChannelTablesData, ProgramChannelBlock, ChannelSeriesRow,
  ProgramEconBlock, ChannelEconRow, ProgramForecast, ForecastSide, ProgramKey,
} from './channelTablesTypes';
import { resolveProgramKey } from './channelTablesTypes';
import type { PartnerKey } from './partners';
export type {
  ChannelTablesData, ProgramChannelBlock, ChannelSeriesRow,
  ProgramEconBlock, ChannelEconRow,
} from './channelTablesTypes';

export const CHANNEL_TABLES_DOC_ID =
  process.env.FALL26_PACING_SHEET_ID ??
  process.env.WHARTON_COHORT_DOC_ID ??
  '1pUVvHARYuZaOLwUqkAtRbOdTkDvt4WRinWX2cd--5Kw';

/** The CBS AI certificate's own cohort performance doc — same tab names and
 *  same block shapes as Wharton's, one program instead of seven. Kept in sync
 *  with the 'c-fall-26' entry in src/lib/cohortSheets.ts. */
export const CBS_CHANNEL_TABLES_DOC_ID =
  process.env.CBS_FALL26_COHORT_DOC_ID ??
  '1qHj4jZauhseusZIYrzVa_byhtkqR7GnZgUZetyo32cE';

interface PartnerSource {
  docId: () => string;
  /** Banner aliases for this doc — see resolveProgramKey. */
  programAliases?: Record<string, ProgramKey>;
  /** Keys to publish forecasts for, in order. */
  forecastKeys: ProgramKey[];
  /** Key that carries the doc's own cohort-wide WoW totals. Wharton splits
   *  those into Overall and Overall (No RDI); CBS has a single program, so its
   *  totals ARE that program's. */
  totalsKey: ProgramKey;
  /** Wharton's WoW tabs carry a No-RDI restatement; CBS has no RDI. */
  hasNoRdiRollup: boolean;
}

const PARTNER_SOURCES: Record<PartnerKey, PartnerSource> = {
  wharton: {
    docId: () => CHANNEL_TABLES_DOC_ID,
    forecastKeys: ['overall', 'overall-no-rdi', 'pe', 're', 'fpa', 'avi', 'rdi'],
    totalsKey: 'overall',
    hasNoRdiRollup: true,
  },
  cbs: {
    docId: () => CBS_CHANNEL_TABLES_DOC_ID,
    // The matrix is bannered "AI", the economics table "Overall Performance";
    // both describe the same single program.
    programAliases: { ai: 'ai', overall: 'ai' },
    forecastKeys: ['ai'],
    totalsKey: 'ai',
    hasNoRdiRollup: false,
  },
};

export function channelTablesDocId(partner: PartnerKey): string {
  return PARTNER_SOURCES[partner].docId();
}

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
  const candidates: { name: string; col: number }[][] = [];
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
    // Two or more blocks on one row is unambiguously the banner row.
    if (found.length >= 2) return found;
    if (found.length === 1) candidates.push(found);
  }
  // A single-program doc (CBS) has exactly one banner; take the topmost row
  // that has one rather than reporting the tab as unrecognised.
  return candidates[0] ?? [];
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

function parseMatrixBlock(
  grid: Grid, name: string, col: number, aliases?: Record<string, ProgramKey>,
): ProgramChannelBlock | null {
  const program = resolveProgramKey(name, aliases);
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

function parseEcon(grid: Grid, aliases?: Record<string, ProgramKey>): ProgramEconBlock[] {
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
    const program = resolveProgramKey(name, aliases);
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

// ─── Forecast sides from the WoW tabs ─────────────────────────────────────────
//
// The channel matrix has no forecast — the source tab carries none. To-date
// forecasts live in the same doc's WoW tabs: "Overall WoW Performance & Goals"
// (all channels, by program) and "Paid WoW Performance & Goals" (paid, by
// program), newest version of each. Non-paid = overall − paid, field by field.
// "Overall (No RDI)" = Total − RDI, matching the tabs' own No-RDI rows.
//
// NOTE these are a slightly different basis than the matrix: the WoW paid rows
// count the four ad platforms (funnel-doc basis) while the matrix's PPC row is
// the doc's "Ads - Google / FB / LI / Other" line, and refresh timing differs.
// Forecast attainment is therefore computed WoW-actual ÷ WoW-forecast — never
// matrix-actual ÷ WoW-forecast — and surfaced with its own actual column.

function sub(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  const d = a - b;
  // Volumes can't be negative — a negative difference means the two source
  // tabs contradict each other (PE's all-channel leads forecast currently sits
  // BELOW its paid leads forecast). Show a gap, not a nonsense number.
  return d < 0 ? null : d;
}

function subSides(a: ForecastSide | null, b: ForecastSide | null): ForecastSide | null {
  if (!a || !b) return null;
  return {
    leads: sub(a.leads, b.leads),
    leadsF: sub(a.leadsF, b.leadsF),
    enrolls: sub(a.enrolls, b.enrolls),
    enrollsF: sub(a.enrollsF, b.enrollsF),
  };
}

async function readForecasts(sheetId: string, src: PartnerSource): Promise<{
  forecasts: ProgramForecast[];
  source: string | null;
}> {
  try {
    const [overall, paid, overallTab, paidTab] = await Promise.all([
      readWoWLeads(sheetId, 'current'),
      readPaidWoW(sheetId),
      resolveVersionedTab(sheetId, 'Overall WoW Performance & Goals'),
      resolveVersionedTab(sheetId, 'Paid WoW Performance & Goals'),
    ]);
    if (!overall && !paid) return { forecasts: [], source: null };

    const side = (r: { leads: number | null; leadsF: number | null; enrolls: number | null; enrollsF: number | null } | null | undefined): ForecastSide | null =>
      r ? { leads: r.leads, leadsF: r.leadsF, enrolls: r.enrolls, enrollsF: r.enrollsF } : null;

    const overallByKey = new Map<ProgramKey, ForecastSide | null>();
    const paidByKey = new Map<ProgramKey, ForecastSide | null>();
    for (const p of overall?.programs ?? []) {
      const k = resolveProgramKey(p.program, src.programAliases);
      if (k) overallByKey.set(k, side(p));
    }
    for (const p of paid?.programs ?? []) {
      const k = resolveProgramKey(p.label, src.programAliases);
      if (k) paidByKey.set(k, side(p));
    }
    // The doc's cohort-wide WoW totals. For a single-program doc those ARE the
    // program's, and they overwrite any same-key row read above — the Total row
    // is the one the doc itself headlines.
    overallByKey.set(src.totalsKey, side(overall?.totals));
    paidByKey.set(src.totalsKey, side(paid?.totals));
    if (src.hasNoRdiRollup) {
      overallByKey.set('overall-no-rdi',
        subSides(side(overall?.totals), overallByKey.get('rdi') ?? null));
      paidByKey.set('overall-no-rdi',
        subSides(side(paid?.totals), paidByKey.get('rdi') ?? null));
    }

    const forecasts: ProgramForecast[] = src.forecastKeys
      .map(program => {
        const o = overallByKey.get(program) ?? null;
        const p = paidByKey.get(program) ?? null;
        if (!o && !p) return null;
        return { program, overall: o, paid: p, nonpaid: subSides(o, p) };
      })
      .filter((f): f is ProgramForecast => f !== null);

    return {
      forecasts,
      source: forecasts.length ? `${overallTab} + ${paidTab}` : null,
    };
  } catch {
    return { forecasts: [], source: null };
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function getChannelTables(
  partner: PartnerKey = 'wharton',
): Promise<ChannelsResult> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return { ok: false, needsAccess: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY is not set' };
  }
  const src = PARTNER_SOURCES[partner];
  const docId = src.docId();
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const [meta, values, wow] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: docId, fields: 'properties.title' }),
      sheets.spreadsheets.values.batchGet({
        spreadsheetId: docId,
        ranges: [`'${MATRIX_TAB}'!A1:BZ70`, `'${ECON_TAB}'!A1:J120`],
        valueRenderOption: 'UNFORMATTED_VALUE',
      }),
      readForecasts(docId, src),
    ]);

    const matrixGrid = (values.data.valueRanges?.[0]?.values ?? []) as Grid;
    const econGrid = (values.data.valueRanges?.[1]?.values ?? []) as Grid;
    if (!matrixGrid.length) {
      return { ok: false, needsAccess: false, error: `"${MATRIX_TAB}" tab is empty` };
    }

    const banners = findMatrixPrograms(matrixGrid);
    const programs = banners
      .map(b => parseMatrixBlock(matrixGrid, b.name, b.col, src.programAliases))
      .filter((p): p is ProgramChannelBlock => p !== null);
    if (programs.length === 0) {
      return { ok: false, needsAccess: false, error: `"${MATRIX_TAB}" tab layout not recognised` };
    }

    const currentLabel =
      programs[0].cohorts[programs[0].cohorts.length - 1] ?? 'Current Cohort';

    return {
      ok: true,
      data: {
        partner,
        programs,
        econ: parseEcon(econGrid, src.programAliases),
        forecasts: wow.forecasts,
        forecastSource: wow.source,
        currentLabel,
        docTitle: meta.data.properties?.title ?? 'Cohort Performance Doc',
        sheetId: docId,
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
