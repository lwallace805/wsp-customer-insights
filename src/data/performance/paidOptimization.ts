// Paid-channel optimization data — the cross-channel "source of truth" for the
// Paid Optimization dashboard (/performance/paid-optimization).
//
// Sources (synced 2026-06-13 — re-sync by asking Claude to re-read the sheets):
//   • Wharton Performance Dashboard, Spring 2026 cohort (in progress)
//       https://docs.google.com/spreadsheets/d/1o5lfRmA1nAe0BDnYtZ1OJOnU9eB8y4WeJdGNL0_BE_Y
//   • Columbia (CBSEE) Performance Dashboard, Spring 2026 cohort (in progress)
//       https://docs.google.com/spreadsheets/d/1EfNBwZYYObVU3XSiW1VPC_Fi13ZLaQdq_tZZyPxZy14
//   • Historical by-cohort efficiency: src/data/performance/historical.ts
//
// WHAT THESE SHEETS DO AND DON'T TRACK
// ────────────────────────────────────
// The performance dashboards model the funnel as Spend → Leads → Enrollments,
// measured by CPL (cost/lead), CPE (cost/enrollment), CVR (lead→enroll %), and
// ROAS. They DO break paid out by platform (Google / Meta / LinkedIn / Bing) and
// by program. They do NOT contain Impressions, Clicks, CPM, CTR, or CPC — the
// ad-platform top-of-funnel. Those live only in Google Ads / Meta Ads Manager /
// LinkedIn Campaign Manager and would have to be pulled from there. See
// MISSING_PLATFORM_METRICS below; the UI surfaces this gap explicitly.
//
// RECONCILIATION NOTES (why these are curated, not a blind cell-parse)
// ────────────────────────────────────
//   • Leads & enrollments are fully program-attributed and sum cleanly; only
//     Google SPEND carries an extra ~$131K of brand/non-program spend, so the
//     Google program rows sum to less than the Google channel total. Channel
//     totals (below) are authoritative for spend; program×channel leaves are
//     authoritative for leads/enrolls.
//   • Columbia's sheet prints a "combined" row that divides PAID spend by
//     TOTAL-cohort leads/enrolls (215 enrolls incl. organic), producing blended
//     figures. The true paid-attributed total is 37 enrolls / 1,432 leads
//     (Google 30 + LinkedIn 3 + Meta 0 + Bing 4), which is what we store.

import type { School } from './types';

export type PaidChannel = 'google' | 'meta' | 'linkedin' | 'bing' | 'affiliates';

export const CHANNEL_LABEL: Record<PaidChannel, string> = {
  google: 'Google',
  meta: 'Meta',
  linkedin: 'LinkedIn',
  bing: 'Bing',
  affiliates: 'Affiliates',
};

// Net tuition revenue per enrollment, used to compute a contribution-relevant
// ROAS that matches the per-channel / per-program ROAS the paid team reports in
// the source sheets (those use net revenue, not gross tuition). On this basis,
// ROAS < 1.0× = the channel/program is below contribution breakeven. Source:
// historical performance sheet (avgNetRev). Gross list price is ~$4,500.
export const NET_REV: Record<School, number> = { wharton: 2796, columbia: 3029 };

// ── Core metric shape ─────────────────────────────────────────────────────────
// We store raw counts + goals and DERIVE cpl/cpe/cvr/roas so every figure is
// internally consistent and recomputes correctly if counts are updated.

export interface RawCounts {
  spend: number;
  leads: number;
  enrolls: number;
  spendForecast?: number | null;
  cplGoal?: number | null;
  cpeGoal?: number | null;
}

export interface DerivedMetrics extends RawCounts {
  cpl: number | null;   // $/lead
  cpe: number | null;   // $/enroll
  cvr: number | null;   // % lead→enroll
  roas: number | null;  // × (enrolls × AOV ÷ spend)
}

export function derive(raw: RawCounts, school: School): DerivedMetrics {
  const { spend, leads, enrolls } = raw;
  return {
    ...raw,
    cpl: leads > 0 ? spend / leads : null,
    cpe: enrolls > 0 ? spend / enrolls : null,
    cvr: leads > 0 ? (enrolls / leads) * 100 : null,
    roas: spend > 0 ? (enrolls * NET_REV[school]) / spend : null,
  };
}

export function sumCounts(rows: RawCounts[]): RawCounts {
  return rows.reduce<RawCounts>(
    (a, r) => ({
      spend: a.spend + r.spend,
      leads: a.leads + r.leads,
      enrolls: a.enrolls + r.enrolls,
    }),
    { spend: 0, leads: 0, enrolls: 0 },
  );
}

