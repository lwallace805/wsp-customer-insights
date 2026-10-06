// Client-safe shapes + constants for the Channel Performance dashboard.
// Kept separate from channelTables.ts so the client bundle never pulls in
// `googleapis` (same split as paidAggregateTypes.ts).

import type { PartnerKey } from './partners';

/** Which tier of the attribution model a view covers. Since the V2 model
 *  (Oct 2026) "paid" is the doc's own Paid tier — Paid Search, Paid Social,
 *  Paid Other, Paid Affiliate and Sponsored Content — not PPC alone. */
export type ChannelScope = 'all' | 'paid' | 'nonpaid';

export const CHANNEL_METRIC_KEYS = ['leads', 'enrollments', 'cvr'] as const;
export type ChannelMetricKey = (typeof CHANNEL_METRIC_KEYS)[number];

/** Canonical program keys shared with the paid-aggregate page, so one program
 *  selector can drive both the paid (funnel doc) and channel (cohort doc)
 *  views. Display names differ per surface; the key is the join. */
export type ProgramKey =
  | 'overall' | 'overall-no-rdi' | 'pe' | 're' | 'fpa' | 'avi' | 'rdi'
  /** The CBS AI certificate — the only program in the CBS cohort doc. */
  | 'ai';

/** The two tiers of the V2 attribution model ("Paid/Non-Paid" column). */
export type ChannelTier = 'paid' | 'nonpaid';

export interface ChannelSubRow {
  /** Sub-channel as written in the sheet's Leads section, e.g. "Google". */
  name: string;
  /** Aligned to the block's `cohorts` array. */
  leads: Array<number | null>;
  enrollments: Array<number | null>;
  /** Of `enrollments`, those whose lead was created inside that cohort's own
   *  enrollment window ("In Cohort" tab). The rest are carry-over: leads from
   *  earlier cohorts enrolling now. Null when the doc has no in-cohort tab. */
  inCohort: Array<number | null> | null;
}

export interface ChannelSeriesRow {
  /** Channel as written in the sheet's Leads section, e.g. "Paid Search". */
  channel: string;
  tier: ChannelTier;
  /** tier === 'paid' — kept as a flag because most callers only filter on it. */
  paid: boolean;
  /** Paid Search / Paid Social: the per-platform PPC slice that the Paid WoW
   *  tab and the Paid Marketing Aggregate page report. A subset of `paid`. */
  ppc: boolean;
  /** Aligned to the block's `cohorts` array. Where the channel has
   *  sub-channels these are their sum (see channelV2.ts for why). */
  leads: Array<number | null>;
  enrollments: Array<number | null>;
  /** See ChannelSubRow.inCohort. Sum of the subs' where there are subs. */
  inCohort: Array<number | null> | null;
  /** Sub-channels in sheet order. Empty when the channel is its own leaf
   *  ("Organic Search | Organic Search"); one entry for a channel that names a
   *  single sub-channel on its own row ("Paid Other | Employer Test"). */
  subs: ChannelSubRow[];
}

export interface ProgramChannelBlock {
  program: ProgramKey;
  /** Banner as written in the sheet, e.g. "PE". */
  displayName: string;
  /** Cohort column labels, oldest → current. A column is null throughout when
   *  the program predates that cohort (RDI before Spring 2026). */
  cohorts: string[];
  rows: ChannelSeriesRow[];
  /** The sheet's own Total rows, kept for reconciliation in the UI. */
  totals: { leads: Array<number | null>; enrollments: Array<number | null> };
  /** True when every row carries an in-cohort split. */
  hasInCohort: boolean;
}

/** One prior-cohort column checked against that cohort's own pacing curve. */
export interface AlignmentCheck {
  cohort: string;
  /** The column's enrollment total in the channel matrix. */
  value: number;
  /** Days before ITS deadline at which that cohort's pacing curve comes
   *  closest to `value`, and the curve's value there. */
  matchDay: number;
  matchValue: number;
  /** Days before the current cohort's deadline as of its last keyed day. */
  currentDay: number;
  ok: boolean;
}

