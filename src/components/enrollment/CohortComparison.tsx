import type { ComparisonPanel } from '@/lib/sheets';

interface Props {
  comparison: {
    wharton: ComparisonPanel;
    cbsee: ComparisonPanel | null;
  };
}

function Panel({ panel }: { panel: ComparisonPanel }) {
  return (
    <div className="flex-1 bg-[#161b22] border border-white/10 rounded-xl overflow-hidden min-w-0">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-white/10">
        <span className="text-sm font-bold uppercase tracking-wider text-white">
          {panel.program}
        </span>
        <span className="text-xs text-gray-400">At {panel.daysRemaining} days remaining</span>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Cohort</th>
            <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">% Done</th>
            <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Enrolled</th>
            <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Goal</th>
          </tr>
        </thead>
        <tbody>
          {/* Active cohort row */}
          <tr className="border-t border-white/5 bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
            <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
              {panel.activeRow.label}
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs px-1.5 py-0.5 rounded">
                Active
              </span>
            </td>
            <td className="px-4 py-3 text-right text-gray-200 font-semibold">{panel.activeRow.pctDone.toFixed(1)}%</td>
            <td className="px-4 py-3 text-right text-gray-200">{panel.activeRow.enrolled.toLocaleString()}</td>
            <td className="px-4 py-3 text-right text-gray-400">{panel.activeRow.goal.toLocaleString()}</td>
          </tr>

          {/* Last 3 avg row */}
          <tr className="border-t border-white/5 hover:bg-white/5 transition-colors">
            <td className="px-4 py-3 italic text-gray-500">Last 3 avg</td>
            <td className="px-4 py-3 text-right italic text-gray-500">{panel.last3Avg.pctDone.toFixed(1)}%</td>
            <td className="px-4 py-3 text-right italic text-gray-500">{panel.last3Avg.enrolled.toLocaleString()}</td>
            <td className="px-4 py-3 text-right italic text-gray-500">{panel.last3Avg.goal.toLocaleString()}</td>
          </tr>

          {/* Closed cohorts section header */}
          <tr className="border-t border-white/10 bg-white/[0.02]">
            <td colSpan={4} className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-600">
              Closed Cohorts
            </td>
          </tr>

          {/* Historical closed rows */}
          {panel.closedRows.map((row) => (
            <tr key={row.label} className="border-t border-white/5 hover:bg-white/5 transition-colors">
              <td className="px-4 py-3 text-gray-400">{row.label}</td>
              <td className="px-4 py-3 text-right text-gray-400">{row.pctDone.toFixed(1)}%</td>
              <td className="px-4 py-3 text-right text-gray-400">{row.enrolled.toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-gray-500">{row.goal.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CohortComparison({ comparison }: Props) {
  return (
    <div className="flex gap-4">
      <Panel panel={comparison.wharton} />
      {comparison.cbsee ? (
        <Panel panel={comparison.cbsee} />
      ) : (
        <div className="flex-1 bg-[#161b22] border border-white/10 rounded-xl p-8 flex items-center justify-center min-w-0">
          <p className="text-gray-500 text-sm">Columbia AI Fall &apos;26 cohort not yet started</p>
        </div>
      )}
    </div>
  );
}
