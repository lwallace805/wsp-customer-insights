import OptimizationDashboard from '@/components/performance/OptimizationDashboard';
import { getCurrentSnapshot } from '@/lib/performance/live';
import { getInsights } from '@/lib/performance/aiInsights';

export const dynamic = 'force-dynamic';
// First uncached load runs a Claude analysis over the full dataset (~30-60s);
// subsequent loads serve the daily cache instantly.
export const maxDuration = 180;

export default async function PerformanceOptimizationPage() {
  const snapshot = await getCurrentSnapshot();
  const result = await getInsights(snapshot);
  return <OptimizationDashboard snapshot={snapshot} result={result} />;
}
