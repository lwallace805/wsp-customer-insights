// Static fallback snapshot of the current active cohorts — used when the
// live Google Sheets layer is unavailable (missing credentials/env vars).
//
// Source: "Marketing Dashboard Draft" Google Sheet
//   https://docs.google.com/spreadsheets/d/1KvuoY8XlNAIaas9ys8WNZT78nkuh8OzQtMDFBGEH_ug
// Enrollment/lead data updated through 2026-06-09; info sessions through 2026-05-31.
//
// Forecast models per source: Wharton = 60/40 weighted on Winter 2026 +
// Spring 2025 cohorts; CBS = 60/40 weighted on Winter 2026 + Fall 2025.

import type { CurrentSnapshot } from './types';

export const CURRENT_SNAPSHOT: CurrentSnapshot = {
  asOf: '2026-06-09',
  live: false,
  // Which cohort each school's "current" numbers describe. Update when the
  // COHORT_DOC_ID env vars are pointed at new cohort docs.
  cohortLabels: { wharton: 'Spring 2026', columbia: 'Winter 2026' },
  forecastNote:
    'Wharton forecast: 60/40 weighted model on Winter 2026 + Spring 2025. CBS forecast: 60/40 weighted on Winter 2026 + Fall 2025.',
  programs: [
    {
      program: 'ai',
      enrolls: { realTime: 195, forecast: 115, finalTarget: 468 },
      leads: { realTime: 2987, forecast: 2594, finalTarget: 4680 },
      leadCvr: 10.0,
      infoSessionRsvps: { realTime: 498, baseline: 349, target: null },
    },
    {
      program: 'pe',
      enrolls: { realTime: 242, forecast: 307, finalTarget: 323 },
      leads: { realTime: 4116, forecast: 6080, finalTarget: 6111 },
      leadCvr: 5.3,
      infoSessionRsvps: { realTime: 898, baseline: 1119, target: 1200 },
    },
    {
      program: 're',
      enrolls: { realTime: 254, forecast: 347, finalTarget: 363 },
      leads: { realTime: 3782, forecast: 5272, finalTarget: 5508 },
      leadCvr: 6.6,
      infoSessionRsvps: { realTime: 1832, baseline: 1066, target: 1130 },
    },
    {
      program: 'fpa',
      enrolls: { realTime: 260, forecast: 282, finalTarget: 300 },
      leads: { realTime: 5823, forecast: 6572, finalTarget: 6881 },
      leadCvr: 4.4,
    },
    {
      program: 'avi',
      enrolls: { realTime: 94, forecast: 108, finalTarget: 114 },
      leads: { realTime: 1784, forecast: 2345, finalTarget: 2413 },
      leadCvr: 4.7,
      infoSessionRsvps: { realTime: 433, baseline: 722, target: 775 },
    },
    {
      program: 'rdi',
      enrolls: { realTime: 111, forecast: 124, finalTarget: 125 },
      leads: { realTime: 1446, forecast: 2625, finalTarget: 2654 },
      leadCvr: 7.7, // computed: 111 / 1,446 (blank in source dashboard)
      infoSessionRsvps: { realTime: 862, baseline: 0, target: 245 },
    },
  ],
  paidVsOrganic: {
    wharton: { paid: 49, organic: 51, priorCohortPaid: 48, priorYearPaid: 48 },
    columbia: { paid: 19, organic: 81, priorCohortPaid: 39, priorYearPaid: 29 },
  },
  channelMix: {
    wharton: [
      { channel: 'PPC', current: 41, priorCohort: 37, priorYear: 37 },
      { channel: 'AI Referral', current: 2, priorCohort: 2, priorYear: 1 },
      { channel: 'Organic Search', current: 11, priorCohort: 11, priorYear: 10 },
      { channel: 'WSP Customer', current: 10, priorCohort: 11, priorYear: 8 },
      { channel: 'Referrals', current: 3, priorCohort: 3, priorYear: 7 },
      { channel: 'Sponsored Content', current: 1, priorCohort: 1, priorYear: 3 },
      { channel: 'Paid Affiliates', current: 6, priorCohort: 9, priorYear: 7 },
      { channel: 'Organic Social', current: 0, priorCohort: 1, priorYear: 1 },
      { channel: 'SEO', current: 3, priorCohort: 2, priorYear: 3 },
    ],
    columbia: [
      { channel: 'PPC', current: 17, priorCohort: 32, priorYear: 21 },
      { channel: 'AI Referral', current: 2, priorCohort: 5, priorYear: 3 },
      { channel: 'Organic Search', current: 12, priorCohort: 13, priorYear: 5 },
      { channel: 'WSP Customer', current: 26, priorCohort: 12, priorYear: 29 },
      { channel: 'Referrals', current: 11, priorCohort: 9, priorYear: 4 },
      { channel: 'Sponsored Content', current: 1, priorCohort: 0, priorYear: 5 },
      { channel: 'Paid Affiliates', current: 1, priorCohort: 7, priorYear: 4 },
      { channel: 'Organic Social', current: 1, priorCohort: 1, priorYear: 3 },
      { channel: 'SEO', current: 3, priorCohort: 3, priorYear: 11 },
    ],
  },
};
