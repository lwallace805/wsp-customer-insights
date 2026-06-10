// Historical cohort performance — Wharton (Spring 2023 → Winter 2026) and
// Columbia/CBS (Summer 2025 → Winter 2026).
//
// Source: "Wharton + Columbia Historical Performance" Google Sheet
//   https://docs.google.com/spreadsheets/d/1R5XiIsJ_rjcwjc9VBkftGs6WglEvnCR_VaYybgNRiJM
// Snapshot taken 2026-06-10. Re-sync by asking Claude to re-read the sheet.
//
// Notes from source:
// - Enrollments are during the cohort marketing cycle, net of refunds.
// - ROAS assumes $4,500 AOV (Wharton) / per-sheet AOV (Columbia).
// - Leads exclude bot traffic in Wharton S'25 and F'25 where noted
//   ("leadsExBots"); raw lead counts retained in totalLeads.
// - B2B = enterprise (sales-led, cohort-agnostic) + B2B cohort enrollments.

import type { CohortHistory } from './types';

export const WHARTON_HISTORY: CohortHistory[] = [
  {
    cohort: 'Spring 2023', shortLabel: "S'23", school: 'wharton', certCount: 1,
    paidEnrolls: 127, organicEnrolls: 383, totalEnrolls: 510,
    b2bEnrolls: 0, totalEnrollsExB2B: 510,
    totalLeads: 5363, leadsExBots: null, leadCvr: 9.5,
    cpl: 39, cpe: 408, ppcRoas: 3.4, blendedRoas: 11.0,
    ppcSpend: 150930, totalSpend: 208044, avgNetRev: 2796,
    channelEnrolls: {
      ppc: 113, email: 184, organicSearch: 0, social: 8, website: 82,
      referrals: 14, sponsored: 14, affiliates: 53, offline: 41,
    },
    callout: 'PE Certificate launch — single program',
  },
  {
    cohort: 'Fall 2023', shortLabel: "F'23", school: 'wharton', certCount: 1,
    paidEnrolls: 213, organicEnrolls: 316, totalEnrolls: 529,
    b2bEnrolls: 29, totalEnrollsExB2B: 500,
    totalLeads: 5043, leadsExBots: null, leadCvr: 9.9,
    cpl: 41, cpe: 417, ppcRoas: 6.0, blendedRoas: 10.8,
    ppcSpend: 147108, totalSpend: 208644, avgNetRev: 2796,
    channelEnrolls: {
      ppc: 195, email: 83, organicSearch: 0, social: 7, website: 40,
      referrals: 29, sponsored: 18, affiliates: 60, offline: 69,
    },
  },
  {
    cohort: 'Winter 2024', shortLabel: "W'24", school: 'wharton', certCount: 1,
    paidEnrolls: 203, organicEnrolls: 300, totalEnrolls: 503,
    b2bEnrolls: 1, totalEnrollsExB2B: 502,
    totalLeads: 5473, leadsExBots: null, leadCvr: 9.2,
    cpl: 37, cpe: 408, ppcRoas: 5.5, blendedRoas: 11.0,
    ppcSpend: 148382, totalSpend: 204616, avgNetRev: 2796,
    channelEnrolls: {
      ppc: 180, email: 101, organicSearch: 6, social: 5, website: 28,
      referrals: 26, sponsored: 23, affiliates: 52, offline: 79,
    },
  },
  {
    cohort: 'Spring 2024', shortLabel: "S'24", school: 'wharton', certCount: 4,
    paidEnrolls: 492, organicEnrolls: 675, totalEnrolls: 1167,
    b2bEnrolls: 109, totalEnrollsExB2B: 1058,
    totalLeads: 16469, leadsExBots: 16469, leadCvr: 6.4,
    cpl: 47, cpe: 735, ppcRoas: 3.4, blendedRoas: 6.1,
    ppcSpend: 593629, totalSpend: 777215, avgNetRev: 2796,
    channelEnrolls: {
      ppc: 454, email: 124, organicSearch: 74, social: 16, website: 64,
      referrals: 27, sponsored: 38, affiliates: 116, offline: 145,
    },
    callout: 'Expansion to 4 certificates (PE, RE, FP&A, AVI)',
  },
  {
    cohort: 'Fall 2024', shortLabel: "F'24", school: 'wharton', certCount: 4,
    paidEnrolls: 484, organicEnrolls: 724, totalEnrolls: 1208,
    b2bEnrolls: 54, totalEnrollsExB2B: 1154,
    totalLeads: 18905, leadsExBots: 18905, leadCvr: 6.1,
    cpl: 41, cpe: 665, ppcRoas: 3.2, blendedRoas: 6.8,
    ppcSpend: 643048, totalSpend: 767728, avgNetRev: 2796,
    channelEnrolls: {
      ppc: 456, email: 119, organicSearch: 87, social: 4, website: 41,
      referrals: 70, sponsored: 28, affiliates: 115, offline: 234,
    },
  },
  {
    cohort: 'Winter 2025', shortLabel: "W'25", school: 'wharton', certCount: 4,
    paidEnrolls: 493, organicEnrolls: 765, totalEnrolls: 1258,
    b2bEnrolls: 67, totalEnrollsExB2B: 1191,
    totalLeads: 19321, leadsExBots: 19321, leadCvr: 6.2,
    cpl: 39, cpe: 632, ppcRoas: 3.2, blendedRoas: 7.1,
    ppcSpend: 673832, totalSpend: 752164, avgNetRev: 2796,
    channelEnrolls: {
      ppc: 472, email: 144, organicSearch: 127, social: 4, website: 54,
      referrals: 68, sponsored: 21, affiliates: 96, offline: 205,
    },
    callout: 'Riverside investment',
  },
  {
    cohort: 'Spring 2025', shortLabel: "S'25", school: 'wharton', certCount: 4,
    paidEnrolls: 406, organicEnrolls: 826, totalEnrolls: 1232,
    b2bEnrolls: 197, totalEnrollsExB2B: 1035,
    totalLeads: 26208, leadsExBots: 18238, leadCvr: 5.7,
    cpl: 41, cpe: 718, ppcRoas: 2.6, blendedRoas: 6.3,
    ppcSpend: 667780, totalSpend: 742820, avgNetRev: 2796,
    channelEnrolls: {
      ppc: 385, email: 123, organicSearch: 105, social: 7, website: 32,
      referrals: 76, sponsored: 21, affiliates: 95, offline: 191,
    },
    callout: 'Launch of AI program + start of bot lead issue',
  },
  {
    cohort: 'Fall 2025', shortLabel: "F'25", school: 'wharton', certCount: 4,
    paidEnrolls: 324, organicEnrolls: 600, totalEnrolls: 924,
    b2bEnrolls: 27, totalEnrollsExB2B: 897,
    totalLeads: 30722, leadsExBots: 16314, leadCvr: 5.5,
    cpl: 50, cpe: 907, ppcRoas: 1.9, blendedRoas: 5.0,
    ppcSpend: 710212, totalSpend: 813444, avgNetRev: 2796,
    channelEnrolls: {
      ppc: 307, email: 109, organicSearch: 124, aiReferral: 10, social: 4,
      website: 34, referrals: 23, sponsored: 17, affiliates: 92, offline: 177,
    },
    callout: 'Bot lead issue continues',
  },
  // RDI launched with the Spring 2026 cohort — F'25/W'26 ran 4 certs.
  // (AVI was previously called "Buy Side" / "Hedge Fund" in older docs;
  // all merged under AVI here.)
  {
    cohort: 'Winter 2026', shortLabel: "W'26", school: 'wharton', certCount: 4,
    paidEnrolls: 413, organicEnrolls: 609, totalEnrolls: 1022,
    b2bEnrolls: 1, totalEnrollsExB2B: 1021,
    totalLeads: 19487, leadsExBots: 19487, leadCvr: 5.2,
    cpl: 42, cpe: 794, ppcRoas: 2.4, blendedRoas: 5.7,
    ppcSpend: 737158, totalSpend: 810733, avgNetRev: 2796,
    channelEnrolls: {
      ppc: 401, email: 96, organicSearch: 119, aiReferral: 21, social: 1,
      website: 18, referrals: 31, sponsored: 12, affiliates: 99, offline: 223,
    },
  },
];

