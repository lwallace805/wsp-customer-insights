// ─── Paid Marketing Aggregate — live reader ───────────────────────────────────
//
// Six metrics (leads, spend, enrollments, CPL, CPE, CVR) × ad platform × program,
// actual vs forecast for the cohort open now, beside two prior cohorts at the
// same point. One payload shape, two partners, each built from its own docs:
//
//   Wharton — summed from the WEEKLY program rows of the active cohort doc's
//             "Paid WoW Performance & Goals V2" tab, and from the same tab's
//             copies for prior cohorts. See getWhartonPaidAggregate below and
//             whartonPaidWeekly.ts for the layout.
//   CBS AI  — assembled from the CBS cohort doc's Paid WoW channel blocks, with
//             priors from its daily per-cohort tabs. See getCbsPaidAggregate.
//
// Until Nov 2026 the Wharton side read the "Paid Marketing Aggregate" tab of the
// "Wharton Fall 2026 Funnel Analysis" doc. That tab is pinned to Fall 2026 (its
// Current Cohort column SUMIFs the Fall doc), there is no Winter 2027 funnel
// doc, and its prior columns hung off a hand-typed week cell (B1) that went
// stale. Reading the cohort doc through the registry rotates with the cohort,
// and the weekly rows let every column cover the same completed weeks.

import { google } from 'googleapis';
import { readPaidWoW, PAID_WOW_BASE_TAB, resolveVersionedTab } from '@/lib/sheets';
import type { PaidRow } from '@/lib/sheets';
import { cbsChannelDocId } from './channelTables';
import {
  COHORT_WINDOWS, getActiveCohort, getCohortBefore, getCohortWeek, nowET, todayET,
  type CohortWindow,
} from '@/lib/cohortCalendar';
import {
  parseDailyPaidTab, sumDaily, forecastThrough, reconcileDaily, weekDates,
  isoAddDays, dayCount, sumWeeksStarted, sumWeeksThenDays, materialGaps, type DailyPaidTab,
} from './whartonPaidDaily';
import { COHORT_SHEETS, getActiveCohortSheet } from '@/lib/cohortSheets';
import { readCbsPaidDaily, reconcile } from './cbsPaidDaily';
import type { CohortSlice, DailyTotals } from './cbsPaidDaily';
import {
  parseWeeklyPaidTab, reconcileWeekly, sumWeeks, weekStatus, WHARTON_PAID_CHANNELS,
  ZERO, addVol, type Vol, type WeeklyPaidTab,
} from './whartonPaidWeekly';
import type { PartnerKey } from './partners';

/** The Wharton funnel-analysis doc. No longer read for the current cohort —
 *  only for its "Paid Data_<cohort>" tabs, copies of each closed cohort's Paid
 *  WoW tab, which is where Winter 2026's weekly paid rows still live. */
export const WHARTON_PAID_HISTORY_DOC_ID =
  process.env.WHARTON_FUNNEL_DOC_ID ?? '148mFYadfpPLFRVvo6hm4WHZhanUMmK18T2r9c5MlnVc';

/** Which doc backs each partner's paid view — the one a "share it with the
 *  service account" prompt should name. */
export function paidAggregateDocId(partner: PartnerKey): string {
  if (partner === 'cbs') return cbsChannelDocId();
  return getActiveCohortSheet('wharton')?.sheetId ?? WHARTON_PAID_HISTORY_DOC_ID;
}

