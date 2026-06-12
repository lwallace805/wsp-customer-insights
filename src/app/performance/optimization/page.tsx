import { after } from 'next/server';
import OptimizationDashboard from '@/components/performance/OptimizationDashboard';
import { getCurrentSnapshot } from '@/lib/performance/live';
import { getInsights, type InsightsResult } from '@/lib/performance/aiInsights';
import { computeInsights } from '@/lib/performance/insights';
import type { CurrentSnapshot } from '@/data/performance/types';

export const dynamic = 'force-dynamic';
// maxDuration covers the background generation kept alive by after() on a cold
// cache. The visitor never waits that long — see the race below.
export const maxDuration = 180;

// How long to wait for the (cached) AI briefing before giving up and serving
// the instant rule-based dashboard. A warm daily cache returns in well under
// this; a cold cache (first load after a deploy, or before the cron warms it)
// exceeds it and we fall back rather than make the visitor wait ~30-60s.
const AI_WAIT_MS = 2500;

/** Instant, zero-I/O baseline so the page never blocks on the AI call. */
function ruleBasedResult(snapshot: CurrentSnapshot): InsightsResult {
  return {
    source: 'rules',
    summary: null,
    insights: computeInsights(snapshot),
    generatedAt: snapshot.asOf,
  };
}

export default async function PerformanceOptimizationPage() {
  // Fast: the live snapshot is cached daily and falls back to a static snapshot.
  const snapshot = await getCurrentSnapshot();

  // getInsights resolves instantly on a warm daily cache; on a cold cache it
  // runs the ~30-60s Opus generation. Race it against a short timeout so the
  // page is always fast: warm → show the AI briefing; cold → show rule-based
  // now and let the generation finish in the background to warm the cache.
  // (getInsights never throws — it falls back to rule-based internally.)
  const aiPromise = getInsights(snapshot);
  const raced = await Promise.race([
    aiPromise.then((result) => ({ ready: true as const, result })),
    new Promise<{ ready: false }>((resolve) => {
      setTimeout(() => resolve({ ready: false }), AI_WAIT_MS);
    }),
  ]);

  if (raced.ready) {
    return <OptimizationDashboard snapshot={snapshot} result={raced.result} />;
  }

  // Cold cache: keep the generation alive past this response so it populates
  // the daily cache for the next visitor, then serve rule-based right now.
  after(async () => {
    try {
      await aiPromise;
    } catch {
      // getInsights already handles its own errors; nothing to do here.
    }
  });

  return (
    <div>
      <div className="mb-4 rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm text-violet-200">
        Today&rsquo;s AI briefing is still generating. Showing the rule-based analysis below —
        reload in ~30 seconds for the AI version.
      </div>
      <OptimizationDashboard snapshot={snapshot} result={ruleBasedResult(snapshot)} />
    </div>
  );
}
