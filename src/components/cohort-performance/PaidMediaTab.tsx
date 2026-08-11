'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { CohortData } from '@/data/cohortPerformance';
import type { CommandLive } from '@/lib/pulseLive';
import type { PaidRow, PaidWeek } from '@/lib/sheets';
import ProFormaBanner from './ProFormaBanner';

function fmtDollar(n: number | null) {
  if (n === null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtPct(n: number | null) { return n === null ? '—' : `${n.toFixed(2)}%`; }
function fmt(n: number | null) { return n === null ? '—' : n.toLocaleString(); }
function money2(n: number | null) { return n === null ? '—' : `$${n.toFixed(2)}`; }

const TH = 'text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider';
const THL = 'text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider';

/** A week is unkeyed (still ahead of us) when nothing has landed in it yet. Its
 *  actuals are held as null so the chart lines stop rather than diving to zero. */
function hasActual(w: PaidWeek) {
  return (w.spend ?? 0) > 0 || (w.leads ?? 0) > 0 || (w.enrolls ?? 0) > 0;
}

/** CPL sits in the tens of dollars, CPE in the thousands — one format can't
 *  serve both without either losing cents or printing "$6703.93". */
function cost(n: number) {
  return n >= 1000 ? `$${Math.round(n).toLocaleString()}` : `$${n.toFixed(2)}`;
}

/** Cost metrics are "good" when under target, so the comparison inverts. */
function GoalCell({ actual, goal }: { actual: number | null; goal: number | null }) {
  if (actual === null) return <span className="text-gray-500">—</span>;
  if (goal === null || goal === 0) return <span className="text-gray-300">{cost(actual)}</span>;
  const over = actual > goal;
  return (
    <span>
      <span className={over ? 'text-red-400 font-medium' : 'text-emerald-400 font-medium'}>
        {cost(actual)}
      </span>
      <span className="block text-[10px] text-gray-500 font-normal">
        goal ${goal.toLocaleString()} · {over ? `${(actual / goal).toFixed(1)}x over` : 'under'}
      </span>
    </span>
  );
}

interface Props {
  cohort: CohortData;
  live?: CommandLive | null;
}

export default function PaidMediaTab({ cohort, live }: Props) {
  const paid = live?.paid ?? null;

  // ── LIVE path: paid-only performance from the cohort doc ──
  // Needs a headline plus at least one breakdown; the weekly series is optional
  // because CBS's doc carries per-channel weeklies only, with no all-paid block.
  if (paid && (paid.totals || paid.channels.length > 0)) {
    const t = paid.totals;
    const weeks = paid.weeks;
    const keyed = weeks.filter(hasActual);

    const chartData = weeks.map(w => ({
      week: `Wk ${w.week}`,
      'Spend (Actual)': hasActual(w) ? w.spend : null,
      'Spend (Forecast)': w.spendF,
      'Leads': hasActual(w) ? w.leads : null,
      'Enrollments': hasActual(w) ? w.enrolls : null,
    }));
    const cvrData = keyed.map(w => ({
      week: `Wk ${w.week}`,
      'CVR (%)': w.cvr,
      'CPE ($)': w.cpe,
    }));

    // Per-program spend excludes brand / unallocated campaigns, though their
    // leads and enrollments ARE attributed to programs. Surface the remainder so
    // the spend column foots to the total instead of quietly falling short.
    const progSpend = paid.programs.reduce((s, p) => s + (p.spend ?? 0), 0);
    const unallocated = t && t.spend !== null ? t.spend - progSpend : null;

    const renderPerf = (r: PaidRow, key: string, bold = false) => (
      <tr key={key} className={bold ? 'border-t border-white/20 bg-white/5' : 'border-b border-white/5'}>
        <td className={`px-5 py-3 ${bold ? 'text-white font-semibold' : 'text-white'}`}>{r.label}</td>
        <td className="px-4 py-3 text-right text-gray-300">{fmtDollar(r.spend)}</td>
        <td className="px-4 py-3 text-right text-gray-300">{fmt(r.leads)}</td>
        <td className="px-4 py-3 text-right text-gray-300">{fmt(r.enrolls)}</td>
        {/* A cost per X with no X isn't zero cost, it's undefined — the sheet
            stores $0.00 there, which would otherwise render as beating goal. */}
        <td className="px-4 py-3 text-right"><GoalCell actual={r.leads ? r.cpl : null} goal={r.cplGoal} /></td>
        <td className="px-4 py-3 text-right"><GoalCell actual={r.enrolls ? r.cpe : null} goal={r.cpeGoal} /></td>
        <td className="px-4 py-3 text-right text-gray-300">{fmtPct(r.cvr)}</td>
        <td className={`px-4 py-3 text-right font-medium ${(r.roas ?? 0) >= 1 ? 'text-emerald-400' : 'text-yellow-400'}`}>
          {r.roas === null ? '—' : `${r.roas.toFixed(2)}x`}
        </td>
      </tr>
    );

    return (
      <div className="space-y-6">
        <p className="text-[11px] text-gray-500">
          <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 mr-2">Live</span>
          {live!.label} · {paid.source}. <b className="text-gray-400">Paid only</b> — everything here is the paid-attributed
          subset of the {fmt(live!.totals?.leads ?? null)} leads and {fmt(live!.totals?.enrolls ?? null)}{' '}
          enrollments shown on Overview, which count every source.{' '}
          {t
            ? 'ROAS is the sheet’s own, on a $2,700-per-enrollment net-revenue basis.'
            : 'This doc keeps no combined-paid total, so the channels below are shown exactly as it states them and are not rolled up here.'}
        </p>

        {/* Summary KPIs */}
        {t && (
        <div className="flex gap-4 flex-wrap">
          {[
            { label: 'Paid Spend', value: fmtDollar(t.spend), sub: t.spendF !== null ? `forecast ${fmtDollar(t.spendF)}` : null },
            { label: 'Paid Leads', value: fmt(t.leads), sub: t.leadsF !== null ? `forecast ${fmt(t.leadsF)}` : null },
            { label: 'Paid Enrolls', value: fmt(t.enrolls), sub: t.enrollsF !== null ? `forecast ${fmt(t.enrollsF)}` : null },
            { label: 'CPL', value: money2(t.cpl), sub: t.cplGoal !== null ? `goal $${t.cplGoal}` : null, bad: (t.cpl ?? 0) > (t.cplGoal ?? Infinity) },
            { label: 'CPE', value: t.cpe === null ? '—' : `$${Math.round(t.cpe).toLocaleString()}`, sub: t.cpeGoal !== null ? `goal $${t.cpeGoal.toLocaleString()}` : null, bad: (t.cpe ?? 0) > (t.cpeGoal ?? Infinity) },
            { label: 'Paid CVR', value: fmtPct(t.cvr), sub: null },
            { label: 'ROAS', value: t.roas === null ? '—' : `${t.roas.toFixed(2)}x`, sub: null, bad: (t.roas ?? 0) < 1 },
          ].map(k => (
            <div key={k.label} className="bg-[#161b22] border border-white/10 rounded-xl p-5 flex-1 min-w-[130px]">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{k.label}</p>
              <p className={`text-2xl font-bold ${k.bad ? 'text-red-400' : 'text-white'}`}>{k.value}</p>
              {k.sub && <p className="text-[11px] text-gray-500 mt-1">{k.sub}</p>}
            </div>
          ))}
        </div>
        )}

        {/* By channel */}
        {paid.channels.length > 0 && (
          <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white">Paid Performance by Channel</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Each channel&apos;s all-program total{t ? '. These sum to the paid totals above.' : ', exactly as the doc states them.'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className={THL}>Channel</th><th className={TH}>Spend</th><th className={TH}>Leads</th>
                    <th className={TH}>Enrolls</th><th className={TH}>CPL</th><th className={TH}>CPE</th>
                    <th className={TH}>CVR</th><th className={TH}>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {paid.channels.map(c => renderPerf(c, c.label))}
                  {t && renderPerf(t, 'ch-total', true)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* By program */}
        {paid.programs.length > 0 && (
          <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white">Paid Performance by Program — vs. CPL / CPE goals</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className={THL}>Program</th><th className={TH}>Spend</th><th className={TH}>Leads</th>
                    <th className={TH}>Enrolls</th><th className={TH}>CPL</th><th className={TH}>CPE</th>
                    <th className={TH}>CVR</th><th className={TH}>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {paid.programs.map(p => renderPerf(p, p.label))}
                  {unallocated !== null && Math.round(unallocated) !== 0 && (
                    <tr className="border-b border-white/5">
                      <td className="px-5 py-3 text-gray-400 italic">
                        Brand / unallocated
                        <span className="block text-[10px] text-gray-600">
                          spend not split by program; its leads and enrollments are already counted in the rows above
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">{fmtDollar(unallocated)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">—</td>
                      <td className="px-4 py-3 text-right text-gray-600">—</td>
                      <td className="px-4 py-3 text-right text-gray-600">—</td>
                      <td className="px-4 py-3 text-right text-gray-600">—</td>
                      <td className="px-4 py-3 text-right text-gray-600">—</td>
                      <td className="px-4 py-3 text-right text-gray-600">—</td>
                    </tr>
                  )}
                  {t && renderPerf(t, 'pg-total', true)}
                </tbody>
              </table>
            </div>
            {unallocated !== null && Math.round(unallocated) !== 0 && (
              <p className="px-5 py-3 text-[11px] text-gray-500 border-t border-white/5">
                Per-program CPL and CPE divide only that program&apos;s directly-attributed spend, so they understate true
                cost by each program&apos;s share of the {fmtDollar(unallocated)} brand spend above.
              </p>
            )}
          </div>
        )}

        {/* Spend vs Leads/Enrolls chart */}
        {weeks.length > 0 && (
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Weekly Paid Spend, Leads &amp; Enrollments</h2>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="spend" orientation="left" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
              <YAxis yAxisId="count" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #ffffff20', borderRadius: 8, color: '#fff', fontSize: 12 }}
                cursor={{ fill: '#ffffff05' }}
                formatter={(v, name) =>
                  v == null ? ['—', name] : String(name).includes('Spend')
                    ? [fmtDollar(Number(v)), name]
                    : [fmt(Number(v)), name]
                }
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar yAxisId="spend" dataKey="Spend (Actual)" fill="#3b82f6" opacity={0.8} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar yAxisId="spend" dataKey="Spend (Forecast)" fill="#3b82f6" opacity={0.2} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Line yAxisId="count" dataKey="Leads" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              <Line yAxisId="count" dataKey="Enrollments" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* CVR & CPE trend — keyed weeks only */}
        {keyed.length > 0 && (
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Weekly Paid CVR &amp; CPE Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={cvrData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="cvr" orientation="left" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <YAxis yAxisId="cpe" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #ffffff20', borderRadius: 8, color: '#fff', fontSize: 12 }}
                cursor={{ fill: '#ffffff05' }}
                formatter={(v, name) =>
                  v == null ? ['—', name] : String(name).includes('CVR')
                    ? [`${Number(v).toFixed(2)}%`, name]
                    : [`$${Math.round(Number(v)).toLocaleString()}`, name]
                }
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Line yAxisId="cvr" dataKey="CVR (%)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="cpe" dataKey="CPE ($)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Weekly detail table */}
        {weeks.length > 0 && (
        <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">Weekly Paid Detail — {live!.label}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className={THL}>Week</th><th className={TH}>Spend</th><th className={TH}>vs. Forecast</th>
                  <th className={TH}>Leads</th><th className={TH}>Fcst</th><th className={TH}>Enrolls</th>
                  <th className={TH}>Fcst</th><th className={TH}>CPL</th><th className={TH}>CPE</th><th className={TH}>CVR</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w, i) => {
                  const keyedWeek = hasActual(w);
                  const spendDelta = keyedWeek && w.spend !== null && w.spendF !== null ? w.spend - w.spendF : null;
                  return (
                    <tr key={w.week} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''} ${keyedWeek ? '' : 'opacity-45'}`}>
                      <td className="px-5 py-3 text-gray-400 whitespace-nowrap">
                        Wk {w.week} <span className="text-gray-600 text-xs">· {w.dateRange}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{keyedWeek ? fmtDollar(w.spend) : '—'}</td>
                      <td className={`px-4 py-3 text-right text-xs font-medium ${spendDelta === null ? 'text-gray-600' : spendDelta <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {spendDelta === null ? '—' : `${spendDelta <= 0 ? '' : '+'}${fmtDollar(Math.abs(spendDelta))} ${spendDelta <= 0 ? 'under' : 'over'}`}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{keyedWeek ? fmt(w.leads) : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(w.leadsF)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{keyedWeek ? fmt(w.enrolls) : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(w.enrollsF)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{keyedWeek ? money2(w.cpl) : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{keyedWeek && w.cpe !== null ? `$${Math.round(w.cpe).toLocaleString()}` : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{keyedWeek ? fmtPct(w.cvr) : '—'}</td>
                    </tr>
                  );
                })}
                {t && (
                <tr className="border-t border-white/20 bg-white/5">
                  <td className="px-5 py-3 text-white font-semibold">Total</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmtDollar(t.spend)}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmt(t.leads)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{fmt(t.leadsF)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmt(t.enrolls)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{fmt(t.enrollsF)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{money2(t.cpl)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{t.cpe === null ? '—' : `$${Math.round(t.cpe).toLocaleString()}`}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmtPct(t.cvr)}</td>
                </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-2.5 text-[11px] text-gray-500 border-t border-white/5">
            Dimmed rows are weeks the cohort hasn&apos;t reached yet — forecast only.
          </p>
        </div>
        )}

        {weeks.length === 0 && (
          <p className="text-[11px] text-gray-500 bg-[#161b22] border border-white/10 rounded-xl px-4 py-3">
            No combined weekly paid series in this doc — its week-by-week detail is kept per channel rather than
            as one paid total, so the weekly charts are omitted instead of being stitched together here.
          </p>
        )}
      </div>
    );
  }

  // ── PRO FORMA fallback (closed cohorts / live source unavailable) ──
  const weeks = cohort.weekly;
  const totalSpend = weeks.reduce((s, w) => s + w.spend, 0);
  const totalLeads = weeks.reduce((s, w) => s + w.leads, 0);
  const totalEnrolls = weeks.reduce((s, w) => s + w.enrolls, 0);
  const blendedCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const blendedCpe = totalEnrolls > 0 ? totalSpend / totalEnrolls : 0;

  const chartData = weeks.map(w => ({
    week: `Wk ${w.week}`,
    'Spend (Actual)': w.spend,
    'Spend (Forecast)': w.spendForecast,
    'Leads': w.leads,
    'Enrollments': w.enrolls,
  }));
  const cvrData = weeks.map(w => ({ week: `Wk ${w.week}`, 'CVR (%)': w.cvr, 'CPE ($)': w.cpe }));

  return (
    <div className="space-y-6">
      <ProFormaBanner note={cohort.status === 'active'
        ? 'Live paid data is loading or unavailable — the numbers below are illustrative placeholders.'
        : 'Illustrative paid data for this closed cohort. Its real paid detail lives in that cohort’s own performance doc.'} />
      {/* Summary KPIs */}
      <div className="flex gap-4">
        {[
          { label: 'Total Spend', value: fmtDollar(totalSpend) },
          { label: 'Total Leads', value: fmt(totalLeads) },
          { label: 'Paid Enrolls', value: fmt(totalEnrolls) },
          { label: 'Blended CPL', value: `$${blendedCpl.toFixed(2)}` },
          { label: 'Blended CPE', value: `$${blendedCpe.toFixed(0)}` },
        ].map(k => (
          <div key={k.label} className="bg-[#161b22] border border-white/10 rounded-xl p-5 flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{k.label}</p>
            <p className="text-2xl font-bold text-white">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Weekly Spend, Leads &amp; Enrollments</h2>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="spend" orientation="left" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis yAxisId="count" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #ffffff20', borderRadius: 8, color: '#fff', fontSize: 12 }}
              cursor={{ fill: '#ffffff05' }}
              formatter={(v, name) =>
                String(name).includes('Spend')
                  ? [fmtDollar(Number(v)), name]
                  : [fmt(Number(v)), name]
              }
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar yAxisId="spend" dataKey="Spend (Actual)" fill="#3b82f6" opacity={0.8} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar yAxisId="spend" dataKey="Spend (Forecast)" fill="#3b82f6" opacity={0.2} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Line yAxisId="count" dataKey="Leads" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            <Line yAxisId="count" dataKey="Enrollments" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Weekly CVR &amp; CPE Trend</h2>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={cvrData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="cvr" orientation="left" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
            <YAxis yAxisId="cpe" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #ffffff20', borderRadius: 8, color: '#fff', fontSize: 12 }}
              cursor={{ fill: '#ffffff05' }}
              formatter={(v, name) =>
                String(name).includes('CVR')
                  ? [`${Number(v).toFixed(2)}%`, name]
                  : [`$${Number(v).toFixed(0)}`, name]
              }
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Line yAxisId="cvr" dataKey="CVR (%)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            <Line yAxisId="cpe" dataKey="CPE ($)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Weekly Paid Media Detail — {cohort.cohort}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className={THL}>Week</th><th className={THL}>Date Range</th><th className={TH}>Spend</th>
                <th className={TH}>vs. Forecast</th><th className={TH}>Leads</th><th className={TH}>Enrolls</th>
                <th className={TH}>vs. Fcst</th><th className={TH}>CPL</th><th className={TH}>CPE</th><th className={TH}>CVR</th>
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
                    <td className={`px-4 py-3 text-right font-medium ${w.cpe < 1000 ? 'text-emerald-400' : 'text-yellow-400'}`}>${w.cpe.toFixed(0)}</td>
                    <td className={`px-4 py-3 text-right ${w.cvr >= 3 ? 'text-emerald-400' : 'text-gray-300'}`}>{fmtPct(w.cvr)}</td>
                  </tr>
                );
              })}
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
