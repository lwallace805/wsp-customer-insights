// ─── Paid Marketing Aggregate — live reader ───────────────────────────────────
//
// Reads the "Paid Marketing Aggregate" tab of the Wharton funnel-analysis doc
// (WHARTON_FUNNEL_DOC_ID). One tab, one very regular layout — parsed by LABEL,
// never by fixed cell, so an inserted row/column doesn't silently repoint us.
//
// Layout (verified 8/18/26):
//   A1 = "Week", B1 = current cohort week (drives the sheet's own SUMIFS)
//   Row 3 carries the program banners on a 6-column stride:
//     A "Overall" | G "Overall (No RDI)" | M "PE" | S "RE" | Y "FP&A"
//     AE "AVI" | AK "RDI"
//   Six metric blocks stack down column A, each 9 rows tall:
//     r+0  metric name           (+3 "Actuals", +4 "Forecasted")
//     r+1  "Paid Channel" | <prior cohort A> | <prior cohort B> | Current | Current
//     r+2… Google / Bing / Meta / LinkedIn
//     r+6  Total
//     r+7  "% Diff vs. Forecast"  value at +3
//     r+8  "% Diff CoC"           value at +3
//   Every program block repeats those rows at its own column offset.
//
// IMPORTANT semantics, carried through to the UI:
//   • The prior-cohort columns are WEEK-ALIGNED, not full-cohort: the sheet
//     sums those cohorts with `week <= B1`, so week 9 compares to week 9.
//   • "% Diff vs. Forecast" in the sheet is (Actual − Forecast) / ACTUAL, not
//     / Forecast. We read the sheet's own value so the page matches the doc,
//     and label it as the doc labels it.
//   • These figures are PROGRAM-ATTRIBUTED paid only — the Overall column is
//     the sum of the five program columns, so brand/generic spend that isn't
//     tagged to a program is excluded. Total paid spend in the source tab is
//     higher. Surfaced as a footnote on the page.

import { google } from 'googleapis';

export const PAID_AGGREGATE_SHEET_ID =
  process.env.WHARTON_FUNNEL_DOC_ID ?? '148mFYadfpPLFRVvo6hm4WHZhanUMmK18T2r9c5MlnVc';
const TAB = 'Paid Marketing Aggregate';

export type {
  MetricKey, ChannelName, MetricRow, MetricBlock, ProgramBlock, PaidAggregateData,
} from './paidAggregateTypes';
import type {
  MetricKey, ChannelName, MetricRow, MetricBlock, ProgramBlock, PaidAggregateData,
} from './paidAggregateTypes';
import { METRIC_KEYS } from './paidAggregateTypes';
export { METRIC_KEYS, CHANNELS } from './paidAggregateTypes';

