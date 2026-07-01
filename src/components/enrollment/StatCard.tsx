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

  // At-pace projection: only meaningful once ≥5% is enrolled and cohort is still active.
  // Formula: goal + current surplus (assumes remaining enrollment follows the forecast plan,
  // not that the current lead rate continues throughout — avoids compounding a small lead).
  const isCompleted = cohort.daysRemaining === 0;
  const pctNum = cohort.goal > 0 ? cohort.enrolled / cohort.goal : 0;
  const showProjection = !isCompleted && pctNum >= 0.05 && cohort.forecast > 0;
  const surplus = forecastDiff; // enrolled - forecast (can be negative)
  const projected = cohort.goal + surplus;
  const projVsGoal = surplus;
  const projPositive = projVsGoal >= 0;
  const projSign = projPositive ? '+' : '';

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
          <span className="text-sm text-gray-400">vs. Goal Pace</span>
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

      {isCompleted ? (
        <div className="mt-4 rounded-lg bg-white/5 border border-white/10 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cohort Complete</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{cohort.enrolled.toLocaleString()}</span>
            <span className={`text-sm font-semibold ${forecastPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {forecastSign}{forecastDiff.toLocaleString()} vs goal
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{pct}% of {cohort.goal.toLocaleString()} goal</p>
        </div>
      ) : showProjection ? (
        <div className="mt-4 rounded-lg bg-white/5 border border-white/10 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">At-pace projection</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{projected.toLocaleString()}</span>
            <span className={`text-sm font-semibold ${projPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {projSign}{projVsGoal.toLocaleString()} vs goal
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {Math.abs(Number(variancePct))}% {forecastPositive ? 'ahead of' : 'behind'} pace · goal {cohort.goal.toLocaleString()} + {projPositive ? '+' : ''}{surplus.toLocaleString()} current surplus
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-white/5 border border-white/10 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">At-pace projection</p>
          <p className="text-sm text-gray-500 mt-1">Available once ≥5% of goal is enrolled</p>
        </div>
      )}
    </div>
  );
}
