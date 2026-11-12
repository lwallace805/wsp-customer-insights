// ─── Wharton — per-program, per-platform paid by WEEK ─────────────────────────
//
// The Wharton cohort doc's "Paid WoW Performance & Goals V2" tab carries, under
// its to-date blocks, one "Overall Performance by Week" block per ad platform
// (Google | Bing | Meta | LinkedIn), each listing every week of the cohort as a
// week-total row followed by one indented row per program:
//
//   Week | Date Range   | Spend (Actual) | Spend (Forecast) | Leads … | Enrollments …
//   4    | 11/3-11/9    | $43,280        | $49,050          | …
//        |    PE        | $8,975         | $9,350           | …
//        |    RE        | …
//
// Closed cohorts keep the same tab, and the Wharton funnel-analysis doc holds a
// copy of each one as "Paid Data_<cohort>" — the tabs the old "Paid Marketing
// Aggregate" view summed with `week <= B1`. Parsing one layout therefore gives
// the current cohort AND its priors on a single basis, week by week, which is
// what lets every column on /paid-aggregate cover exactly the same weeks.
//
// Why PROGRAM rows and not the week-total row: the total row also carries
// brand campaigns tagged to no program (Winter 2027 week 2: $27,056 total vs
// $22,830 across the five programs; leads and enrollments are fully
// attributed). The program rows are what the funnel doc's aggregate summed,
// so "Overall" here is program-attributed paid, as it always was on this page.
//
// Layout traps handled:
//   • Program rows carry their label in the DATE RANGE column, indented with
//     spaces ("   PE") in the 2026-27 docs and bare ("PE") in Winter 2026, which
//     also repeats the week number on every program row. The week is taken
//     from the row when present, else from the week-total row above it.
//   • The Google block has an extra "Week Start" column to the left of "Week";
//     columns are resolved by header name inside each block, never by offset.
//   • Each weekly block sits in the same column as its platform's to-date
//     banner ("Google" / "Bing" / …), which is how a block is tied to a
//     platform — the weekly banners themselves all read "Overall Performance by
//     Week". "Paid Total Weekly" (2026-27 docs only) bounds the last block.
//   • Winter 2026 ran no RDI program; a program a tab doesn't list is reported
//     as absent (null), never as zero.
//
// Every parse is checked against the same tab's to-date block: summed over all
// weeks, each platform × program must reproduce that block's spend, leads and
// enrollments. `reconcileWeekly()` reports any that don't, and the caller says
// so on the page rather than showing a column built on rows that miss data.

import type { ChannelName } from './paidAggregateTypes';

export const WHARTON_PAID_CHANNELS: ChannelName[] = ['Google', 'Bing', 'Meta', 'LinkedIn'];

type Grid = unknown[][];

/** Cumulative volumes; ratios are always derived from these, never summed. */
export interface Vol {
  spend: number; spendF: number;
  leads: number; leadsF: number;
  enrolls: number; enrollsF: number;
}

export const ZERO: Vol = { spend: 0, spendF: 0, leads: 0, leadsF: 0, enrolls: 0, enrollsF: 0 };

export function addVol(a: Vol, b: Vol): Vol {
  return {
    spend: a.spend + b.spend, spendF: a.spendF + b.spendF,
    leads: a.leads + b.leads, leadsF: a.leadsF + b.leadsF,
    enrolls: a.enrolls + b.enrolls, enrollsF: a.enrollsF + b.enrollsF,
  };
}

/** To-date figures from the tab's per-platform blocks, used to verify the
 *  weekly parse and to state how much spend sits outside the program rows. */
export interface TopRow { spend: number | null; leads: number | null; enrolls: number | null }

export interface WeeklyPaidTab {
  /** Program labels in tab order, from the to-date blocks ("PE", "RE", …). */
  programs: string[];
  /** platform → program → to-date row. */
  top: Map<ChannelName, Map<string, TopRow>>;
  /** platform → its "Total (All)" to-date row (includes unattributed brand). */
  topTotals: Map<ChannelName, TopRow>;
  /** platform → program → week → volumes. */
  weekly: Map<ChannelName, Map<string, Map<number, Vol>>>;
  /** week → date range as the tab writes it ("11/3-11/9"). */
  ranges: Map<number, string>;
}

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

function platformFor(label: string): ChannelName | null {
  const t = label.toLowerCase();
  if (t === 'google') return 'Google';
  if (t === 'bing' || t === 'microsoft' || t === 'microsoft ads') return 'Bing';
  if (t === 'meta' || t === 'facebook') return 'Meta';
  if (t === 'linkedin' || t === 'linked in') return 'LinkedIn';
  return null;
}

const DATE_RANGE = /^\d{1,2}\/\d{1,2}\s*-\s*\d{1,2}\/\d{1,2}$/;
const WEEKLY_BANNER = /overall performance by week/i;

