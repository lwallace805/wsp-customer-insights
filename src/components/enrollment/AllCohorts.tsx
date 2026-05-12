import type { CohortSummary } from '@/lib/sheets';
import CohortComparison from './CohortComparison';

interface Props {
  cohorts: CohortSummary[];
}

export default function AllCohorts({ cohorts }: Props) {
  return (
    <div>
      <p className="text-sm text-gray-400 mb-4">All active cohorts tracked in the enrollment sheet.</p>
      <CohortComparison cohorts={cohorts} />
    </div>
  );
}
