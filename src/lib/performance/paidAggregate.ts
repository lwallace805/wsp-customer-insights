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
import { readPaidWoW, PAID_WOW_BASE_TAB, resolveVersionedTab } from '@/lib/sheets';
import type { PaidRow } from '@/lib/sheets';
import { CBS_CHANNEL_TABLES_DOC_ID } from './channelTables';
import { getActiveCohort, getCohortWeek } from '@/lib/cohortCalendar';
import { readCbsPaidDaily, reconcile } from './cbsPaidDaily';
import type { CohortSlice, DailyTotals } from './cbsPaidDaily';
import type { PartnerKey } from './partners';

export const PAID_AGGREGATE_SHEET_ID =
  process.env.WHARTON_FUNNEL_DOC_ID ?? '148mFYadfpPLFRVvo6hm4WHZhanUMmK18T2r9c5MlnVc';
const TAB = 'Paid Marketing Aggregate';

/** Which doc backs each partner's paid view. CBS has no funnel doc and no
 *  "Paid Marketing Aggregate" tab — see buildCbsPaidAggregate below. */
export function paidAggregateDocId(partner: PartnerKey): string {
  return partner === 'cbs' ? CBS_CHANNEL_TABLES_DOC_ID : PAID_AGGREGATE_SHEET_ID;
}

export type {
  MetricKey, ChannelName, MetricRow, MetricBlock, ProgramBlock, PaidAggregateData,
} from './paidAggregateTypes';
import type {
  MetricKey, ChannelName, MetricRow, MetricBlock, ProgramBlock, PaidAggregateData,
} from './paidAggregateTypes';
import { METRIC_KEYS, CHANNELS } from './paidAggregateTypes';
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

export async function getPaidAggregate(
  partner: PartnerKey = 'wharton',
): Promise<AggregateResult> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return { ok: false, needsAccess: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY is not set' };
  }
  if (partner === 'cbs') return getCbsPaidAggregate();
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
        partner: 'wharton',
        cohortLabel: cohortFromTitle(docTitle),
        week,
        priorLabels,
        hasPriors: true,
        programs,
        notes: [],
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

// ─── CBS AI — assembled, not read from an aggregate tab ───────────────────────
//
// The CBS cohort doc has no "Paid Marketing Aggregate" tab, so the same six
// metric blocks are assembled from its "Paid WoW Performance & Goals" tab,
// which carries one block per ad platform (Google | Bing | Meta | LinkedIn |
// Open AI) plus a "Total Paid" block above them. Each block's "Total" row is
// cumulative for the cohort to date, with a forecast beside it — the same
// actual/forecast pairing the Wharton tab publishes.
//
// Verified against the doc on 9/3/26: the five platform blocks sum EXACTLY to
// the Total Paid block on spend ($74,061.996), leads (562) and enrollments (4),
// and that lead/enrollment total is the same figure the doc's "Channel Tables"
// PPC row reports for the current cohort. The reconciliation is re-checked on
// every read and surfaced as a note if it ever stops holding, because the Total
// row — not the sum — is what the rest of the doc uses.
//
// Prior-cohort columns come from the same doc's DAILY per-cohort tabs, summed
// over the same days-to-close window the current cohort has reached — see
// cbsPaidDaily.ts, which documents why that basis is the same one the Paid WoW
// blocks are built on (it reproduces them exactly, and is re-checked on every
// read). They are NOT taken from "Channel Tables", whose prior columns are
// whole-PPC only and IMPORTRANGE'd from a doc this service account can't read.
//
// Winter 2026 has no daily tab in this doc (there is a gap between the Fall
// 2025 and Spring 2026 tabs), so the two alignable priors are Fall 2025 and
// Spring 2026 — the immediately prior cohort plus the same season a year back.
// Any cohort that can't be aligned is named in a page note rather than dropped
// silently.

/** a ÷ b, guarding the zero and non-finite cases the sheet leaves as #DIV/0!. */
function ratio(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  const r = a / b;
  return isFinite(r) ? r : null;
}

/** Keep a ratio only when its denominator is real. The tab writes a literal 0
 *  into CPE and CVR for a platform with no enrollments yet, and "$0 per
 *  enrollment" reads as free rather than as not-yet-measurable. */
function gated(value: number | null, denominator: number | null): number | null {
  if (denominator === null || denominator === 0) return null;
  return value;
}

/** One metric out of an aligned prior-cohort slice, on the same definitions the
 *  actual column uses: ratios are computed from that cohort's own sums, gated
 *  on their denominators so "no enrollments yet" never reads as $0. */
