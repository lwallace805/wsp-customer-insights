import type { CohortSummary } from '@/lib/sheets';
import StatCard from './StatCard';
import KeyTakeaways from './KeyTakeaways';

interface Props {
  cohorts: CohortSummary[];
}

export default function ExecutiveSummary({ cohorts }: Props) {
  return (
    <div>
      <div className="flex gap-4">
        {cohorts.map((c) => (
          <StatCard key={c.cohort} cohort={c} />
        ))}
      </div>
      <KeyTakeaways cohorts={cohorts} />
    </div>
  );
}
