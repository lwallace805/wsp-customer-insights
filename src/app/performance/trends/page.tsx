import TrendsDashboard from '@/components/performance/TrendsDashboard';
import { getCurrentSnapshot } from '@/lib/performance/live';

export const dynamic = 'force-dynamic';

export default async function PerformanceTrendsPage() {
  const snapshot = await getCurrentSnapshot();
  return <TrendsDashboard snapshot={snapshot} />;
}