export type AggregateResult =
  | { ok: true; data: PaidAggregateData }
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
  const n = parseFloat(s.replace(/[$,%]/g, '').replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function S(v: unknown): string {
  return String(v ?? '').trim();
}

// Map the sheet's metric-block heading to our key. Matched loosely on the
// leading word so "CVR (L2E)" and a future "CVR (Lead→Enroll)" both land.
function metricKeyFor(label: string): MetricKey | null {
  const t = label.toLowerCase();
  if (t.startsWith('leads')) return 'leads';
  if (t.startsWith('spend')) return 'spend';
  if (t.startsWith('enrollment')) return 'enrollments';
  if (t.startsWith('cpl')) return 'cpl';
  if (t.startsWith('cpe')) return 'cpe';
  if (t.startsWith('cvr')) return 'cvr';
  return null;
}

function channelFor(label: string): ChannelName | 'Total' | null {
  const t = label.toLowerCase();
  if (t === 'google') return 'Google';
  if (t === 'bing' || t === 'microsoft' || t === 'microsoft ads') return 'Bing';
  if (t === 'meta' || t === 'facebook') return 'Meta';
  if (t === 'linkedin' || t === 'linked in') return 'LinkedIn';
  if (t === 'total') return 'Total';
  return null;
}

type Grid = unknown[][];

function cell(grid: Grid, r: number, c: number): unknown {
  return grid[r]?.[c];
}

/** Find the program banners on the banner row: any non-empty label that also
 *  has "Paid Channel" directly under a metric header at the same column. */
function findPrograms(grid: Grid): { name: string; col: number }[] {
  // The banner row is the row containing "Overall" in column A.
  let bannerRow = -1;
  for (let r = 0; r < Math.min(grid.length, 12); r++) {
    if (S(cell(grid, r, 0)).toLowerCase() === 'overall') { bannerRow = r; break; }
  }
  if (bannerRow < 0) return [];
  const row = grid[bannerRow] ?? [];
  const out: { name: string; col: number }[] = [];
  for (let c = 0; c < row.length; c++) {
    const name = S(row[c]);
    if (!name) continue;
    // Confirm it heads a real block: a "Paid Channel" label appears in this
    // column somewhere in the next few rows.
    let confirmed = false;
    for (let r = bannerRow + 1; r < Math.min(bannerRow + 8, grid.length); r++) {
      if (S(cell(grid, r, c)).toLowerCase() === 'paid channel') { confirmed = true; break; }
    }
    if (confirmed) out.push({ name, col: c });
  }
  return out;
}

/** Row indices where a metric block starts, keyed off column A of the Overall
 *  block (every program repeats the same rows). */
function findMetricBlocks(grid: Grid): { key: MetricKey; label: string; row: number }[] {
  const out: { key: MetricKey; label: string; row: number }[] = [];
  for (let r = 0; r < grid.length; r++) {
    const label = S(cell(grid, r, 0));
    if (!label) continue;
    const key = metricKeyFor(label);
    if (!key || out.some(o => o.key === key)) continue;
    // A metric heading is followed on the next row by "Paid Channel".
    if (S(cell(grid, r + 1, 0)).toLowerCase() !== 'paid channel') continue;
    out.push({ key, label, row: r });
  }
  return out;
}

function parseBlock(
  grid: Grid,
  col: number,
  block: { key: MetricKey; label: string; row: number },
): MetricBlock | null {
  const r = block.row;
  const rows: MetricRow[] = [];
  let diffVsForecast: number | null = null;
  let diffCoC: number | null = null;

  // Channel rows + Total live within the 8 rows below the header row.
  for (let j = r + 2; j < Math.min(r + 10, grid.length); j++) {
    const label = S(cell(grid, j, col));
    if (!label) continue;
    const ch = channelFor(label);
    if (ch) {
      rows.push({
        channel: ch,
        priorA: N(cell(grid, j, col + 1)),
        priorB: N(cell(grid, j, col + 2)),
        actual: N(cell(grid, j, col + 3)),
        forecast: N(cell(grid, j, col + 4)),
      });
      continue;
    }
    const t = label.toLowerCase();
    if (t.includes('forecast')) diffVsForecast = N(cell(grid, j, col + 3));
    else if (t.includes('coc')) diffCoC = N(cell(grid, j, col + 3));
  }

  if (!rows.some(x => x.channel === 'Total')) return null;
  return { key: block.key, label: block.label, rows, diffVsForecast, diffCoC };
}

function cohortFromTitle(title: string): string {
  const m = title.match(/(Fall|Spring|Winter|Summer)\s*(20\d\d)/i);
  return m ? `${m[1]} ${m[2]}` : 'Current cohort';
}

export async function getPaidAggregate(): Promise<AggregateResult> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return { ok: false, needsAccess: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY is not set' };
  }
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const [meta, values] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: PAID_AGGREGATE_SHEET_ID, fields: 'properties.title' }),
      sheets.spreadsheets.values.get({
        spreadsheetId: PAID_AGGREGATE_SHEET_ID,
        range: `'${TAB}'!A1:BZ120`,
        valueRenderOption: 'UNFORMATTED_VALUE',
      }),
    ]);

    const grid = (values.data.values ?? []) as Grid;
    if (!grid.length) return { ok: false, needsAccess: false, error: `"${TAB}" tab is empty` };

    const programCols = findPrograms(grid);
    const blocks = findMetricBlocks(grid);
    if (!programCols.length || !blocks.length) {
      return { ok: false, needsAccess: false, error: `"${TAB}" tab layout not recognised` };
    }

    const programs: ProgramBlock[] = programCols.map(({ name, col }) => {
      const metrics = {} as Record<MetricKey, MetricBlock | null>;
      for (const k of METRIC_KEYS) metrics[k] = null;
      for (const b of blocks) metrics[b.key] = parseBlock(grid, col, b);
      return { name, metrics };
    });

    // Prior-cohort labels sit on the "Paid Channel" header row of any block.
    const hdrRow = blocks[0].row + 1;
    const priorLabels: [string, string] = [
      S(cell(grid, hdrRow, 1)) || 'Prior cohort',
      S(cell(grid, hdrRow, 2)) || 'Prior cohort',
    ];

    // Week lives beside the "Week" label in row 1.
    let week: number | null = null;
    for (let r = 0; r < Math.min(grid.length, 5); r++) {
      if (S(cell(grid, r, 0)).toLowerCase() === 'week') { week = N(cell(grid, r, 1)); break; }
    }

    const docTitle = meta.data.properties?.title ?? 'Funnel Analysis';

    return {
      ok: true,
      data: {
        cohortLabel: cohortFromTitle(docTitle),
        week,
        priorLabels,
        programs,
        docTitle,
        sheetId: PAID_AGGREGATE_SHEET_ID,
        tab: TAB,
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
