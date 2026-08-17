// ─── Partner (external) access gate ───────────────────────────────────────────
//
// The Wharton team gets ONE dashboard (/wharton) and nothing else. They have no
// @wallstreetprep.com Google account, so NextAuth can't let them in — and giving
// them a NextAuth session would be worse than useless, because middleware treats
// any valid token as access to the WHOLE hub. So this is a deliberately separate,
// narrower credential:
//
//   shared password  →  signed cookie, 30 days  →  /wharton and /api/wharton only
//
// Properties that matter:
//  - The cookie is a signed assertion, not a password store: it carries an expiry
//    and a fingerprint of the password that minted it, so ROTATING the password
//    instantly invalidates every cookie already handed out. That's the revocation
//    story — there is no session table to clear.
//  - HttpOnly + SameSite=Lax + Secure(prod): not readable from JS, not sent
//    cross-site.
//  - Web Crypto (not node:crypto) because this is verified in middleware, which
//    runs on the edge runtime.
//
// Fails CLOSED: with no password or no signing secret configured, nobody gets in.
// A misconfigured deploy must not silently publish enrollment data.

/** Cookie carrying the signed partner grant. */
export const PARTNER_COOKIE = 'wsp_partner_wharton';

/** How long a single password entry lasts. Andrew's ask: enter it once a month. */
export const PARTNER_MAX_AGE_DAYS = 30;

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return b64url(new Uint8Array(digest));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

/** The configured shared password, or null when the gate isn't set up. */
export function partnerPassword(): string | null {
  const p = process.env.WHARTON_ACCESS_PASSWORD;
  return p && p.length > 0 ? p : null;
}

/** Signing secret for the cookie. Its own env var so the partner grant can be
 *  invalidated without rotating NEXTAUTH_SECRET (which would sign every
 *  internal user out); falls back to NEXTAUTH_SECRET so a deploy that only sets
 *  the password still works. */
function signingSecret(): string | null {
  const s = process.env.WHARTON_COOKIE_SECRET || process.env.NEXTAUTH_SECRET;
  return s && s.length > 0 ? s : null;
}

/** True when the gate can actually be used (password + secret both present). */
export function partnerGateConfigured(): boolean {
  return partnerPassword() !== null && signingSecret() !== null;
}

/** Short fingerprint of the current password. Embedded in the token so a
 *  password change invalidates outstanding cookies. */
async function passwordFingerprint(password: string): Promise<string> {
  return (await sha256(`wharton:${password}`)).slice(0, 16);
}

/** Constant-time-ish comparison. Length is not secret here (both sides are
 *  fixed-width hashes), and the loop doesn't short-circuit on the first
 *  mismatching byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checks a submitted password against the configured one. */
export function checkPartnerPassword(submitted: string): boolean {
  const expected = partnerPassword();
  if (!expected) return false;
  return safeEqual(submitted, expected);
}

/** Mint a grant token valid for PARTNER_MAX_AGE_DAYS. Returns null when the
 *  gate isn't configured. */
export async function mintPartnerToken(now = Date.now()): Promise<string | null> {
  const password = partnerPassword();
  const secret = signingSecret();
  if (!password || !secret) return null;

  const exp = now + PARTNER_MAX_AGE_DAYS * 86400000;
  const payload = `v1.${exp}.${await passwordFingerprint(password)}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload));
  return `${payload}.${b64url(new Uint8Array(sig))}`;
}

/** Verify a cookie value. Rejects on: gate unconfigured, malformed token,
 *  expired, password rotated since it was minted, or bad signature. */
export async function verifyPartnerToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const password = partnerPassword();
  const secret = signingSecret();
  if (!password || !secret) return false;

  const parts = token.split('.');
  if (parts.length !== 4) return false;
  const [version, expRaw, fingerprint, sig] = parts;
  if (version !== 'v1') return false;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= now) return false;
  if (!safeEqual(fingerprint, await passwordFingerprint(password))) return false;

  const payload = `${version}.${expRaw}.${fingerprint}`;
  const expected = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload));
  return safeEqual(sig, b64url(new Uint8Array(expected)));
}

/** Cookie attributes shared by the login route (set) and logout (clear). */
export function partnerCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
