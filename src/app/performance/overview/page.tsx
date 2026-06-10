import OverviewDashboard from '@/components/performance/OverviewDashboard';
import { getCurrentSnapshot } from '@/lib/performance/live';

export const dynamic = 'force-dynamic';

export default async function PerformanceOverviewPage() {
  const snapshot = await getCurrentSnapshot();
  return <OverviewDashboard snapshot={snapshot} />;
}
