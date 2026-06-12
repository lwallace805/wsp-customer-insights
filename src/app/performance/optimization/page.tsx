import { Suspense } from 'react';
import OptimizationDashboard from '@/components/performance/OptimizationDashboard';
import { getCurrentSnapshot } from '@/lib/performance/live';
import { getInsights, type InsightsResult } from '@/lib/performance/aiInsights';
import { computeInsights } from '@/lib/performance/insights';
import type { CurrentSnapshot } from '@/data/performance/types';

export const dynamic = 'force-dynamic';
// The AI briefing is served from the daily cache and pre-warmed by the cron.
// On a cold cache the generation runs ~30-60s — but it now streams in behind a
// Suspense boundary, so the page paints the rule-based dashboard instantly and
// upgrades to the AI version when it resolves. maxDuration covers the worst
// case (cold cache, first visitor regenerating).
export const maxDuration = 180;

/** Instant, zero-I/O baseline so the page never blocks on the AI call. */
function ruleBasedResult(snapshot: CurrentSnapshot): InsightsResult {
  return {
    source: 'rules',
    summary: null,
    insights: computeInsights(snapshot),
    generatedAt: snapshot.asOf,
  };
}

// Streams the AI briefing in once getInsights() resolves (cache hit → instant;
// cold cache → after generation). Until then the Suspense fallback shows the
// rule-based dashboard, so the user always has a usable page immediately.
async function AiBriefing({ snapshot }: { snapshot: CurrentSnapshot }) {
  const result = await getInsights(snapshot);
  return <OptimizationDashboard snapshot={snapshot} result={result} />;
}

export default async function PerformanceOptimizationPage() {
  // Fast: the live snapshot is cached daily and reads from Google Sheets.
  const snapshot = await getCurrentSnapshot();

  return (
    <Suspense
      fallback={
        <OptimizationDashboard snapshot={snapshot} result={ruleBasedResult(snapshot)} />
      }
    >
      <AiBriefing snapshot={snapshot} />
    </Suspense>
  );
}
