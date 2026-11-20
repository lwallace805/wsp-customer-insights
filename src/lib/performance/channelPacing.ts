// ─── /channels — lead pacing at the exact keyed day (Wharton) ─────────────────
//
// The channel matrix's prior-cohort columns are hand-refreshed snapshots. On
// 11/20/26 Fall 2026's (3,108 leads) was exactly Fall's running total at 88
// days to close, while the current column ran through Nov 19 — 89 days out.
// At ~150 leads a day that one day tilts every "vs prior" by ~5% against the
// current cohort, and the page's existing check (enrollments, which barely
// move this early) can't see it.
//
// This panel cuts every prior at the SAME days-to-close as the current
// cohort's last keyed day, from sources that are keyed by date:
//   • Total / per-program leads: each cohort's daily "<Term> Data" tab in the
//     current cohort doc, cumulative "Total Overall Leads" / "<P> Overall
//     Leads" columns (the WoW basis — Fall 2026's equals the matrix snapshot
//     exactly at the matching day).
//   • Per-platform leads: whole weeks from the prior's weekly paid rows plus
//     the remaining days from its daily tab — the same cut and the same >1%
//     platform gate as /paid-aggregate (whartonPaidDaily.ts).
// The current cohort's figures and forecasts are the WoW to-date figures the
// matrix's forecast columns already use. Priors are closed cohorts, so each
// one is cached per days-to-close for 12 hours.

import { google } from 'googleapis';
import { unstable_cache } from 'next/cache';
import { COHORT_WINDOWS, todayET } from '@/lib/cohortCalendar';
import { getActiveCohortSheet } from '@/lib/cohortSheets';
import { loadWhartonPriors } from './paidAggregate';
import {
  parseDailyPaidTab, sumWeeksThenDays, materialGaps, weekDates, isoAddDays, dayCount,
} from './whartonPaidDaily';
import { WHARTON_PAID_CHANNELS } from './whartonPaidWeekly';
import type {
  LeadPacing, PacingRow, PriorCut, ProgramForecast, ProgramChannelBlock, ProgramKey,
} from './channelTablesTypes';
import { programKeyFor, platformKey } from './channelTablesTypes';
import type { ChannelName } from './paidAggregateTypes';

const PROGRAM_LABELS = ['PE', 'RE', 'FP&A', 'AVI', 'RDI'];

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

/** One prior cohort cut at `daysOut` — plain JSON so it can be cached. */
interface PriorFigures {
  label: string;
  to: string;
  /** Running all-channel leads at `to`: 'total' plus each program label. */
  totals: Record<string, number>;
  /** program label → platform → leads through `to`; null when withheld. */
  platforms: Record<string, Record<string, number>> | null;
  note: string | null;
  /** Days-to-close where the running total is closest to the matrix snapshot. */
  matrixDaysOut: number | null;
}

async function computePrior(
  label: string, daysOut: number, docId: string, snapshotLeads: number | null,
): Promise<PriorFigures | string> {
  const win = COHORT_WINDOWS.find(w => w.family === 'wharton' && w.termLabel === label);
  if (!win) return `${label}: not in the cohort calendar`;
  const to = isoAddDays(win.extEnds, -daysOut);
  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  const tab = `${label} Data`;
  let grid: unknown[][];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: docId, range: `'${tab}'!A1:FZ260`, valueRenderOption: 'UNFORMATTED_VALUE',
    });
    grid = (res.data.values ?? []) as unknown[][];
  } catch {
    return `${label}: no readable “${tab}” tab in the current cohort doc`;
  }
  const { loaded, problems } = await loadWhartonPriors(sheets, [win], 0);
  const weekly = loaded[0]?.tab ?? null;
  const daily = parseDailyPaidTab(grid, tab, weekly?.programs ?? PROGRAM_LABELS);
  if (typeof daily === 'string') return `${label}: ${daily}`;

  // Before the prior had opened there is nothing to compare: zeros, not gaps.
  const opened = to >= win.opens;
  const totals = opened ? daily.cumLeads.get(to) : {};
  if (!totals) return `${label}: “${tab}” has no row for ${shortDate(to)}`;

  let platforms: PriorFigures['platforms'] = null;
  let note: string | null = null;
  if (!weekly) {
    note = `no weekly paid rows to check its daily tab against (${problems.join('; ')})`;
  } else if (opened) {
    const dates = weekDates(weekly.ranges, win.opens);
    // Leads only: this panel shows no spend, so a spend gap (Spring 2026's
    // daily Google spend runs $6.8K under its weekly rows) shouldn't hide it.
    const gaps = materialGaps(daily, weekly, dates, WHARTON_PAID_CHANNELS, to, ['leads']);
    if (gaps.length) {
      note = `its daily tab misses its weekly paid rows by more than 1% on leads (${gaps.slice(0, 2).join('; ')})`;
    } else {
      platforms = {};
      for (const p of weekly.programs) {
        const per: Record<string, number> = {};
        for (const ch of WHARTON_PAID_CHANNELS) {
          const v = sumWeeksThenDays(weekly, daily, dates, ch, [p], win.opens, to);
          if (v) per[ch] = v.leads;
        }
        platforms[p] = per;
      }
    }
  } else {
    platforms = {};
  }

  // Where the matrix snapshot for this cohort is really cut.
  let matrixDaysOut: number | null = null;
  if (snapshotLeads !== null && snapshotLeads > 0) {
    let best: { d: number; gap: number } | null = null;
    daily.cumLeads.forEach((rec, date) => {
      if (date < win.opens || date > win.extEnds) return;
      const gap = Math.abs((rec.total ?? 0) - snapshotLeads);
      const d = dayCount(date, win.extEnds) - 1;
      if (!best || gap < best.gap || (gap === best.gap && Math.abs(d - daysOut) < Math.abs(best.d - daysOut))) {
        best = { d, gap };
      }
    });
    matrixDaysOut = (best as { d: number } | null)?.d ?? null;
  }

  return { label, to, totals: totals ?? {}, platforms, note, matrixDaysOut };
}