function priorValue(t: DailyTotals | undefined, key: MetricKey): number | null {
  if (!t) return null;
  switch (key) {
    case 'leads':       return t.leads;
    case 'spend':       return t.spend;
    case 'enrollments': return t.enrolls;
    case 'cpl':         return gated(ratio(t.spend, t.leads), t.leads);
    case 'cpe':         return gated(ratio(t.spend, t.enrolls), t.enrolls);
    case 'cvr':         return gated(ratio(t.enrolls, t.leads), t.leads);
  }
}

/** One metric's actual/forecast pair out of a Paid WoW row. Ratio forecasts
 *  fall back to being derived from the volume forecasts, which reconciles with
 *  the tab's own forecast columns to the cent. */
function pairFor(row: PaidRow, key: MetricKey): { actual: number | null; forecast: number | null } {
  switch (key) {
    case 'leads':       return { actual: row.leads,   forecast: row.leadsF };
    case 'spend':       return { actual: row.spend,   forecast: row.spendF };
    case 'enrollments': return { actual: row.enrolls, forecast: row.enrollsF };
    // Only the Google block publishes CPL/CPE/CVR in full; the others omit
    // some or all of those columns. Each is exactly its volume ratio — checked
    // against Google's own cells, which agree to seven decimals — so a missing
    // column is derived rather than left blank.
    case 'cpl': return {
      actual: gated(row.cpl ?? ratio(row.spend, row.leads), row.leads),
      forecast: gated(row.cplF ?? ratio(row.spendF, row.leadsF), row.leadsF),
    };
    case 'cpe': return {
      actual: gated(row.cpe ?? ratio(row.spend, row.enrolls), row.enrolls),
      forecast: gated(row.cpeF ?? ratio(row.spendF, row.enrollsF), row.enrollsF),
    };
    case 'cvr': return {
      actual: gated(row.cvr ?? ratio(row.enrolls, row.leads), row.leads),
      forecast: gated(row.cvrF ?? ratio(row.enrollsF, row.leadsF), row.leadsF),
    };
  }
}

const CBS_METRIC_LABELS: Record<MetricKey, string> = {
  leads: 'Leads', spend: 'Spend', enrollments: 'Enrollments',
  cpl: 'CPL', cpe: 'CPE', cvr: 'CVR (L2E)',
};

/** Sum a volume across the platform blocks, for the reconciliation check.
 *  Returns null when no block reports the field at all. */
function sumOf(rows: PaidRow[], pick: (r: PaidRow) => number | null): number | null {
  let seen = false;
  let total = 0;
  for (const r of rows) {
    const v = pick(r);
    if (v === null) continue;
    seen = true;
    total += v;
  }
  return seen ? total : null;
}

