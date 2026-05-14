import { WHARTON_COHORTS } from '@/data/cohortPerformance';
import CohortDashboard from '@/components/cohort-performance/CohortDashboard';

export default function WhartonCohortPage() {
  return (
    <CohortDashboard
      cohorts={WHARTON_COHORTS}
      title="Wharton Online"
      subtitle="PE · RE · FP&A · AVI · RDI"
    />
  );
}
