import type { CohortSummary } from '@/lib/sheets';
import VarianceRow from './VarianceRow';

interface Props {
  cohort: CohortSummary;
}

export default function StatCard({ cohort }: Props) {
  const pct = cohort.goal > 0 ? ((cohort.enrolled / cohort.goal) * 100).toFixed(1) : '0.0';
  const forecastDiff = cohort.enrolled - cohort.forecast;
  const forecastPositive = forecastDiff >= 0;
  const forecastColor = forecastPositive ? 'text-emerald-400' : 'text-red-400';
  const forecastSign = forecastPositive ? '+' : '';
  const variancePct = cohort.forecast > 0
    ? Math.abs((forecastDiff / cohort.forecast) * 100).toFixed(1)
    : '0.0';
  const histDiff = cohort.enrolled - cohort.histAvg;
  const histPositive = histDiff >= 0;
  const histColor = histPositive ? 'text-emerald-400' : 'text-red-400';
  const histSign = histPositive ? '+' : '';

  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-5 flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {cohort.cohort}
        </h2>
        <span className="text-xs font-medium bg-white/10 text-gray-300 px-2.5 py-1 rounded-full">
          {cohort.daysRemaining} days remaining
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Enrollments</p>
          <p className="text-4xl font-bold text-white">{cohort.enrolled.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">of {cohort.goal.toLocaleString()} goal</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Goal completion</p>
          <p className="text-4xl font-bold text-white">{pct}%</p>
        </div>
      </div>

      <div className="space-y-0">
        <div className="flex items-center justify-between py-1.5 border-t border-white/10">
          <span className="text-sm text-gray-400">vs. Forecast</span>
          <span className={`text-sm font-medium ${forecastColor}`}>
            {forecastSign}{forecastDiff} vs. {cohort.forecast.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-t border-white/10">
          <span className="text-sm text-gray-400">Variance</span>
          <span className={`text-sm font-medium ${forecastColor}`}>
            {forecastSign}{variancePct}% {forecastPositive ? 'ahead' : 'behind'}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-t border-white/10">
          <span className="text-sm text-gray-400">vs. Last 3 cohort avg</span>
          <span className={`text-sm font-medium ${histColor}`}>
            {histSign}{histDiff} vs. avg {cohort.histAvg.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
