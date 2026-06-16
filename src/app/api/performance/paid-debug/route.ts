import { NextResponse } from 'next/server';
import { debugPaidParse } from '@/lib/performance/paidLive';

// Read-only diagnostic for the Paid Optimization live parser: shows why the
// live parse is or isn't engaging in production. Login-protected by the auth
// middleware (only /api/performance/cron is exempt). Returns no secrets — just
// env presence, doc IDs, tab names, and what the parser extracted. Safe to
// remove once the live parse is verified.

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const diag = await debugPaidParse();
    return NextResponse.json(diag, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