/** One row of current-cohort economics from "Overall Performance Tables - V2".
 *  Only the three base figures are carried; every ratio (CPL, CPE, CVR, share)
 *  is derived in the UI from these, because the sheet's own ratio cells are
 *  formatted inconsistently across imported blocks (CBS's "% of Total" reads 0
 *  and its "Leads per Enroll" is formatted as currency). */
export interface ChannelEconFigures {
  enrolls: number | null;
  leads: number | null;
  /** Direct spend. Null for non-paid rows (none is recorded) and when withheld. */
  spend: number | null;
  /** The sheet HAS a spend figure here but it failed a consistency check
   *  (see ChannelTablesData.notes) — render "withheld", never "—" or $0. */
  spendWithheld: boolean;
  /** The sheet's spend here was a copy of another row's and was replaced with
   *  the Paid WoW tab's figure for the same program and platform (see notes).
   *  On a rollup: at least one part was. Rendered with a † marker. */
  spendCorrected?: boolean;
}

export interface ChannelEconSub extends ChannelEconFigures {
  name: string;
}

export interface ChannelEconRow extends ChannelEconFigures {
  channel: string;
  tier: ChannelTier;
  paid: boolean;
  ppc: boolean;
  subs: ChannelEconSub[];
}

export interface ProgramEconBlock {
  program: ProgramKey;
  displayName: string;
  rows: ChannelEconRow[];
  /** Computed from the rows (leaf-up), reconciled against the sheet's Total. */
  total: ChannelEconFigures | null;
}

/** To-date actual + forecast for one slice of one program, from the cohort
 *  doc's WoW tabs. */
export interface ForecastSide {
  leads: number | null;
  leadsF: number | null;
  enrolls: number | null;
  enrollsF: number | null;
}

export interface ProgramForecast {
  program: ProgramKey;
  /** All channels — "Overall WoW Performance & Goals" (newest version). */
  overall: ForecastSide | null;
  /** The Paid WoW tab (newest version) — the ad platforms only, i.e. the PPC
   *  slice, NOT the V2 Paid tier (which also counts affiliates, sponsored
   *  content and Employer Test). There is no forecast for the other tiers. */
  ppc: ForecastSide | null;
  /** Derived: overall − ppc, field by field. Under V2 this is NOT the
   *  Non-Paid tier — it also holds Paid Other, Paid Affiliate and Sponsored
   *  Content — so it is labelled "everything except PPC" wherever shown. */
  nonPpc: ForecastSide | null;
}

export interface ChannelTablesData {
  /** Which partner's docs this payload was read from. Echoed back so the page
   *  can't render one partner's numbers under another's pill. */
  partner: PartnerKey;
  programs: ProgramChannelBlock[];
  econ: ProgramEconBlock[];
  /** Empty when either WoW tab couldn't be read — the UI omits forecast rows
   *  rather than showing a partial or mixed-basis comparison. */
  forecasts: ProgramForecast[];
  /** Provenance of the forecast figures, e.g. the resolved tab names. */
  forecastSource: string | null;
  /** Reader-attached caveats about THIS payload: source-doc gaps that made a
   *  column unreadable, subtotals in the sheet that don't add up, spend that
   *  was withheld. Rendered prominently, because they explain why a figure on
   *  the page is "—" or differs from the sheet. Empty in the normal case. */
  notes: string[];
  /** Label of the current-cohort column, e.g. "Current Cohort". */
  currentLabel: string;
  docTitle: string;
  sheetId: string;
  /** Resolved tab names actually read, e.g. "Channel Tables V2". */
  tab: string;
  econTab: string;
  /** The in-cohort enrollments tab, when the doc has one and it parsed. */
  inCohortTab: string | null;
  /** Prior-cohort columns checked against the pacing sheet at the same
   *  days-to-deadline. Empty when no closed-cohort curve was reachable. */
  alignment: AlignmentCheck[];
  alignmentSource: string | null;
  fetchedAt: string;
}

/** Display names for program pills, matching the paid-aggregate page's style. */
export const PROGRAM_DISPLAY: Record<ProgramKey, string> = {
  overall: 'Overall',
  'overall-no-rdi': 'Overall (No RDI)',
  pe: 'PE',
  re: 'RE',
  fpa: 'FP&A',
  avi: 'AVI',
  rdi: 'RDI',
  ai: 'AI',
};