async function getCbsPaidAggregate(): Promise<AggregateResult> {
  const docId = CBS_CHANNEL_TABLES_DOC_ID;
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    // The metadata call is what surfaces a 403/404 as needsAccess — readPaidWoW
    // swallows its own errors and would just come back empty.
    const [meta, tab, wow] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: docId, fields: 'properties.title' }),
      resolveVersionedTab(docId, PAID_WOW_BASE_TAB),
      // Unformatted, so CVR arrives as a fraction and spend to the cent —
      // the same basis as the Wharton funnel-doc read this page sits beside.
      readPaidWoW(docId, undefined, { unformatted: true }),
    ]);

    const totals = wow?.totals ?? null;
    const channels = wow?.channels ?? [];
    if (!totals && channels.length === 0) {
      return {
        ok: false,
        needsAccess: false,
        error: `"${tab}" carries neither a paid total nor any channel block`,
      };
    }

    // Platform rows in the page's canonical channel order; a platform the doc
    // doesn't run simply yields no row.
    const present = CHANNELS
      .map(name => ({ name, row: channels.find(c => c.label === name) }))
      .filter((x): x is { name: ChannelName; row: PaidRow } => x.row !== undefined);

    const docTitle = meta.data.properties?.title ?? 'CBS Cohort Performance Doc';
    const cohortLabel = cohortFromTitle(docTitle);

    // ── Prior-cohort columns from the daily tabs ──
    // Withheld unless the same summation still reproduces this cohort's Paid
    // WoW figures; otherwise the prior columns would sit on a basis the actual
    // column no longer shares.
    const priorNotes: string[] = [];
    let priors: CohortSlice[] = [];
    let alignment: { days: number; anchorDate: string } | null = null;
    try {
      const daily = await readCbsPaidDaily(docId, cohortLabel, auth);
      if (daily) {
        const off = reconcile(
          daily.current,
          present.map(({ name, row }) => ({ channel: name, leads: row.leads, spend: row.spend })),
        );
        if (off.length > 0) {
          priorNotes.push(
            `Prior-cohort columns are withheld: the daily “${daily.current.tab}” tab no longer ` +
            `reproduces this cohort’s figures in “${tab}” (${off.join('; ')}), so a prior column ` +
            'built the same way would not be comparable to the actual column.',
          );
        } else {
          priors = daily.priors;
          alignment = { days: daily.current.days, anchorDate: daily.anchorDate };
          if (daily.skipped.length > 0) {
            priorNotes.push(`Not shown for comparison: ${daily.skipped.join('; ')}.`);
          }
        }
      }
    } catch {
      // A daily-tab problem must never cost the page its current-cohort view.
      priors = [];
    }
    const priorLabels: [string, string] = [
      priors.length > 1 ? priors[0].label : '',
      priors.length > 0 ? priors[priors.length - 1].label : '',
    ];
    const priorFor = (channel: ChannelName | 'Total', key: MetricKey, i: number): number | null => {
      const s = priors.length > 1 ? priors[i] : i === 1 ? priors[0] : undefined;
      if (!s) return null;
      return priorValue(channel === 'Total' ? s.total : s.byChannel[channel], key);
    };

    const metrics = {} as Record<MetricKey, MetricBlock | null>;
    for (const key of METRIC_KEYS) {
      const rows: MetricRow[] = present.map(({ name, row }) => ({
        channel: name,
        priorA: priorFor(name, key, 0),
        priorB: priorFor(name, key, 1),
        ...pairFor(row, key),
      }));
      if (totals) {
        rows.push({
          channel: 'Total',
          priorA: priorFor('Total', key, 0),
          priorB: priorFor('Total', key, 1),
          ...pairFor(totals, key),
        });
      }
      metrics[key] = {
        key,
        label: CBS_METRIC_LABELS[key],
        rows,
        // The doc states no "% Diff" rows for this tab; the page derives
        // attainment from the actual/forecast columns instead.
        diffVsForecast: null,
        diffCoC: null,
      };
    }

    const notes = [
      `Actual and forecast are assembled from the cohort doc’s “${tab}” tab — ` +
      'the CBS doc has no Paid Marketing Aggregate tab. Both sides are ' +
      'cumulative for the cohort to date, so “% of forecast” is like-for-like.',
      ...(priors.length > 0 && alignment
        ? [
            'Prior-cohort columns are summed from this doc’s own daily per-cohort ' +
            `tabs over each cohort’s FIRST ${alignment.days} days after enrollment ` +
            `opened — the same age this cohort reached on ${alignment.anchorDate} — ` +
            'so no column has had more time to accumulate than another. Summing ' +
            'the current cohort that way reproduces the per-platform figures in ' +
            `“${tab}” exactly, which is re-checked on every read; the prior ` +
            'columns are that same calculation on the prior cohorts.',
            'These are computed from the daily rows, not read from “Channel ' +
            'Tables” — whose prior columns are whole-PPC only and imported from ' +
            'another doc by hand. The Channels page shows those instead, so a ' +
            'small difference there on older cohorts is expected; the ' +
            'immediately prior cohort currently agrees on both surfaces.',
          ]
        : []),
      ...priorNotes,
      'CPL, CPE and CVR are shown only where the denominator exists. The tab ' +
      'writes a literal 0 into those cells for a platform with no leads or no ' +
      'enrollments yet, which would read as “$0 per enrollment” instead of ' +
      '“not yet measurable”.',
      'A blank prior-cohort cell means the platform wasn’t running in that ' +
      'cohort (Open AI is new this cohort), not zero.',
    ];

    // Reconciliation: the platform blocks must sum to the doc's own Total Paid
    // row, which is what every other CBS surface quotes.
    if (totals && present.length > 0) {
      const checks: Array<[string, number | null, number | null]> = [
        ['spend', sumOf(present.map(p => p.row), r => r.spend), totals.spend],
        ['leads', sumOf(present.map(p => p.row), r => r.leads), totals.leads],
        ['enrollments', sumOf(present.map(p => p.row), r => r.enrolls), totals.enrolls],
      ];
      const off = checks.filter(([, sum, total]) =>
        sum !== null && total !== null && Math.abs(sum - total) > Math.max(1, Math.abs(total) * 0.005));
      if (off.length > 0) {
        notes.push(
          'Heads up: the platform blocks no longer sum to the doc’s Total Paid row on ' +
          off.map(([m, sum, total]) => `${m} (${Math.round(sum ?? 0).toLocaleString()} vs ${Math.round(total ?? 0).toLocaleString()})`).join(', ') +
          '. The Total row is shown as the doc states it — the gap is in the source.',
        );
      }
    }

    const win = getActiveCohort('columbia');

    return {
      ok: true,
      data: {
        partner: 'cbs',
        cohortLabel,
        // The tab has no "Week" cell; the cohort calendar's week for the active
        // Columbia cohort is the same 1-based week its weekly rows run on
        // (week 1 = the cohort's open week).
        week: win ? getCohortWeek(win) : null,
        priorLabels,
        hasPriors: priors.length > 0,
        programs: [{ name: 'AI', metrics }],
        notes,
        docTitle,
        sheetId: docId,
        tab,
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
