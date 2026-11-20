// ─── Wharton — per-program, per-platform paid by DAY ──────────────────────────
//
// The weekly rows (whartonPaidWeekly.ts) can only say where a cohort stood at
// the end of a week. The cohort doc's daily "<Term> Data" tabs — the tabs the
// doc's own WoW tables are built from — carry the same split one row per day:
//
//   Date | … | PE Google Spend | RE Google Spend | … | PE Google Leads | … | PE Google Enrolls | …
//
// for every program × Google / Bing / FB / LI / Twitter. The Winter 2027 doc
// also keeps those tabs for earlier cohorts ("Winter 2026 Data", "Fall 2026
// Data", …), which is what lets a prior cohort be cut at exactly the same day
// from open as the current one.
//
// Layout traps, all handled by reading headers rather than positions:
//   • AVI is "Buy" in these headers; "Twitter" has no weekly block on the Paid
//     WoW tab (so it can't be reconciled) and is left out of the platforms.
//   • Rows are ragged: trailing empty cells are simply absent, and platform
//     enrollment cells are blank on most days. Blank = 0 within a keyed day.
//   • Rows run to the close date; unkeyed future days read $0.00 / 0, so the
//     last keyed day is the last one with any platform or program activity.
//   • Tabs differ: Winter 2026 counts days up from open and has no RDI columns,
//     Fall 2026 counts down. Days are matched by DATE, never by the day column.
//
// Nothing here is shown unchecked: reconcileDaily() compares the daily sums
// over each completed week against that cohort's own weekly rows, platform by
// platform and program by program, and the caller withholds what fails.

import type { ChannelName } from './paidAggregateTypes';
import { ZERO, addVol, type Vol, type WeeklyPaidTab } from './whartonPaidWeekly';

type Cell = unknown;
type Grid = Cell[][];

/** date (ISO) → platform → program → that day's actuals (forecast fields 0). */
export interface DailyPaidTab {
  tab: string;
  days: Map<string, Map<ChannelName, Map<string, Vol>>>;
  /** Last day with any paid or program activity. */
  lastKeyed: string | null;
  /** Programs the tab has platform columns for, in the weekly tab's labels. */
  programs: string[];
  /** date → running ALL-CHANNEL lead totals from the tab's cumulative columns:
   *  "Total Overall Leads" under `total`, and "<P> Overall Leads" (RDI's is
   *  headed "RDI Overall") under the weekly tab's program label. These carry
   *  forward on unkeyed days, so a value at a date is "as of" that date. */
  cumLeads: Map<string, Record<string, number>>;
}