// Columbia / CBS — AI for Business & Finance. Source table is ordered
// Summer 2025 → Fall 2025 → Winter 2026.
export const COLUMBIA_HISTORY: CohortHistory[] = [
  {
    cohort: 'Summer 2025', shortLabel: "Su'25", school: 'columbia', certCount: 1,
    paidEnrolls: 109, organicEnrolls: 336, totalEnrolls: 445,
    b2bEnrolls: 30, totalEnrollsExB2B: 415,
    totalLeads: 6749, leadsExBots: 6761, leadCvr: 6.1,
    cpl: 36, cpe: 591, ppcRoas: 1.9, blendedRoas: 7.6,
    ppcSpend: 166466, totalSpend: 245137, avgNetRev: 3029,
    // Channel detail from the CBS Summer 2025 cohort doc
    // (1ZX917V1WmvXJKl4QIzBfv51SovfrWGLbBYveQ1xq64Y)
    channelEnrolls: {
      ppc: 74, email: 114, organicSearch: 42, social: 4, website: 29,
      referrals: 11, sponsored: 38, affiliates: 27, offline: 77,
    },
    callout: 'AI Certificate launch cohort',
  },
  {
    cohort: 'Fall 2025', shortLabel: "F'25", school: 'columbia', certCount: 1,
    paidEnrolls: 116, organicEnrolls: 374, totalEnrolls: 490,
    b2bEnrolls: 22, totalEnrollsExB2B: 468,
    totalLeads: 5063, leadsExBots: 5063, leadCvr: 9.2,
    cpl: 44, cpe: 473, ppcRoas: 2.7, blendedRoas: 9.5,
    ppcSpend: 168964, totalSpend: 221363, avgNetRev: 3029,
    // Channel detail from the CBS Fall 2025 cohort doc
    // (1R8qzrOg2xuP0dmRNxYS1iizglfnBnU8oi9Yir93fXkE)
    channelEnrolls: {
      ppc: 101, email: 133, organicSearch: 58, website: 17,
      referrals: 33, sponsored: 15, affiliates: 52, offline: 78,
    },
  },
  {
    cohort: 'Winter 2026', shortLabel: "W'26", school: 'columbia', certCount: 1,
    paidEnrolls: 126, organicEnrolls: 359, totalEnrolls: 485,
    b2bEnrolls: 0, totalEnrollsExB2B: 485,
    totalLeads: 4428, leadsExBots: 4428, leadCvr: 11.0,
    cpl: 53, cpe: 479, ppcRoas: 2.8, blendedRoas: 9.4,
    ppcSpend: 181676, totalSpend: 232551, avgNetRev: 3029,
    channelEnrolls: {
      ppc: 117, email: 110, organicSearch: 59, social: 1, website: 15,
      referrals: 37, sponsored: 6, affiliates: 6, offline: 129,
    },
  },
];

