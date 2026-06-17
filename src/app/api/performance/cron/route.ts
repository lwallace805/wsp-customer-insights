import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getCurrentSnapshot } from '@/lib/performance/live';
import { getPaidPerformance } from '@/lib/performance/paidLive';
import { getInsights } from '@/lib/performance/aiInsights';

// Daily performance refresh — invoked by Vercel Cron (vercel.json) at
// 08:00 UTC = midnight PST (1:00am PDT). Purges the performance caches,
// re-pulls the live cohort data, and proactively generates the day's AI
// optimization briefing so the first visitor never waits.
//
// Excluded from the auth middleware (src/middleware.ts matcher); protected
// instead by CRON_SECRET — Vercel sends it as a Bearer token automatically.

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();

  // 1. Purge live-data + AI-insight caches
  revalidateTag('performance', 'max');

  // 2. Re-pull live cohort data (fresh fetch, repopulates cache)
  const snapshot = await getCurrentSnapshot();

  // 2b. Re-pull live paid-channel data for the Paid Optimization dashboard
  //     (parses the Wharton + Columbia sheets; falls back to snapshot).
  const paid = await getPaidPerformance();

  // 3. Generate today's AI briefing (cached under today's Pacific date key)
  const insights = await getInsights(snapshot);

  return NextResponse.json({
    ok: true,
    tookMs: Date.now() - started,
    snapshot: { asOf: snapshot.asOf, live: snapshot.live },
    paid: { asOf: paid.asOf, live: paid.live },
    insights: {
      source: insights.source,
      count: insights.insights.length,
      generatedAt: insights.generatedAt,
      model: insights.model ?? null,
    },
  });
}
