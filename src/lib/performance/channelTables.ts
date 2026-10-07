// ─── Channel Performance — live reader ────────────────────────────────────────
//
// Reads a cohort performance doc — Wharton's (the doc Pulse and Cohort Command
// already read) or the CBS AI certificate's, selected by the `partner`
// argument — in the V2 attribution model (Oct 2026; see channelV2.ts for the
// model and the row grammar):
//
//   "Channel Tables V2" — Paid/Non-Paid → Channel → Sub-Channel × cohort
//   matrices, one block per program on an 11-column stride (Overall | Overall
//   (No - RDI) | PE | RE | FP&A | AVI | RDI). CBS carries ONE block and no
//   banner row at all. Each block stacks Leads / Enrollments / Conversions;
//   cohort columns are Fall 2025 | Winter 2026 | Spring 2026 | Current Cohort.
//
//   "Overall Performance Tables - V2" — the current cohort's economics (leads,
//   enrolls, spend) on the same hierarchy, one table per program.
//
// IMPORTANT semantics, carried through to the UI:
//   • Only the Current Cohort column is formula-driven (off the economics
//     tab). Prior-cohort columns are IMPORTRANGE'd snapshots from each
//     program's own doc ("Channel Level Tables"), refreshed by hand. On
//     10/6/26 they sat within 1% of each cohort's pacing-sheet total at the
//     same days-to-deadline (Fall '25 832 vs 834, Winter '26 975 vs 976,
//     Spring '26 940 vs 948 at 7 days out) — day-aligned, not finals.
//   • "Paid" is the doc's V2 Paid tier — PPC plus Paid Other, Paid Affiliate
//     and Sponsored Content. The PPC slice (Paid Search + Paid Social) is
//     flagged per row because the WoW forecasts and the Paid Marketing
//     Aggregate page only cover that slice.
//   • The V1 tabs are hidden and frozen. There is deliberately NO fallback to
//     them: a doc without the V2 tabs is an error, not a quiet stale read.
//   • The Conversions section is not read — CVR is derived as enrollments ÷
//     leads, which is exactly what the sheet's own block does.

import { google } from 'googleapis';
import {
  readPaidWoW, resolveVersionedTab, readDeadlineTable, getClosedWhartonCohorts,
} from '@/lib/sheets';
import { readWoWLeads } from '@/lib/pulseLive';
import { COHORT_WINDOWS, getActiveCohort, daysOutAt, nowET } from '@/lib/cohortCalendar';
import { COHORT_SHEETS } from '@/lib/cohortSheets';
import type {
  ChannelTablesData, ProgramForecast, ForecastSide, ProgramKey, ProgramChannelBlock,
  AlignmentCheck,
} from './channelTablesTypes';
import { resolveProgramKey } from './channelTablesTypes';
import {
  parseMatrixV2, parseEconV2, reconcileCurrent, channelSubtotalNotes, attachInCohortV2,
  platformFiguresFromPaidWoW,
} from './channelV2';
import type { Grid, PlatformFigures } from './channelV2';
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
 *  same row grammar as Wharton's, one program instead of seven. Kept in sync
 *  with the 'c-fall-26' entry in src/lib/cohortSheets.ts. */
export const CBS_CHANNEL_TABLES_DOC_ID =
  process.env.CBS_FALL26_COHORT_DOC_ID ??
  '1qHj4jZauhseusZIYrzVa_byhtkqR7GnZgUZetyo32cE';

interface PartnerSource {
  docId: () => string;
  /** Banner aliases for this doc — see resolveProgramKey. */
  programAliases?: Record<string, ProgramKey>;
  /** Program for a matrix block with no banner (CBS has a single, unbannered
   *  block). */
  singleProgram?: ProgramKey;
  /** Keys to publish forecasts for, in order. */
  forecastKeys: ProgramKey[];
  /** Key that carries the doc's own cohort-wide totals. Wharton splits those
   *  into Overall and Overall (No RDI); CBS has a single program, so its
   *  totals ARE that program's. */
  totalsKey: ProgramKey;
  /** Wharton's WoW tabs carry a No-RDI restatement; CBS has no RDI. */
  hasNoRdiRollup: boolean;
}

