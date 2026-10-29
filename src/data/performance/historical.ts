// Historical cohort performance — Wharton (Spring 2023 → Fall 2026) and
// Columbia/CBS (Summer 2025 → Spring 2026).
//
// Source: the "Professional Certificates Channel Performance" tracker (the
// Summary Cohort Tracker), Google Sheet id 16Me7guESIVYQsIUsVk2y9bWYYtMu9RbBm8X-dWtpZFk
//   · "AN Copy Summary" tab — one column per cohort: the paid/organic/total/
//     B2B enrollment rows, leads and bot-adjusted leads, CVR, CPL, CPE, PPC and
//     blended ROAS, PPC and total spend, and avg. net revenue. Its "C2'26"-style
//     codes (row 4) are COMBINED_EFFICIENCY's labels; the combined "Cohort
//     Performance" / "Marketing Efficiency" block starts at row 82.
//   · "<School> <Term> Cohort" tabs — per-channel enrollments and direct spend.
//   · "Program ROAS Analysis" tab — per-program B2C enrollments by cohort and
//     the combined Cohort Total ROAS rows.
// (The June 2026 header cited sheet 1R5XiIsJ_rjcwjc9VBkftGs6WglEvnCR_VaYybgNRiJM;
// that is the "WSP Professional Certificate Marketing Playbooks and Performance
// Documents" index, which links to this tracker — not a data sheet.)
// Snapshot taken 2026-06-10 through Winter 2026; Spring 2026 (both schools) and
// Wharton Fall 2026 added 2026-10-29, when every earlier row was re-checked
// against the sheet (only the ROAS and net-revenue cells noted below had moved).
// Re-sync by asking Claude to re-read the sheet.
//
// Notes from source:
// - Enrollments are during the cohort marketing cycle, net of refunds.
// - ROAS is on the sheet's own AOV basis: $4,660 from C2'25 (Spring 2025)
//   onward ("AOV Increased from $4,500 to $4,660 starting in C2'25"), $4,500
//   before. The June snapshot still had the S'25 → W'26 rows (both schools) on
//   $4,500; on 2026-10-29 they were re-synced to the sheet's current ROAS cells
//   (AN Copy Summary rows 24–25 — e.g. Wharton W'26 2.4x / 5.7x → 2.5x / 5.9x,
//   Columbia W'26 2.8x / 9.4x → 2.9x / 9.7x).
// - Leads exclude bot traffic in Wharton S'25 and F'25 where noted
//   ("leadsExBots"); raw lead counts retained in totalLeads.
// - B2B = enterprise (sales-led, cohort-agnostic) + B2B cohort enrollments.
// - avgNetRev is the sheet's "Avg. Net Rev (Inc. to $4,660 AOV Spring 25)" row
//   (AN Copy Summary row 32): $2,700 for Wharton S'23 → W'25, $2,796 from S'25
//   on, $3,029 for Columbia.

import type { CohortHistory } from './types';

