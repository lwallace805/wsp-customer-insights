// Per-program lead volume, lead→enrollment CVR, and enrollments by cohort.
//
// Sources:
// - Spring 2024 → Winter 2025: "Wharton + Columbia Historical Performance"
//   rollup sheet (1R5XiIsJ_rjcwjc9VBkftGs6WglEvnCR_VaYybgNRiJM)
// - Spring 2025 → Spring 2026 (current): Wharton Spring 2026 cohort doc,
//   "Channel Tables" tab (1o5lfRmA1nAe0BDnYtZ1OJOnU9eB8y4WeJdGNL0_BE_Y)
// Snapshot taken 2026-06-10.
//
// Notes:
// - AVI was previously labeled "Buy Side" / "Hedge Fund" in older docs —
//   all merged under AVI here.
// - RDI launched with the Spring 2026 cohort; no earlier history exists.
// - Fall 2025 lead counts are bot-inflated (the bot issue was not filtered
//   at the program level), so F'25 CVRs are understated.
// - The two sources differ slightly for Spring 2025 (e.g. PE 5,689 vs 5,603
//   leads) due to bot adjustments; doc values are used from S'25 onward for
//   internal consistency.

import type { ProgramHistory } from './types';

export const PROGRAM_HISTORY: ProgramHistory[] = [
  {
    program: 'pe',
    stats: [
      { cohort: 'Spring 2024', leads: 5086, cvr: 7.0 },
      { cohort: 'Fall 2024',   leads: 5749, cvr: 6.7 },
      { cohort: 'Winter 2025', leads: 5789, cvr: 6.5 },
      { cohort: 'Spring 2025', leads: 5603, cvr: 5.2, enrolls: 293 },
      { cohort: 'Fall 2025',   leads: 7418, cvr: 3.2, enrolls: 238 },
      { cohort: 'Winter 2026', leads: 5615, cvr: 5.2, enrolls: 292 },
      { cohort: 'Spring 2026', leads: 4115, cvr: 5.9, enrolls: 242, inProgress: true },
    ],
  },
  {
    program: 're',
    stats: [
      { cohort: 'Spring 2024', leads: 4564, cvr: 6.8 },
      { cohort: 'Fall 2024',   leads: 5263, cvr: 6.8 },
      { cohort: 'Winter 2025', leads: 5836, cvr: 6.5 },
      { cohort: 'Spring 2025', leads: 7054, cvr: 4.5, enrolls: 316 },
      { cohort: 'Fall 2025',   leads: 8028, cvr: 3.2, enrolls: 259 },
      { cohort: 'Winter 2026', leads: 5270, cvr: 6.5, enrolls: 345 },
      { cohort: 'Spring 2026', leads: 3782, cvr: 6.6, enrolls: 249, inProgress: true },
    ],
  },
  {
    program: 'fpa',
    stats: [
      { cohort: 'Spring 2024', leads: 4250, cvr: 6.4 },
      { cohort: 'Fall 2024',   leads: 4656, cvr: 6.3 },
      { cohort: 'Winter 2025', leads: 4591, cvr: 6.3 },
      { cohort: 'Spring 2025', leads: 6839, cvr: 2.1, enrolls: 147 },
      { cohort: 'Fall 2025',   leads: 9672, cvr: 1.3, enrolls: 128 },
      { cohort: 'Winter 2026', leads: 6092, cvr: 2.7, enrolls: 164 },
      { cohort: 'Spring 2026', leads: 5808, cvr: 4.5, enrolls: 262, inProgress: true },
    ],
  },
  {
    program: 'avi',
    stats: [
      { cohort: 'Spring 2024', leads: 2569, cvr: 4.7 },
      { cohort: 'Fall 2024',   leads: 3237, cvr: 3.5 },
      { cohort: 'Winter 2025', leads: 3105, cvr: 4.5 },
      { cohort: 'Spring 2025', leads: 5389, cvr: 2.1, enrolls: 112 },
      { cohort: 'Fall 2025',   leads: 5407, cvr: 1.6, enrolls: 88 },
      { cohort: 'Winter 2026', leads: 2097, cvr: 4.7, enrolls: 98 },
      { cohort: 'Spring 2026', leads: 1784, cvr: 5.3, enrolls: 94, inProgress: true },
    ],
  },
  {
    program: 'rdi',
    stats: [
      // First cohort — launched Spring 2026. Leads/enrolls from the marketing
      // dashboard tab; CVR computed (111 / 1,446).
      { cohort: 'Spring 2026', leads: 1446, cvr: 7.7, enrolls: 111, inProgress: true },
    ],
  },
  {
    program: 'ai',
    stats: [
      { cohort: 'Summer 2025', leads: 6749, cvr: 6.1 },
      { cohort: 'Fall 2025',   leads: 5063, cvr: 9.2 },
      { cohort: 'Winter 2026', leads: 4428, cvr: 11.0 },
      // Current cohort — from the CBS Spring 2026 doc (195 enrolls / 2,987 leads)
      { cohort: 'Spring 2026', leads: 2987, cvr: 6.5, enrolls: 195, inProgress: true },
    ],
  },
];

// Fall 2025 vs Spring 2025 per-program info-session leads change (the one
// clean F'25 program comparison in the rollup source).
export const FALL25_LEAD_CHANGE = [
  { program: 'pe' as const,  fall2025: 252, spring2025: 313, pctChange: -19 },
  { program: 're' as const,  fall2025: 277, spring2025: 339, pctChange: -18 },
  { program: 'fpa' as const, fall2025: 274, spring2025: 260, pctChange: 5 },
  { program: 'avi' as const, fall2025: 94,  spring2025: 123, pctChange: -24 },
];
