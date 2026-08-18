// Client-safe shapes + constants for the Paid Marketing Aggregate dashboard.
// Kept separate from paidAggregate.ts so the client bundle never pulls in
// `googleapis` (which needs node builtins and breaks the browser build).

export const METRIC_KEYS = ['leads', 'spend', 'enrollments', 'cpl', 'cpe', 'cvr'] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export const CHANNELS = ['Google', 'Bing', 'Meta', 'LinkedIn'] as const;
export type ChannelName = (typeof CHANNELS)[number];

export interface MetricRow {
  channel: ChannelName | 'Total';
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
  cohortLabel: string;           // "Fall 2026" — derived from the doc title
  week: number | null;           // B1
  priorLabels: [string, string]; // ["Winter 2026", "Spring 2026"]
  programs: ProgramBlock[];
  docTitle: string;
  sheetId: string;
  tab: string;
  fetchedAt: string;
}