export const WHARTON_HISTORY: CohortHistory[] = [
  {
    cohort: 'Spring 2023', shortLabel: "S'23", school: 'wharton', certCount: 1,
    paidEnrolls: 127, organicEnrolls: 383, totalEnrolls: 510,
    b2bEnrolls: 0, totalEnrollsExB2B: 510,
    totalLeads: 5363, leadsExBots: null, leadCvr: 9.5,
    cpl: 39, cpe: 408, ppcRoas: 3.4, blendedRoas: 11.0,
    ppcSpend: 150930, totalSpend: 208044, avgNetRev: 2700,
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
    ppcSpend: 147108, totalSpend: 208644, avgNetRev: 2700,
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
    ppcSpend: 148382, totalSpend: 204616, avgNetRev: 2700,
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
    ppcSpend: 593629, totalSpend: 777215, avgNetRev: 2700,
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
    ppcSpend: 643048, totalSpend: 767728, avgNetRev: 2700,
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
    ppcSpend: 673832, totalSpend: 752164, avgNetRev: 2700,
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
    cpl: 41, cpe: 718, ppcRoas: 2.7, blendedRoas: 6.5,
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
    cpl: 50, cpe: 907, ppcRoas: 2.0, blendedRoas: 5.1,
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
    cpl: 42, cpe: 794, ppcRoas: 2.5, blendedRoas: 5.9,
    ppcSpend: 737158, totalSpend: 810733, avgNetRev: 2796,
    channelEnrolls: {
      ppc: 401, email: 96, organicSearch: 119, aiReferral: 21, social: 1,
      website: 18, referrals: 31, sponsored: 12, affiliates: 99, offline: 223,
    },
  },
  // Spring 2026 (closed 2026-06-15). AN Copy Summary column L: L6 paid 401,
  // L7 organic 601, L8 total 1,002, L9 B2B 9, L11 ex-B2B 993, L17/L18 leads
  // 17,145 (no bot filter), L19 CVR 5.79%, L21 CPL 61.91, L22 CPE 1,068.85,
  // L24 PPC ROAS 1.871, L25 blended 4.360 ($4,660 AOV), L27 PPC spend
  // 958,669.82, L30 total spend 1,061,369.82, L32 avg net rev 2,796. Channels
  // from the "Wharton Spring 2026 Cohort" tab rows 8–20 (sum to the 993).
  {
    cohort: 'Spring 2026', shortLabel: "S'26", school: 'wharton', certCount: 5,
    paidEnrolls: 401, organicEnrolls: 601, totalEnrolls: 1002,
    b2bEnrolls: 9, totalEnrollsExB2B: 993,
    totalLeads: 17145, leadsExBots: 17145, leadCvr: 5.8,
    cpl: 62, cpe: 1069, ppcRoas: 1.9, blendedRoas: 4.4,
    ppcSpend: 958670, totalSpend: 1061370, avgNetRev: 2796,
    // That tab's "Organic Search" (B10) and "Ai Referral" (B11) ENROLLS are
    // transposed: 21 and 102 against 1,514 and 146 leads (a 70% AI-referral
    // CVR), while the cohort doc's frozen Channel Tables read 94 / 20 and W'26
    // read 119 / 21. Recorded un-swapped; the sheet itself still needs fixing.
    channelEnrolls: {
      ppc: 385, email: 105, organicSearch: 102, aiReferral: 21, social: 6,
      website: 26, referrals: 29, sponsored: 16, affiliates: 100, offline: 203,
    },
    callout: 'RDI launch — expansion to 5 certificates (PE, RE, FP&A, AVI, RDI)',
  },
  // Fall 2026 (closed 2026-10-13) is the first cohort the tracker reports on
  // its V2 attribution model (Paid / Non-Paid → Channel → Sub-Channel). The
  // "AN Copy Summary" tab has no Fall 2026 column yet, so these come from the
  // "Summary" tab column M — M9 paid 496, M10 organic 461, M11 total 957, M12
  // B2B 4, M14 ex-B2B 953, M20/M21 leads 15,325, M22 CVR 6.24%, M24 CPL 68.68,
  // M25 CPE 1,099.74, M27 PPC ROAS 2.22, M28 blended 4.27 — and the "Wharton
  // Fall 2026 Cohort" tab: PPC spend = Paid Search H10 659,477 + Paid Social
  // H13 294,541 + Paid Other H16 14,204; total spend H41 1,052,448.43; channel
  // rows 10–40 mapped onto the legacy keys per the Fall 2026 doc's "Channel
  // Definitions" tab. Three breaks from the earlier rows, flagged in the callout:
  //   · "paid" is the V2 Paid tier (PPC + Paid Other + Paid Affiliate +
  //     Sponsored Content), so it counts the 53 affiliate enrollments the
  //     earlier rows leave in "organic"; on the old PPC + sponsored definition
  //     paid = 443 and organic = 514. ppcRoas is that tier's ROAS too; the PPC
  //     slice alone (Paid Search + Paid Social: 427 enrolls on $954K) is ≈2.1x.
  //   · CPE and CVR divide by 957 incl. B2B where earlier rows use the ex-B2B
  //     count; on 953, CPE is $1,104 and CVR 6.22%.
  //   · The tab's ROAS cells reconcile to a $4,700 AOV on every platform row,
  //     not the $4,660 the Spring 2026 tabs use.
  // avgNetRev carried from Spring 2026 (no Fall 2026 column on the net-rev row).
  {
    cohort: 'Fall 2026', shortLabel: "F'26", school: 'wharton', certCount: 5,
    paidEnrolls: 496, organicEnrolls: 461, totalEnrolls: 957,
    b2bEnrolls: 4, totalEnrollsExB2B: 953,
    totalLeads: 15325, leadsExBots: 15325, leadCvr: 6.2,
    cpl: 69, cpe: 1100, ppcRoas: 2.2, blendedRoas: 4.3,
    ppcSpend: 968222, totalSpend: 1052448, avgNetRev: 2796,
    // V2 → legacy keys: ppc = Paid Search 278 + Paid Social 149 + Paid Other
    // (Employer Test) 3; email = Lifecycle 13 + Wall Street Prep Leads 57 +
    // Purchasers 13; website = Wall Street Prep Banner 24 (EML / Financial
    // Edge 0); offline = Direct 85 + Enrollment (consultation, inbound) 29 +
    // Offline (SamCart) 50; social = Organic Social 3. Sums to the 953.
    channelEnrolls: {
      ppc: 430, email: 83, organicSearch: 110, aiReferral: 12, social: 3,
      website: 24, referrals: 61, sponsored: 13, affiliates: 53, offline: 164,
    },
    callout: 'V2 attribution model — "paid" now includes affiliates (496; 443 on the prior PPC + sponsored definition) and CPE/CVR divide by the total incl. B2B',
  },
];