// ── Channel-level totals (authoritative for spend; sums to grand total) ───────

export interface ChannelTotal extends RawCounts {
  channel: PaidChannel;
}

// Wharton — Spring 2026, all paid channels. Σ spend = $960,016 · leads 11,819 ·
// enrolls 399. (Google spend includes ~$131K brand/non-program search.)
export const WHARTON_CHANNELS: ChannelTotal[] = [
  { channel: 'google',     spend: 565235, leads: 3837, enrolls: 223, spendForecast: 597343, cplGoal: 48, cpeGoal: 1350 },
  { channel: 'meta',       spend: 233483, leads: 3956, enrolls: 107, spendForecast: 165967, cplGoal: 38, cpeGoal: 1350 },
  { channel: 'linkedin',   spend: 116303, leads: 3527, enrolls: 45,  spendForecast: 118736, cplGoal: 36, cpeGoal: 1350 },
  { channel: 'affiliates', spend: 44995,  leads: 499,  enrolls: 24,  spendForecast: 38881,  cplGoal: 47, cpeGoal: 1350 },
];

// Columbia (CBSEE) — Spring 2026, all paid channels. Σ spend = $125,976 ·
// leads 1,432 · enrolls 37. Single program ("AI for Business & Finance").
//
// PLATFORM LABELS ARE INFERRED. The source sheet only labels the Google table;
// the other three tables are unlabeled, so platform is inferred from each line's
// budget + CPL target, corroborated by Meta Ads Manager:
//   • Meta = the $11,806 line ($81K budget, $19.81 CPL, 596 leads — the cheap,
//     high-volume social fingerprint). Ads Manager showed ~$6K Meta in a single
//     trailing-30-day window, which rules out the tiny $1,865 line being Meta.
//   • LinkedIn = the $11,595 line ($23K budget, $200 CPL goal — expensive B2B).
//   • Bing = the $1,865 line ($2K budget — a minor search/test channel).
// (Earlier this had Meta and Bing swapped.) The sheet also slightly under-
// captures vs. the platform: its latest week lags Ads Manager by manual entry,
// so cohort-to-date here can read low vs. the live ad accounts. Confirm labels
// with the sheet owner (jbain) — ideally add platform banners at the source.
export const COLUMBIA_CHANNELS: ChannelTotal[] = [
  { channel: 'google',   spend: 100710, leads: 726, enrolls: 30, spendForecast: 84549, cplGoal: 175, cpeGoal: 2067 },
  { channel: 'meta',     spend: 11806,  leads: 596, enrolls: 4,  spendForecast: 44183, cplGoal: 49,  cpeGoal: 2700 },
  { channel: 'linkedin', spend: 11595,  leads: 91,  enrolls: 3,  spendForecast: 12546, cplGoal: 200, cpeGoal: 2556 },
  { channel: 'bing',     spend: 1865,   leads: 19,  enrolls: 0,  spendForecast: 1091,  cplGoal: 83,  cpeGoal: 1350 },
];

export const CHANNELS_BY_SCHOOL: Record<School, ChannelTotal[]> = {
  wharton: WHARTON_CHANNELS,
  columbia: COLUMBIA_CHANNELS,
};

// ── Program × channel matrix (leaves) ─────────────────────────────────────────
// Leads & enrolls are exact; spend is program-attributed (excludes Google brand).

export interface ProgramChannelLeaf extends RawCounts {
  program: string;
  channel: PaidChannel;
}

