'use client';

import type { NPSSummary } from '@/lib/nps';

type Props = { summary: NPSSummary };

export default function NPSScoreCard({ summary }: Props) {
  const { score, promoterPct, passivePct, detractorPct, totalResponses } = summary;

  const scoreColor =
    score >= 50 ? 'text-emerald-600' :
    score >= 0  ? 'text-amber-500' :
                  'text-red-500';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Net Promoter Score</p>
      <div className="flex items-end gap-3 mb-4">
        <span className={`text-7xl font-bold ${scoreColor}`}>{score}</span>
        <span className="text-gray-400 text-lg mb-2">/ 100</span>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="h-3 rounded-full bg-emerald-500 transition-all" style={{ width: `${promoterPct}%` }} title={`Promoters ${promoterPct}%`} />
        <div className="h-3 rounded-full bg-amber-400 transition-all" style={{ width: `${passivePct}%` }} title={`Passives ${passivePct}%`} />
        <div className="h-3 rounded-full bg-red-400 transition-all" style={{ width: `${detractorPct}%` }} title={`Detractors ${detractorPct}%`} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xl font-bold text-emerald-600">{promoterPct}%</p>
          <p className="text-xs text-gray-500">Promoters</p>
        </div>
        <div>
          <p className="text-xl font-bold text-amber-500">{passivePct}%</p>
          <p className="text-xs text-gray-500">Passives</p>
        </div>
        <div>
          <p className="text-xl font-bold text-red-500">{detractorPct}%</p>
          <p className="text-xs text-gray-500">Detractors</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">{totalResponses.toLocaleString()} total responses</p>
    </div>
  );
}