export const PARTNER_SOURCES: Record<PartnerKey, PartnerSource> = {
  wharton: {
    docId: () => CHANNEL_TABLES_DOC_ID,
    forecastKeys: ['overall', 'overall-no-rdi', 'pe', 're', 'fpa', 'avi', 'rdi'],
    totalsKey: 'overall',
    hasNoRdiRollup: true,
  },
  cbs: {
    docId: () => CBS_CHANNEL_TABLES_DOC_ID,
    // The economics table is bannered "Overall Performance"; it describes the
    // one program the unbannered matrix block covers.
    programAliases: { ai: 'ai', overall: 'ai' },
    singleProgram: 'ai',
    forecastKeys: ['ai'],
    totalsKey: 'ai',
    hasNoRdiRollup: false,
  },
};

export function channelTablesDocId(partner: PartnerKey): string {
  return PARTNER_SOURCES[partner].docId();
}

export const MATRIX_BASE_TAB = 'Channel Tables';
export const ECON_BASE_TAB = 'Overall Performance Tables';
/** The in-cohort tab is named differently in each doc. Newest version wins. */
const IN_COHORT_BASE_TABS = ['Channel Tables - In Cohort Enrollments', 'In-Cohort Channel Tables'];

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

// ─── Forecasts + platform spend from the WoW tabs ─────────────────────────────
//
// The channel matrix has no forecast — the source tab carries none. To-date
// forecasts live in the same doc's WoW tabs: "Overall WoW Performance & Goals"
// (all channels, by program) and "Paid WoW Performance & Goals" (the ad
// platforms, by program), newest version of each.
//
// Under V2 the Paid WoW tab covers the PPC slice only (Wharton: Google, Bing,
// Meta, LinkedIn — its 11,767 leads / 405 enrollments on 10/6/26 equal Paid
// Search + Paid Social exactly; CBS also counts Open AI). Overall − PPC is
// still derived, but it is "everything except PPC", not the Non-Paid tier:
// Paid Other, Paid Affiliate and Sponsored Content sit in it too.
//
// Attainment is always WoW-actual ÷ WoW-forecast, never matrix ÷ WoW.

async function readForecasts(sheetId: string, src: PartnerSource): Promise<{
  forecasts: ProgramForecast[];
  source: string | null;
  platform: PlatformFigures | undefined;
}> {
  try {
    const [overall, paid, overallTab, paidTab] = await Promise.all([
      readWoWLeads(sheetId, 'current'),
      // Unformatted: spend is compared to the cent with the economics tab.
      readPaidWoW(sheetId, undefined, { unformatted: true }),
      resolveVersionedTab(sheetId, 'Overall WoW Performance & Goals'),
      resolveVersionedTab(sheetId, 'Paid WoW Performance & Goals'),
    ]);

    const platform = platformFiguresFromPaidWoW(paid, src.totalsKey, src.programAliases);

    if (!overall && !paid) return { forecasts: [], source: null, platform };

    const side = (r: { leads: number | null; leadsF: number | null; enrolls: number | null; enrollsF: number | null } | null | undefined): ForecastSide | null =>
      r ? { leads: r.leads, leadsF: r.leadsF, enrolls: r.enrolls, enrollsF: r.enrollsF } : null;
    const minus = (a: ForecastSide | null, b: ForecastSide | null): ForecastSide | null => {
      if (!a || !b) return null;
      const d = (x: number | null, y: number | null) => (x === null || y === null || x - y < 0 ? null : x - y);
      return { leads: d(a.leads, b.leads), leadsF: d(a.leadsF, b.leadsF), enrolls: d(a.enrolls, b.enrolls), enrollsF: d(a.enrollsF, b.enrollsF) };
    };

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
      overallByKey.set('overall-no-rdi', minus(side(overall?.totals), overallByKey.get('rdi') ?? null));
      paidByKey.set('overall-no-rdi', minus(side(paid?.totals), paidByKey.get('rdi') ?? null));
    }

    const forecasts: ProgramForecast[] = src.forecastKeys
      .map(program => {
        const o = overallByKey.get(program) ?? null;
        const p = paidByKey.get(program) ?? null;
        if (!o && !p) return null;
        return { program, overall: o, ppc: p, nonPpc: minus(o, p) };
      })
      .filter((f): f is ProgramForecast => f !== null);

    return {
      forecasts,
      source: forecasts.length ? `${overallTab} + ${paidTab}` : null,
      platform,
    };
  } catch {
    return { forecasts: [], source: null, platform: undefined };
  }
}

