// Per-program lead volume and lead→enrollment CVR by cohort.
//
// Source: "Wharton + Columbia Historical Performance" Google Sheet
//   https://docs.google.com/spreadsheets/d/1R5XiIsJ_rjcwjc9VBkftGs6WglEvnCR_VaYybgNRiJM
// Snapshot taken 2026-06-10.
//
// Data quality notes from source:
// - Fall 2025 / Winter 2026 per-program leads and CVR cells are corrupted in
//   the source sheet (bot-issue artifacts, #VALUE! errors) — stored as null.
// - AVI Spring 2025 leads repeat PE's value in the source sheet (likely a
//   formula error); retained as-is to match the source.

import type { ProgramHistory } from './types';

export const PROGRAM_HISTORY: ProgramHistory[] = [
  {
    program: 'pe',
    stats: [
      { cohort: 'Spring 2024', leads: 5086, cvr: 7.0 },
      { cohort: 'Fall 2024',   leads: 5749, cvr: 6.7 },
      { cohort: 'Winter 2025', leads: 5789, cvr: 6.5 },
      { cohort: 'Spring 2025', leads: 5689, cvr: 5.5 },
      { cohort: 'Fall 2025',   leads: null, cvr: null },
      { cohort: 'Winter 2026', leads: null, cvr: null },
    ],
  },
  {
    program: 're',
    stats: [
      { cohort: 'Spring 2024', leads: 4564, cvr: 6.8 },
      { cohort: 'Fall 2024',   leads: 5263, cvr: 6.8 },
      { cohort: 'Winter 2025', leads: 5836, cvr: 6.5 },
      { cohort: 'Spring 2025', leads: 7421, cvr: 4.6 },
      { cohort: 'Fall 2025',   leads: null, cvr: null },
      { cohort: 'Winter 2026', leads: null, cvr: null },
    ],
  },
  {
    program: 'fpa',
    stats: [
      { cohort: 'Spring 2024', leads: 4250, cvr: 6.4 },
      { cohort: 'Fall 2024',   leads: 4656, cvr: 6.3 },
      { cohort: 'Winter 2025', leads: 4591, cvr: 6.3 },
      { cohort: 'Spring 2025', leads: 7227, cvr: 3.6 },
      { cohort: 'Fall 2025',   leads: null, cvr: null },
      { cohort: 'Winter 2026', leads: null, cvr: null },
    ],
  },
  {
    program: 'avi',
    stats: [
      { cohort: 'Spring 2024', leads: 2569, cvr: 4.7 },
      { cohort: 'Fall 2024',   leads: 3237, cvr: 3.5 },
      { cohort: 'Winter 2025', leads: 3105, cvr: 4.5 },
      { cohort: 'Spring 2025', leads: 5689, cvr: 2.2 },
      { cohort: 'Fall 2025',   leads: null, cvr: null },
      { cohort: 'Winter 2026', leads: null, cvr: null },
    ],
  },
  {
    program: 'ai',
    stats: [
      { cohort: 'Summer 2025', leads: 6749, cvr: 6.1 },
      { cohort: 'Fall 2025',   leads: 5063, cvr: 9.2 },
      { cohort: 'Winter 2026', leads: 4428, cvr: 11.0 },
    ],
  },
];

// Fall 2025 vs Spring 2025 per-program info-session leads change (the one
// clean F'25 program comparison in the source).
export const FALL25_LEAD_CHANGE = [
  { program: 'pe' as const,  fall2025: 252, spring2025: 313, pctChange: -19 },
  { program: 're' as const,  fall2025: 277, spring2025: 339, pctChange: -18 },
  { program: 'fpa' as const, fall2025: 274, spring2025: 260, pctChange: 5 },
  { program: 'avi' as const, fall2025: 94,  spring2025: 123, pctChange: -24 },
];
