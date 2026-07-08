'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { CohortData } from '@/data/cohortPerformance';
import ProFormaBanner from './ProFormaBanner';

function fmtDollar(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }
function fmt(n: number) { return n.toLocaleString(); }

interface Props { cohort: CohortData }

export default function PaidMediaTab({ cohort }: Props) {
  const weeks = cohort.weekly;

  const chartData = weeks.map(w => ({
    week: `Wk ${w.week}`,
    'Spend (Actual)': w.spend,
    'Spend (Forecast)': w.spendForecast,
    'Leads': w.leads,
    'Enrollments': w.enrolls,
  }));

  const cvrData = weeks.map(w => ({
    week: `Wk ${w.week}`,
    'CVR (%)': w.cvr,
    'CPE ($)': w.cpe,
  }));

  const totalSpend = weeks.reduce((s, w) => s + w.spend, 0);
  const totalLeads = weeks.reduce((s, w) => s + w.leads, 0);
  const totalEnrolls = weeks.reduce((s, w) => s + w.enrolls, 0);
  const blendedCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const blendedCpe = totalEnrolls > 0 ? totalSpend / totalEnrolls : 0;

  return (
    <div className="space-y-6">
      <ProFormaBanner />
      {/* Summary KPIs */}
      <div className="flex gap-4">
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5 flex-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Total Spend</p>
          <p className="text-2xl font-bold text-white">{fmtDollar(totalSpend)}</p>
        </div>
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5 flex-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Total Leads</p>
          <p className="text-2xl font-bold text-white">{fmt(totalLeads)}</p>
        </div>
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5 flex-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Paid Enrolls</p>
          <p className="text-2xl font-bold text-white">{fmt(totalEnrolls)}</p>
        </div>
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5 flex-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Blended CPL</p>
          <p className="text-2xl font-bold text-white">${blendedCpl.toFixed(2)}</p>
        </div>
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5 flex-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Blended CPE</p>
          <p className={`text-2xl font-bold ${blendedCpe < 1000 ? 'text-emerald-400' : 'text-white'}`}>
            ${blendedCpe.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Spend vs Leads/Enrolls chart */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Weekly Spend, Leads & Enrollments</h2>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="spend" orientation="left" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis yAxisId="count" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #ffffff20', borderRadius: 8, color: '#fff', fontSize: 12 }}
              cursor={{ fill: '#ffffff05' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((v: number, name: string) =>
                name.includes('Spend') ? [fmtDollar(v), name] : [fmt(v), name]
              ) as any}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar yAxisId="spend" dataKey="Spend (Actual)" fill="#3b82f6" opacity={0.8} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar yAxisId="spend" dataKey="Spend (Forecast)" fill="#3b82f6" opacity={0.2} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Line yAxisId="count" dataKey="Leads" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            <Line yAxisId="count" dataKey="Enrollments" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* CVR & CPE trend */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Weekly CVR & CPE Trend</h2>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={cvrData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="cvr" orientation="left" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
            <YAxis yAxisId="cpe" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #ffffff20', borderRadius: 8, color: '#fff', fontSize: 12 }}
              cursor={{ fill: '#ffffff05' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((v: number, name: string) =>
                name.includes('CVR') ? [`${v.toFixed(2)}%`, name] : [`$${v.toFixed(0)}`, name]
              ) as any}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Line yAxisId="cvr" dataKey="CVR (%)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            <Line yAxisId="cpe" dataKey="CPE ($)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly detail table */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Weekly Paid Media Detail — {cohort.cohort}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Week</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date Range</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Spend</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">vs. Forecast</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Leads</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Enrolls</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">vs. Fcst</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CPL</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CPE</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CVR</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => {
                const spendDelta = w.spend - w.spendForecast;
                const enrollDelta = w.enrolls - w.enrollForecast;
                return (
                  <tr key={w.week} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                    <td className="px-5 py-3 text-gray-400 font-medium">Wk {w.week}</td>
                    <td className="px-4 py-3 text-gray-400">{w.dateRange}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmtDollar(w.spend)}</td>
                    <td className={`px-4 py-3 text-right text-xs font-medium ${spendDelta <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {spendDelta <= 0 ? '' : '+'}{fmtDollar(Math.abs(spendDelta))} {spendDelta <= 0 ? 'under' : 'over'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(w.leads)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(w.enrolls)}</td>
                    <td className={`px-4 py-3 text-right text-xs font-medium ${enrollDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {enrollDelta >= 0 ? '+' : ''}{enrollDelta}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">${w.cpl.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${w.cpe < 1000 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      ${w.cpe.toFixed(0)}
                    </td>
                    <td className={`px-4 py-3 text-right ${w.cvr >= 3 ? 'text-emerald-400' : 'text-gray-300'}`}>
                      {fmtPct(w.cvr)}
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="border-t border-white/20 bg-white/5">
                <td className="px-5 py-3 text-white font-semibold" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right text-white font-semibold">{fmtDollar(totalSpend)}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right text-white font-semibold">{fmt(totalLeads)}</td>
                <td className="px-4 py-3 text-right text-white font-semibold">{fmt(totalEnrolls)}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right text-white font-semibold">${blendedCpl.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-white font-semibold">${blendedCpe.toFixed(0)}</td>
                <td className="px-4 py-3 text-right text-white font-semibold">
                  {totalLeads > 0 ? fmtPct((totalEnrolls / totalLeads) * 100) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
