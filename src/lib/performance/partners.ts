// ─── Partner (school) registry — client-safe ──────────────────────────────────
//
// The top-level filter on /paid-aggregate and /channels. Each partner is a
// different set of source docs, so this is a scope above the program pills:
// switching partner re-fetches, it doesn't re-slice.
//
//   wharton — Wharton Online certificates (PE / RE / FP&A / AVI / RDI).
//             Paid figures come from the Wharton funnel doc's
//             "Paid Marketing Aggregate" tab; channels from the Wharton
//             cohort performance doc.
//   cbs     — the CBS (Columbia Business School) AI certificate, a single
//             program tracked in its own cohort performance doc. That doc has
//             no "Paid Marketing Aggregate" tab, so its paid view is built
//             from the doc's own "Paid WoW Performance & Goals" channel blocks
//             — see buildCbsPaidAggregate in paidAggregate.ts.
//
// No process.env access here: this module is imported by client components.

export type PartnerKey = 'wharton' | 'cbs';

export const PARTNER_ORDER: PartnerKey[] = ['wharton', 'cbs'];

export const PARTNER_DISPLAY: Record<PartnerKey, string> = {
  wharton: 'Wharton',
  cbs: 'CBS AI',
};

/** Parse a `?partner=` value. Anything unrecognised falls back to Wharton,
 *  which is what every existing link and bookmark means. */
export function partnerKeyFor(v: string | null | undefined): PartnerKey {
  return String(v ?? '').trim().toLowerCase() === 'cbs' ? 'cbs' : 'wharton';
}
