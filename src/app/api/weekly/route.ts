import { NextRequest, NextResponse } from 'next/server';
import { getWeeklyReport } from '@/lib/weeklyReport';
import { resolveAsOf } from '@/lib/cohortCalendar';

export async function GET(req: NextRequest) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured' }, { status: 500 });
  }

  try {
    const data = await getWeeklyReport(resolveAsOf(req.nextUrl.searchParams.get('asOf')));
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Weekly report error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
