// ─── Who may sign in to the internal hub ─────────────────────────────────────
//
// Two sources, checked in this order:
//   1. Any Google account on @wallstreetprep.com — the default, unchanged.
//   2. Specific outside addresses listed in ALLOWED_EXTERNAL_EMAILS: a
//      comma-separated allowlist for ad hoc guests (a contractor's Gmail, a
//      partner's Workspace account) who need the WHOLE hub, not one page.
//      For one-page access use the partner gate instead (partnerAccess.ts).
//
// The same predicate runs at sign-in (auth.ts) AND on every request in
// middleware. Sessions are 30-day JWTs, so checking only at sign-in would let a
// removed guest keep their access until the token expired; checking in
// middleware makes "delete the email, redeploy" take effect on the next request.
//
// Addresses are matched case-insensitively against the address Google reports
// for the account — list it exactly as the guest's Google account spells it.
//
// Edge-safe: no Node imports, so middleware can use it.

export const INTERNAL_DOMAIN = 'wallstreetprep.com';

function normalize(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/** Parsed allowlist. Read on every call rather than cached at module load so
 *  a changed env var is honoured without a restart in dev; the cost is a
 *  split of a short string. */
export function allowedExternalEmails(): Set<string> {
  const raw = process.env.ALLOWED_EXTERNAL_EMAILS ?? '';
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map(normalize)
      .filter(e => e.includes('@')),
  );
}

export function isInternalEmail(email: string | null | undefined): boolean {
  return normalize(email).endsWith(`@${INTERNAL_DOMAIN}`);
}

export function isAllowedExternalEmail(email: string | null | undefined): boolean {
  const e = normalize(email);
  return e.length > 0 && allowedExternalEmails().has(e);
}

/** The one predicate both gates use: internal domain, or on the allowlist. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  return isInternalEmail(email) || isAllowedExternalEmail(email);
}