// Wharton — PE / RE / FP&A / AVI / RDI × Google / Meta / LinkedIn.
export const WHARTON_PROGRAM_CHANNEL: ProgramChannelLeaf[] = [
  // Google
  { program: 'PE',   channel: 'google', spend: 72524,  leads: 785,  enrolls: 45, cplGoal: 27, cpeGoal: 1350 },
  { program: 'RE',   channel: 'google', spend: 117290, leads: 989,  enrolls: 71, cplGoal: 55, cpeGoal: 1350 },
  { program: 'FP&A', channel: 'google', spend: 93910,  leads: 1171, enrolls: 77, cplGoal: 65, cpeGoal: 1350 },
  { program: 'AVI',  channel: 'google', spend: 64687,  leads: 582,  enrolls: 17, cplGoal: 27, cpeGoal: 1350 },
  { program: 'RDI',  channel: 'google', spend: 85930,  leads: 310,  enrolls: 13, cplGoal: 27, cpeGoal: 1350 },
  // Meta
  { program: 'PE',   channel: 'meta', spend: 60340, leads: 1016, enrolls: 30, cplGoal: 31, cpeGoal: 1350 },
  { program: 'RE',   channel: 'meta', spend: 53928, leads: 947,  enrolls: 26, cplGoal: 53, cpeGoal: 1350 },
  { program: 'FP&A', channel: 'meta', spend: 46956, leads: 1116, enrolls: 24, cplGoal: 55, cpeGoal: 1350 },
  { program: 'AVI',  channel: 'meta', spend: 31783, leads: 458,  enrolls: 10, cplGoal: 18, cpeGoal: 1350 },
  { program: 'RDI',  channel: 'meta', spend: 40477, leads: 419,  enrolls: 17, cplGoal: 18, cpeGoal: 1350 },
  // LinkedIn
  { program: 'PE',   channel: 'linkedin', spend: 19867, leads: 806,  enrolls: 11, cplGoal: 19, cpeGoal: 1350 },
  { program: 'RE',   channel: 'linkedin', spend: 22813, leads: 400,  enrolls: 6,  cplGoal: 57, cpeGoal: 1350 },
  { program: 'FP&A', channel: 'linkedin', spend: 48528, leads: 1919, enrolls: 20, cplGoal: 61, cpeGoal: 1350 },
  { program: 'AVI',  channel: 'linkedin', spend: 4290,  leads: 36,   enrolls: 0,  cplGoal: 28, cpeGoal: 1350 },
  { program: 'RDI',  channel: 'linkedin', spend: 20806, leads: 366,  enrolls: 8,  cplGoal: 28, cpeGoal: 1350 },
];

// Per-school program list (display order).
export const PROGRAMS_BY_SCHOOL: Record<School, string[]> = {
  wharton: ['PE', 'RE', 'FP&A', 'AVI', 'RDI'],
  columbia: ['AI'],
};

export const PROGRAM_FULL_NAME: Record<string, string> = {
  PE: 'Private Equity',
  RE: 'Real Estate',
  'FP&A': 'FP&A',
  AVI: 'Applied Value Investing',
  RDI: 'Restructuring & Distressed Investing',
  AI: 'AI for Business & Finance',
};

// The channels covered for the program×channel matrix (the three the team buys
// across both schools at program granularity).
export const MATRIX_CHANNELS: PaidChannel[] = ['google', 'meta', 'linkedin'];

// ── Weekly series within the current cohort ───────────────────────────────────

export interface PaidWeekPoint {
  week: string;     // week-start label, e.g. "3/24"
  spend: number;
  leads: number;
  enrolls: number;
}

