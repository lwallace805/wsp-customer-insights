import { getColumbiaCohorts } from '@/lib/demo/cohorts';
import CohortDashboard from '@/components/cohort-performance/CohortDashboard';

export default function ColumbiaCohortPage() {
  return (
    <CohortDashboard
      cohorts={getColumbiaCohorts()}
      title="Columbia / CBSEE"
      subtitle="AI for Business & Finance"
    />
  );
}
