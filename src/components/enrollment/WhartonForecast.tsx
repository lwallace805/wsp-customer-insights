import type { CohortSummary, PacingDataPoint } from '@/lib/sheets';
import ForecastChart from './ForecastChart';

interface Props {
  cohorts: CohortSummary[];
  pacing: PacingDataPoint[];
}

export default function WhartonForecast({ cohorts, pacing }: Props) {
  const cohort = cohorts.find((c) => c.program === 'Wharton');
  const goal = cohort?.goal ?? 1225;
  return (
    <div>
      <h2 className="text-base font-semibold text-white mb-4">
        {cohort?.cohort ?? "Wharton Spring '26"} — Actual vs. Forecast
      </h2>
      <ForecastChart
        data={pacing}
        program="Wharton"
        goal={goal}
        daysRemaining={cohort?.daysRemaining}
      />
    </div>
  );
}