/** Column resolver scoped to [from, to), so the Meta block's "Spend (Actual)"
 *  can never be satisfied by the Google block's identically named column. */
function finder(header: unknown[], from: number, to: number) {
  return (...needles: string[]) => {
    for (let i = from; i < to; i++) {
      const h = S(header[i]).toLowerCase();
      if (h !== '' && needles.every(n => h.includes(n))) return i;
    }
    return -1;
  };
}

function volCols(find: ReturnType<typeof finder>) {
  return {
    spend: find('spend', 'actual'), spendF: find('spend', 'forecast'),
    leads: find('leads', 'actual'), leadsF: find('leads', 'forecast'),
    enrolls: find('enrollment', 'actual'), enrollsF: find('enrollment', 'forecast'),
  };
}

/** Parse one Paid WoW-shaped tab. Returns a string describing what's missing
 *  when the layout isn't recognised, so the caller can name it on the page. */
export function parseWeeklyPaidTab(grid: Grid): WeeklyPaidTab | string {
  // ── Platform banner row: the first row naming two or more platforms ──
  let bannerRow = -1;
  const bannerCols = new Map<ChannelName, number>();
  for (let r = 0; r < Math.min(grid.length, 40) && bannerRow < 0; r++) {
    const found = new Map<ChannelName, number>();
    (grid[r] ?? []).forEach((v, c) => {
      const ch = platformFor(S(v));
      if (ch && !found.has(ch)) found.set(ch, c);
    });
    if (found.size >= 2) {
      bannerRow = r;
      found.forEach((c, ch) => bannerCols.set(ch, c));
    }
  }
  if (bannerRow < 0) return 'no platform banner row (Google / Bing / Meta / LinkedIn)';
  const missing = WHARTON_PAID_CHANNELS.filter(ch => !bannerCols.has(ch));
  if (missing.length) return `no ${missing.join(' / ')} block`;

  const order = WHARTON_PAID_CHANNELS
    .map(ch => ({ ch, col: bannerCols.get(ch)! }))
    .sort((a, b) => a.col - b.col);

  // ── To-date blocks: header row under the banner, program rows below it ──
  const hdr = grid[bannerRow + 1] ?? [];
  const top = new Map<ChannelName, Map<string, TopRow>>();
  const topTotals = new Map<ChannelName, TopRow>();
  const programs: string[] = [];
  order.forEach(({ ch, col }, k) => {
    const end = k + 1 < order.length ? order[k + 1].col : col + 21;
    const c = volCols(finder(hdr, col, end));
    const rows = new Map<string, TopRow>();
    for (let i = bannerRow + 2; i < Math.min(bannerRow + 16, grid.length); i++) {
      const label = S(grid[i]?.[col]);
      if (!label || label.startsWith('*')) break;
      const row: TopRow = {
        spend: N(grid[i]?.[c.spend]), leads: N(grid[i]?.[c.leads]), enrolls: N(grid[i]?.[c.enrolls]),
      };
      if (/^total\s*(\(all\))?$/i.test(label)) { topTotals.set(ch, row); continue; }
      if (/^total/i.test(label)) continue; // "Total (No RDI)" restates the same spend
      rows.set(label, row);
      if (!programs.includes(label)) programs.push(label);
    }
    top.set(ch, rows);
  });
  if (programs.length === 0) return 'no program rows under the platform blocks';
  const programSet = new Set(programs);

  // ── Weekly blocks ──
  let wRow = -1;
  for (let r = bannerRow + 2; r < grid.length && wRow < 0; r++) {
    if ((grid[r] ?? []).some(v => WEEKLY_BANNER.test(S(v)))) wRow = r;
  }
  if (wRow < 0) return 'no "Overall Performance by Week" blocks';
  // Every labelled cell on the weekly banner row bounds the block to its left
  // (this is where "Paid Total Weekly" stops the LinkedIn block).
  const stops = (grid[wRow] ?? [])
    .map((v, c) => (S(v) ? c : -1))
    .filter(c => c >= 0)
    .sort((a, b) => a - b);

  const wHdr = grid[wRow + 1] ?? [];
  const weekly = new Map<ChannelName, Map<string, Map<number, Vol>>>();
  const ranges = new Map<number, string>();
  for (const { ch, col } of order) {
    if (!WEEKLY_BANNER.test(S(grid[wRow]?.[col]))) {
      return `no weekly block under ${ch} (expected "Overall Performance by Week" in the same column)`;
    }
    const end = stops.find(c => c > col) ?? col + 21;
    const find = finder(wHdr, col, end);
    let weekC = -1;
    for (let i = col; i < end && weekC < 0; i++) if (S(wHdr[i]).toLowerCase() === 'week') weekC = i;
    const dateC = find('date range');
    const c = volCols(find);
    if (weekC < 0 || dateC < 0 || c.spend < 0 || c.leads < 0 || c.enrolls < 0) {
      return `${ch} weekly block is missing a Week / Date Range / actual column`;
    }

    const byProgram = new Map<string, Map<number, Vol>>();
    let current: number | null = null;
    for (let r = wRow + 2; r < grid.length; r++) {
      const row = grid[r] ?? [];
      const label = S(row[dateC]);
      const wk = N(row[weekC]);
      if (DATE_RANGE.test(label)) {
        if (wk !== null) {
          current = wk;
          if (!ranges.has(wk)) ranges.set(wk, label);
        }
        continue;
      }
      if (!programSet.has(label)) continue;
      const week = wk ?? current;
      if (week === null) continue;
      const v: Vol = {
        spend: N(row[c.spend]) ?? 0, spendF: c.spendF >= 0 ? N(row[c.spendF]) ?? 0 : 0,
        leads: N(row[c.leads]) ?? 0, leadsF: c.leadsF >= 0 ? N(row[c.leadsF]) ?? 0 : 0,
        enrolls: N(row[c.enrolls]) ?? 0, enrollsF: c.enrollsF >= 0 ? N(row[c.enrollsF]) ?? 0 : 0,
      };
      const weeks = byProgram.get(label) ?? new Map<number, Vol>();
      weeks.set(week, addVol(weeks.get(week) ?? ZERO, v));
      byProgram.set(label, weeks);
    }
    weekly.set(ch, byProgram);
  }
  if (ranges.size === 0) return 'no dated weeks in the weekly blocks';

  return { programs, top, topTotals, weekly, ranges };
}

