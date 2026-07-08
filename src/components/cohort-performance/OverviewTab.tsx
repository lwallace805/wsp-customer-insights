'use client';

import type { CohortData } from '@/data/cohortPerformance';
import type { CommandLive } from '@/lib/pulseLive';
import ProFormaBanner from './ProFormaBanner';

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
  live?: CommandLive | null;
}

export default function OverviewTab({ cohort, allCohorts, live }: Props) {
  // Live values (same sources as Pulse) override the pro forma data for the
  // active cohort; closed cohorts keep the demo dataset.
  const enrolls = live ? live.enrolls : cohort.totalEnrolls;
  const goal = live ? live.goal : cohort.totalGoal;
  const enrollDelta = delta(enrolls, goal);
  const pctToGoal = goal > 0 ? (enrolls / goal) * 100 : 0;
  const daysRemaining = live ? live.daysRemaining : cohort.daysRemaining;
  const t = live?.totals ?? null;

  return (
    <div className="space-y-6">
      {!live && (
        <ProFormaBanner note={cohort.status === 'active'
          ? 'Live data is loading or unavailable — the numbers below are illustrative placeholders.'
          : 'Closed-cohort economics (spend, ROAS, CPL, CPE, CVR) are illustrative until historical economics are wired; goals and enrollment totals are real.'} />
      )}
      {live && (
        <p className="text-[11px] text-gray-500">
          <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 mr-2">Live</span>
          Enrollments from the deadline pacing table (keyed through {live.keyedThrough ?? '—'}); spend / leads / efficiency from Overall WoW totals — the same sources as Pulse.
        </p>
      )}

      {/* KPI row */}
      <div className="flex gap-4">
        <KpiCard
          label="Enrollments"
          value={fmt(enrolls)}
          sub={`of ${fmt(goal)} goal · ${enrollDelta.sign}${fmt(enrollDelta.d)}${enrollDelta.pct}`}
          positive={enrollDelta.positive}
        />
        <KpiCard
          label="% to Goal"
          value={fmtPct(pctToGoal)}
          sub={cohort.status === 'active' ? `${daysRemaining} days remaining` : 'Final'}
          positive={pctToGoal >= 100}
        />
        {live ? (
          <>
            <KpiCard label="Total Spend" value={t?.spend != null ? fmtDollar(t.spend) : '—'} />
            <KpiCard label="ROAS" value={t?.roas != null ? `${t.roas.toFixed(1)}x` : '—'} positive={(t?.roas ?? 0) >= 2.5} />
            <KpiCard label="Cost / Enroll" value={t?.cpe != null ? `$${t.cpe.toFixed(0)}` : '—'} positive={(t?.cpe ?? Infinity) < 1000} />
            <KpiCard label="Cost / Lead" value={t?.cpl != null ? `$${t.cpl.toFixed(2)}` : '—'} />
            <KpiCard label="Lead → Enroll CVR" value={t?.cvr != null ? fmtPct(t.cvr) : '—'} positive={(t?.cvr ?? 0) >= 3} />
          </>
        ) : (
          <>
            <KpiCard label="Total Spend" value={fmtDollar(cohort.totalSpend)} />
            <KpiCard label="ROAS" value={`${cohort.roas.toFixed(1)}x`} positive={cohort.roas >= 2.5} />
            <KpiCard label="Cost / Enroll" value={`$${cohort.cpe.toFixed(0)}`} positive={cohort.cpe < 1000} />
            <KpiCard label="Cost / Lead" value={`$${cohort.cpl.toFixed(2)}`} />
            <KpiCard label="Lead → Enroll CVR" value={fmtPct(cohort.cvr)} positive={cohort.cvr >= 3} />
          </>
        )}
      </div>

      {/* Pacing vs forecast callout (active + live). Compares actual to the
          forecast-to-date — where the plan says we should be TODAY — not the
          end-of-cohort goal, which is meaningless early in the cycle. */}
      {cohort.status === 'active' && live && (
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Pacing vs. Forecast (to date)</p>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Actual</p>
              <p className="text-2xl font-bold text-white">{fmt(live.enrolls)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Forecast to date</p>
              <p className="text-2xl font-bold text-white">{fmt(live.forecastToDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Δ vs pace</p>
              {(() => {
                const gap = live.enrolls - live.forecastToDate;
                const pos = gap >= 0;
                return (
                  <p className={`text-2xl font-bold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pos ? '+' : ''}{fmt(gap)}
                  </p>
                );
              })()}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Goal</p>
              <p className="text-2xl font-bold text-white">{fmt(live.goal)}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-white/5 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(pctToGoal, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{fmtPct(pctToGoal)} of goal</p>
          </div>
        </div>
      )}

      {/* Forecast vs goal callout (active, demo fallback) */}
      {cohort.status === 'active' && !live && (
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
              {live && live.history.map((h, i) => {
                const pct = h.pctDone;
                return (
                  <tr
                    key={h.label}
                    className={`border-b border-white/5 ${h.isActive ? 'bg-white/5' : i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}
                  >
                    <td className="px-5 py-3 text-white font-medium">
                      {h.label}
                      {h.isActive && (
                        <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(h.goal)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(h.enrolled)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${pct >= 100 ? 'text-emerald-400' : pct >= 85 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {fmtPct(pct)}
                    </td>
                    {h.isActive && t ? (
                      <>
                        <td className="px-4 py-3 text-right text-gray-300">{t.spend != null ? fmtDollar(t.spend) : '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{t.roas != null ? `${t.roas.toFixed(1)}x` : '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{t.cpe != null ? `$${t.cpe.toFixed(0)}` : '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{t.cvr != null ? fmtPct(t.cvr) : '—'}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="px-4 py-3 text-right text-gray-600 text-xs italic">wires with historical economics</td>
                    )}
                  </tr>
                );
              })}
              {!live && [...allCohorts].reverse().map((c, i) => {
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
