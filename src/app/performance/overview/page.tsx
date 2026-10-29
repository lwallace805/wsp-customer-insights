import OverviewDashboard from '@/components/performance/OverviewDashboard';
import { getCurrentSnapshot } from '@/lib/performance/live';
import { getPaidPerformance } from '@/lib/performance/paidLive';

export const dynamic = 'force-dynamic';

export default async function PerformanceOverviewPage() {
  const [snapshot, paid] = await Promise.all([getCurrentSnapshot(), getPaidPerformance()]);
  return <OverviewDashboard snapshot={snapshot} paid={paid} />;
}
