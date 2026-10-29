import PaidChannelsDashboard from '@/components/performance/PaidChannelsDashboard';
import { getPaidPerformance } from '@/lib/performance/paidLive';

export const dynamic = 'force-dynamic';

export default async function PerformancePaidChannelsPage() {
  // The same paid read as Paid Optimization: the active cohort docs parsed via
  // the service account, cached daily, falling back to the curated snapshot —
  // each school's entry says which cohort it describes and whether it is live.
  const data = await getPaidPerformance();
  return <PaidChannelsDashboard data={data} />;
}
