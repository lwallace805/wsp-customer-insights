// ─── CBS AI — per-platform paid history from the cohort doc's daily tabs ──────
//
// The CBS cohort doc carries one DAILY tab per cohort ("Fall 2026 Data",
// "Spring 2026 Data", "Fall 2025 Data", …): one row per day, counting DOWN from
// day 118 (enrollment opens) to day 0 (the deadline), with per-platform Spend,
// Leads and Enrollments columns. Summing a prior cohort's rows over the same
// number of days from its own open as the current cohort has been running gives
// a genuinely like-for-like per-platform prior column — which is what the
// paid-aggregate page needs and what the WoW tabs don't carry.
//
// Why this is trustworthy (verified 9/3/26, and re-checked on every read):
//   • Summing the CURRENT cohort's tab over its elapsed window reproduces the
//     "Paid WoW Performance & Goals" per-platform blocks EXACTLY — Google
//     245 leads / $58,784.71, Bing 8 / $608.206, Meta 100 / $9,575.31,
//     LinkedIn 207 / $3,490.43, Open AI 2 / $1,603.34. So the prior columns are
//     computed by the same rule that produces the current column, from the same
//     doc — one basis, not two. `reconcile()` below re-runs that check and the
//     caller withholds the prior columns if it ever stops holding.
//   • The same summation over Spring 2026 gives 567 leads / 5 enrollments,
//     which is exactly what the doc's "Channel Tables" PPC row shows for
//     Spring 2026 — an independent confirmation, since those Channel Tables
//     prior columns are IMPORTRANGE'd from a different doc entirely.
//     (Fall 2025 comes out 17 leads below that hand-refreshed snapshot,
//     1,179 vs 1,196 — 1.4%. The snapshot is the one that can drift; these
//     sums are recomputed from the daily rows on every read.)
//
// Layout traps this parser is built around:
//   • The day column is "Day" in some tabs and "Days Out" in others.
//   • A platform's leads column is sometimes named ("Google Leads") and
//     sometimes just "Leads", so it is taken as the column IMMEDIATELY after
//     that platform's Spend column. This matters: several tabs carry a STRAY
//     DUPLICATE of the LinkedIn leads column sitting just BEFORE "LinkedIn
//     Spend", and a name-only match would double-count it.
//   • Enrollment columns are named per platform, and Meta appears as both "FB"
//     (spend/leads) and "Facebook" (enrollments).
//   • Only the platforms the page reports are read. The doc's "Test" /
//     "Employer" line is deliberately excluded — it sits outside the doc's own
//     "Total Paid" row, which is the figure every other CBS surface quotes.
//   • Cohorts are not all the same length ("Summer 2025 Data" runs 133 days),
//     so alignment is by DAYS ELAPSED SINCE THE COHORT OPENED — each cohort's
//     first N days — not by days-to-close. That matches what "week-aligned"
//     means in the Wharton funnel doc (`week <= B1` from the cohort's open), so
//     the two partners' paid pages mean the same thing by a prior column, and
//     it keeps paid spend, which is budget-paced from launch, on a comparable
//     footing. For the cohorts in play today both rules give identical numbers
//     (Fall 2026, Spring 2026 and Fall 2025 all run exactly 118 days). A cohort
//     with fewer recorded days than the current one has elapsed is skipped
//     rather than compared short.

import { google } from 'googleapis';
import type { ChannelName } from './paidAggregateTypes';
import { nowET } from '@/lib/cohortCalendar';

/** Cumulative spend/leads/enrollments for one platform over an aligned window.
 *  `enrolls` is null when the tab has no enrollment column for that platform. */
export interface DailyTotals {
  spend: number | null;
  leads: number | null;
  enrolls: number | null;
}

export interface CohortSlice {
  /** Cohort label as the tab names it, e.g. "Spring 2026". */
  label: string;
  tab: string;
  /** ISO date of the cohort's first (day-max) row. */
  opens: string;
  /** Rows counted, i.e. days elapsed. */
  days: number;
  byChannel: Partial<Record<ChannelName, DailyTotals>>;
  /** Sum across the platforms above — never the tab's own Total column, which
   *  variously includes the Test line and excludes Open AI. */
  total: DailyTotals;
}

export interface CbsPaidDaily {
  /** The current cohort's own slice, used only to verify the summation rule
   *  still reproduces the Paid WoW blocks. */
  current: CohortSlice;
  /** Alignable prior cohorts, oldest → newest. */
  priors: CohortSlice[];
  /** Days-to-close the aligned window runs through. */
  anchorDay: number;
  /** Days elapsed since open — the window length every cohort is summed over. */
  elapsedDays: number;
  /** Date of the last day counted, ISO. */
  anchorDate: string;
  /** Cohorts found but skipped, with the reason — surfaced as a page note so a
   *  missing comparison is visible rather than silent. */
  skipped: string[];
}

