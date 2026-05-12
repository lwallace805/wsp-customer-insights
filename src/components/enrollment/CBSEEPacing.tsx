import type { CohortSummary, PacingDataPoint } from '@/lib/sheets';
import PacingChart from './PacingChart';

interface Props {
  cohorts: CohortSummary[];
  pacing: PacingDataPoint[];
}

export default function CBSEEPacing({ cohorts, pacing }: Props) {
  const cohort = cohorts.find((c) => c.program === 'CBSEE');
  return (
    <PacingChart data={pacing} program="CBSEE" daysRemaining={cohort?.daysRemaining} />
  );
}
