// Values shared by the server-rendered view and the client charts. Kept out of
// the 'use client' module so the server component can call them directly — a
// client module's exports can only cross the boundary as components or props.

/** Categorical slots 1–5 of the validated dark palette, in fixed order.
 *  Assigned to programs by their position in the data, never by rank, so a
 *  program keeps its colour when the standings change mid-cohort. */
export const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];

/** "2026-08-13" → "Aug 13". Split into parts rather than `new Date(ymd)`, which
 *  reads a bare date as UTC and renders the previous day west of Greenwich. */
export function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "2026-08-13" → "August 13, 2026". */
export function longDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
