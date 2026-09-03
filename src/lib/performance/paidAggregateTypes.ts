// Client-safe shapes + constants for the Paid Marketing Aggregate dashboard.
// Kept separate from paidAggregate.ts so the client bundle never pulls in
// `googleapis` (which needs node builtins and breaks the browser build).

import type { PartnerKey } from './partners';

export const METRIC_KEYS = ['leads', 'spend', 'enrollments', 'cpl', 'cpe', 'cvr'] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

// "Open AI" runs on the CBS AI cohort only; the Wharton funnel doc has no such
// column and simply yields no row for it.
export const CHANNELS = ['Google', 'Bing', 'Meta', 'LinkedIn', 'Open AI'] as const;
export type ChannelName = (typeof CHANNELS)[number];

export interface MetricRow {
  channel: ChannelName | 'Total';
  /** Week-aligned prior cohorts. Null throughout on a partner whose doc
   *  publishes no per-platform prior-cohort columns — see `hasPriors`. */
  priorA: number | null;   // e.g. Winter 2026, week-aligned
  priorB: number | null;   // e.g. Spring 2026, week-aligned (immediately prior)
  actual: number | null;   // current cohort to date
  forecast: number | null; // current cohort forecast to date
}

export interface MetricBlock {
  key: MetricKey;
  label: string;                 // as written in the sheet, e.g. "CVR (L2E)"
  rows: MetricRow[];             // 4 channels + Total
  diffVsForecast: number | null; // sheet's own value, decimal fraction
  diffCoC: number | null;        // sheet's own value, decimal fraction
}

export interface ProgramBlock {
  name: string;                  // "Overall", "PE", …
  metrics: Record<MetricKey, MetricBlock | null>;
}

export interface PaidAggregateData {
  partner: PartnerKey;
  cohortLabel: string;           // "Fall 2026" — derived from the doc title
  week: number | null;           // B1
  priorLabels: [string, string]; // ["Winter 2026", "Spring 2026"]
  /** False when the source doc carries no prior-cohort paid columns (CBS). The
   *  page hides the prior columns and the cohort-over-cohort deltas rather than
   *  filling them from a second source on a different basis — the paid CoC
   *  comparison for those partners lives on /channels, where the whole matrix
   *  comes from one tab. */
  hasPriors: boolean;
  programs: ProgramBlock[];
  /** Anything the reader needs the page to say about this partner's basis,
   *  rendered as an extra footnote. */
  notes: string[];
  docTitle: string;
  sheetId: string;
  tab: string;
  fetchedAt: string;
}
