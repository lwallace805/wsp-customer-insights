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

  // At-pace projection: only meaningful once enough enrollment has accumulated.
  // At <5% of goal the extrapolation amplifies noise rather than signal.
  const pctNum = cohort.goal > 0 ? cohort.enrolled / cohort.goal : 0;
  const showProjection = pctNum >= 0.05 && cohort.forecast > 0;
  const paceRatio = cohort.forecast > 0 ? cohort.enrolled / cohort.forecast : 1;
  const projected = Math.round(paceRatio * cohort.goal);
  const projVsGoal = projected - cohort.goal;
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

      {/* At-pace projection — only shown once ≥5% of goal is enrolled */}
      {showProjection ? (
        <div className="mt-4 rounded-lg bg-white/5 border border-white/10 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">At-pace projection</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{projected.toLocaleString()}</span>
            <span className={`text-sm font-semibold ${projPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {projSign}{projVsGoal.toLocaleString()} vs goal
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {Math.abs(Number(variancePct))}% {forecastPositive ? 'ahead of' : 'behind'} pace · {paceRatio.toFixed(3)}× ratio applied to {cohort.goal.toLocaleString()} goal
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