// ─── Prior-column alignment check ─────────────────────────────────────────────
//
// The matrix's prior-cohort columns are hand-refreshed snapshots, so nothing in
// the doc says WHEN they were cut. Each one is checked against that cohort's
// own pacing curve: find the days-before-deadline at which the curve comes
// closest to the column's enrollment total, and compare with where the
// current cohort is now. A snapshot left behind as the current cohort moves on
// (seen 8/31/26, ~2 days stale) or a column holding a full-cohort final shows
// up as a mismatch instead of as a flattering or damning "vs prior" delta.
//
// Curves: Wharton's closed cohorts come from the AN Summary pacing sheet;
// CBS's from each closed cohort's own doc where it's wired in cohortSheets.ts
// (Spring '26 today — Fall '25 and Winter '26 have no wired doc, so they go
// unchecked rather than being guessed at).

/** "Spring 2026" → "Spring '26", the label the pacing sources use. */
const shortLabel = (c: string) => c.replace(/^(\w+)\s+20(\d\d)$/, "$1 '$2");

const DAY_TOLERANCE = 2;
const VALUE_TOLERANCE = 0.02;

export function matchCurve(
  cohort: string, value: number, curve: Map<number, number>, currentDay: number,
): AlignmentCheck | null {
  let best: { day: number; v: number } | null = null;
  for (const [day, v] of curve) {
    if (!best) { best = { day, v }; continue; }
    const d = Math.abs(v - value);
    const bd = Math.abs(best.v - value);
    if (d < bd || (d === bd && Math.abs(day - currentDay) < Math.abs(best.day - currentDay))) {
      best = { day, v };
    }
  }
  if (!best) return null;
  const atCurrent = curve.get(currentDay);
  const ok = Math.abs(best.day - currentDay) <= DAY_TOLERANCE ||
    (atCurrent !== undefined && atCurrent > 0 && Math.abs(value - atCurrent) / atCurrent <= VALUE_TOLERANCE);
  return { cohort, value, matchDay: best.day, matchValue: best.v, currentDay, ok };
}

