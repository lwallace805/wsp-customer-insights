import { getWhartonCohorts } from '@/lib/demo/cohorts';
import CohortDashboard from '@/components/cohort-performance/CohortDashboard';

export default function WhartonCohortPage() {
  return (
    <CohortDashboard
      cohorts={getWhartonCohorts()}
      title="Wharton Online"
      subtitle="PE · RE · FP&A · AVI · RDI"
    />
  );
}
