// Client-safe shapes for the partner Cohort Dashboard (/cohort-dashboard) —
// the hub's rebuild of the HubSpot "Wharton Winter 2027 Cohort Dashboard" and
// "Fall 2026 Cohort Dashboard - AI" reports on the cohort docs' data instead of
// HubSpot's. Kept apart from cohortDashboard.ts so the client bundle never
// pulls in `googleapis`.

import type { PartnerKey } from './partners';
import type { ProgramKey } from './channelTablesTypes';

/** Where a lead or enrollment came from, at the grain the daily tabs record it.
 *  The ad platforms are the V2 attribution model's paid sub-channels (Paid
 *  Search → Google/Bing, Paid Social → Meta/LinkedIn/X, Paid Other → Open AI /
 *  Employer Test). `other` is everything else — the cohort total minus those
 *  platforms — because the daily tabs carry no per-day split of the non-PPC
 *  channels. Their full breakdown exists only cohort-to-date (Channel Tables V2). */
export type SourceKey =
  | 'google' | 'bing' | 'meta' | 'linkedin' | 'twitter' | 'openai' | 'employer' | 'other';

export interface SourceMeta {
  key: SourceKey;
  label: string;
  /** The V2 channel this sub-channel rolls up to, e.g. "Paid Search". */
  channel: string;
  color: string;
}

/** Display order and colours. Paid platforms first (search, social, other),
 *  the residual last so it stacks on top.
 *
 *  Colours are the dataviz reference palette's dark steps, one fixed slot per
 *  source so a source keeps its colour across partners and filters. Slot order
 *  is what keeps adjacent stack segments apart for colour-blind readers; both
 *  stacks that exist today were run through the skill's validator against the
 *  card surface #161b22 and pass every check:
 *    Wharton  Google·Bing·Meta·LinkedIn·Other             (slots 1,2,3,4,7)
 *    CBS      Google·Bing·Meta·LinkedIn·OpenAI·Employer·Other (slots 1–7)
 *  "All other channels" takes slot 7, not a neutral gray: a gray failed the
 *  normal-vision floor beside LinkedIn's yellow. X/Twitter (slot 8) has never
 *  carried data; re-run the validator if it starts to. */
export const SOURCE_META: Record<SourceKey, SourceMeta> = {
  google:   { key: 'google',   label: 'Google',   channel: 'Paid Search', color: '#3987e5' },
  bing:     { key: 'bing',     label: 'Bing',     channel: 'Paid Search', color: '#d95926' },
  meta:     { key: 'meta',     label: 'Meta',     channel: 'Paid Social', color: '#199e70' },
  linkedin: { key: 'linkedin', label: 'LinkedIn', channel: 'Paid Social', color: '#c98500' },
  twitter:  { key: 'twitter',  label: 'X / Twitter', channel: 'Paid Social', color: '#e66767' },
  openai:   { key: 'openai',   label: 'Open AI',  channel: 'Paid Other', color: '#d55181' },
  employer: { key: 'employer', label: 'Employer Test', channel: 'Paid Other', color: '#008300' },
  other:    { key: 'other',    label: 'All other channels', channel: 'Everything except ad platforms', color: '#9085e9' },
};

export const SOURCE_ORDER: SourceKey[] =
  ['google', 'bing', 'meta', 'linkedin', 'twitter', 'openai', 'employer', 'other'];

/** One program's counts for one day, split by source. The sources always sum
 *  to the program's total for that day — `other` is the remainder. */
export type SourceCounts = Partial<Record<SourceKey, number>>;

export interface DayRow {
  /** ISO date, ET business day. */
  date: string;
  /** program → source → count. */
  leads: Partial<Record<ProgramKey, SourceCounts>>;
  enrolls: Partial<Record<ProgramKey, SourceCounts>>;
}

/** A reporting week as the cohort doc's own WoW tab defines it, so every
 *  weekly bar here can be checked against that tab's row for the same week.
 *  Wharton: a partial opening week, then Monday–Sunday. CBS: seven-day blocks
 *  from the Tuesday the cohort opened. */
export interface WeekDef {
  week: number;
  /** ISO dates, inclusive. */
  start: string;
  end: string;
}

/** One reconciliation of the daily tab against another part of the doc. */
export interface SourceCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface ProgramMeta {
  key: ProgramKey;
  label: string;
  color: string;
}

export interface CohortDashboardData {
  partner: PartnerKey;
  cohort: {
    key: string;
    /** Marketing label, e.g. "Winter '27". */
    label: string;
    /** "Winter 2027" — the daily tab is named "<termLabel> Data". */
    termLabel: string;
    opens: string;
    /** Extended-enrollment end, the cohort's true close. */
    closes: string;
  };
  docTitle: string;
  sheetId: string;
  dailyTab: string;
  wowTab: string | null;
  /** Last day with anything keyed. Days after it are omitted, not zero. */
  throughDate: string | null;
  /** Today in ET. */
  asOf: string;
  programs: ProgramMeta[];
  /** Sources that carry at least one lead or enrollment, in display order. */
  sources: SourceKey[];
  days: DayRow[];
  /** Empty when the WoW tab couldn't be read — the page then buckets by
   *  Monday-start weeks and says so. */
  weeks: WeekDef[];
  checks: SourceCheck[];
  /** Caveats about this payload, rendered prominently. */
  notes: string[];
  fetchedAt: string;
}

/** Program colours: palette slots 1–5 in stack order (PE at the bottom),
 *  validated as a set on #161b22. CBS has one program, so AI takes slot 1. */
export const PROGRAM_COLORS: Partial<Record<ProgramKey, string>> = {
  pe: '#3987e5',
  re: '#d95926',
  fpa: '#199e70',
  avi: '#c98500',
  rdi: '#d55181',
  ai: '#3987e5',
};
