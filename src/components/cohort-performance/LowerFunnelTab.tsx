'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { EnrollmentTeamData, ConsultAdvisorBlock } from '@/lib/enrollmentTeam';
import ProFormaBanner from './ProFormaBanner';

interface ApiResponse {
  live: EnrollmentTeamData | null;
  needsAccess: boolean;
}

function fmt(n: number | null | undefined) { return n === null || n === undefined ? '—' : n.toLocaleString(); }
function pct(n: number | null | undefined) { return n === null || n === undefined ? '—' : `${n.toFixed(1)}%`; }

const TH = 'text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider';
const THL = 'text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider';

function DeltaVal({ base, actual, isPct }: { base: number | null; actual: number | null; isPct?: boolean }) {
  if (actual === null) return <span className="text-gray-600">—</span>;
  const show = isPct ? pct(actual) : fmt(actual);
  if (base === null || (base === 0 && actual === 0)) return <span className="text-gray-300">{show}</span>;
  return <span className={`font-medium ${actual >= base ? 'text-emerald-400' : 'text-red-400'}`}>{show}</span>;
}

interface Props {
  family: 'wharton' | 'columbia';
}

export default function LowerFunnelTab({ family }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/enrollment-team')
      .then(r => r.json())
      .then(json => { if (!cancelled) { setData(json); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const live = data?.live ?? null;
  const pick = (b: ConsultAdvisorBlock) => (family === 'columbia' ? b.columbia : b.wharton);
  const ta = live?.ta ? (family === 'columbia' ? live.ta.columbia : live.ta.wharton) : null;
  const kpiWeek = live?.advisorKpis ? live.advisorKpis.weeks[live.advisorKpis.weeks.length - 1] : null;

  if (loading) {
    return <div className="bg-[#161b22] border border-white/10 rounded-xl p-6 text-sm text-gray-400 animate-pulse">Loading enrollment team data…</div>;
  }

  if (!live) {
    return (
      <div className="space-y-4">
        <ProFormaBanner note="Aubrey's enrollment-team sheet is unreachable right now — no illustrative substitute is shown to avoid confusing fake numbers with real ones." />
        <Link href="/enrollment-team" className="block bg-[#161b22] border border-white/10 rounded-xl p-4 hover:border-white/25 transition-colors">
          <p className="text-sm font-semibold text-white">Open the Enrollment Team dashboard →</p>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-[11px] text-gray-500">
        <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 mr-2">Live</span>
        {family === 'columbia' ? 'Columbia' : 'Wharton'} slice of Aubrey&apos;s enrollment-team dashboard. Baselines use her comparison-dates method (same cycle window, prior cohort).
      </p>

      {/* Consults per advisor, family slice */}
      {live.consults ? (
        <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">Consults &amp; Consult → Enroll CVR — per advisor</h2>
            {live.consults.dataPulled && <p className="text-[11px] text-gray-500 mt-0.5">Data pulled {live.consults.dataPulled}</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className={THL}>Advisor</th>
                  <th className={TH}>Consults (base)</th>
                  <th className={TH}>Consults (actual)</th>
                  <th className={TH}>Enrollees (base)</th>
                  <th className={TH}>Enrollees (actual)</th>
                  <th className={TH}>CVR (base)</th>
                  <th className={TH}>CVR (actual)</th>
                </tr>
              </thead>
              <tbody>
                {live.consults.advisors.map((b, i) => {
                  const m = pick(b);
                  const isTotal = b.advisor === 'Total';
                  return (
                    <tr key={b.advisor} className={`border-b border-white/5 ${isTotal ? 'bg-white/5 font-semibold' : i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                      <td className="px-5 py-3 text-white font-medium">{b.advisor}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(m.completed[0])}</td>
                      <td className="px-4 py-3 text-right"><DeltaVal base={m.completed[0]} actual={m.completed[1]} /></td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(m.enrollees[0])}</td>
                      <td className="px-4 py-3 text-right"><DeltaVal base={m.enrollees[0]} actual={m.enrollees[1]} /></td>
                      <td className="px-4 py-3 text-right text-gray-500">{pct(m.cvr[0])}</td>
                      <td className="px-4 py-3 text-right"><DeltaVal base={m.cvr[0]} actual={m.cvr[1]} isPct /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex gap-4 flex-wrap">
        {/* TA, family slice */}
        {ta && (
          <div className="flex-1 min-w-[300px] bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white">Tuition Assistance</h2>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="px-5 py-3 text-gray-300">TA Applications</td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt(ta.apps[0])}</td>
                  <td className="px-4 py-3 text-right"><DeltaVal base={ta.apps[0]} actual={ta.apps[1]} /></td>
                </tr>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <td className="px-5 py-3 text-gray-300">TA Enrollees</td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt(ta.enrollees[0])}</td>
                  <td className="px-4 py-3 text-right"><DeltaVal base={ta.enrollees[0]} actual={ta.enrollees[1]} /></td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-5 py-3 text-gray-300">TA CVR</td>
                  <td className="px-4 py-3 text-right text-gray-500">{pct(ta.cvr[0])}</td>
                  <td className="px-4 py-3 text-right"><DeltaVal base={ta.cvr[0]} actual={ta.cvr[1]} isPct /></td>
                </tr>
              </tbody>
            </table>
            <p className="px-5 py-2.5 text-[11px] text-gray-500">Baseline → actual</p>
          </div>
        )}

        {/* Info sessions (Columbia cycle) */}
        {family === 'columbia' && live.infoSessions && (
          <div className="flex-1 min-w-[300px] bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white">Info Sessions — {live.infoSessions.cohortLabel}</h2>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="px-5 py-3 text-gray-300">Registrations (cycle)</td>
                  <td className="px-4 py-3 text-right text-white font-medium">{fmt(live.infoSessions.totalRegistrations)}</td>
                </tr>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <td className="px-5 py-3 text-gray-300">Attendance (cycle)</td>
                  <td className="px-4 py-3 text-right text-white font-medium">{fmt(live.infoSessions.totalAttendance)}</td>
                </tr>
                {live.infoSessions.comparisons.slice(0, 3).map((c, i) => (
                  <tr key={c.label} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                    <td className="px-5 py-3 text-gray-500 text-xs">{c.label} · same slots</td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{fmt(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Advisor KPI latest week */}
        {kpiWeek && (
          <div className="flex-1 min-w-[340px] bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white">Advisor KPIs — Wk {kpiWeek.week}</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">{kpiWeek.dateRange} · goals: 90% tasks · 200 emails · 80 closed · 35% CVR</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className={THL}>Advisor</th>
                  <th className={TH}>Enrolls</th>
                  <th className={TH}>Emails</th>
                  <th className={TH}>Closed</th>
                  <th className={TH}>KPIs met</th>
                </tr>
              </thead>
              <tbody>
                {kpiWeek.rows.map((r, i) => (
                  <tr key={r.advisor} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                    <td className="px-5 py-3 text-white font-medium">{r.advisor}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(r.enrollments)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${(r.emailsSent ?? 0) >= 200 ? 'text-emerald-400' : 'text-yellow-400'}`}>{fmt(r.emailsSent)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${(r.emailsClosed ?? 0) >= 80 ? 'text-emerald-400' : 'text-yellow-400'}`}>{fmt(r.emailsClosed)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                        /yes/i.test(r.kpisMet)
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                      }`}>
                        {r.kpisMet || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Link href="/enrollment-team" className="block bg-[#161b22] border border-white/10 rounded-xl p-4 hover:border-white/25 transition-colors">
        <p className="text-sm font-semibold text-white">Full Enrollment Team dashboard →</p>
        <p className="text-xs text-gray-500 mt-1">Both schools · weekly outreach volume · full info-session series · KPI history</p>
      </Link>
    </div>
  );
}
