// GA4 weekly traffic — sessions by channel, sitewide YoY, and key page-group
// YoY series (certificate pages, self-study pages).
//
// Source: "WSP Traffic Tracking" Google Sheet
//   https://docs.google.com/spreadsheets/d/1wFqx_RHaASMbvf-fcWmBhR1mHi2rDEg9tmYvRnAnUhc
// Snapshot taken 2026-06-10. Channel-level data populated through week of
// 4/12/2026; page-group YoY series through week of 5/31/2026.
//
// Data quality notes from source:
// - 2026 week of 1/25: AI traffic shows 32,588 (vs ~3,300 typical) — value
//   retained as-is from source; likely a data-entry artifact.
// - From week of 3/1/2026, Direct jumps ~3x while Other drops ~4x — appears
//   to be a GA4 channel reclassification, not a real traffic shift.

import type { YoYWeeklySeries } from './types';

// Week-start labels shared by all series (index-aligned).
export const WEEK_LABELS_2026 = [
  '1/1', '1/4', '1/11', '1/18', '1/25', '2/1', '2/8', '2/15', '2/22',
  '3/1', '3/8', '3/15', '3/22', '3/29', '4/5', '4/12', '4/19', '4/26',
  '5/3', '5/10', '5/17', '5/24', '5/31',
] as const;

export interface ChannelTrafficYear {
  year: 2025 | 2026;
  seo: (number | null)[];
  ai: (number | null)[];
  direct: (number | null)[];
  paid: (number | null)[];
  other: (number | null)[];
  total: (number | null)[];
}

export const CHANNEL_TRAFFIC: ChannelTrafficYear[] = [
  {
    year: 2025,
    seo:    [68670, 208329, 228635, 238079, 246745, 251921, 263012, 265018, 256218, 245368, 236299, 249315, 257956, 235549, 255993, null, null, null, null, null, null, null, null],
    ai:     [649, 1877, 2046, 1940, 2208, 2545, 2669, 2671, 2614, 2529, 2504, 3098, 3151, 3006, 2918, null, null, null, null, null, null, null, null],
    direct: [17586, 46398, 47723, 46853, 47021, 48755, 49371, 48874, 49371, 50937, 51304, 57437, 57210, 55822, 47686, null, null, null, null, null, null, null, null],
    paid:   [9508, 25706, 25461, 24808, 25373, 28142, 26310, 25517, 24719, 24906, 25312, 26532, 28045, 26453, 28913, null, null, null, null, null, null, null, null],
    other:  [12104, 31321, 33593, 32885, 30416, 34574, 46743, 48211, 44335, 44280, 43350, 44527, 47212, 39051, 31355, null, null, null, null, null, null, null, null],
    total:  [108517, 313631, 337458, 344565, 351763, 365937, 388105, 390291, 377257, 368020, 358769, 380909, 393574, 359881, 366865, null, null, null, null, null, null, null, null],
  },
  {
    year: 2026,
    seo:    [33838, 129774, 143831, 141483, 147456, 157031, 149078, 134978, 142962, 133112, 122166, 114742, 119518, 113155, 116720, 97342, null, null, null, null, null, null, null],
    ai:     [1067, 3262, 3395, 3376, 32588, 3454, 3094, 3111, 3023, 2926, 2859, 2701, 3119, 2947, 3016, null, null, null, null, null, null, null, null],
    direct: [26858, 66706, 63286, 46745, 47712, 46712, 45489, 49593, 64718, 157562, 174604, 174508, 170765, 168638, 184188, null, null, null, null, null, null, null, null],
    paid:   [6696, 20502, 21000, 20056, 20794, 15411, 19645, 20771, 19878, 19174, 18490, 18978, 18963, 18413, 19716, null, null, null, null, null, null, null, null],
    other:  [61794, 148797, 144923, 150618, 145785, 150552, 66273, 32414, 31244, 44056, 32687, 34100, 44635, 33246, 24087, null, null, null, null, null, null, null, null],
    total:  [130253, 369041, 376435, 362278, 394335, 373160, 283579, 240867, 261825, 356830, 350806, 345029, 357000, 336399, 347727, 97342, null, null, null, null, null, null, null],
  },
];

export const SITEWIDE_YOY: YoYWeeklySeries = {
  label: 'Sitewide Sessions',
  y2025: [108250, 320534, 342924, 343435, 345663, 371135, 393578, 381246, 382883, 367953, 357968, 380180, 394537, 356958, 370407, null, null, null, null, null, null, null, null],
  y2026: [131935, 366124, 377748, 360015, 373989, 370826, 285304, 235995, 268357, 357139, 348025, 345051, 353748, 336036, 348354, null, null, null, null, null, null, null, null],
};

export const CERT_PAGES_WHARTON_YOY: YoYWeeklySeries = {
  label: 'Certificate Pages — Wharton',
  y2025: [14752, 41941, 40576, 41785, 40756, 55103, 35476, 19171, 18607, 30423, 36758, 34477, 32387, 34224, 32226, 28468, 37187, 35646, 43304, 54322, 46293, 56162, 53818],
  y2026: [11874, 32152, 30393, 29359, 26262, 29057, 20788, 9741, 7770, 8900, 11362, 16112, 22697, 25046, 27590, 44047, 50357, 48113, 53492, 50961, 58497, 64962, 51162],
};

export const CERT_PAGES_COLUMBIA_YOY: YoYWeeklySeries = {
  label: 'Certificate Pages — Columbia',
  y2025: [null, null, null, null, null, null, null, null, null, null, 675, 3317, 14809, 10130, 8361, 10106, 9621, 10066, 7719, 7331, 8239, 7477, 11830],
  y2026: [null, null, null, null, null, null, null, null, null, null, 16574, 10859, 4820, 2258, 2437, 3443, 6980, 10293, 9074, 8700, 8029, 10658, 8470],
};

export const SELF_STUDY_PAGES_YOY: YoYWeeklySeries = {
  label: 'Self-Study Pages',
  y2025: [6605, 18296, 18063, 17491, 18326, 19756, 20203, 21076, 19425, 18640, 18111, 19267, 19585, 18227, 18838, null, null, null, null, null, null, null, null],
  y2026: [12155, 27456, 20586, 17756, 18271, 18097, 17855, 16987, 16841, 17253, 16072, 16504, 16496, 14756, 15010, null, null, null, null, null, null, null, null],
};