const cachedPrior = unstable_cache(computePrior, ['channels-prior-pacing-v2'], { revalidate: 43200 });

/** Program labels a ProgramKey covers. */
function membersFor(key: ProgramKey, labels: string[]): string[] {
  const keyOf = (l: string) => programKeyFor(l) ?? (/^buy$/i.test(l) ? 'avi' : null);
  if (key === 'overall') return labels;
  if (key === 'overall-no-rdi') return labels.filter(l => keyOf(l) !== 'rdi');
  return labels.filter(l => keyOf(l) === key);
}

export async function getLeadPacing(
  forecasts: ProgramForecast[], matrix: ProgramChannelBlock[],
): Promise<{ pacing: LeadPacing | null; note: string | null }> {
  const active = getActiveCohortSheet('wharton');
  if (!active) return { pacing: null, note: null };
  const { sheetId: docId, win } = active;
  if (forecasts.length === 0) return { pacing: null, note: 'Lead pacing needs the WoW tabs, which could not be read.' };
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const tab = `${win.termLabel} Data`;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: docId, range: `'${tab}'!A1:FZ260`, valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const cur = parseDailyPaidTab((res.data.values ?? []) as unknown[][], tab, PROGRAM_LABELS);
    if (typeof cur === 'string') return { pacing: null, note: `Lead pacing unavailable: ${cur}.` };
    if (!cur.lastKeyed) return { pacing: null, note: null };
    const yesterday = isoAddDays(todayET(), -1);
    const through = cur.lastKeyed < yesterday ? cur.lastKeyed : yesterday;
    const daysOut = dayCount(through, win.extEnds) - 1;

    const overallBlock = matrix.find(b => b.program === 'overall') ?? matrix[0];
    const priorLabels = (overallBlock?.cohorts ?? []).slice(0, -1);
    const figs = await Promise.all(priorLabels.map((l, i) =>
      cachedPrior(l, daysOut, docId, overallBlock?.totals.leads[i] ?? null)));

    const notes: string[] = [];
    const priors: PriorCut[] = figs.map((f, i) => typeof f === 'string'
      ? { label: priorLabels[i], date: null, note: f, matrixDaysOut: null }
      : { label: f.label, date: f.to, note: f.note, matrixDaysOut: f.matrixDaysOut });

    const programs: LeadPacing['programs'] = {};
    for (const fc of forecasts) {
      const key = fc.program;
      const total = (f: PriorFigures | string): number | null => {
        if (typeof f === 'string') return null;
        if (key === 'overall') return f.totals.total ?? null;
        const ms = membersFor(key, Object.keys(f.totals).filter(k => k !== 'total'));
        return ms.length ? ms.reduce((s, m) => s + (f.totals[m] ?? 0), 0) : null;
      };
      const plat = (f: PriorFigures | string, ch: ChannelName): number | null => {
        if (typeof f === 'string' || !f.platforms) return null;
        const ms = membersFor(key, Object.keys(f.platforms));
        const vals = ms.map(m => f.platforms![m]?.[ch]).filter((v): v is number => v !== undefined);
        return vals.length ? vals.reduce((s, v) => s + v, 0) : (ms.length ? 0 : null);
      };
      const ppcOf = (f: PriorFigures | string) => {
        const vs = WHARTON_PAID_CHANNELS.map(ch => plat(f, ch));
        return vs.every(v => v === null) ? null : vs.reduce<number>((s, v) => s + (v ?? 0), 0);
      };
      const cur = (side: { leads: number | null; leadsF: number | null } | null | undefined) =>
        ({ current: side?.leads ?? null, forecast: side?.leadsF ?? null });

      const rows: PacingRow[] = [
        { key: 'total', label: 'All channels', ...cur(fc.overall), priors: figs.map(total) },
        { key: 'ppc', label: 'PPC (ad platforms)', ...cur(fc.ppc), priors: figs.map(ppcOf) },
        ...WHARTON_PAID_CHANNELS.map((ch): PacingRow => ({
          key: ch.toLowerCase() as PacingRow['key'],
          label: ch,
          ...cur(fc.platforms[platformKey(ch)]),
          priors: figs.map(f => plat(f, ch)),
        })),
        {
          key: 'other', label: 'Everything except PPC', ...cur(fc.nonPpc),
          priors: figs.map(f => {
            const t = total(f);
            const p = ppcOf(f);
            return t === null || p === null ? null : t - p;
          }),
        },
      ];
      programs[key] = rows;
    }

    // The WoW to-date figures count everything keyed so far; if today is
    // already partly keyed they run past `through`. Say so.
    const curTotal = cur.cumLeads.get(through)?.total;
    const wowTotal = forecasts.find(f => f.program === 'overall')?.overall?.leads ?? null;
    if (curTotal !== undefined && wowTotal !== null && Math.round(curTotal) !== Math.round(wowTotal)) {
      notes.push(
        `The current column is the WoW tab’s to-date figure (${wowTotal.toLocaleString()} leads), which ` +
        `differs from “${tab}” through ${shortDate(through)} (${curTotal.toLocaleString()}) — usually because ` +
        'today is already partly keyed.');
    }
    return { pacing: { through, daysOut, priors, programs, notes }, note: null };
  } catch (err: unknown) {
    return { pacing: null, note: `Lead pacing unavailable: ${(err as Error)?.message ?? String(err)}.` };
  }
}
