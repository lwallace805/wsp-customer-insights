'use client';

import type { CohortData } from '@/data/cohortPerformance';

function fmt(n: number) { return n.toLocaleString(); }
function fmtDollar(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }
function delta(actual: number, goal: number) {
  const d = actual - goal;
  const sign = d >= 0 ? '+' : '';
  const pct = goal > 0 ? ` (${sign}${((d / goal) * 100).toFixed(1)}%)` : '';
  return { d, sign, pct, positive: d >= 0 };
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}

function KpiCard({ label, value, sub, positive }: KpiCardProps) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-5 flex-1 min-w-0">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      {sub && (
        <p className={`text-xs font-medium ${positive === undefined ? 'text-gray-400' : positive ? 'text-emerald-400' : 'text-red-400'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

interface Props {
  cohort: CohortData;
  allCohorts: CohortData[];
}

export default function OverviewTab({ cohort, allCohorts }: Props) {
  const enrollDelta = delta(cohort.totalEnrolls, cohort.totalGoal);
  const pctToGoal = cohort.totalGoal > 0 ? (cohort.totalEnrolls / cohort.totalGoal) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="flex gap-4">
        <KpiCard
          label="Enrollments"
          value={fmt(cohort.totalEnrolls)}
          sub={`of ${fmt(cohort.totalGoal)} goal · ${enrollDelta.sign}${fmt(enrollDelta.d)}${enrollDelta.pct}`}
          positive={enrollDelta.positive}
        />
        <KpiCard
          label="% to Goal"
          value={fmtPct(pctToGoal)}
          sub={cohort.status === 'active' ? `${cohort.daysRemaining} days remaining` : 'Final'}
          positive={pctToGoal >= 100}
        />
        <KpiCard label="Total Spend" value={fmtDollar(cohort.totalSpend)} />
        <KpiCard label="ROAS" value={`${cohort.roas.toFixed(1)}x`} positive={cohort.roas >= 2.5} />
        <KpiCard label="Cost / Enroll" value={`$${cohort.cpe.toFixed(0)}`} positive={cohort.cpe < 1000} />
        <KpiCard label="Cost / Lead" value={`$${cohort.cpl.toFixed(2)}`} />
        <KpiCard label="Lead → Enroll CVR" value={fmtPct(cohort.cvr)} positive={cohort.cvr >= 3} />
      </div>

      {/* Forecast vs goal callout (active only) */}
      {cohort.status === 'active' && (
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Forecast vs. Goal</p>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Forecasted enrollment</p>
              <p className="text-2xl font-bold text-white">{fmt(cohort.totalForecast)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Goal</p>
              <p className="text-2xl font-bold text-white">{fmt(cohort.totalGoal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Forecast gap</p>
              {(() => {
                const gap = cohort.totalForecast - cohort.totalGoal;
                const pos = gap >= 0;
                return (
                  <p className={`text-2xl font-bold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pos ? '+' : ''}{fmt(gap)}
                  </p>
                );
              })()}
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4">
            <div className="w-full bg-white/5 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(pctToGoal, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{fmtPct(pctToGoal)} complete</p>
          </div>
        </div>
      )}

      {/* Historical cohort comparison table */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Cohort History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cohort</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Goal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Enrolls</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">% to Goal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Spend</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">ROAS</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CPE</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CVR</th>
              </tr>
            </thead>
            <tbody>
              {[...allCohorts].reverse().map((c, i) => {
                const pct = c.totalGoal > 0 ? (c.totalEnrolls / c.totalGoal) * 100 : 0;
                const isActive = c.cohort === cohort.cohort;
                return (
                  <tr
                    key={c.cohort}
                    className={`border-b border-white/5 ${isActive ? 'bg-white/5' : i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}
                  >
                    <td className="px-5 py-3 text-white font-medium">
                      {c.cohort}
                      {c.status === 'active' && (
                        <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(c.totalGoal)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(c.totalEnrolls)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${pct >= 100 ? 'text-emerald-400' : pct >= 85 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {fmtPct(pct)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmtDollar(c.totalSpend)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${c.roas >= 2.5 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {c.roas.toFixed(1)}x
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${c.cpe < 1000 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      ${c.cpe.toFixed(0)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${c.cvr >= 3 ? 'text-emerald-400' : 'text-gray-300'}`}>
                      {fmtPct(c.cvr)}
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
