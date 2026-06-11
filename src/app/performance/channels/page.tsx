import ChannelsDashboard from '@/components/performance/ChannelsDashboard';
import { getCurrentSnapshot } from '@/lib/performance/live';

export const dynamic = 'force-dynamic';

export default async function PerformanceChannelsPage() {
  const snapshot = await getCurrentSnapshot();
  return <ChannelsDashboard snapshot={snapshot} />;
}
