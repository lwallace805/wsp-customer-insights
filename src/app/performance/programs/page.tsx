import ProgramsDashboard from '@/components/performance/ProgramsDashboard';
import { getCurrentSnapshot } from '@/lib/performance/live';

export const dynamic = 'force-dynamic';

export default async function PerformanceProgramsPage() {
  const snapshot = await getCurrentSnapshot();
  return <ProgramsDashboard snapshot={snapshot} />;
}
