import { NextResponse } from 'next/server';
import { getWhartonPartnerData } from '@/lib/whartonPartner';

// Gated by the partner cookie (or an internal Google session) in middleware.
// The payload is enrollments-only by construction — see whartonPartner.ts.

export async function GET() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json(
      { ok: false, reason: 'Enrollment data is temporarily unavailable. Please try again shortly.' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const data = await getWhartonPartnerData();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    // The reason string is read by an external audience, so it stays generic;
    // the detail goes to our logs.
    console.error('Wharton partner enrollments error:', err);
    return NextResponse.json(
      { ok: false, reason: 'Enrollment data is temporarily unavailable. Please try again shortly.' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
