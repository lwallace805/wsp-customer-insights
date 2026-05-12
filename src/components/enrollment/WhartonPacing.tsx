import type { CohortSummary, PacingDataPoint } from '@/lib/sheets';
import StatCard from './StatCard';
import PacingChart from './PacingChart';

interface Props {
  cohorts: CohortSummary[];
  pacing: PacingDataPoint[];
}

export default function WhartonPacing({ cohorts, pacing }: Props) {
  const cohort = cohorts.find((c) => c.program === 'Wharton');
  return (
    <div className="space-y-4">
      {cohort && (
        <div className="flex gap-4">
          <StatCard cohort={cohort} />
          <div className="flex-1" />
        </div>
      )}
      <PacingChart data={pacing} program="Wharton" daysRemaining={cohort?.daysRemaining} />
    </div>
  );
}
