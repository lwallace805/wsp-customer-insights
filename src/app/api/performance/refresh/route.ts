import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

// Force-refresh the daily performance data cache (normally revalidates every 24h).
export async function POST() {
  revalidateTag('performance', 'max');
  return NextResponse.json({ ok: true, refreshed: 'performance', at: new Date().toISOString() });
}
