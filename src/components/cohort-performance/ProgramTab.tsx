'use client';

import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { CohortData } from '@/data/cohortPerformance';
import type { CommandLive } from '@/lib/pulseLive';
import ProFormaBanner from './ProFormaBanner';

function fmt(n: number) { return n.toLocaleString(); }
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#a78bfa', '#f472b6'];

/** One rendered program row, whether it came from the live doc or the demo set. */
interface Row {
  program: string;
  goal: number;
  enrolls: number;
  forecast: number;
  leads: number;
  cvr: number;
  cpl: number;
  cpe: number;
}

/** Join the cohort doc's per-program targets (goals tab) to its per-program
 *  actuals (Overall WoW totals block) by program name. Returns null when the
 *  doc can't supply both halves, so the caller falls back rather than render a
 *  breakdown with real goals against blank actuals. */
function buildLiveRows(live: CommandLive): Row[] | null {
  const goals = live.programGoals?.rows ?? [];
  let actuals = live.leadsDetail?.programs ?? [];

  // Single-program cohorts (CBS) carry no per-program rows in the WoW block —
  // the Total row IS the program, so map it across.
  if (actuals.length === 0 && goals.length === 1 && live.totals) {
    const t = live.totals;
    actuals = [{
      program: goals[0].program,
      spend: t.spend, leads: t.leads, leadsF: t.leadsF,
      enrolls: t.enrolls, enrollsF: t.enrollsF,
      cpl: t.cpl, cpe: t.cpe, cvr: t.cvr, cvrF: t.cvrF,
    }];
  }
  if (goals.length === 0 || actuals.length === 0) return null;

  const byName = new Map(actuals.map(a => [a.program.toLowerCase(), a]));
  return goals.map(g => {
    const a = byName.get(g.program.toLowerCase());
    return {
      program: g.program,
      goal: g.goalEnrollments ?? 0,
      enrolls: a?.enrolls ?? 0,
      forecast: a?.enrollsF ?? 0,
      leads: a?.leads ?? 0,
      cvr: a?.cvr ?? 0,
      cpl: a?.cpl ?? 0,
      cpe: a?.cpe ?? 0,
    };
  });
}

interface Props {
  cohort: CohortData;
  live?: CommandLive | null;
}

export default function ProgramTab({ cohort, live }: Props) {
  const liveRows = live ? buildLiveRows(live) : null;
  const rows: Row[] = liveRows ?? cohort.programs.map(p => ({
    program: p.program,
    goal: p.goal,
    enrolls: p.enrolls,
    forecast: p.forecast,
    leads: p.leads,
    cvr: p.cvr,
    cpl: p.cpl,
    cpe: p.cpe,
  }));

  // The goals tab carries its own Total. If the programs no longer sum to it, or
  // to the headline goal the rest of the dashboard shows, say so rather than let
  // two different totals sit on two tabs unexplained.
  const goalSum = rows.reduce((s, r) => s + r.goal, 0);
  const headlineGoal = live?.goal ?? cohort.totalGoal;
  const goalMismatch = liveRows && headlineGoal > 0 && goalSum !== headlineGoal ? goalSum : null;

  const chartData = rows.map(p => ({
    program: p.program,
    Enrollments: p.enrolls,
    Goal: p.goal,
  }));

  const effData = rows
    .filter(p => p.cpe > 0)
    .map(p => ({
      program: p.program,
      'Cost / Enroll': Math.round(p.cpe),
      'Cost / Lead': Math.round(p.cpl),
    }));

  return (
    <div className="space-y-6">
      {liveRows ? (
        <p className="text-[11px] text-gray-500">
          <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 mr-2">Live</span>
          Goals from {live!.programGoals!.source}; enrollments, leads and efficiency from the Overall WoW totals block
          {live!.keyedThrough ? ` (keyed through ${live!.keyedThrough})` : ''}. CPL/CPE are paid-spend basis, so they divide paid spend by all-source leads and enrollments.
        </p>
      ) : (
        <ProFormaBanner />
      )}
      {goalMismatch !== null && (
        <p className="text-[11px] text-yellow-400/80 bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2">
          Program goals sum to {fmt(goalMismatch)} but the cohort goal is {fmt(headlineGoal)} — the goals tab&apos;s program split hasn&apos;t been re-cut since the target changed.
        </p>
      )}
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
                  formatter={(v, name) => [`$${Number(v).toLocaleString()}`, name]}
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
          <h2 className="text-sm font-semibold text-white">Program Breakdown — {liveRows ? live!.label : cohort.cohort}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Program</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Goal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Enrolls</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">% to Goal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{liveRows ? 'Pace to date' : 'Forecast'}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Leads</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CVR</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CPL</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CPE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const pct = p.goal > 0 ? (p.enrolls / p.goal) * 100 : 0;
                // The two modes measure different things against different bases.
                // Live: forecast is the pace target TO DATE, so the useful delta is
                // actual-minus-pace (positive = ahead). Demo: forecast is an
                // end-of-cohort projection, so it's measured against the goal.
                const forecastDelta = liveRows ? p.enrolls - p.forecast : p.forecast - p.goal;
                const showDelta = liveRows ? p.forecast > 0 || p.enrolls > 0 : p.goal > 0;
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
                      {showDelta && (
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