export const PROGRAM_ORDER: ProgramKey[] =
  ['overall', 'overall-no-rdi', 'pe', 're', 'fpa', 'avi', 'rdi', 'ai'];

/** Map a sheet banner / paid-aggregate program name to its canonical key. */
export function programKeyFor(name: string): ProgramKey | null {
  const t = name.trim().toLowerCase();
  // "Overall (No RDI)" in V1, "Overall (No - RDI)" in V2.
  if (/no\s*-?\s*rdi/.test(t)) return 'overall-no-rdi';
  if (t.startsWith('overall')) return 'overall';
  if (t === 'pe' || t.startsWith('private equity')) return 'pe';
  if (t === 're' || t.startsWith('real estate')) return 're';
  if (/^fp\s*&?\s*a/.test(t)) return 'fpa';
  // V2 economics tables use full names for the newer programs.
  if (t === 'avi' || t.startsWith('avi') || t.startsWith('applied value')) return 'avi';
  if (t === 'rdi' || t === 'rd' || t.startsWith('rdi') || /^rd\b/.test(t) ||
      t.startsWith('restructuring')) return 'rdi';
  // After AVI, so "AVI" can't be swallowed by the AI test.
  if (/^ai\b/.test(t)) return 'ai';
  return null;
}

/** Program keys with per-partner banner aliases applied first.
 *
 *  A single-program doc names its rollup table "Overall" even though the only
 *  thing in it is that one program — the CBS doc's economics table is bannered
 *  "Overall Performance". Left to `programKeyFor` that lands on 'overall' and
 *  the page shows a matrix with no economics under it. The alias map is what
 *  ties them together, and it is per-partner so a second CBS program later
 *  comes through as its own key rather than being folded into AI. */
export function resolveProgramKey(
  name: string,
  aliases?: Record<string, ProgramKey>,
): ProgramKey | null {
  const t = name.trim().toLowerCase();
  if (aliases) {
    for (const [alias, key] of Object.entries(aliases)) {
      if (t === alias || t.startsWith(`${alias} `)) return key;
    }
  }
  return programKeyFor(name);
}

// ─── Derived economics (shared by /channels and the paid-aggregate page) ──────

export interface EconMetrics {
  cvr: number | null;   // enrolls ÷ leads, fraction
  cpl: number | null;
  cpe: number | null;
  share: number | null; // of the block's total enrollments, fraction
}

/** Ratios from the base figures. A spend of exactly 0 means "no direct cost
 *  recorded" (Sponsored Content), so it yields no CPL/CPE rather than $0. */
export function econMetrics(f: ChannelEconFigures, totalEnrolls: number | null): EconMetrics {
  const div = (a: number | null, b: number | null) =>
    a === null || b === null || b === 0 ? null : a / b;
  const spend = f.spend !== null && f.spend > 0 ? f.spend : null;
  return {
    cvr: div(f.enrolls, f.leads),
    cpl: div(spend, f.leads),
    cpe: div(spend, f.enrolls),
    share: div(f.enrolls, totalEnrolls),
  };
}

/** Sum econ figures; spend is withheld if any part's spend was. Parts with no
 *  spend (non-paid rows) simply don't contribute to it. */
export function sumEcon(parts: ChannelEconFigures[]): ChannelEconFigures {
  const add = (k: 'enrolls' | 'leads') => {
    let any = false;
    let t = 0;
    for (const p of parts) if (p[k] !== null) { any = true; t += p[k]!; }
    return any ? t : null;
  };
  const withheld = parts.some(p => p.spendWithheld);
  let spend: number | null = null;
  if (!withheld) {
    for (const p of parts) if (p.spend !== null) spend = (spend ?? 0) + p.spend;
  }
  return {
    enrolls: add('enrolls'), leads: add('leads'), spend, spendWithheld: withheld,
    ...(!withheld && parts.some(p => p.spendCorrected) ? { spendCorrected: true } : {}),
  };
}