export type {
  MetricKey, ChannelName, MetricRow, MetricBlock, ProgramBlock, PaidAggregateData,
} from './paidAggregateTypes';
import type {
  MetricKey, ChannelName, MetricRow, MetricBlock, ProgramBlock, PaidAggregateData, PaidBasis,
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

function cohortFromTitle(title: string): string {
  const m = title.match(/(Fall|Spring|Winter|Summer)\s*(20\d\d)/i);
  return m ? `${m[1]} ${m[2]}` : 'Current cohort';
}

export async function getPaidAggregate(
  partner: PartnerKey = 'wharton',
  /** Wharton only: 'day' = through the last keyed day (default), 'week' =
   *  through the last completed week. CBS is already day-aligned. */
  basis: PaidBasis = 'day',
): Promise<AggregateResult> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return { ok: false, needsAccess: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY is not set' };
  }
  return partner === 'cbs' ? getCbsPaidAggregate() : getWhartonPaidAggregate(basis);
}

const METRIC_LABELS: Record<MetricKey, string> = {
  leads: 'Leads', spend: 'Spend', enrollments: 'Enrollments',
  cpl: 'CPL', cpe: 'CPE', cvr: 'CVR (L2E)',
};

// ─── Wharton — summed from the cohort docs' weekly program rows ──────────────
//
// Current cohort: the doc the registry maps the open Wharton cohort to
// (getActiveCohortSheet), at the newest version of its "Paid WoW Performance &
// Goals" tab. Priors: the same season a year earlier (Winter 2026 beside
// Winter 2027 — its weeks cross the holidays the way this cohort's will) and
// the immediately prior cohort (Fall 2026), oldest first, so the immediately
// prior one drives the page's cohort-over-cohort delta. A prior's tab is the
// funnel doc's "Paid Data_<cohort>" copy when one exists, else the Paid WoW tab
// of that cohort's own doc from the registry — so Spring 2027 will find Winter
// 2027 in its cohort doc with no code change.
//
// Every column — actual, forecast and both priors — is the sum of weeks 1..N,
// N being the last week the CURRENT cohort has completed by the tab's own date
// ranges. The tab's to-date block also counts the week in progress; putting
// that part-week beside whole prior weeks is the mismatch that skewed the old
// view's deltas, so the in-progress week is stated in a note instead.
//
// Verified 11/12/26 against the Winter 2027 doc: summed over every week, the
// weekly rows reproduce the tab's to-date block exactly (Paid Total $114,240 /
// 1,132 leads / 12 enrollments). reconcileWeekly() reruns that check per
// platform × program on every read, for the current cohort and each prior.

const RDI = /^rdi$/i;

function metricOf(v: Vol | null, key: MetricKey, side: 'actual' | 'forecast'): number | null {
  if (!v) return null;
  const spend = side === 'actual' ? v.spend : v.spendF;
  const leads = side === 'actual' ? v.leads : v.leadsF;
  const enrolls = side === 'actual' ? v.enrolls : v.enrollsF;
  switch (key) {
    case 'leads':       return leads;
    case 'spend':       return spend;
    case 'enrollments': return enrolls;
    case 'cpl':         return gated(ratio(spend, leads), leads);
    case 'cpe':         return gated(ratio(spend, enrolls), enrolls);
    case 'cvr':         return gated(ratio(enrolls, leads), leads);
  }
}

/** Each platform's sum over `members`, weeks 1..`through`, plus their total.
 *  A platform the tab lists none of those programs on stays null. */
function volsFor(tab: WeeklyPaidTab, members: string[], through: number) {
  const byChannel = new Map<ChannelName, Vol | null>();
  let total: Vol | null = null;
  for (const ch of WHARTON_PAID_CHANNELS) {
    const v = sumWeeks(tab, ch, members, through);
    byChannel.set(ch, v);
    if (v) total = addVol(total ?? ZERO, v);
  }
  return { byChannel, total };
}