// Columbia / CBS — AI for Business & Finance. Source table is ordered
// Summer 2025 → Fall 2025 → Winter 2026 → Spring 2026.
export const COLUMBIA_HISTORY: CohortHistory[] = [
  {
    cohort: 'Summer 2025', shortLabel: "Su'25", school: 'columbia', certCount: 1,
    paidEnrolls: 109, organicEnrolls: 336, totalEnrolls: 445,
    b2bEnrolls: 30, totalEnrollsExB2B: 415,
    totalLeads: 6749, leadsExBots: 6761, leadCvr: 6.1,
    cpl: 36, cpe: 591, ppcRoas: 2.0, blendedRoas: 7.9,
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
    cpl: 44, cpe: 473, ppcRoas: 2.8, blendedRoas: 9.9,
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
    cpl: 53, cpe: 479, ppcRoas: 2.9, blendedRoas: 9.7,
    ppcSpend: 181676, totalSpend: 232551, avgNetRev: 3029,
    channelEnrolls: {
      ppc: 117, email: 110, organicSearch: 59, social: 1, website: 15,
      referrals: 37, sponsored: 6, affiliates: 6, offline: 129,
    },
  },
  // Spring 2026 (closed 2026-07-20) — the marketing name used by the tracker
  // tab "CBS Spring 2026 Cohort", the cohort doc and every in-app label; the AN
  // Copy Summary heads the same column "Summer 2026" / C2'26 (academic term).
  // AN Copy Summary column Q: Q6 paid 129, Q7 organic 407, Q8 total 536, Q9 B2B
  // 1, Q11 ex-B2B 535, Q17/Q18 leads 4,871 (no bot filter), Q19 CVR 10.98%,
  // Q21 CPL 50.82, Q22 CPE 462.68, Q24 PPC ROAS 2.810, Q25 blended 10.072
  // ($4,660 AOV), Q27 PPC spend 203,960.51, Q30 total spend 247,535.51, Q32
  // avg net rev 3,029. Channels from the "CBS Spring 2026 Cohort" tab rows
  // 8–20 (sum to the 535). The cohort doc's own Channel Tables split the same
  // 535 differently after its affiliate reconciliation (affiliates 44, offline
  // 122, email 97); the tracker's split is kept for consistency with the
  // Wharton rows.
  {
    cohort: 'Spring 2026', shortLabel: "S'26", school: 'columbia', certCount: 1,
    paidEnrolls: 129, organicEnrolls: 407, totalEnrolls: 536,
    b2bEnrolls: 1, totalEnrollsExB2B: 535,
    totalLeads: 4871, leadsExBots: 4871, leadCvr: 11.0,
    cpl: 51, cpe: 463, ppcRoas: 2.8, blendedRoas: 10.1,
    ppcSpend: 203961, totalSpend: 247536, avgNetRev: 3029,
    channelEnrolls: {
      ppc: 123, email: 82, organicSearch: 64, aiReferral: 13, social: 3,
      website: 14, referrals: 54, sponsored: 6, affiliates: 23, offline: 153,
    },
  },
];

