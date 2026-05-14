'use client';

import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { CohortData } from '@/data/cohortPerformance';

function fmt(n: number) { return n.toLocaleString(); }
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#a78bfa', '#f472b6'];

interface Props { cohort: CohortData }

export default function ProgramTab({ cohort }: Props) {
  const chartData = cohort.programs.map(p => ({
    program: p.program,
    Enrollments: p.enrolls,
    Goal: p.goal,
  }));

  const effData = cohort.programs
    .filter(p => p.cpe > 0)
    .map(p => ({
      program: p.program,
      'Cost / Enroll': Math.round(p.cpe),
      'Cost / Lead': Math.round(p.cpl),
    }));

  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Enrollments vs. Goal by Program</h2>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="program" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #ffffff20', borderRadius: 8, color: '#fff' }}
                cursor={{ fill: '#ffffff08' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="Enrollments" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Goal" fill="#3b82f6" opacity={0.5} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Cost Efficiency by Program</h2>
          {effData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={effData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="program" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #ffffff20', borderRadius: 8, color: '#fff' }}
                  cursor={{ fill: '#ffffff08' }}
                  formatter={((v: number) => [`$${v.toLocaleString()}`, undefined]) as any}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                <Bar dataKey="Cost / Enroll" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Cost / Lead" fill="#a78bfa" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-500 text-sm">
              Paid media data not yet available for this cohort
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Program Breakdown — {cohort.cohort}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Program</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Goal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Enrolls</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">% to Goal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Forecast</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Leads</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CVR</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CPL</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CPE</th>
              </tr>
            </thead>
            <tbody>
              {cohort.programs.map((p, i) => {
                const pct = p.goal > 0 ? (p.enrolls / p.goal) * 100 : 0;
                const forecastDelta = p.forecast - p.goal;
                return (
                  <tr key={p.program} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-white font-medium">{p.program}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(p.goal)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(p.enrolls)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${pct >= 100 ? 'text-emerald-400' : pct >= 80 ? 'text-yellow-400' : pct === 0 ? 'text-gray-500' : 'text-red-400'}`}>
                      {pct === 0 ? '—' : fmtPct(pct)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${forecastDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmt(p.forecast)}
                      {p.goal > 0 && (
                        <span className="text-xs ml-1">
                          ({forecastDelta >= 0 ? '+' : ''}{fmt(forecastDelta)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(p.leads)}</td>
                    <td className={`px-4 py-3 text-right ${p.cvr >= 3 ? 'text-emerald-400' : p.cvr === 0 ? 'text-gray-500' : 'text-gray-300'}`}>
                      {p.cvr === 0 ? '—' : fmtPct(p.cvr)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {p.cpl === 0 ? '—' : `$${p.cpl.toFixed(2)}`}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${p.cpe === 0 ? 'text-gray-500' : p.cpe < 1000 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {p.cpe === 0 ? '—' : `$${p.cpe.toFixed(0)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