/** The same season one year before `w` — "Winter 2026" for Winter 2027. */
function sameSeasonLastYear(w: CohortWindow): CohortWindow | null {
  const m = w.termLabel.match(/^(\w+)\s+(\d{4})$/);
  if (!m) return null;
  const want = `${m[1]} ${Number(m[2]) - 1}`;
  return COHORT_WINDOWS.find(x => x.family === w.family && x.termLabel === want) ?? null;
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const count = (n: number) => Math.round(n).toLocaleString();
const dashed = (range: string) => range.replace(/\s*-\s*/, '–');

interface LoadedPrior { label: string; win: CohortWindow; tab: WeeklyPaidTab; source: string }

/** Find, read, parse and verify each prior cohort's weekly tab. A prior that
 *  can't be found, parsed, reconciled, or doesn't reach week `through` is left
 *  out and described in `problems` — never shown on a basis we couldn't check. */
async function loadWhartonPriors(
  sheets: ReturnType<typeof google.sheets>,
  wins: CohortWindow[],
  through: number,
): Promise<{ loaded: LoadedPrior[]; problems: string[] }> {
  let historyTabs: string[] = [];
  let historyTitle = 'the Wharton funnel-analysis doc';
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: WHARTON_PAID_HISTORY_DOC_ID,
      fields: 'properties.title,sheets.properties.title',
    });
    historyTitle = meta.data.properties?.title?.trim() || historyTitle;
    historyTabs = (meta.data.sheets ?? [])
      .map(s => s.properties?.title ?? '')
      .filter(Boolean);
  } catch {
    // Unreadable history doc → each prior falls through to its own cohort doc.
  }

  const results = await Promise.all(wins.map(async (w): Promise<LoadedPrior | string> => {
    const label = w.termLabel;
    const copy = historyTabs.find(t =>
      t.trim().toLowerCase().startsWith(`paid data_${label.toLowerCase()}`));
    let docId: string;
    let tab: string;
    let source: string;
    if (copy) {
      docId = WHARTON_PAID_HISTORY_DOC_ID;
      tab = copy;
      source = `“${copy}” in ${historyTitle}`;
    } else {
      const own = COHORT_SHEETS[w.key]?.sheetId();
      if (!own) return `${label}: no weekly paid tab found (no “Paid Data_${label}” tab and no cohort doc registered)`;
      docId = own;
      tab = await resolveVersionedTab(own, PAID_WOW_BASE_TAB);
      source = `“${tab}” in the ${label} cohort doc`;
    }
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: docId,
        range: `'${tab}'!A1:CZ220`,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
      const parsed = parseWeeklyPaidTab((res.data.values ?? []) as unknown[][]);
      if (typeof parsed === 'string') return `${label}: ${source} not recognised (${parsed})`;
      const off = reconcileWeekly(parsed);
      if (off.length > 0) {
        return `${label} is withheld: summed over every week, ${source} no longer reproduces ` +
          `its own to-date block (${off.slice(0, 3).join('; ')}${off.length > 3 ? '; …' : ''})`;
      }
      const lastWeek = Math.max(...parsed.ranges.keys());
      if (lastWeek < through) return `${label} is withheld: ${source} records only ${lastWeek} weeks`;
      return { label, win: w, tab: parsed, source };
    } catch (err: unknown) {
      return `${label}: ${source} could not be read (${(err as Error)?.message ?? String(err)})`;
    }
  }));

  return {
    loaded: results.filter((r): r is LoadedPrior => typeof r !== 'string'),
    problems: results.filter((r): r is string => typeof r === 'string'),
  };
}

type Vols = { byChannel: Map<ChannelName, Vol | null>; total: Vol | null };

/** Combine per-platform volumes into a Vols, summing the non-null ones. */
function volsOf(get: (ch: ChannelName) => Vol | null): Vols {
  const byChannel = new Map<ChannelName, Vol | null>();
  let total: Vol | null = null;
  for (const ch of WHARTON_PAID_CHANNELS) {
    const v = get(ch);
    byChannel.set(ch, v);
    if (v) total = addVol(total ?? ZERO, v);
  }
  return { byChannel, total };
}

