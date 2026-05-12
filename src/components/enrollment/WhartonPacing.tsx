import type { CohortSummary, PacingDataPoint } from '@/lib/sheets';
import PacingChart from './PacingChart';

interface Props {
  cohorts: CohortSummary[];
  pacing: PacingDataPoint[];
}

export default function WhartonPacing({ cohorts, pacing }: Props) {
  const cohort = cohorts.find((c) => c.program === 'Wharton');
  return (
    <PacingChart data={pacing} program="Wharton" daysRemaining={cohort?.daysRemaining} />
  );
}
