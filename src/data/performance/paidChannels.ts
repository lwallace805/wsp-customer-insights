// Paid channel (platform-level) performance for the current cohorts.
//
// Sources (snapshot 2026-06-10):
// - Wharton Spring 2026 cohort doc, "Paid WoW Performance & Goals" tab
//   (1o5lfRmA1nAe0BDnYtZ1OJOnU9eB8y4WeJdGNL0_BE_Y). Wharton paid media is
//   Google-dominated; Meta/LinkedIn/Bing are not broken out per-platform in
//   the Wharton doc — only Overall Paid and Google sections exist.
// - CBS Winter 2026 cohort doc, "Paid WoW Performance & Goals" + platform
//   tables (1yame8J593cCIpwcMrkYm68tBhhDKpV3sAY7wXJeW-2g). Platform
//   assignment reconciled against the doc's budget split (Google 70.19%,
//   LinkedIn 21.04% incl. test, Meta 8.12%, Bing 0.65% of $185,969).

export interface PaidProgramRow {
  program: string;
  spend: number;
  spendForecast: number | null;
  leads: number;
  leadsForecast: number | null;
  enrolls: number;
  enrollsForecast: number | null;
  cpl: number | null;
  cplGoal: number | null;
  cpe: number | null;
  cvr: number | null;        // %
  roas: number | null;       // x
}

export interface PaidPlatform {
  platform: string;
  spend: number;
  leads: number | null;
  enrolls: number | null;
  cpl: number | null;
  cpe: number | null;
  cvr: number | null;
  note?: string;
}

export interface PaidWeek {
  week: string;        // week start label
  spend: number;
  leads: number;
  enrolls: number;
}

// ── Wharton — Spring 2026 cohort (in progress) ────────────────────────────────

export const WHARTON_PAID_OVERALL: PaidProgramRow[] = [
  { program: 'Total', spend: 959566, spendForecast: 920927, leads: 11795, leadsForecast: 18428, enrolls: 395, enrollsForecast: 463, cpl: 81.35, cplGoal: 48, cpe: 2429.28, cvr: 3.35, roas: 1.85 },
  { program: 'PE',    spend: 152568, spendForecast: 165150, leads: 2649,  leadsForecast: 4450,  enrolls: 91,  enrollsForecast: 115, cpl: 57.59,  cplGoal: 27, cpe: 1676.57, cvr: 3.44, roas: 1.61 },
  { program: 'RE',    spend: 193908, spendForecast: 212301, leads: 2489,  leadsForecast: 4479,  enrolls: 108, enrollsForecast: 132, cpl: 77.91,  cplGoal: 55, cpe: 1795.45, cvr: 4.34, roas: 1.50 },
  { program: 'FP&A',  spend: 189300, spendForecast: 172513, leads: 4433,  leadsForecast: 5518,  enrolls: 130, enrollsForecast: 121, cpl: 42.70,  cplGoal: 65, cpe: 1456.15, cvr: 2.93, roas: 1.85 },
  { program: 'AVI',   spend: 100721, spendForecast: 112039, leads: 1120,  leadsForecast: 1834,  enrolls: 27,  enrollsForecast: 46,  cpl: 89.93,  cplGoal: 27, cpe: 3730.41, cvr: 2.41, roas: 0.72 },
  { program: 'RDI',   spend: 147196, spendForecast: 130331, leads: 1104,  leadsForecast: 2147,  enrolls: 39,  enrollsForecast: 49,  cpl: 133.33, cplGoal: 27, cpe: 3774.25, cvr: 3.53, roas: 0.72 },
];

export const WHARTON_PAID_GOOGLE: PaidProgramRow[] = [
  { program: 'Total', spend: 564785, spendForecast: 597343, leads: 3814, leadsForecast: 7949, enrolls: 219, enrollsForecast: 269, cpl: 148.08, cplGoal: 48, cpe: 2578.93, cvr: 5.74, roas: 1.05 },
  { program: 'PE',    spend: 72361,  spendForecast: 87985,  leads: 778,  leadsForecast: 1444, enrolls: 45,  enrollsForecast: 54,  cpl: 93.01,  cplGoal: 27, cpe: 1608.02, cvr: 5.78, roas: 1.68 },
  { program: 'RE',    spend: 117168, spendForecast: 146603, leads: 986,  leadsForecast: 2421, enrolls: 69,  enrollsForecast: 86,  cpl: 118.83, cplGoal: 55, cpe: 1698.08, cvr: 7.00, roas: 1.59 },
  { program: 'FP&A',  spend: 93816,  spendForecast: 97271,  leads: 1161, leadsForecast: 1395, enrolls: 75,  enrollsForecast: 60,  cpl: 80.81,  cplGoal: 65, cpe: 1250.88, cvr: 6.46, roas: 2.16 },
  { program: 'AVI',   spend: 64648,  spendForecast: 92043,  leads: 581,  leadsForecast: 1524, enrolls: 17,  enrollsForecast: 38,  cpl: 111.27, cplGoal: 27, cpe: 3802.83, cvr: 2.93, roas: 0.71 },
  { program: 'RDI',   spend: 85913,  spendForecast: 83729,  leads: 308,  leadsForecast: 1165, enrolls: 13,  enrollsForecast: 31,  cpl: 278.94, cplGoal: 27, cpe: 6608.72, cvr: 4.22, roas: 0.41 },
];

// Weekly overall paid performance (spend / leads / enrollments actual)
export const WHARTON_PAID_WEEKLY: PaidWeek[] = [
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
  { week: '6/9',  spend: 3601,  leads: 34,  enrolls: 2 },
];

// ── Columbia / CBS — Spring 2026 cohort (current, in progress) ───────────────
// Source: CBS Spring 2026 cohort doc, "Paid WoW Performance & Goals"
//   (1EfNBwZYYObVU3XSiW1VPC_Fi13ZLaQdq_tZZyPxZy14). Snapshot 2026-06-10.
// Spring 2026 paid is Google-only so far; cohort runs 3/24 → 7/20/2026.

export const CBS_SPRING_GOOGLE: PaidPlatform = {
  platform: 'Google',
  spend: 98330, leads: 691, enrolls: 27,
  cpl: 142.30, cpe: 3641.86, cvr: 3.91,
  note: 'CPL goal $175 · CPE goal $2,067 · target budget $155K · forecast 75 enrolls / 886 leads by 7/20',
};

// Weekly actuals (weeks with spend recorded; cohort in progress)
export const CBS_SPRING_WEEKLY: PaidWeek[] = [
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
  { week: '6/9',  spend: 1443,  leads: 7,   enrolls: 0 },
];

// ── Columbia / CBS — Winter 2026 cohort (closed, prior) ──────────────────────

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

export const PAID_COHORT_LABELS = {
  wharton: 'Spring 2026 (in progress)',
  columbia: 'Spring 2026 (in progress)',
  columbiaPrior: 'Winter 2026 (closed)',
} as const;