function buildBlocks(
  programs: string[],
  now: (members: string[]) => Vols,
  a: ((members: string[]) => Vols) | null,
  b: ((members: string[]) => Vols) | null,
): ProgramBlock[] {
  const groups: { name: string; members: string[] }[] = [
    { name: 'Overall', members: programs },
    ...(programs.some(p => RDI.test(p))
      ? [{ name: 'Overall (No RDI)', members: programs.filter(p => !RDI.test(p)) }]
      : []),
    ...programs.map(p => ({ name: p, members: [p] })),
  ];
  return groups.map(({ name, members }) => {
    const n = now(members);
    const pa = a ? a(members) : null;
    const pb = b ? b(members) : null;
    const metrics = {} as Record<MetricKey, MetricBlock | null>;
    for (const key of METRIC_KEYS) {
      const rows: MetricRow[] = WHARTON_PAID_CHANNELS.map(ch => ({
        channel: ch,
        priorA: metricOf(pa?.byChannel.get(ch) ?? null, key, 'actual'),
        priorB: metricOf(pb?.byChannel.get(ch) ?? null, key, 'actual'),
        actual: metricOf(n.byChannel.get(ch) ?? null, key, 'actual'),
        forecast: metricOf(n.byChannel.get(ch) ?? null, key, 'forecast'),
      }));
      rows.push({
        channel: 'Total',
        priorA: metricOf(pa?.total ?? null, key, 'actual'),
        priorB: metricOf(pb?.total ?? null, key, 'actual'),
        actual: metricOf(n.total, key, 'actual'),
        forecast: metricOf(n.total, key, 'forecast'),
      });
      // The cohort doc has no "% Diff" rows; the page derives attainment
      // and the CoC delta from the columns themselves.
      metrics[key] = { key, label: METRIC_LABELS[key], rows, diffVsForecast: null, diffCoC: null };
    }
    return { name, metrics };
  });
}

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

// ─── Wharton through the last keyed day ─────────────────────────────────────
//
// The same metric blocks, cut at a DAY rather than a week:
//   • Current actual — the Paid WoW weekly rows for every week begun by the
//     cut-off day (the week in progress as keyed so far): the tab's own to-date
//     basis. The daily "<Term> Data" tab decides that day (its last keyed day,
//     never today — a half-keyed today would read as behind) and must agree
//     with the in-progress weekly row, or the page falls back to completed
//     weeks. The daily tab isn't summed for the current cohort because it can
//     miss cells the weekly rows have (11/20/26: RDI Bing spend blank, $154
//     over weeks 4–5); those gaps are listed in a note instead.
//   • Forecast — the weekly forecast for whole weeks ended by then, plus the
//     week in progress pro-rated by days elapsed ÷ days in that week. Verified
//     11/20/26: spend and leads reproduce the tab's own to-date forecast
//     (program rows $152,665.86 / 2,278); its to-date enrollment forecast read
//     18 against 16.3 pro-rated, so the tab computes that one differently.
//   • Priors — cut at the same day N from open: whole weeks from the prior's
//     weekly paid rows, the days after them from its daily tab in this doc.
//     A prior whose daily tab misses its weekly rows by more than 1% on any
//     platform is withheld. Winter 2026 and Fall 2026 matched exactly on
//     11/20/26 (day 37).
/** Notes both bases share: programs a shown prior never ran, the
 *  program-attributed scope, any weekly reconciliation gap, ratio gating. */
