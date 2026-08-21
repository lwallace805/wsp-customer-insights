// Client-safe shapes + constants for the Channel Performance dashboard.
// Kept separate from channelTables.ts so the client bundle never pulls in
// `googleapis` (same split as paidAggregateTypes.ts).

export type ChannelScope = 'all' | 'paid' | 'nonpaid';

export const CHANNEL_METRIC_KEYS = ['leads', 'enrollments', 'cvr'] as const;
export type ChannelMetricKey = (typeof CHANNEL_METRIC_KEYS)[number];

/** Canonical program keys shared with the paid-aggregate page, so one program
 *  selector can drive both the paid (funnel doc) and channel (cohort doc)
 *  views. Display names differ per surface; the key is the join. */
export type ProgramKey =
  | 'overall' | 'overall-no-rdi' | 'pe' | 're' | 'fpa' | 'avi' | 'rdi';

export interface ChannelSeriesRow {
  /** Channel label as written in the sheet's Leads block, e.g. "PPC". */
  channel: string;
  /** True only for PPC — the house definition of "paid" (the four ad
   *  platforms). Sponsored Content and Paid Affiliates carry spend but are
   *  reported outside the paid rollup everywhere else, so they stay non-paid
   *  here and are flagged with `hasSpend` instead. */
  paid: boolean;
  hasSpend: boolean;
  /** Aligned to the block's `cohorts` array. */
  leads: Array<number | null>;
  enrollments: Array<number | null>;
}

export interface ProgramChannelBlock {
  program: ProgramKey;
  /** Banner as written in the sheet, e.g. "Private Equity". */
  displayName: string;
  /** Cohort column labels, oldest → current. RDI has fewer (launched Spring 2026). */
  cohorts: string[];
  rows: ChannelSeriesRow[];
  /** The sheet's own Totals rows, kept for reconciliation in the UI. */
  totals: { leads: Array<number | null>; enrollments: Array<number | null> };
}

/** Current-cohort channel economics from "Overall Performance Tables".
 *  ROAS is deliberately omitted: the sheet computes it against a revenue
 *  constant that varies by row ($4,500 gross vs $2,700 net), so the values
 *  aren't comparable — see readChannelTable in src/lib/sheets.ts. */
export interface ChannelEconRow {
  channel: string;
  /** True for the ads row ("Ads - Google / FB / LI / Other") — same paid
   *  definition as the matrix rows. */
  paid: boolean;
  enrolls: number | null;
  pct: number | null;   // % of the program's total enrollments, fraction
  leads: number | null;
  spend: number | null;
  cpl: number | null;
  cpe: number | null;
  cvr: number | null;   // Lead:Enroll, fraction
}

export interface ProgramEconBlock {
  program: ProgramKey;
  displayName: string;
  rows: ChannelEconRow[];
  total: ChannelEconRow | null;
}

/** To-date actual + forecast for one slice (all / paid / non-paid) of one
 *  program, from the cohort doc's WoW tabs. */
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
  /** Paid — "Paid WoW Performance & Goals" (newest version). */
  paid: ForecastSide | null;
  /** Derived: overall − paid, field by field, when both sides are present. */
  nonpaid: ForecastSide | null;
}

export interface ChannelTablesData {
  programs: ProgramChannelBlock[];
  econ: ProgramEconBlock[];
  /** Empty when either WoW tab couldn't be read — the UI omits forecast rows
   *  rather than showing a partial or mixed-basis comparison. */
  forecasts: ProgramForecast[];
  /** Provenance of the forecast figures, e.g. the resolved tab names. */
  forecastSource: string | null;
  /** Label of the current-cohort column, e.g. "Current Cohort". */
  currentLabel: string;
  docTitle: string;
  sheetId: string;
  tab: string;
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
};

export const PROGRAM_ORDER: ProgramKey[] =
  ['overall', 'overall-no-rdi', 'pe', 're', 'fpa', 'avi', 'rdi'];

/** Map a sheet banner / paid-aggregate program name to its canonical key. */
export function programKeyFor(name: string): ProgramKey | null {
  const t = name.trim().toLowerCase();
  if (/no\s*rdi/.test(t)) return 'overall-no-rdi';
  if (t.startsWith('overall')) return 'overall';
  if (t === 'pe' || t.startsWith('private equity')) return 'pe';
  if (t === 're' || t.startsWith('real estate')) return 're';
  if (/^fp\s*&?\s*a/.test(t)) return 'fpa';
  if (t === 'avi' || t.startsWith('avi')) return 'avi';
  if (t === 'rdi' || t === 'rd' || t.startsWith('rdi') || /^rd\b/.test(t)) return 'rdi';
  return null;
}
