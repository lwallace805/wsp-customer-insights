'use client';

import { useEffect, useState } from 'react';
import type {
  EnrollmentTeamData,
  ConsultAdvisorBlock,
} from '@/lib/enrollmentTeam';

interface ApiResponse {
  whartonCohort: { label: string; week: number } | null;
  columbiaCohort: { label: string; week: number } | null;
  live: EnrollmentTeamData | null;
  needsAccess: boolean;
  serviceAccount?: string | null;
  error?: string | null;
}

function fmt(n: number | null | undefined) { return n === null || n === undefined ? '—' : n.toLocaleString(); }
function pct(n: number | null | undefined) { return n === null || n === undefined ? '—' : `${n.toFixed(1)}%`; }

function LiveChip() {
  return (
    <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
      Live
    </span>
  );
}

function SectionShell({ title, sub, right, children }: {
  title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {sub && <p className="text-[11px] text-gray-500 mt-0.5 max-w-3xl whitespace-pre-line">{sub}</p>}
        </div>
        {right ?? <LiveChip />}
      </div>
      {children}
    </div>
  );
}

function Unavailable({ tab }: { tab: string }) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-5 text-sm text-gray-600 italic">
      &quot;{tab}&quot; tab unavailable or restructured — section degrades instead of crashing. Ping Luke if this persists.
    </div>
  );
}

const TH = 'text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider';
const THL = 'text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider';

function DeltaVal({ base, actual, isPct, higherIsBetter = true }: {
  base: number | null; actual: number | null; isPct?: boolean; higherIsBetter?: boolean;
}) {
  if (actual === null) return <span className="text-gray-600">—</span>;
  const show = isPct ? pct(actual) : fmt(actual);
  if (base === null || base === 0 && actual === 0) return <span className="text-gray-300">{show}</span>;
  const good = higherIsBetter ? actual >= base : actual <= base;
  return <span className={`font-medium ${good ? 'text-emerald-400' : 'text-red-400'}`}>{show}</span>;
}

function ConsultRow({ b, zebra }: { b: ConsultAdvisorBlock; zebra: boolean }) {
  const isTotal = b.advisor === 'Total';
  return (
    <tr className={`border-b border-white/5 ${isTotal ? 'bg-white/5 font-semibold' : zebra ? 'bg-white/[0.02]' : ''}`}>
      <td className="px-5 py-3 text-white font-medium">{b.advisor}</td>
      <td className="px-4 py-3 text-right text-gray-500">{fmt(b.columbia.completed[0])}</td>
      <td className="px-4 py-3 text-right"><DeltaVal base={b.columbia.completed[0]} actual={b.columbia.completed[1]} /></td>
      <td className="px-4 py-3 text-right text-gray-500">{pct(b.columbia.cvr[0])}</td>
      <td className="px-4 py-3 text-right"><DeltaVal base={b.columbia.cvr[0]} actual={b.columbia.cvr[1]} isPct /></td>
      <td className="px-4 py-3 text-right text-gray-500 border-l border-white/5">{fmt(b.wharton.completed[0])}</td>
      <td className="px-4 py-3 text-right"><DeltaVal base={b.wharton.completed[0]} actual={b.wharton.completed[1]} /></td>
      <td className="px-4 py-3 text-right text-gray-500 border-l border-white/5">{fmt(b.combined.completed[0])}</td>
      <td className="px-4 py-3 text-right"><DeltaVal base={b.combined.completed[0]} actual={b.combined.completed[1]} /></td>
    </tr>
  );
}