function programNotes(cur: WeeklyPaidTab, programs: string[], shown: LoadedPrior[]): string[] {
  const notes: string[] = [];
  for (const p of shown) {
    const absent = programs.filter(prog =>
      WHARTON_PAID_CHANNELS.every(ch => !p.tab.weekly.get(ch)?.has(prog)));
    if (absent.length > 0) {
      notes.push(
        `${p.label} ran no ${absent.join(' / ')} program, so its column is blank there and its ` +
        `Overall covers ${programs.length - absent.length} programs` +
        (absent.every(x => RDI.test(x)) ? ' — “Overall (No RDI)” compares like-for-like.' : '.'),
      );
    }
  }
  let tabAll = 0;
  let tabPrograms = 0;
  cur.topTotals.forEach(t => { tabAll += t.spend ?? 0; });
  cur.top.forEach(rows => rows.forEach(t => { tabPrograms += t.spend ?? 0; }));
  notes.push(
    `Program-attributed paid only: figures are the sum of the ${programs.join(', ')} rows, so ` +
    'brand campaigns tagged to no program are excluded' +
    (tabAll > tabPrograms
      ? ` — to date the tab’s “Total (All)” spend is ${money(tabAll)} against ` +
        `${money(tabPrograms)} across the program rows.`
      : '.'),
  );
  const off = reconcileWeekly(cur);
  if (off.length > 0) {
    notes.push(
      'Heads up: summed over every week, the weekly rows no longer reproduce the tab’s to-date ' +
      `block for ${off.slice(0, 4).join('; ')}${off.length > 4 ? `; and ${off.length - 4} more` : ''}. ` +
      'The figures here follow the weekly rows.',
    );
  }
  notes.push(
    'CPL, CPE and CVR are computed from the summed volumes and shown only where the ' +
    'denominator exists, so a platform with no enrollments yet reads “—”, not $0.',
  );
  return notes;
}

interface DailyView {
  blocks: ProgramBlock[];
  through: string;
  day: number;
  priorLabels: [string, string];
  hasPriors: boolean;
  notes: string[];
}

