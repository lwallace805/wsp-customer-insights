import { NextRequest, NextResponse } from 'next/server';
import { getCohortCommandLive } from '@/lib/pulseLive';

export async function GET(req: NextRequest) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured' }, { status: 500 });
  }

  const family = req.nextUrl.searchParams.get('family') === 'columbia' ? 'columbia' : 'wharton';

  try {
    const data = await getCohortCommandLive(family);
    return NextResponse.json({ live: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Cohort command live error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