export const ALL_HISTORY: CohortHistory[] = [...WHARTON_HISTORY, ...COLUMBIA_HISTORY];

// Wharton Spring 2026 channel-attributed enrollments from the cohort doc's
// "Channel Tables" tab, Current Cohort column, snapshot 2026-06-10 (mid-cohort:
// 847 of a real-time 961 — only channel-attributed enrollments appear here).
// The cohort has since CLOSED; its finals are the Spring 2026 row in
// WHARTON_HISTORY. This snapshot only still feeds the Channels page's
// current-cohort comparison and detail table (which have no live source yet);
// ChannelsDashboard no longer draws it as a chart point.
export const WHARTON_CURRENT_CHANNELS = {
  cohort: 'Spring 2026',
  shortLabel: "S'26*",
  inProgress: false,
  total: 847,
  channelEnrolls: {
    ppc: 356, aiReferral: 20, organicSearch: 97, email: 64, referrals: 26,
    sponsored: 9, affiliates: 57, social: 3, website: 20, offline: 195,
  } as Partial<Record<import('./types').ChannelKey, number>>,
};

// Columbia Spring 2026 channel-attributed enrollments from the CBS Spring 2026
// doc "Channel Tables" tab, Current Cohort column
// (1EfNBwZYYObVU3XSiW1VPC_Fi13ZLaQdq_tZZyPxZy14), snapshot 2026-06-10.
// Mapping follows the Wharton convention: "WSP Customer" → email, "SEO" → website.
// Closed since; finals are the Spring 2026 row in COLUMBIA_HISTORY (see the
// Wharton note above for what this snapshot still feeds).
export const COLUMBIA_CURRENT_CHANNELS = {
  cohort: 'Spring 2026',
  shortLabel: "S'26*",
  inProgress: false,
  total: 208,
  channelEnrolls: {
    ppc: 35, aiReferral: 6, organicSearch: 26, email: 54, referrals: 22,
    sponsored: 1, affiliates: 2, social: 2, website: 5, offline: 55,
  } as Partial<Record<import('./types').ChannelKey, number>>,
};

// Combined (Wharton + Columbia) marketing efficiency by calendar cohort — the
// "Cohort Performance" / "Marketing Efficiency" block of the AN Copy Summary
// tab (rows 82–92; its ROAS rows equal the "Program ROAS Analysis" Cohort
// Total rows). Callouts are the block's own "Call outs" row (row 94), which is
// blank for C2'26 — that callout is the RDI row first populated in C2'26 on
// the Program ROAS Analysis tab. C2'26 cells: G83 leads 22,016, G84 B2C
// enrolls 1,528 (993 Wharton + 535 Columbia), G85 CVR 6.94%, G89 CPL 59.45,
// G90 CPE 856.61, G91 PPC ROAS 2.036, G92 blended 5.440. C3'26 waits on
// Columbia Fall 2026, which is still enrolling.
export const COMBINED_EFFICIENCY = [
  { cohort: "C1'25", totalLeads: 19321, b2cEnrolls: 1191, leadCvr: 6.2, cpl: 39, cpe: 632, ppcRoas: 3.2, blendedRoas: 7.1, callout: 'Riverside investment' },
  { cohort: "C2'25", totalLeads: 24999, b2cEnrolls: 1450, leadCvr: 5.8, cpl: 40, cpe: 681, ppcRoas: 2.5, blendedRoas: 6.8, callout: 'AI launch + start of bot issue' },
  { cohort: "C3'25", totalLeads: 21377, b2cEnrolls: 1365, leadCvr: 6.4, cpl: 48, cpe: 758, ppcRoas: 2.2, blendedRoas: 6.1, callout: 'Bot issue' },
  { cohort: "C1'26", totalLeads: 23915, b2cEnrolls: 1506, leadCvr: 6.3, cpl: 44, cpe: 693, ppcRoas: 2.6, blendedRoas: 6.7 },
  { cohort: "C2'26", totalLeads: 22016, b2cEnrolls: 1528, leadCvr: 6.9, cpl: 59, cpe: 857, ppcRoas: 2.0, blendedRoas: 5.4, callout: 'RDI launch' },
] as const;