async function checkAlignment(
  partner: PartnerKey, block: ProgramChannelBlock | undefined,
): Promise<{ checks: AlignmentCheck[]; source: string | null }> {
  if (!block) return { checks: [], source: null };
  const family = partner === 'wharton' ? 'wharton' : 'columbia';
  const now = nowET();
  const win = getActiveCohort(family, now);
  if (!win) return { checks: [], source: null };
  const currentDay = daysOutAt(win, now);
  const priors = block.cohorts.slice(0, -1)
    .map((cohort, i) => ({ cohort, value: block.totals.enrollments[i] }))
    .filter((p): p is { cohort: string; value: number } => p.value !== null && p.value > 0);

  try {
    const curves = new Map<string, Map<number, number>>();
    let source: string | null = null;
    if (partner === 'wharton') {
      const id = process.env.GOOGLE_PACING_SHEET_ID;
      if (!id) return { checks: [], source: null };
      for (const c of await getClosedWhartonCohorts(id)) curves.set(c.label, c.byDay);
      source = 'the AN Summary pacing sheet';
    } else {
      const closed = COHORT_WINDOWS.filter(w => w.family === family && COHORT_SHEETS[w.key] && w.key !== win.key);
      for (const w of closed) {
        const wiring = COHORT_SHEETS[w.key]!;
        const id = wiring.sheetId();
        if (!id) continue;
        const end = new Date(`${w.extEnds}T12:00:00Z`);
        const t = await readDeadlineTable(id, wiring.deadlineTab, w.label, new Date(end.getTime() + 2 * 86400000));
        if (!t) continue;
        curves.set(w.label, new Map(t.series.map(p =>
          [Math.round((end.getTime() - new Date(`${p.date}T12:00:00Z`).getTime()) / 86400000), p.total])));
      }
      source = 'each closed cohort’s own deadline pacing table';
    }
    const checks = priors
      .map(p => {
        const curve = curves.get(shortLabel(p.cohort));
        return curve ? matchCurve(p.cohort, p.value, curve, currentDay) : null;
      })
      .filter((c): c is AlignmentCheck => c !== null);
    return { checks, source: checks.length ? source : null };
  } catch {
    return { checks: [], source: null };
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
    const [meta, matrixTab, econTab, wow, ...inCohortTabs] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: docId, fields: 'properties.title' }),
      resolveVersionedTab(docId, MATRIX_BASE_TAB),
      resolveVersionedTab(docId, ECON_BASE_TAB),
      readForecasts(docId, src),
      ...IN_COHORT_BASE_TABS.map(b => resolveVersionedTab(docId, b)),
    ]);
    // Only a V2+ in-cohort tab: the unversioned ones are V1 and frozen.
    const inCohortTab = inCohortTabs.find((t, i) => t !== IN_COHORT_BASE_TABS[i]) ?? null;
    // The unversioned tabs are the frozen V1 model — never read them here.
    for (const [tab, base] of [[matrixTab, MATRIX_BASE_TAB], [econTab, ECON_BASE_TAB]]) {
      if (tab === base) {
        return {
          ok: false,
          needsAccess: false,
          error: `No V2 "${base}" tab found in ${meta.data.properties?.title ?? 'the doc'}. ` +
            `The unversioned "${base}" tab is the retired V1 model and stopped updating, so it ` +
            `is not read as a fallback.`,
        };
      }
    }

    const values = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: docId,
      ranges: [
        `'${matrixTab}'!A1:CA130`,
        `'${econTab}'!A1:P260`,
        ...(inCohortTab ? [`'${inCohortTab}'!A1:CK80`] : []),
      ],
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const matrixGrid = (values.data.valueRanges?.[0]?.values ?? []) as Grid;
    const econGrid = (values.data.valueRanges?.[1]?.values ?? []) as Grid;
    const inCohortGrid = (values.data.valueRanges?.[2]?.values ?? []) as Grid;
    if (!matrixGrid.length) {
      return { ok: false, needsAccess: false, error: `"${matrixTab}" tab is empty` };
    }

    const matrix = parseMatrixV2(matrixGrid, {
      aliases: src.programAliases,
      singleProgram: src.singleProgram,
    });
    if (matrix.programs.length === 0) {
      // Name what actually failed. "Layout not recognised" on its own sends
      // whoever picks this up hunting for a layout change that may not exist.
      return {
        ok: false,
        needsAccess: false,
        error: `"${matrixTab}" tab could not be parsed — ` +
          (matrix.fails.length ? matrix.fails.join('; ') : 'no Paid/Non-Paid header rows found'),
      };
    }

    const econ = parseEconV2(econGrid, {
      aliases: src.programAliases,
      totalsKey: src.totalsKey,
      platform: wow.platform,
      tabName: `"${econTab}"`,
    });

    const inCohortNotes = inCohortTab && inCohortGrid.length
      ? attachInCohortV2(inCohortGrid, matrix.programs, {
          aliases: src.programAliases,
          singleProgram: src.singleProgram,
          tabName: `"${inCohortTab}"`,
        })
      : [];
    const alignment = await checkAlignment(
      partner, matrix.programs.find(p => p.program === src.totalsKey));

    // Order matters: the in-cohort split is joined by position, so it must be
    // attached before any correction adds a row; subtotal notes are judged
    // only after the correction, against what the page will actually show.
    const reconciled =
      reconcileCurrent(matrix.programs, econ.blocks, `"${econTab}"`, `"${matrixTab}"`);
    const notes = [
      ...matrix.notes,
      ...channelSubtotalNotes(matrix, reconciled.corrected),
      ...econ.notes,
      ...reconciled.notes,
      ...inCohortNotes,
      ...alignment.checks.filter(c => !c.ok).map(c =>
        `The ${c.cohort} column (${c.value.toLocaleString('en-US')} enrollments) matches ${c.cohort} at ` +
        `${c.matchDay} days before its deadline (${c.matchValue.toLocaleString('en-US')} in ` +
        `${alignment.source}), but the current cohort is ${c.currentDay} days out. The imported ` +
        `snapshot isn't cut at the same point, so "vs ${c.cohort}" deltas are not like-for-like ` +
        `until the program docs' Channel Level Tables are refreshed.`),
    ];
    // A block that failed while others parsed is a silent hole otherwise.
    if (matrix.fails.length) {
      notes.push(`Some program blocks could not be read and are omitted: ${matrix.fails.join('; ')}.`);
    }

    const first = matrix.programs[0];
    return {
      ok: true,
      data: {
        partner,
        programs: matrix.programs,
        econ: econ.blocks,
        forecasts: wow.forecasts,
        forecastSource: wow.source,
        notes,
        currentLabel: first.cohorts[first.cohorts.length - 1] ?? 'Current Cohort',
        docTitle: meta.data.properties?.title ?? 'Cohort Performance Doc',
        sheetId: docId,
        tab: matrixTab,
        econTab,
        inCohortTab: matrix.programs.some(p => p.hasInCohort) ? inCohortTab : null,
        alignment: alignment.checks,
        alignmentSource: alignment.source,
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
