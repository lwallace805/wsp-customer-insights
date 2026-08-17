import { NextRequest, NextResponse } from 'next/server';
import {
  PARTNER_COOKIE,
  PARTNER_MAX_AGE_DAYS,
  checkPartnerPassword,
  mintPartnerToken,
  partnerCookieOptions,
  partnerGateConfigured,
} from '@/lib/partnerAccess';

// The one path the partner gate leaves open (see middleware). Exchanges the
// shared password for a 30-day signed cookie.

// Throttle so the shared password can't be brute-forced from a single client.
// Per-instance and in-memory: a serverless deploy can spread attempts across
// instances, so this is friction, not a hard limit — the real protection is a
// long random password. Sized to be invisible to a human typing a password.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

function clearAttempts(ip: string) {
  attempts.delete(ip);
}

export async function POST(req: NextRequest) {
  if (!partnerGateConfigured()) {
    return NextResponse.json(
      { error: 'Access is not configured yet. Contact your Wall Street Prep contact.' },
      { status: 503 },
    );
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  }

  let password = '';
  try {
    const body = await req.json();
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (!checkPartnerPassword(password)) {
    return NextResponse.json({ error: 'That password is not correct.' }, { status: 401 });
  }

  const token = await mintPartnerToken();
  if (!token) {
    return NextResponse.json({ error: 'Access is not configured yet.' }, { status: 503 });
  }

  clearAttempts(ip);
  const res = NextResponse.json({ ok: true, expiresInDays: PARTNER_MAX_AGE_DAYS });
  res.cookies.set(PARTNER_COOKIE, token, partnerCookieOptions(PARTNER_MAX_AGE_DAYS * 86400));
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PARTNER_COOKIE, '', partnerCookieOptions(0));
  return res;
}
