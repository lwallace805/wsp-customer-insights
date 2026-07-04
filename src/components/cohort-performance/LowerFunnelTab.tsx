'use client';

import { Fragment } from 'react';
import { LOWER_FUNNEL, type LowerFunnelMetric } from '@/data/proforma';

function fmtVal(n: number, format: LowerFunnelMetric['format']) {
  return format === 'pct' ? `${n.toFixed(0)}%` : n.toLocaleString();
}

interface Props {
  family: 'wharton' | 'columbia';
}

export default function LowerFunnelTab({ family }: Props) {
  const data = LOWER_FUNNEL[family];
  const programs = data.metrics[0].perProgram.map(p => p.program);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] text-gray-500 max-w-2xl">{data.baselineNote}</p>
        <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
          Updated through {data.updatedThrough}
        </span>
      </div>

      {/* Funnel chain by program */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Enrollment Team Funnel — Actual vs. Baseline by Program</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">RSVPs → attendees → consults → consult CVR → TA applications → TA enrollments. Feed: enrollment-team contract tab (HubSpot properties later).</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Metric</th>
                {programs.map(p => (
                  <th key={p} colSpan={2} className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider border-l border-white/5">
                    {p}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-white/10">
                <th className="px-5 py-1.5" />
                {programs.map(p => (
                  <th key={p} colSpan={2} className="text-right px-4 py-1.5 text-[10px] font-normal text-gray-600 border-l border-white/5">
                    actual · vs baseline
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.metrics.map((m, i) => (
                <tr key={m.metric} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="px-5 py-3 text-white font-medium whitespace-nowrap">{m.metric}</td>
                  {m.perProgram.map(p => {
                    const isPct = m.format === 'pct';
                    const delta = isPct ? p.actual - p.baseline : p.baseline > 0 ? ((p.actual - p.baseline) / p.baseline) * 100 : 0;
                    const good = m.higherIsBetter ? delta >= 0 : delta <= 0;
                    return (
                      <Fragment key={p.program}>
                        <td className="px-2 py-3 text-right text-gray-300 border-l border-white/5">
                          {fmtVal(p.actual, m.format)}
                        </td>
                        <td className={`pr-4 py-3 text-right text-xs font-medium ${good ? 'text-emerald-400' : 'text-red-400'}`}>
                          {delta >= 0 ? '+' : ''}{delta.toFixed(0)}{isPct ? 'pt' : '%'}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advisor layer */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Advisor Layer — Weekly KPIs</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            The drill below team metrics, from the weekly deck: round-robin lead assignment, lead-scoring task outreach. Goals: 200–225 emails · 80 closed · 90% tasks · 35% consult→enroll · &lt;10% no-show.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Advisor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Emails / wk</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Closed</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Task completion</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Consult → Enroll</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">No-show</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Enrolls vs target</th>
              </tr>
            </thead>
            <tbody>
              {data.advisors.map((a, i) => {
                const kpi = (val: number, goal: number, higherIsBetter = true) => {
                  const good = higherIsBetter ? val >= goal : val <= goal;
                  return good ? 'text-emerald-400' : 'text-yellow-400';
                };
                return (
                  <tr key={a.advisor} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                    <td className="px-5 py-3 text-white font-medium">{a.advisor}</td>
                    <td className={`px-4 py-3 text-right font-medium ${kpi(a.weeklyEmails, 200)}`}>{a.weeklyEmails}</td>
                    <td className={`px-4 py-3 text-right font-medium ${kpi(a.closedEmails, 80)}`}>{a.closedEmails}</td>
                    <td className={`px-4 py-3 text-right font-medium ${kpi(a.taskCompletion, 90)}`}>{a.taskCompletion}%</td>
                    <td className={`px-4 py-3 text-right font-medium ${kpi(a.consultCvr, 35)}`}>{a.consultCvr}%</td>
                    <td className={`px-4 py-3 text-right font-medium ${kpi(a.noShowRate, 10, false)}`}>{a.noShowRate}%</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {a.enrolls} <span className="text-gray-500">/ {a.enrollTarget}</span>
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
