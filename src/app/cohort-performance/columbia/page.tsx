import { COLUMBIA_COHORTS } from '@/data/cohortPerformance';
import CohortDashboard from '@/components/cohort-performance/CohortDashboard';

export default function ColumbiaCohortPage() {
  return (
    <CohortDashboard
      cohorts={COLUMBIA_COHORTS}
      title="Columbia / CBSEE"
      subtitle="AI Finance · AI Accounting"
    />
  );
}