/** Sum `programs` on one platform over weeks 1..`through`. Null when the tab
 *  lists none of those programs on that platform (not running ≠ zero). */
export function sumWeeks(
  tab: WeeklyPaidTab, channel: ChannelName, programs: string[], through: number,
): Vol | null {
  const byProgram = tab.weekly.get(channel);
  if (!byProgram) return null;
  let seen = false;
  let acc = ZERO;
  for (const p of programs) {
    const weeks = byProgram.get(p);
    if (!weeks) continue;
    seen = true;
    weeks.forEach((v, wk) => { if (wk <= through) acc = addVol(acc, v); });
  }
  return seen ? acc : null;
}

/** Platform × program cells whose all-weeks sum no longer reproduces the
 *  tab's own to-date block, described for a page note. Empty = reconciled. */
export function reconcileWeekly(tab: WeeklyPaidTab): string[] {
  const off: string[] = [];
  const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005);
  tab.top.forEach((rows, ch) => {
    rows.forEach((t, prog) => {
      const sum = sumWeeks(tab, ch, [prog], Infinity) ?? ZERO;
      const checks: Array<[string, number, number | null]> = [
        ['spend', sum.spend, t.spend], ['leads', sum.leads, t.leads], ['enrollments', sum.enrolls, t.enrolls],
      ];
      for (const [m, got, want] of checks) {
        if (want !== null && !close(got, want)) {
          off.push(`${ch} ${prog} ${m} ${Math.round(got).toLocaleString()} vs ${Math.round(want).toLocaleString()}`);
        }
      }
    });
  });
  return off;
}

/** The last week whose end date has passed, plus the week in progress, read
 *  off the tab's own date ranges. The ranges carry no year, so it is rolled
 *  forward from the cohort's open date whenever the month goes backwards
 *  (Winter cohorts cross New Year). The sheet's ranges decide the weeks — the
 *  calendar's getCohortWeek() counts 7-day blocks from the open date and can
 *  disagree with the sheet by a day. */
export function weekStatus(
  ranges: Map<number, string>, opensYmd: string, today: Date,
): { complete: number; inProgress: { week: number; range: string } | null } {
  const midnight = new Date(today);
  midnight.setHours(0, 0, 0, 0);
  let year = Number(opensYmd.slice(0, 4));
  let prevMonth = Number(opensYmd.slice(5, 7));
  let complete = 0;
  let inProgress: { week: number; range: string } | null = null;
  for (const wk of [...ranges.keys()].sort((a, b) => a - b)) {
    const range = ranges.get(wk)!;
    const m = range.match(/-\s*(\d{1,2})\/(\d{1,2})/);
    if (!m) continue;
    const month = Number(m[1]);
    if (month < prevMonth) year += 1;
    prevMonth = month;
    const end = new Date(year, month - 1, Number(m[2]));
    if (end.getTime() < midnight.getTime()) complete = wk;
    else if (!inProgress) inProgress = { week: wk, range };
  }
  return { complete, inProgress };
}
