import type { CohortSummary, PacingDataPoint } from '@/lib/sheets';
import ForecastChart from './ForecastChart';

interface Props {
  cohorts: CohortSummary[];
  pacing: PacingDataPoint[];
}

export default function CBSEEForecast({ cohorts, pacing }: Props) {
  const cohort = cohorts.find((c) => c.program === 'CBSEE');
  const goal = cohort?.goal ?? 468;
  return (
    <div>
      <h2 className="text-base font-semibold text-white mb-4">
        {cohort?.cohort ?? 'CBSEE'} — Actual vs. Forecast
      </h2>
      <ForecastChart
        data={pacing}
        program="CBSEE"
        goal={goal}
        daysRemaining={cohort?.daysRemaining}
      />
    </div>
  );
}
