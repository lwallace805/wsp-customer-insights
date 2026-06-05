/**
 * Demo mode flag.
 *
 * When NEXT_PUBLIC_DEMO_MODE === '1', the app serves fabricated (synthetic)
 * data instead of hitting Airtable / Google Sheets, and the login switches to
 * a shared-password gate. Used to stand up a public-facing demo deployment
 * (e.g. demo.<domain>) without exposing real customer data.
 *
 * NEXT_PUBLIC_ prefix so both server (data layer) and client (nav badge,
 * login form) can read it.
 */
export function isDemo(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === '1';
}
