import PaidOptimizationDashboard from '@/components/performance/PaidOptimizationDashboard';
import { getPaidPerformance } from '@/lib/performance/paidLive';

export const dynamic = 'force-dynamic';

export default async function PerformancePaidOptimizationPage() {
  // Live paid data (parsed from the Wharton + Columbia sheets via the service
  // account, cached daily); falls back to the curated snapshot on any failure.
  const data = await getPaidPerformance();
  return <PaidOptimizationDashboard data={data} />;
}