// Per-channel weekly (Wharton). Each series sums to its channel total above.
export const WHARTON_WEEKLY: Record<'all' | 'google' | 'meta' | 'linkedin', PaidWeekPoint[]> = {
  all: [
    { week: '2/17', spend: 6893,  leads: 37,   enrolls: 2 },
    { week: '2/24', spend: 7126,  leads: 53,   enrolls: 0 },
    { week: '3/3',  spend: 26366, leads: 112,  enrolls: 2 },
    { week: '3/10', spend: 41552, leads: 155,  enrolls: 4 },
    { week: '3/17', spend: 59268, leads: 471,  enrolls: 6 },
    { week: '3/24', spend: 52790, leads: 561,  enrolls: 12 },
    { week: '3/31', spend: 58435, leads: 779,  enrolls: 9 },
    { week: '4/7',  spend: 79246, leads: 1220, enrolls: 13 },
    { week: '4/14', spend: 88643, leads: 1463, enrolls: 19 },
    { week: '4/21', spend: 83376, leads: 1115, enrolls: 20 },
    { week: '4/28', spend: 83052, leads: 933,  enrolls: 18 },
    { week: '5/5',  spend: 78310, leads: 891,  enrolls: 91 },
    { week: '5/12', spend: 89736, leads: 866,  enrolls: 22 },
    { week: '5/19', spend: 81032, leads: 1139, enrolls: 26 },
    { week: '5/26', spend: 68806, leads: 1133, enrolls: 40 },
    { week: '6/2',  spend: 51334, leads: 833,  enrolls: 106 },
    { week: '6/9',  spend: 4051,  leads: 58,   enrolls: 9 },
  ],
  google: [
    { week: '2/17', spend: 6893,  leads: 37,  enrolls: 1 },
    { week: '2/24', spend: 7126,  leads: 51,  enrolls: 0 },
    { week: '3/3',  spend: 26366, leads: 111, enrolls: 1 },
    { week: '3/10', spend: 41436, leads: 153, enrolls: 3 },
    { week: '3/17', spend: 44977, leads: 181, enrolls: 4 },
    { week: '3/24', spend: 35369, leads: 148, enrolls: 9 },
    { week: '3/31', spend: 29570, leads: 184, enrolls: 6 },
    { week: '4/7',  spend: 38784, leads: 251, enrolls: 9 },
    { week: '4/14', spend: 41249, leads: 309, enrolls: 10 },
    { week: '4/21', spend: 38869, leads: 274, enrolls: 11 },
    { week: '4/28', spend: 40223, leads: 275, enrolls: 11 },
    { week: '5/5',  spend: 44046, leads: 334, enrolls: 46 },
    { week: '5/12', spend: 56634, leads: 287, enrolls: 12 },
    { week: '5/19', spend: 45766, leads: 405, enrolls: 15 },
    { week: '5/26', spend: 36155, leads: 462, enrolls: 21 },
    { week: '6/2',  spend: 27722, leads: 318, enrolls: 58 },
    { week: '6/9',  spend: 4051,  leads: 57,  enrolls: 6 },
  ],
  meta: [
    { week: '2/17', spend: 0,     leads: 0,   enrolls: 0 },
    { week: '2/24', spend: 0,     leads: 0,   enrolls: 0 },
    { week: '3/3',  spend: 0,     leads: 0,   enrolls: 1 },
    { week: '3/10', spend: 0,     leads: 0,   enrolls: 0 },
    { week: '3/17', spend: 6568,  leads: 166, enrolls: 1 },
    { week: '3/24', spend: 8573,  leads: 204, enrolls: 2 },
    { week: '3/31', spend: 15265, leads: 316, enrolls: 2 },
    { week: '4/7',  spend: 19092, leads: 318, enrolls: 4 },
    { week: '4/14', spend: 25169, leads: 431, enrolls: 3 },
    { week: '4/21', spend: 24683, leads: 349, enrolls: 7 },
    { week: '4/28', spend: 25820, leads: 290, enrolls: 5 },
    { week: '5/5',  spend: 19758, leads: 255, enrolls: 24 },
    { week: '5/12', spend: 22683, leads: 332, enrolls: 6 },
    { week: '5/19', spend: 25292, leads: 523, enrolls: 8 },
    { week: '5/26', spend: 23503, leads: 447, enrolls: 15 },
    { week: '6/2',  spend: 17080, leads: 325, enrolls: 29 },
    { week: '6/9',  spend: 0,     leads: 0,   enrolls: 0 },
  ],
  linkedin: [
    { week: '2/17', spend: 0,     leads: 0,   enrolls: 1 },
    { week: '2/24', spend: 0,     leads: 0,   enrolls: 0 },
    { week: '3/3',  spend: 0,     leads: 0,   enrolls: 0 },
    { week: '3/10', spend: 0,     leads: 0,   enrolls: 1 },
    { week: '3/17', spend: 5885,  leads: 112, enrolls: 1 },
    { week: '3/24', spend: 6484,  leads: 182, enrolls: 1 },
    { week: '3/31', spend: 10969, leads: 244, enrolls: 0 },
    { week: '4/7',  spend: 16351, leads: 599, enrolls: 0 },
    { week: '4/14', spend: 16523, leads: 662, enrolls: 4 },
    { week: '4/21', spend: 15597, leads: 453, enrolls: 0 },
    { week: '4/28', spend: 12940, leads: 323, enrolls: 2 },
    { week: '5/5',  spend: 10223, leads: 253, enrolls: 11 },
    { week: '5/12', spend: 6171,  leads: 207, enrolls: 3 },
    { week: '5/19', spend: 5719,  leads: 167, enrolls: 1 },
    { week: '5/26', spend: 5793,  leads: 176, enrolls: 4 },
    { week: '6/2',  spend: 3649,  leads: 149, enrolls: 14 },
    { week: '6/9',  spend: 0,     leads: 0,   enrolls: 2 },
  ],
};

