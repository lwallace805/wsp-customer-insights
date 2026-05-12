import type { CohortSummary } from '@/lib/sheets';

interface Props {
  cohorts: CohortSummary[];
}

export default function CohortComparison({ cohorts }: Props) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Cohort</th>
            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Enrolled</th>
            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Goal</th>
            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">% Complete</th>
            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">vs. Forecast</th>
            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">vs. Hist Avg</th>
            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Days Left</th>
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => {
            const pct = c.goal > 0 ? ((c.enrolled / c.goal) * 100).toFixed(1) : '0.0';
            const fcDiff = c.enrolled - c.forecast;
            const histDiff = c.enrolled - c.histAvg;
            const fcColor = fcDiff >= 0 ? 'text-emerald-400' : 'text-red-400';
            const histColor = histDiff >= 0 ? 'text-emerald-400' : 'text-red-400';
            return (
              <tr key={c.cohort} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{c.cohort}</td>
                <td className="px-4 py-3 text-right text-gray-300">{c.enrolled.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-300">{c.goal.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-300">{pct}%</td>
                <td className={`px-4 py-3 text-right font-medium ${fcColor}`}>{fcDiff >= 0 ? '+' : ''}{fcDiff}</td>
                <td className={`px-4 py-3 text-right font-medium ${histColor}`}>{histDiff >= 0 ? '+' : ''}{histDiff}</td>
                <td className="px-4 py-3 text-right text-gray-300">{c.daysRemaining}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