function num(v: Cell): number {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s || s.startsWith('#')) return 0;
  const n = parseFloat(s.replace(/[$,%\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

const str = (v: Cell) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** A Sheets serial (unformatted read) or "M/D/YYYY" → ISO. */
function cellDate(v: Cell): string | null {
  if (typeof v === 'number' && v > 30000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  }
  const m = str(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
}

function platformOf(token: string): ChannelName | null {
  const t = token.toLowerCase();
  if (t === 'google') return 'Google';
  if (t === 'bing') return 'Bing';
  if (t === 'fb' || t === 'facebook' || t === 'meta') return 'Meta';
  if (t === 'li' || t === 'linkedin') return 'LinkedIn';
  return null; // Twitter / X: no weekly block to reconcile against
}

const norm = (p: string) => {
  const t = p.trim().toLowerCase();
  return t === 'buy' ? 'avi' : t;
};

/** Parse one daily tab. `programs` are the weekly tab's labels ("PE", "AVI", …)
 *  so both readers key programs identically. A string explains a rejection. */
export function parseDailyPaidTab(grid: Grid, tab: string, programs: string[]): DailyPaidTab | string {
  const header = (grid[0] ?? []).map(str);
  const cDate = header.findIndex(h => /^date$/i.test(h));
  if (cDate < 0) return `"${tab}" has no Date column`;

  const byNorm = new Map(programs.map(p => [norm(p), p]));
  const cols: Array<{ ch: ChannelName; program: string; kind: 'spend' | 'leads' | 'enrolls'; col: number }> = [];
  header.forEach((h, i) => {
    const m = h.match(/^(\S+)\s+(Google|Bing|FB|Facebook|Meta|LI|LinkedIn)\s+(Spend|Leads|Enrolls?|Enrollments?)$/i);
    if (!m) return;
    const program = byNorm.get(norm(m[1]));
    const ch = platformOf(m[2]);
    if (!program || !ch) return;
    const kind = /^spend$/i.test(m[3]) ? 'spend' : /^lead/i.test(m[3]) ? 'leads' : 'enrolls';
    cols.push({ ch, program, kind, col: i });
  });
  if (!cols.some(c => c.kind === 'leads')) return `"${tab}" has no "<program> <platform> Leads" columns`;
  // Program-level daily leads mark a keyed day even when no ad ran that day.
  const activity = header
    .map((h, i) => (/overall daily (leads|enrollments)$/i.test(h) ? i : -1))
    .filter(i => i >= 0);

  // Running all-channel lead totals. First match wins: these names are unique
  // in every layout seen, but "Daily Overall Leads" (not matched) repeats.
  const cumCols: Array<{ key: string; col: number }> = [];
  header.forEach((h, i) => {
    let key: string | null = null;
    if (/^total overall leads$/i.test(h)) key = 'total';
    else if (/^rdi overall$/i.test(h)) key = byNorm.get('rdi') ?? null;
    else {
      const m = h.match(/^(\S+) overall leads$/i);
      if (m) key = byNorm.get(norm(m[1])) ?? null;
    }
    if (key && !cumCols.some(c => c.key === key)) cumCols.push({ key, col: i });
  });

  const cumLeads = new Map<string, Record<string, number>>();
  const days = new Map<string, Map<ChannelName, Map<string, Vol>>>();
  let lastKeyed: string | null = null;
  for (const r of grid.slice(1)) {
    const date = cellDate(r?.[cDate]);
    if (!date) continue;
    if (cumCols.length) {
      const rec: Record<string, number> = {};
      for (const c of cumCols) rec[c.key] = num(r[c.col]);
      cumLeads.set(date, rec);
    }
    const day = new Map<ChannelName, Map<string, Vol>>();
    let active = activity.some(i => num(r[i]) !== 0);
    for (const c of cols) {
      const v = num(r[c.col]);
      if (v !== 0) active = true;
      const per = day.get(c.ch) ?? new Map<string, Vol>();
      const cur = per.get(c.program) ?? ZERO;
      per.set(c.program, {
        ...cur,
        spend: cur.spend + (c.kind === 'spend' ? v : 0),
        leads: cur.leads + (c.kind === 'leads' ? v : 0),
        enrolls: cur.enrolls + (c.kind === 'enrolls' ? v : 0),
      });
      day.set(c.ch, per);
    }
    days.set(date, day);
    if (active && (!lastKeyed || date > lastKeyed)) lastKeyed = date;
  }
  const present = [...new Set(cols.map(c => c.program))];
  return { tab, days, lastKeyed, programs: programs.filter(p => present.includes(p)), cumLeads };
}

export function isoAddDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function dayCount(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
}

/** Sum `members` on one platform over [from, to]. Null when the tab has no
 *  column for any of those programs on that platform (not running ≠ zero). */
export function sumDaily(
  tab: DailyPaidTab, ch: ChannelName, members: string[], from: string, to: string,
): Vol | null {
  let seen = false;
  let acc = ZERO;
  tab.days.forEach((day, date) => {
    const per = day.get(ch);
    if (!per) return;
    for (const p of members) {
      const v = per.get(p);
      if (!v) continue;
      seen = true;
      if (date >= from && date <= to) acc = addVol(acc, v);
    }
  });
  return seen ? acc : null;
}

/** Week number → ISO start/end, from the weekly tab's year-less ranges, rolled
 *  forward a year whenever the month goes backwards (Winter crosses New Year). */
export function weekDates(ranges: Map<number, string>, opensYmd: string): Map<number, { start: string; end: string }> {
  let year = Number(opensYmd.slice(0, 4));
  let prevMonth = Number(opensYmd.slice(5, 7));
  const out = new Map<number, { start: string; end: string }>();
  const iso = (y: number, mo: number, d: number) =>
    `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  for (const wk of [...ranges.keys()].sort((a, b) => a - b)) {
    const m = ranges.get(wk)!.match(/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/);
    if (!m) continue;
    const [sm, sd, em, ed] = m.slice(1).map(Number);
    let sy = year;
    if (sm < prevMonth) sy = year = year + 1;
    let ey = sy;
    if (em < sm) ey = year = sy + 1;
    prevMonth = em;
    out.set(wk, { start: iso(sy, sm, sd), end: iso(ey, em, ed) });
  }
  return out;
}

/** Forecast through `through`: whole weeks that ended by then, plus the week
 *  containing it pro-rated by days elapsed ÷ days in that week. Actual fields 0. */
export function forecastThrough(
  weekly: WeeklyPaidTab, dates: Map<number, { start: string; end: string }>,
  ch: ChannelName, members: string[], through: string,
): Vol | null {
  const byProgram = weekly.weekly.get(ch);
  if (!byProgram) return null;
  let seen = false;
  let acc = ZERO;
  for (const p of members) {
    const weeks = byProgram.get(p);
    if (!weeks) continue;
    seen = true;
    weeks.forEach((v, wk) => {
      const d = dates.get(wk);
      if (!d || d.start > through) return;
      const share = d.end <= through ? 1 : dayCount(d.start, through) / dayCount(d.start, d.end);
      acc = addVol(acc, { ...ZERO, spendF: v.spendF * share, leadsF: v.leadsF * share, enrollsF: v.enrollsF * share });
    });
  }
  return seen ? acc : null;
}

/** Daily sums over each completed week (end ≤ `upTo`) vs the weekly rows, per
 *  platform × program. Returns the mismatches; empty = the two readers agree. */
export function reconcileDaily(
  daily: DailyPaidTab, weekly: WeeklyPaidTab, dates: Map<number, { start: string; end: string }>,
  channels: ChannelName[], upTo: string,
): { checked: number; off: string[] } {
  const off: string[] = [];
  let checked = 0;
  const close = (a: number, b: number, money: boolean) =>
    Math.abs(a - b) <= (money ? Math.max(1, Math.abs(b) * 0.005) : 0.5);
  for (const ch of channels) {
    const byProgram = weekly.weekly.get(ch);
    if (!byProgram) continue;
    byProgram.forEach((weeks, prog) => {
      if (!daily.programs.includes(prog)) {
        // Weekly rows with activity that the daily tab has no column for.
        let any = 0;
        weeks.forEach((v, wk) => { const d = dates.get(wk); if (d && d.end <= upTo) any += v.leads + v.spend; });
        if (any > 0) off.push(`${ch} ${prog}: no daily columns`);
        return;
      }
      weeks.forEach((v, wk) => {
        const d = dates.get(wk);
        if (!d || d.end > upTo) return;
        checked++;
        const s = sumDaily(daily, ch, [prog], d.start, d.end) ?? ZERO;
        const bad: string[] = [];
        if (!close(s.spend, v.spend, true)) bad.push(`spend $${Math.round(s.spend).toLocaleString()} vs $${Math.round(v.spend).toLocaleString()}`);
        if (!close(s.leads, v.leads, false)) bad.push(`leads ${s.leads} vs ${v.leads}`);
        if (!close(s.enrolls, v.enrolls, false)) bad.push(`enrollments ${s.enrolls} vs ${v.enrolls}`);
        if (bad.length) off.push(`wk ${wk} ${ch} ${prog} ${bad.join(', ')}`);
      });
    });
  }
  return { checked, off };
}

/** Weekly actuals summed over the weeks `keep` accepts, forecast fields 0. */
function sumWeeksWhere(
  weekly: WeeklyPaidTab, ch: ChannelName, members: string[],
  keep: (wk: number) => boolean,
): Vol | null {
  const byProgram = weekly.weekly.get(ch);
  if (!byProgram) return null;
  let seen = false;
  let acc = ZERO;
  for (const p of members) {
    const weeks = byProgram.get(p);
    if (!weeks) continue;
    seen = true;
    weeks.forEach((v, wk) => {
      if (keep(wk)) acc = addVol(acc, { ...v, spendF: 0, leadsF: 0, enrollsF: 0 });
    });
  }
  return seen ? acc : null;
}

/** Weekly rows for every week that has STARTED by `through` — the week in
 *  progress included, as keyed so far. This is the tab's own to-date basis. */
export function sumWeeksStarted(
  weekly: WeeklyPaidTab, dates: Map<number, { start: string; end: string }>,
  ch: ChannelName, members: string[], through: string,
): Vol | null {
  return sumWeeksWhere(weekly, ch, members, wk => {
    const d = dates.get(wk);
    return !!d && d.start <= through;
  });
}

/** Whole weeks that ended by `to` from the weekly rows, plus the days after
 *  them up to `to` from the daily tab — a prior cohort cut at an exact day. */
export function sumWeeksThenDays(
  weekly: WeeklyPaidTab, daily: DailyPaidTab, dates: Map<number, { start: string; end: string }>,
  ch: ChannelName, members: string[], from: string, to: string,
): Vol | null {
  let lastEnd = '';
  dates.forEach(d => { if (d.end <= to && d.end > lastEnd) lastEnd = d.end; });
  const whole = lastEnd
    ? sumWeeksWhere(weekly, ch, members, wk => {
        const d = dates.get(wk);
        return !!d && d.end <= lastEnd;
      })
    : null;
  const restFrom = lastEnd ? isoAddDays(lastEnd, 1) : from;
  const rest = restFrom <= to ? sumDaily(daily, ch, members, restFrom, to) : null;
  if (!whole && !rest) return null;
  return addVol(whole ?? ZERO, rest ?? ZERO);
}

/** Platform totals over the completed weeks (end ≤ `upTo`), daily vs weekly.
 *  A gap beyond 1% — and beyond $25 / 1 lead / 1 enrollment — is material:
 *  the daily tab is missing data at a scale that would move a platform. */
export function materialGaps(
  daily: DailyPaidTab, weekly: WeeklyPaidTab, dates: Map<number, { start: string; end: string }>,
  channels: ChannelName[], upTo: string,
  /** Which figures must agree — a leads-only view needn't fail on spend. */
  metrics: Array<'spend' | 'leads' | 'enrolls'> = ['spend', 'leads', 'enrolls'],
): string[] {
  const out: string[] = [];
  const far = (a: number, b: number, floor: number) => Math.abs(a - b) > Math.max(floor, Math.abs(b) * 0.01);
  const want = new Set(metrics);
  for (const ch of channels) {
    const byProgram = weekly.weekly.get(ch);
    if (!byProgram) continue;
    let w = ZERO;
    let d = ZERO;
    byProgram.forEach((weeks, prog) => {
      weeks.forEach((v, wk) => {
        const r = dates.get(wk);
        if (!r || r.end > upTo) return;
        w = addVol(w, v);
        d = addVol(d, sumDaily(daily, ch, [prog], r.start, r.end) ?? ZERO);
      });
    });
    if (want.has('spend') && far(d.spend, w.spend, 25)) out.push(`${ch} spend $${Math.round(d.spend).toLocaleString()} vs $${Math.round(w.spend).toLocaleString()}`);
    if (want.has('leads') && far(d.leads, w.leads, 1)) out.push(`${ch} leads ${d.leads} vs ${w.leads}`);
    if (want.has('enrolls') && far(d.enrolls, w.enrolls, 1)) out.push(`${ch} enrollments ${d.enrolls} vs ${w.enrolls}`);
  }
  return out;
}
