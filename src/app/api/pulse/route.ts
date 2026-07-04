import { NextResponse } from 'next/server';
import { getPulseLive } from '@/lib/pulseLive';

export async function GET() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured' }, { status: 500 });
  }

  try {
    const data = await getPulseLive();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Pulse data error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