// Columbia weekly (combined paid + Google). Cohort runs 3/24 → 7/20; weeks with
// zero spend are still-future and omitted from charts by the component.
export const COLUMBIA_WEEKLY: Record<'all' | 'google', PaidWeekPoint[]> = {
  all: [
    { week: '3/24', spend: 2280,  leads: 125, enrolls: 6 },
    { week: '3/31', spend: 2102,  leads: 105, enrolls: 5 },
    { week: '4/7',  spend: 3654,  leads: 135, enrolls: 8 },
    { week: '4/14', spend: 10410, leads: 251, enrolls: 3 },
    { week: '4/21', spend: 13743, leads: 376, enrolls: 11 },
    { week: '4/28', spend: 13324, leads: 340, enrolls: 8 },
    { week: '5/5',  spend: 13864, leads: 338, enrolls: 21 },
    { week: '5/12', spend: 15774, leads: 328, enrolls: 15 },
    { week: '5/19', spend: 17153, leads: 317, enrolls: 25 },
    { week: '5/26', spend: 17809, leads: 357, enrolls: 43 },
    { week: '6/2',  spend: 11146, leads: 255, enrolls: 40 },
    { week: '6/9',  spend: 4717,  leads: 223, enrolls: 30 },
  ],
  google: [
    { week: '3/24', spend: 2280,  leads: 9,   enrolls: 1 },
    { week: '3/31', spend: 2102,  leads: 8,   enrolls: 0 },
    { week: '4/7',  spend: 3654,  leads: 8,   enrolls: 0 },
    { week: '4/14', spend: 6433,  leads: 50,  enrolls: 1 },
    { week: '4/21', spend: 8976,  leads: 78,  enrolls: 1 },
    { week: '4/28', spend: 10098, leads: 87,  enrolls: 0 },
    { week: '5/5',  spend: 11473, leads: 80,  enrolls: 3 },
    { week: '5/12', spend: 13147, leads: 56,  enrolls: 0 },
    { week: '5/19', spend: 14647, leads: 107, enrolls: 3 },
    { week: '5/26', spend: 15343, leads: 142, enrolls: 9 },
    { week: '6/2',  spend: 8735,  leads: 59,  enrolls: 9 },
    { week: '6/9',  spend: 3823,  leads: 42,  enrolls: 3 },
  ],
};

// ── Cohort context (pace vs goal) ─────────────────────────────────────────────

export interface CohortContext {
  school: School;
  cohort: string;            // "Spring 2026"
  dateRange: string;         // "Feb 17 – Jun 15, 2026" etc.
  daysRemaining: number | null;
  // Total-cohort (ALL channels incl. organic) enrollment + lead pace
  enrollsRealTime: number;
  enrollsGoal: number;
  leadsRealTime: number;
  leadsGoal: number;
  totalPaidSpend: number;    // Σ paid channel spend this cohort
  paidEnrolls: number;       // paid-attributed enrolls (Σ channel enrolls)
}

export const COHORT_CONTEXT: Record<School, CohortContext> = {
  wharton: {
    school: 'wharton',
    cohort: 'Spring 2026',
    dateRange: 'Feb 17 – Jun 15, 2026',
    daysRemaining: 2,
    enrollsRealTime: 969,
    enrollsGoal: 1225,
    leadsRealTime: 17023,
    leadsGoal: 23261,
    totalPaidSpend: 960016,
    paidEnrolls: 399,
  },
  columbia: {
    school: 'columbia',
    cohort: 'Spring 2026',
    dateRange: 'Mar 24 – Jul 20, 2026',
    daysRemaining: 37,
    enrollsRealTime: 215,
    enrollsGoal: 468,
    leadsRealTime: 3150,
    leadsGoal: 4680,
    totalPaidSpend: 125976,
    paidEnrolls: 37,
  },
};

// ── The metrics the source sheets do NOT contain ──────────────────────────────
// Surfaced in the UI so the gap is explicit and actionable.
export const MISSING_PLATFORM_METRICS = ['CPM', 'CTR', 'CPC'] as const;

// ── Bundled dashboard data (live layer or static fallback) ────────────────────
// The dashboard renders from a PaidData bundle. In production the live layer
// (src/lib/performance/paidLive.ts) parses this from the source sheets via the
// service account and refreshes daily via the Vercel cron; if the parse fails
// or its sanity checks don't reconcile, it serves STATIC_PAID_DATA below so the
// page is always correct. `asOf`/`live` drive the freshness badge.

export interface WeeklySeries {
  all: PaidWeekPoint[];
  google: PaidWeekPoint[];
  meta?: PaidWeekPoint[];
  linkedin?: PaidWeekPoint[];
}

export interface PaidData {
  asOf: string;        // YYYY-MM-DD the data is current through
  live: boolean;       // true = parsed from sheets this run; false = static snapshot
  channelsBySchool: Record<School, ChannelTotal[]>;
  whartonProgramChannel: ProgramChannelLeaf[];
  weekly: Record<School, WeeklySeries>;
  cohortContext: Record<School, CohortContext>;
}

// The curated snapshot, assembled from the constants above. Sourced 2026-06-13.
export const STATIC_PAID_DATA: PaidData = {
  asOf: '2026-06-13',
  live: false,
  channelsBySchool: CHANNELS_BY_SCHOOL,
  whartonProgramChannel: WHARTON_PROGRAM_CHANNEL,
  weekly: { wharton: WHARTON_WEEKLY, columbia: COLUMBIA_WEEKLY },
  cohortContext: COHORT_CONTEXT,
};
