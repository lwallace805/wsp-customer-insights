import TrendsDashboard from '@/components/performance/TrendsDashboard';
import { getCurrentSnapshot } from '@/lib/performance/live';
import { getPaidPerformance } from '@/lib/performance/paidLive';

export const dynamic = 'force-dynamic';

export default async function PerformanceTrendsPage() {
  const [snapshot, paid] = await Promise.all([getCurrentSnapshot(), getPaidPerformance()]);
  return <TrendsDashboard snapshot={snapshot} paid={paid} />;
}