export default function EnrollmentTeamDashboard() {
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
  const outreachBlock = live?.outreach?.blocks?.[0] ?? null;
  const outreachAdvisors = outreachBlock ? outreachBlock.totals.filter(t => t.totalSent !== null).map(t => t.advisor) : [];
  const kpiWeeks = live?.advisorKpis ? live.advisorKpis.weeks.slice(-2).reverse() : [];

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-xl font-bold text-white">Enrollment Team — Lower Funnel</h1>
          <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            Live · Aubrey&apos;s dashboard
          </span>
        </div>
        <p className="text-sm text-gray-400">
          {data?.whartonCohort ? `${data.whartonCohort.label} · Wk ${data.whartonCohort.week}` : ''}
          {data?.columbiaCohort ? `  ·  ${data.columbiaCohort.label} · Wk ${data.columbiaCohort.week}` : ''}
          {'  ·  '}The weekly email, as a page: consults · info sessions · TA · outreach · advisor KPIs
        </p>
      </div>

      {loading && (
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-6 mb-6 text-sm text-gray-400 animate-pulse">
          Loading enrollment team data…
        </div>
      )}

      {data?.needsAccess && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 text-sm text-yellow-200">
          <p className="font-semibold mb-1">Sheet access lost</p>
          <p className="text-yellow-200/80 text-xs">
            Re-share the sheet with <code className="bg-black/30 px-1.5 py-0.5 rounded">{data.serviceAccount}</code> (Viewer).
          </p>
        </div>
      )}

      {live && !loading && (
        <div className="space-y-6">
          {/* ── 1 · Consults ── */}
          {live.consults ? (
            <SectionShell
              title="Consult Volume & Consult → Enroll CVR — per advisor, baseline vs actual"
              sub={`${live.consults.dataPulled ? `Data pulled ${live.consults.dataPulled} · ` : ''}Baseline = same cycle window, prior cohort (Aubrey's comparison-dates method).${live.consults.comparisonNote ? `\n${live.consults.comparisonNote}` : ''}`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className={THL}>Advisor</th>
                      <th className={TH} colSpan={2}>Columbia consults (base → actual)</th>
                      <th className={TH} colSpan={2}>Columbia CVR (base → actual)</th>
                      <th className={`${TH} border-l border-white/5`} colSpan={2}>Wharton consults</th>
                      <th className={`${TH} border-l border-white/5`} colSpan={2}>Combined consults</th>
                    </tr>
                  </thead>
                  <tbody>
                    {live.consults.advisors.map((b, i) => <ConsultRow key={b.advisor} b={b} zebra={i % 2 === 1} />)}
                  </tbody>
                </table>
              </div>
            </SectionShell>
          ) : <Unavailable tab="Team Consult Data" />}

          {/* ── 2 · Info sessions ── */}
          {live.infoSessions ? (
            <SectionShell
              title={`Info Sessions — ${live.infoSessions.cohortLabel} cycle`}
              sub="Registrations & attendance per session week, with same-slot attendance from prior cohorts (C-numbers) for baseline."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className={THL}>Series</th>
                      {live.infoSessions.weeks.map(w => (
                        <th key={w.session} className={TH}>
                          <div>{w.week || w.session}</div>
                          <div className="font-normal normal-case text-gray-600">{w.date}</div>
                        </th>
                      ))}
                      <th className={`${TH} border-l border-white/5`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/5">
                      <td className="px-5 py-3 text-white">Registrations</td>
                      {live.infoSessions.weeks.map(w => (
                        <td key={w.session} className="px-4 py-3 text-right text-gray-300">{fmt(w.registrations)}</td>
                      ))}
                      <td className="px-4 py-3 text-right text-white font-semibold border-l border-white/5">{fmt(live.infoSessions.totalRegistrations)}</td>
                    </tr>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td className="px-5 py-3 text-white">Attendance</td>
                      {live.infoSessions.weeks.map(w => (
                        <td key={w.session} className="px-4 py-3 text-right text-gray-300">{fmt(w.attendance)}</td>
                      ))}
                      <td className="px-4 py-3 text-right text-white font-semibold border-l border-white/5">{fmt(live.infoSessions.totalAttendance)}</td>
                    </tr>
                    {live.infoSessions.comparisons.map((c, i) => (
                      <tr key={c.label} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                        <td className="px-5 py-3 text-gray-500 text-xs">{c.label} · same slots</td>
                        {c.values.map((v, j) => (
                          <td key={j} className="px-4 py-3 text-right text-gray-500 text-xs">{fmt(v)}</td>
                        ))}
                        <td className="px-4 py-3 text-right text-gray-500 text-xs border-l border-white/5">{fmt(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionShell>
          ) : <Unavailable tab="Info Session Data" />}

          {/* ── 3 · TA + outreach cycle totals side by side ── */}
          <div className="flex gap-4 flex-wrap">
            {live.ta ? (
              <div className="flex-1 min-w-[340px]">
                <SectionShell
                  title="Tuition Assistance"
                  sub={live.ta.dataPulled ? `Data pulled ${live.ta.dataPulled} · baseline vs actual` : 'Baseline vs actual'}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className={THL}>Metric</th>
                          <th className={TH}>Wharton base</th>
                          <th className={TH}>Wharton actual</th>
                          <th className={`${TH} border-l border-white/5`}>Columbia base</th>
                          <th className={TH}>Columbia actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-white/5">
                          <td className="px-5 py-3 text-white">TA Applications</td>
                          <td className="px-4 py-3 text-right text-gray-500">{fmt(live.ta.wharton.apps[0])}</td>
                          <td className="px-4 py-3 text-right"><DeltaVal base={live.ta.wharton.apps[0]} actual={live.ta.wharton.apps[1]} /></td>
                          <td className="px-4 py-3 text-right text-gray-500 border-l border-white/5">{fmt(live.ta.columbia.apps[0])}</td>
                          <td className="px-4 py-3 text-right"><DeltaVal base={live.ta.columbia.apps[0]} actual={live.ta.columbia.apps[1]} /></td>
                        </tr>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <td className="px-5 py-3 text-white">TA Enrollees</td>
                          <td className="px-4 py-3 text-right text-gray-500">{fmt(live.ta.wharton.enrollees[0])}</td>
                          <td className="px-4 py-3 text-right"><DeltaVal base={live.ta.wharton.enrollees[0]} actual={live.ta.wharton.enrollees[1]} /></td>
                          <td className="px-4 py-3 text-right text-gray-500 border-l border-white/5">{fmt(live.ta.columbia.enrollees[0])}</td>
                          <td className="px-4 py-3 text-right"><DeltaVal base={live.ta.columbia.enrollees[0]} actual={live.ta.columbia.enrollees[1]} /></td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="px-5 py-3 text-white">TA CVR</td>
                          <td className="px-4 py-3 text-right text-gray-500">{pct(live.ta.wharton.cvr[0])}</td>
                          <td className="px-4 py-3 text-right"><DeltaVal base={live.ta.wharton.cvr[0]} actual={live.ta.wharton.cvr[1]} isPct /></td>
                          <td className="px-4 py-3 text-right text-gray-500 border-l border-white/5">{pct(live.ta.columbia.cvr[0])}</td>
                          <td className="px-4 py-3 text-right"><DeltaVal base={live.ta.columbia.cvr[0]} actual={live.ta.columbia.cvr[1]} isPct /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </SectionShell>
              </div>
            ) : <div className="flex-1 min-w-[340px]"><Unavailable tab="Tuition Assistance Data" /></div>}

            {outreachBlock ? (
              <div className="flex-1 min-w-[340px]">
                <SectionShell
                  title={`Advisor Outreach — ${outreachBlock.cohortLabel} cycle to date`}
                  sub="Total emails sent by contact stage, per advisor"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className={THL}>Advisor</th>
                          <th className={TH}>Contacts</th>
                          <th className={TH}>Leads</th>
                          <th className={TH}>Qualified</th>
                          <th className={TH}>Customers</th>
                          <th className={TH}>Total</th>
                          <th className={TH}>Closed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outreachBlock.totals.filter(t => t.totalSent !== null).map((t, i) => (
                          <tr key={t.advisor} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                            <td className="px-5 py-3 text-white font-medium capitalize">{t.advisor.toLowerCase()}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{fmt(t.contactSent)}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{fmt(t.leadSent)}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{fmt(t.qualifiedSent)}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{fmt(t.customerSent)}</td>
                            <td className="px-4 py-3 text-right text-white font-medium">{fmt(t.totalSent)}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{fmt(t.closed)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionShell>
              </div>
            ) : <div className="flex-1 min-w-[340px]"><Unavailable tab="Email Data" /></div>}
          </div>

          {/* ── 4 · Weekly outreach volume ── */}
          {outreachBlock && outreachBlock.weeks.length > 0 && (
            <SectionShell
              title={`Weekly Outreach Volume — ${outreachBlock.cohortLabel}`}
              sub="Total emails sent per advisor per cycle week · goal 200–225/wk"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className={THL}>Week</th>
                      {outreachAdvisors.map(a => (
                        <th key={a} className={`${TH} capitalize`}>{a.toLowerCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...outreachBlock.weeks]
                      .filter(w => Object.values(w.perAdvisor).some(v => v.sent > 0))
                      .sort((a, b) => b.week - a.week)
                      .map((w, i) => (
                        <tr key={w.week} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                          <td className="px-5 py-3 text-white whitespace-nowrap">Wk {w.week} <span className="text-gray-500 text-xs">· {w.dateRange}</span></td>
                          {outreachAdvisors.map(a => {
                            const v = w.perAdvisor[a];
                            const good = (v?.sent ?? 0) >= 200;
                            return (
                              <td key={a} className={`px-4 py-3 text-right font-medium ${!v || v.sent === 0 ? 'text-gray-600' : good ? 'text-emerald-400' : 'text-gray-300'}`}>
                                {v && v.sent > 0 ? v.sent.toLocaleString() : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </SectionShell>
          )}

          {/* ── 5 · Advisor KPI scoreboard ── */}
          {live.advisorKpis ? (
            <SectionShell
              title={`Advisor KPI Scoreboard — ${live.advisorKpis.tabLabel} (last 2 keyed weeks)`}
              sub="Goals: 90% task completion · 200 emails/wk · 80 closed/wk · 35% consult→enroll CTD"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className={THL}>Week</th>
                      <th className={THL}>Advisor</th>
                      <th className={TH}>Enrolls (goal)</th>
                      <th className={TH}>Tasks %</th>
                      <th className={TH}>Emails sent</th>
                      <th className={TH}>Closed</th>
                      <th className={TH}>Consult CVR</th>
                      <th className={TH}>KPIs met</th>
                      <th className={THL}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiWeeks.flatMap((w, wi) =>
                      w.rows.map((r, i) => (
                        <tr key={`${wi}-${i}`} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                          <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{i === 0 ? `Wk ${w.week} · ${w.dateRange}` : ''}</td>
                          <td className="px-5 py-3 text-white font-medium">{r.advisor}</td>
                          <td className="px-4 py-3 text-right text-gray-300">{fmt(r.enrollments)}{r.enrollGoal !== null ? <span className="text-gray-600"> / {fmt(r.enrollGoal)}</span> : ''}</td>
                          <td className={`px-4 py-3 text-right font-medium ${(r.taskCompletionPct ?? 0) >= 90 ? 'text-emerald-400' : 'text-yellow-400'}`}>{pct(r.taskCompletionPct)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${(r.emailsSent ?? 0) >= 200 ? 'text-emerald-400' : 'text-yellow-400'}`}>{fmt(r.emailsSent)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${(r.emailsClosed ?? 0) >= 80 ? 'text-emerald-400' : 'text-yellow-400'}`}>{fmt(r.emailsClosed)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${(r.consultCvr ?? 0) >= 35 ? 'text-emerald-400' : 'text-yellow-400'}`}>{pct(r.consultCvr)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                              /yes/i.test(r.kpisMet)
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                            }`}>
                              {r.kpisMet || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{r.notes}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionShell>
          ) : <Unavailable tab="Enrollment KPIs/Goal Tracking" />}

          <p className="text-[11px] text-gray-600 max-w-3xl">
            All sections read Aubrey&apos;s &quot;Certifcates Dashboard&quot; sheet directly (manual-first: she keeps updating it exactly as today). Contact-rate and phone metrics live only in HubSpot reports and wire at the L2 HubSpot phase.
          </p>
        </div>
      )}
    </div>
  );
}
