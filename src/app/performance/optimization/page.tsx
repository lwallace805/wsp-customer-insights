import OptimizationDashboard from '@/components/performance/OptimizationDashboard';
import { getCurrentSnapshot } from '@/lib/performance/live';

export const dynamic = 'force-dynamic';

export default async function PerformanceOptimizationPage() {
  const snapshot = await getCurrentSnapshot();
  return <OptimizationDashboard snapshot={snapshot} />;
}