async function buildWhartonDaily(
  sheets: ReturnType<typeof google.sheets>,
  docId: string,
  titles: string[],
  win: CohortWindow,
  cur: WeeklyPaidTab,
  priors: LoadedPrior[],
): Promise<DailyView | string> {
  const dailyTab = `${win.termLabel} Data`;
  if (!titles.includes(dailyTab)) return `the cohort doc has no “${dailyTab}” tab`;

  // One read for the current tab and every prior tab this doc carries.
  const priorTabs = priors.map(p => `${p.label} Data`);
  const ranges = [dailyTab, ...priorTabs.filter(t => titles.includes(t))];
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: docId,
    ranges: ranges.map(t => `'${t}'!A1:FZ260`),
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const gridOf = (t: string) => {
    const i = ranges.indexOf(t);
    return i < 0 ? null : ((res.data.valueRanges?.[i]?.values ?? []) as unknown[][]);
  };

  const curDaily = parseDailyPaidTab(gridOf(dailyTab)!, dailyTab, cur.programs);
  if (typeof curDaily === 'string') return curDaily;
  if (!curDaily.lastKeyed) return `“${dailyTab}” has no keyed days yet`;

  const yesterday = isoAddDays(todayET(), -1);
  const through = curDaily.lastKeyed < yesterday ? curDaily.lastKeyed : yesterday;
  if (through < win.opens) return 'no day of this cohort has been keyed yet';
  const day = dayCount(win.opens, through);
  const dates = weekDates(cur.ranges, win.opens);

  // Current cohort: the Paid WoW weekly rows for every week that has started —
  // the in-progress week as keyed so far — which is exactly the tab's own
  // to-date basis. The daily tab only says which day that is. If today is
  // already partly keyed, today's daily figures come back off.
  let inProgress: { wk: number; start: string; end: string } | null = null;
  dates.forEach((d, wk) => { if (d.start <= through && through < d.end) inProgress = { wk, ...d }; });
  const lastKeyed = curDaily.lastKeyed;
  const trimFrom = isoAddDays(through, 1);
  if (inProgress) {
    // The daily tab and the in-progress weekly row must agree on how far the
    // week is keyed, or "through <day>" would be a guess.
    const ip = inProgress as { wk: number; start: string; end: string };
    let dLeads = 0;
    let wLeads = 0;
    for (const ch of WHARTON_PAID_CHANNELS) {
      dLeads += (sumDaily(curDaily, ch, cur.programs, ip.start, lastKeyed) ?? ZERO).leads;
      cur.weekly.get(ch)?.forEach(weeks => { wLeads += weeks.get(ip.wk)?.leads ?? 0; });
    }
    if (Math.abs(dLeads - wLeads) > Math.max(2, wLeads * 0.02)) {
      return `week ${ip.wk} so far reads ${wLeads} paid leads on the Paid WoW tab but ${dLeads} on ` +
        `“${dailyTab}”, so the day it is keyed through can’t be confirmed`;
    }
  }
  const cells = reconcileDaily(curDaily, cur, dates, WHARTON_PAID_CHANNELS, through);

  const notes: string[] = [];
  const okPriors: Array<{ label: string; weekly: WeeklyPaidTab; daily: DailyPaidTab; dates: Map<number, { start: string; end: string }>; from: string; to: string }> = [];
  for (const p of priors) {
    const t = `${p.label} Data`;
    const grid = gridOf(t);
    if (!grid) { notes.push(`${p.label}: no “${t}” tab in the ${win.termLabel} cohort doc`); continue; }
    const pd = parseDailyPaidTab(grid, t, p.tab.programs);
    if (typeof pd === 'string') { notes.push(`${p.label}: ${pd}`); continue; }
    const to = isoAddDays(p.win.opens, day - 1);
    if (!pd.lastKeyed || pd.lastKeyed < to) { notes.push(`${p.label}: “${t}” doesn’t reach day ${day}`); continue; }
    const pDates = weekDates(p.tab.ranges, p.win.opens);
    const gaps = materialGaps(pd, p.tab, pDates, WHARTON_PAID_CHANNELS, to);
    if (gaps.length > 0) {
      notes.push(`${p.label} is withheld: over its completed weeks, “${t}” doesn’t match ${p.source} ` +
        `(${gaps.slice(0, 3).join('; ')}${gaps.length > 3 ? `; and ${gaps.length - 3} more` : ''})`);
      continue;
    }
    okPriors.push({ label: p.label, weekly: p.tab, daily: pd, dates: pDates, from: p.win.opens, to });
  }

  const now = (members: string[]) => volsOf(ch => {
    const wk = sumWeeksStarted(cur, dates, ch, members, through);
    const fc = forecastThrough(cur, dates, ch, members, through);
    if (!wk && !fc) return null;
    let a = wk ?? ZERO;
    if (lastKeyed > through) {
      const t = sumDaily(curDaily, ch, members, trimFrom, lastKeyed) ?? ZERO;
      a = { ...a, spend: a.spend - t.spend, leads: a.leads - t.leads, enrolls: a.enrolls - t.enrolls };
    }
    const f = fc ?? ZERO;
    return { spend: a.spend, leads: a.leads, enrolls: a.enrolls, spendF: f.spendF, leadsF: f.leadsF, enrollsF: f.enrollsF };
  });
  const priorFn = (pr: (typeof okPriors)[number]) =>
    (members: string[]) => volsOf(ch => sumWeeksThenDays(pr.weekly, pr.daily, pr.dates, ch, members, pr.from, pr.to));
  const pa = okPriors.length > 1 ? okPriors[0] : null;
  const pb = okPriors.length > 0 ? okPriors[okPriors.length - 1] : null;

  const ipNote = inProgress
    ? ` — week ${(inProgress as { wk: number }).wk} counted as keyed so far`
    : '';
  const outNotes: string[] = [
    `Through ${shortDate(through)}, day ${day} of the cohort (open ${shortDate(win.opens)}). The current cohort is ` +
    `the Paid WoW weekly rows for every week begun by then${ipNote}, the same basis as the tab’s own to-date ` +
    `block. “${dailyTab}” sets the keyed-through day; today is never counted.`,
    'Forecast = the weekly forecast for weeks already ended, plus the current week’s forecast × days elapsed ÷ ' +
    'days in the week. Spend and leads reproduce the tab’s own to-date forecast; enrollments are pro-rated the ' +
    'same way and can differ slightly from the tab’s own enrollment forecast, which it calculates differently.',
  ];
  if (okPriors.length > 0) {
    outNotes.push(
      `${okPriors.map(p => `${p.label} (${shortDate(p.from)}–${shortDate(p.to)})`).join(' and ')} ` +
      `${okPriors.length > 1 ? 'are' : 'is'} cut at the same day ${day} from open: whole weeks from each cohort’s ` +
      'weekly paid rows, the remaining days from its daily tab in this doc. Each daily tab matches its weekly ' +
      'rows platform by platform over the weeks it replaces.',
    );
  }
  if (cells.off.length > 0) {
    outNotes.push(
      `For Jon: “${dailyTab}” is short of the Paid WoW weekly rows in ${cells.off.length} of ${cells.checked} ` +
      `platform × program weeks (${cells.off.join('; ')}). The figures above use the weekly rows, so they are unaffected.`,
    );
  }
  if (notes.length > 0) outNotes.push(`Not shown for comparison: ${notes.join('; ')}.`);

  return {
    blocks: buildBlocks(cur.programs, now, pa ? priorFn(pa) : null, pb ? priorFn(pb) : null),
    through,
    day,
    priorLabels: [pa?.label ?? '', pb?.label ?? ''],
    hasPriors: okPriors.length > 0,
    notes: outNotes,
  };
}

