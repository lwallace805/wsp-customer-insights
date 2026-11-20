// ─── Who may sign in to the internal hub ─────────────────────────────────────
//
// Three sources, checked in this order:
//   1. Any Google account on @wallstreetprep.com — the default, unchanged.
//   2. Any Google account on a partner domain listed in ALLOWED_EXTERNAL_DOMAINS:
//      a comma-separated list of bare domains (e.g. `ibhero.com`) whose whole
//      team should reach the hub without being listed one address at a time.
//   3. Specific outside addresses listed in ALLOWED_EXTERNAL_EMAILS: a
//      comma-separated allowlist for ad hoc guests (a contractor's Gmail, a
//      partner's Workspace account) who need the WHOLE hub, not one page.
//      For one-page access use the partner gate instead (partnerAccess.ts).
//
// The same predicate runs at sign-in (auth.ts) AND on every request in
// middleware. Sessions are 30-day JWTs, so checking only at sign-in would let a
// removed guest keep their access until the token expired; checking in
// middleware makes "delete the entry, redeploy" take effect on the next request.
//
// Everything is matched case-insensitively against the address Google reports
// for the account — list an address exactly as the guest's Google account
// spells it. A domain entry admits that domain only: `ibhero.com` does not
// admit `mail.ibhero.com`, and an entry that is really an address (still
// contains `@` once a leading `@` is dropped) is ignored rather than widened.
//
// Edge-safe: no Node imports, so middleware can use it.

export const INTERNAL_DOMAIN = 'wallstreetprep.com';

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** Split a comma/semicolon/whitespace-separated env var into trimmed, lowercased entries. */
function entries(raw: string | undefined): string[] {
  return (raw ?? '').split(/[,;\s]+/).map(normalize).filter(e => e.length > 0);
}

/** The domain of an address, or '' unless it is `local@domain` with exactly one `@`. */
function domainOf(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return '';
  return parts[1];
}

/** Parsed address allowlist. Read on every call rather than cached at module
 *  load so a changed env var is honoured without a restart in dev; the cost is
 *  a split of a short string. */
export function allowedExternalEmails(): Set<string> {
  return new Set(entries(process.env.ALLOWED_EXTERNAL_EMAILS).filter(e => e.includes('@')));
}

/** Parsed domain allowlist: bare domains, a leading `@` tolerated. */
export function allowedExternalDomains(): Set<string> {
  return new Set(
    entries(process.env.ALLOWED_EXTERNAL_DOMAINS)
      .map(d => (d.startsWith('@') ? d.slice(1) : d))
      .filter(d => d.length > 0 && !d.includes('@')),
  );
}

export function isInternalEmail(email: string | null | undefined): boolean {
  return domainOf(normalize(email)) === INTERNAL_DOMAIN;
}

export function isAllowedExternalDomain(email: string | null | undefined): boolean {
  const domain = domainOf(normalize(email));
  return domain.length > 0 && allowedExternalDomains().has(domain);
}

export function isAllowedExternalEmail(email: string | null | undefined): boolean {
  const e = normalize(email);
  return e.length > 0 && allowedExternalEmails().has(e);
}

/** The one predicate both gates use: internal domain, partner domain, or on the address allowlist. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  return isInternalEmail(email) || isAllowedExternalDomain(email) || isAllowedExternalEmail(email);
}
