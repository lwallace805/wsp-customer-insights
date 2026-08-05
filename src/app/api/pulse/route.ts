import { NextRequest, NextResponse } from 'next/server';
import { getPulseLive } from '@/lib/pulseLive';
import { resolveAsOf } from '@/lib/cohortCalendar';

export async function GET(req: NextRequest) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured' }, { status: 500 });
  }

  try {
    const data = await getPulseLive(resolveAsOf(req.nextUrl.searchParams.get('asOf')));
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Pulse data error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