async function getWhartonPaidAggregate(basis: PaidBasis): Promise<AggregateResult> {
  const active = getActiveCohortSheet('wharton');
  if (!active) {
    return {
      ok: false,
      needsAccess: false,
      error: 'No cohort performance doc is registered for the Wharton cohort open now ' +
        '(src/lib/cohortSheets.ts).',
    };
  }
  const { sheetId: docId, win } = active;
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    // The metadata call is what surfaces a 403/404 as needsAccess.
    const [meta, tab] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: docId, fields: 'properties.title,sheets.properties.title' }),
      resolveVersionedTab(docId, PAID_WOW_BASE_TAB),
    ]);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: docId,
      range: `'${tab}'!A1:CZ220`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const cur = parseWeeklyPaidTab((res.data.values ?? []) as unknown[][]);
    if (typeof cur === 'string') {
      return { ok: false, needsAccess: false, error: `“${tab}” layout not recognised: ${cur}` };
    }

    const { complete, inProgress } = weekStatus(cur.ranges, win.opens, nowET());
    // In a cohort's first days no week has closed: show week 1 to date, alone.
    const through = complete >= 1 ? complete : (inProgress?.week ?? 1);
    const programs = cur.programs;
    const notes: string[] = [];

    // ── Priors, oldest first ──
    const priorWins = [sameSeasonLastYear(win), getCohortBefore(win)]
      .filter((w): w is CohortWindow => w !== null)
      .filter((w, i, all) => all.findIndex(x => x.key === w.key) === i)
      .sort((a, b) => a.opens.localeCompare(b.opens));
    let priors: LoadedPrior[] = [];
    if ((complete >= 1 || basis === 'day') && priorWins.length > 0) {
      const { loaded, problems } = await loadWhartonPriors(sheets, priorWins, through);
      priors = loaded;
      if (problems.length > 0) notes.push(`Not shown for comparison: ${problems.join('; ')}.`);
    }
    // Week basis: no prior comparison until a week of this cohort has closed.
    const weekPriors = complete >= 1 ? priors : [];
    const priorA = weekPriors.length > 1 ? weekPriors[0] : null;
    const priorB = weekPriors.length > 0 ? weekPriors[weekPriors.length - 1] : null;

    // ── Program blocks ──
    const blocks: ProgramBlock[] = buildBlocks(
      programs,
      m => volsFor(cur, m, through),
      priorA ? m => volsFor(priorA.tab, m, through) : null,
      priorB ? m => volsFor(priorB.tab, m, through) : null,
    );

    // ── Through the last keyed day (default view) ──
    const docTitle = meta.data.properties?.title?.trim() ?? `${win.termLabel} Cohort Performance Doc`;
    let fallback: string | null = null;
    if (basis === 'day') {
      const titles = (meta.data.sheets ?? []).map(x => x.properties?.title ?? '');
      const daily = await buildWhartonDaily(sheets, docId, titles, win, cur, priors);
      if (typeof daily !== 'string') {
        return {
          ok: true,
          data: {
            partner: 'wharton',
            cohortLabel: win.termLabel,
            week: null,
            weekRange: null,
            basis: 'day',
            throughDate: daily.through,
            cohortDay: daily.day,
            basisFallback: null,
            priorLabels: daily.priorLabels,
            hasPriors: daily.hasPriors,
            programs: daily.blocks,
            notes: [...daily.notes, ...programNotes(cur, programs, priors.filter(p => daily.priorLabels.includes(p.label)))],
            docTitle,
            sheetId: docId,
            tab: `${win.termLabel} Data`,
            fetchedAt: new Date().toISOString(),
          },
        };
      }
      fallback = `Through-yesterday view unavailable: ${daily}. Showing completed weeks instead.`;
    }

    // ── Notes: the basis, stated with this read's own numbers ──
    const range = cur.ranges.get(through);
    notes.unshift(
      complete >= 1
        ? `Every column is summed from the weekly program rows of “${tab}” in the ` +
          `${win.termLabel} cohort doc: weeks 1–${through} of each cohort` +
          `${range ? ` (this cohort’s week ${through} is ${dashed(range)})` : ''}, the last week ` +
          'this cohort has completed. Actual, forecast and each prior cohort cover the same ' +
          'weeks, so every comparison is like-for-like.'
        : `No week of this cohort has closed yet, so these are week 1 to date from “${tab}”, ` +
          'against the whole week’s forecast. Prior cohorts appear once week 1 closes.',
    );
    if (complete >= 1 && inProgress) {
      const upTo = volsFor(cur, programs, inProgress.week).total ?? ZERO;
      const before = volsFor(cur, programs, inProgress.week - 1).total ?? ZERO;
      notes.push(
        `Week ${inProgress.week} (${dashed(inProgress.range)}) is in progress and is left out ` +
        `until it closes — so far ${money(upTo.spend - before.spend)} spend, ` +
        `${count(upTo.leads - before.leads)} leads and ${count(upTo.enrolls - before.enrolls)} ` +
        'enrollments across the programs. The to-date figures at the top of the tab include it.',
      );
    }
    if (weekPriors.length > 0) {
      const names = weekPriors.map(p => p.label);
      const same = sameSeasonLastYear(win)?.termLabel;
      notes.push(
        `${names.join(' and ')} ${names.length > 1 ? 'are' : 'is'} summed the same way through ` +
        `week ${through}, from ${weekPriors.map(p => p.source).join(' and ')}. ` +
        (same && names.includes(same)
          ? `${same} is the same season a year earlier (its weeks run through the same holidays); `
          : '') +
        `${priorB!.label} is the immediately prior cohort, so “vs ${priorB!.label}” compares against it.`,
      );
    }
    notes.push(...programNotes(cur, programs, weekPriors));

    return {
      ok: true,
      data: {
        partner: 'wharton',
        cohortLabel: win.termLabel,
        week: through,
        weekRange: range ? dashed(range) : null,
        basis: 'week',
        throughDate: null,
        cohortDay: null,
        basisFallback: fallback,
        priorLabels: [priorA?.label ?? '', priorB?.label ?? ''],
        hasPriors: weekPriors.length > 0,
        programs: blocks,
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
  const docId = cbsChannelDocId();
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
        label: METRIC_LABELS[key],
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