const MAX_ROWS = 200;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[$,%]/g, ''));
  return isNaN(n) ? null : n;
}

function str(v: unknown): string {
  return String(v ?? '').trim();
}

/** Google's serial date (days since 1899-12-30) → ISO date. */
function serialToISO(serial: number | null): string | null {
  if (serial === null) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Map a sheet platform name onto the channel names the page reports. Anything
 *  unmapped (the Test/Employer line, Fall 2024's per-program columns) is
 *  ignored rather than guessed at. */
function channelFor(name: string): ChannelName | null {
  const t = name.trim().toLowerCase();
  if (t === 'google') return 'Google';
  if (t === 'bing' || t === 'microsoft') return 'Bing';
  if (t === 'fb' || t === 'facebook' || t === 'meta') return 'Meta';
  if (t === 'linkedin' || t === 'li') return 'LinkedIn';
  if (t === 'open ai' || t === 'openai') return 'Open AI';
  return null;
}

interface PlatformCols {
  channel: ChannelName;
  spend: number;
  /** -1 when the tab carries spend but no leads column for this platform. */
  leads: number;
  enrolls: number;
}

interface ParsedTab {
  label: string;
  tab: string;
  dayCol: number;
  dateCol: number;
  platforms: PlatformCols[];
  rows: unknown[][];
}

function parseTab(tab: string, grid: unknown[][]): ParsedTab | null {
  const header = (grid[0] ?? []).map(str);
  if (header.length === 0) return null;

  const dayCol = header.findIndex(h => /^(day|days out)$/i.test(h));
  const dateCol = header.findIndex(h => /^date$/i.test(h));
  if (dayCol < 0 || dateCol < 0) return null;

  const platforms: PlatformCols[] = [];
  header.forEach((h, i) => {
    const m = h.match(/^(.+?)\s+spend$/i);
    if (!m) return;
    const channel = channelFor(m[1]);
    if (!channel || platforms.some(p => p.channel === channel)) return;
    // The leads column is the NEXT one, when that one is a leads column at all
    // — never a name search, which would find the stray duplicate LinkedIn
    // leads column that sits before "LinkedIn Spend" in several tabs.
    const leads = /leads$/i.test(header[i + 1] ?? '') ? i + 1 : -1;
    const enrolls = header.findIndex(x => {
      const e = x.match(/^(.+?)\s+enrollments$/i);
      return e !== null && channelFor(e[1]) === channel;
    });
    platforms.push({ channel, spend: i, leads, enrolls });
  });
  if (platforms.length === 0) return null;

  const label = tab.replace(/\s+data$/i, '').trim();
  const rows = grid.slice(1).filter(r => num(r?.[dayCol]) !== null);
  if (rows.length === 0) return null;
  return { label, tab, dayCol, dateCol, platforms, rows };
}

/** Sum the cohort's FIRST `elapsedDays` days, counted from its own open — the
 *  row with the largest day-out value — so every cohort is compared at the same
 *  age. A cohort with fewer recorded days than that can't be aligned. */
function slice(p: ParsedTab, elapsedDays: number): CohortSlice | null {
  const dated = p.rows
    .map(r => ({ r, day: num(r[p.dayCol]) }))
    .filter((x): x is { r: unknown[]; day: number } => x.day !== null)
    .sort((a, b) => b.day - a.day);
  if (dated.length < elapsedDays) return null;
  const window = dated.slice(0, elapsedDays);

  const byChannel: Partial<Record<ChannelName, DailyTotals>> = {};
  for (const pl of p.platforms) {
    byChannel[pl.channel] = {
      spend: 0,
      leads: pl.leads >= 0 ? 0 : null,
      enrolls: pl.enrolls >= 0 ? 0 : null,
    };
  }

  const counted = window.length;
  const opens = serialToISO(num(window[0].r[p.dateCol]));
  for (const { r } of window) {
    for (const pl of p.platforms) {
      const t = byChannel[pl.channel]!;
      t.spend = (t.spend ?? 0) + (num(r[pl.spend]) ?? 0);
      if (pl.leads >= 0) t.leads = (t.leads ?? 0) + (num(r[pl.leads]) ?? 0);
      if (pl.enrolls >= 0) t.enrolls = (t.enrolls ?? 0) + (num(r[pl.enrolls]) ?? 0);
    }
  }
  if (counted === 0) return null;

  const total: DailyTotals = { spend: 0, leads: 0, enrolls: 0 };
  let sawLeads = false;
  let sawEnrolls = false;
  for (const t of Object.values(byChannel)) {
    total.spend = (total.spend ?? 0) + (t.spend ?? 0);
    if (t.leads !== null) { total.leads = (total.leads ?? 0) + t.leads; sawLeads = true; }
    if (t.enrolls !== null) { total.enrolls = (total.enrolls ?? 0) + t.enrolls; sawEnrolls = true; }
  }
  if (!sawLeads) total.leads = null;
  if (!sawEnrolls) total.enrolls = null;

  return { label: p.label, tab: p.tab, opens: opens ?? '', days: counted, byChannel, total };
}

/** Does this slice reproduce the figures the Paid WoW tab publishes? Leads are
 *  integers and spend is to the cent, so the tolerance is deliberately tight —
 *  the point is to catch a layout change, not to smooth one over. */
export function reconcile(
  current: CohortSlice,
  wow: Array<{ channel: ChannelName; leads: number | null; spend: number | null }>,
): string[] {
  const off: string[] = [];
  for (const w of wow) {
    const mine = current.byChannel[w.channel];
    if (!mine) {
      if ((w.leads ?? 0) > 0 || (w.spend ?? 0) > 0) {
        off.push(`${w.channel} is absent from "${current.tab}"`);
      }
      continue;
    }
    if (w.leads !== null && mine.leads !== null && Math.abs(w.leads - mine.leads) > 0.5) {
      off.push(`${w.channel} leads ${mine.leads} vs ${w.leads}`);
    }
    if (w.spend !== null && mine.spend !== null && Math.abs(w.spend - mine.spend) > 1) {
      off.push(`${w.channel} spend ${Math.round(mine.spend)} vs ${Math.round(w.spend)}`);
    }
  }
  return off;
}

export async function readCbsPaidDaily(
  docId: string,
  /** Cohort label from the doc title, e.g. "Fall 2026" — picks the current tab. */
  cohortLabel: string,
  auth: Parameters<typeof google.sheets>[0]['auth'],
): Promise<CbsPaidDaily | null> {
  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: docId,
    fields: 'sheets.properties.title',
  });
  const dataTabs = (meta.data.sheets ?? [])
    .map(s => s.properties?.title ?? '')
    .filter(t => /\sdata$/i.test(t));
  if (dataTabs.length === 0) return null;

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: docId,
    ranges: dataTabs.map(t => `'${t}'!A1:Z${MAX_ROWS}`),
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const parsed: ParsedTab[] = [];
  dataTabs.forEach((tab, i) => {
    const grid = (res.data.valueRanges?.[i]?.values ?? []) as unknown[][];
    const p = parseTab(tab, grid);
    if (p) parsed.push(p);
  });

  const wanted = cohortLabel.trim().toLowerCase();
  const currentTab = parsed.find(p => p.label.toLowerCase() === wanted);
  if (!currentTab) return null;

  // Anchor on the deepest day the current cohort has actual activity for, not
  // on today's date: the tab is updated in batches, and anchoring on today
  // would compare an un-filled current day against a full prior one. Days
  // beyond today are ignored outright so a pre-filled future row can't extend
  // the window.
  const today = nowET().toISOString().slice(0, 10);
  let anchorDay: number | null = null;
  let anchorDate: string | null = null;
  for (const r of currentTab.rows) {
    const day = num(r[currentTab.dayCol]);
    if (day === null) continue;
    const date = serialToISO(num(r[currentTab.dateCol]));
    if (date && date > today) continue;
    const active = currentTab.platforms.some(pl =>
      (num(r[pl.spend]) ?? 0) > 0 || (pl.leads >= 0 && (num(r[pl.leads]) ?? 0) > 0));
    if (!active) continue;
    if (anchorDay === null || day < anchorDay) { anchorDay = day; anchorDate = date; }
  }
  if (anchorDay === null) return null;

  // Days elapsed = rows from the cohort's own open down to the anchor.
  const currentMaxDay = Math.max(
    ...currentTab.rows.map(r => num(r[currentTab.dayCol]) ?? -Infinity),
  );
  const elapsedDays = currentMaxDay - anchorDay + 1;

  const current = slice(currentTab, elapsedDays);
  if (!current) return null;

  const skipped: string[] = [];
  const candidates = parsed
    .filter(p => p !== currentTab)
    .map(p => ({ p, s: slice(p, elapsedDays) }));
  for (const c of candidates) {
    if (!c.s) {
      skipped.push(`${c.p.label} (its daily tab has fewer than ${elapsedDays} days recorded)`);
    }
  }
  // Newest first by the cohort's own open date, then keep the two most recent —
  // the same shape as the Wharton tab's two prior-cohort columns.
  const priors = candidates
    .map(c => c.s)
    .filter((s): s is CohortSlice => s !== null)
    .sort((a, b) => (b.opens > a.opens ? 1 : b.opens < a.opens ? -1 : 0))
    .slice(0, 2)
    .reverse(); // oldest → newest, matching the page's column order

  return { current, priors, anchorDay, elapsedDays, anchorDate: anchorDate ?? '', skipped };
}