export const ALL_HISTORY: CohortHistory[] = [...WHARTON_HISTORY, ...COLUMBIA_HISTORY];

// Current Wharton cohort (Spring 2026, in progress) — channel-attributed
// enrollments from the cohort doc "Channel Tables" tab, Current Cohort column.
// Snapshot 2026-06-10. Total (847) differs slightly from the dashboard
// real-time figure (961) because only channel-attributed enrollments appear here.
export const WHARTON_CURRENT_CHANNELS = {
  cohort: 'Spring 2026',
  shortLabel: "S'26*",
  inProgress: true,
  total: 847,
  channelEnrolls: {
    ppc: 356, aiReferral: 20, organicSearch: 97, email: 64, referrals: 26,
    sponsored: 9, affiliates: 57, social: 3, website: 20, offline: 195,
  } as Partial<Record<import('./types').ChannelKey, number>>,
};

// Combined (Wharton + Columbia) marketing efficiency by calendar cohort —
// from the "Cohort Performance" summary block in the source sheet.
export const COMBINED_EFFICIENCY = [
  { cohort: "C1'25", totalLeads: 19321, b2cEnrolls: 1191, leadCvr: 6.2, cpl: 39, cpe: 632, ppcRoas: 3.2, blendedRoas: 7.1, callout: 'Riverside investment' },
  { cohort: "C2'25", totalLeads: 24999, b2cEnrolls: 1450, leadCvr: 5.8, cpl: 40, cpe: 681, ppcRoas: 2.5, blendedRoas: 6.8, callout: 'AI launch + start of bot issue' },
  { cohort: "C3'25", totalLeads: 21377, b2cEnrolls: 1365, leadCvr: 6.4, cpl: 48, cpe: 758, ppcRoas: 2.2, blendedRoas: 6.1, callout: 'Bot issue' },
  { cohort: "C1'26", totalLeads: 23915, b2cEnrolls: 1506, leadCvr: 6.3, cpl: 44, cpe: 693, ppcRoas: 2.6, blendedRoas: 6.7 },
] as const;
