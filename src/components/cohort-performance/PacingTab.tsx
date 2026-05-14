'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { CohortData } from '@/data/cohortPerformance';

interface Props {
  cohort: CohortData;
  allCohorts: CohortData[];
}

const SERIES_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#a78bfa'];

export default function PacingTab({ cohort, allCohorts }: Props) {
  // Pick prior 2 closed cohorts for comparison
  const closed = allCohorts.filter(c => c.status === 'closed' && c.cohort !== cohort.cohort);
  const prior = closed.slice(-2);

  // Build combined chart data aligned by day number
  const maxDays = cohort.pacing.length;
  const chartData = cohort.pacing.map((pt, idx) => {
    const row: Record<string, number | null> = {
      day: pt.day,
      [cohort.cohort]: pt.cumulative,
      Forecast: pt.forecast,
    };
    prior.forEach(p => {
      const match = p.pacing[idx];
      row[p.cohort] = match ? match.cumulative : null;
    });
    return row;
  });

  const series = [cohort, ...prior];

  // Where active cohort data ends (last day with actual enrolls)
  const lastActualDay = cohort.status === 'active'
    ? cohort.pacing.filter(p => p.cumulative > 0).length
    : maxDays;

  return (
    <div className="space-y-6">
      {/* Pace chart */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Cumulative Enrollment Pacing</h2>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-6 border-t border-dashed border-gray-500" />
              Forecast
            </span>
            {cohort.status === 'active' && (
              <span className="flex items-center gap-1.5">
                <span className="w-6 border-t border-white/30" />
                Today (Day {lastActualDay})
              </span>
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis
              dataKey="day"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Day', position: 'insideBottomRight', offset: -4, fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #ffffff20', borderRadius: 8, color: '#fff', fontSize: 12 }}
              cursor={{ stroke: '#ffffff20' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((v: number | null | undefined) => v == null ? '—' : v.toLocaleString()) as any}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />

            {/* Forecast dashed line */}
            <Line
              dataKey="Forecast"
              stroke="#ffffff30"
              strokeWidth={1}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
            />

            {/* Per-cohort lines */}
            {series.map((s, i) => (
              <Line
                key={s.cohort}
                dataKey={s.cohort}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={i === 0 ? 2.5 : 1.5}
                dot={false}
                activeDot={{ r: 4 }}
                opacity={i === 0 ? 1 : 0.6}
              />
            ))}

            {/* Today marker for active cohort */}
            {cohort.status === 'active' && (
              <ReferenceLine
                x={lastActualDay}
                stroke="#ffffff30"
                strokeDasharray="3 3"
                label={{ value: 'Today', position: 'top', fill: '#6b7280', fontSize: 10 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pacing summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Current Pace</p>
          <p className="text-2xl font-bold text-white">{cohort.totalEnrolls.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">enrolled to date</p>
        </div>
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Absolute Pacing</p>
          {(() => {
            const gap = cohort.totalEnrolls - cohort.totalForecast;
            const pos = gap >= 0;
            return (
              <>
                <p className={`text-2xl font-bold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pos ? '+' : ''}{gap.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-1">vs. forecast</p>
              </>
            );
          })()}
        </div>
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Days Remaining</p>
          <p className="text-2xl font-bold text-white">{cohort.daysRemaining}</p>
          <p className="text-xs text-gray-400 mt-1">of {cohort.daysTotal} total days</p>
        </div>
      </div>

      {/* Prior cohort comparison table */}
      {prior.length > 0 && (
        <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">Pace Comparison at Same Day</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cohort</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Enrolled at Day {lastActualDay}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Final Enrolls</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Goal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">% to Goal</th>
              </tr>
            </thead>
            <tbody>
              {[cohort, ...prior].map((c, i) => {
                const atDay = c.pacing[lastActualDay - 1]?.cumulative ?? 0;
                const finalPct = c.totalGoal > 0 ? (c.totalEnrolls / c.totalGoal) * 100 : 0;
                return (
                  <tr key={c.cohort} className={`border-b border-white/5 ${i === 0 ? 'bg-white/5' : ''}`}>
                    <td className="px-5 py-3 text-white font-medium">
                      {c.cohort}
                      {c.status === 'active' && <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">Active</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{atDay.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{c.totalEnrolls.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{c.totalGoal.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right font-medium ${finalPct >= 100 ? 'text-emerald-400' : finalPct >= 85 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {finalPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
