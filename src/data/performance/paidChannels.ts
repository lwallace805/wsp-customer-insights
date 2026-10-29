// Paid-channel reference data the live paid layer does NOT carry: the Columbia
// Winter 2026 cohort's per-platform detail, kept as a closed prior-cohort
// comparison on /performance/paid-channels and as history in the AI briefing.
//
// Nothing in this file describes a current cohort. Current-cohort paid figures
// come from src/lib/performance/paidLive.ts (getPaidPerformance()), and which
// cohort they describe — live from its doc, or the Spring 2026 snapshot in
// src/data/performance/paidOptimization.ts — travels with them as
// PaidData.sources. (The Spring 2026 per-program tables and Google-only
// Columbia row that used to live here were that snapshot's cohort, labelled
// "in progress" long after it closed; they are gone.)
//
// Source (snapshot 2026-06-10): CBS Winter 2026 cohort doc, "Paid WoW
// Performance & Goals" + platform tables
// (1yame8J593cCIpwcMrkYm68tBhhDKpV3sAY7wXJeW-2g). Platform assignment
// reconciled against the doc's budget split (Google 70.19%, LinkedIn 21.04%
// incl. test, Meta 8.12%, Bing 0.65% of $185,969).

export interface PaidPlatform {
  platform: string;
  spend: number;
  leads: number | null;
  enrolls: number | null;
  cpl: number | null;
  cpe: number | null;
  cvr: number | null;
  roas?: number;        // x — on whatever basis the producer states (the live rows: net revenue/enroll)
  note?: string;
}

export interface PaidWeek {
  week: string;        // week start label
  spend: number;
  leads: number;
  enrolls: number;
}

// ── Columbia / CBS — Winter 2026 cohort (closed, prior) ──────────────────────

/** The cohort the constants below describe, and when they were taken. */
export const CBS_PRIOR_COHORT = {
  cohort: 'Winter 2026',
  label: 'Winter 2026 (closed)',
  asOf: '2026-06-10',
} as const;

export const CBS_PAID_PLATFORMS: PaidPlatform[] = [
  { platform: 'Google',   spend: 130536, leads: 1073, enrolls: 92, cpl: 121.65, cpe: 1418.87, cvr: 8.57 },
  { platform: 'LinkedIn', spend: 39127,  leads: 1029, enrolls: 15, cpl: 38.02,  cpe: 2608.47, cvr: 1.46, note: 'Includes $44K employer-sponsored / In-Mail test (lead-gen forms drive cheap, low-converting leads)' },
  { platform: 'Meta',     spend: 15104,  leads: 71,   enrolls: 8,  cpl: 212.74, cpe: 1888.03, cvr: 11.27 },
  { platform: 'Bing',     spend: 1202,   leads: 14,   enrolls: 2,  cpl: 85.89,  cpe: 601.21,  cvr: 14.29 },
];

// Adjacent paid channels (not platform ad spend) for the same CBS cohort,
// from the cohort doc's channel table.
export const CBS_OTHER_PAID: PaidPlatform[] = [
  { platform: 'Paid Affiliates', spend: 4175, leads: null, enrolls: 6, cpl: null, cpe: 695.83, cvr: null, note: 'ROAS 3.88x per cohort doc' },
  { platform: 'Sponsored Content', spend: 0, leads: null, enrolls: 6, cpl: null, cpe: null, cvr: null, note: 'No spend recorded in cohort doc for W26' },
];

// CBS weekly Google performance (spend / leads / enrollments actual)
export const CBS_PAID_WEEKLY: PaidWeek[] = [
  { week: '11/18', spend: 2445,  leads: 40,  enrolls: 0 },
  { week: '11/25', spend: 2801,  leads: 48,  enrolls: 0 },
  { week: '12/2',  spend: 2730,  leads: 49,  enrolls: 1 },
  { week: '12/9',  spend: 2737,  leads: 43,  enrolls: 1 },
  { week: '12/16', spend: 6707,  leads: 53,  enrolls: 2 },
  { week: '12/23', spend: 8472,  leads: 40,  enrolls: 2 },
  { week: '12/30', spend: 6819,  leads: 45,  enrolls: 1 },
  { week: '1/6',   spend: 7937,  leads: 66,  enrolls: 4 },
  { week: '1/13',  spend: 7282,  leads: 59,  enrolls: 4 },
  { week: '1/20',  spend: 7938,  leads: 54,  enrolls: 1 },
  { week: '1/27',  spend: 5311,  leads: 37,  enrolls: 4 },
  { week: '2/3',   spend: 13433, leads: 50,  enrolls: 6 },
  { week: '2/10',  spend: 11142, leads: 43,  enrolls: 10 },
  { week: '2/17',  spend: 8455,  leads: 90,  enrolls: 12 },
  { week: '2/24',  spend: 8208,  leads: 73,  enrolls: 13 },
  { week: '3/3',   spend: 11650, leads: 151, enrolls: 9 },
  { week: '3/10',  spend: 14155, leads: 123, enrolls: 19 },
  { week: '3/17',  spend: 2312,  leads: 9,   enrolls: 3 },
];
