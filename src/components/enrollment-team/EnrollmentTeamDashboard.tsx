'use client';

import { useEffect, useState } from 'react';

// Shapes from /api/enrollment-team
interface AdvisorTotals {
  advisor: string;
  contactSent: number | null;
  leadSent: number | null;
  qualifiedSent: number | null;
  customerSent: number | null;
  totalSent: number | null;
  closed: number | null;
}
interface WeekRow {
  week: number;
  dateRange: string;
  perAdvisor: Record<string, { sent: number; closed: number | null }>;
}
interface Block { cohortLabel: string; totals: AdvisorTotals[]; weeks: WeekRow[]; }
interface ApiResponse {
  whartonCohort: { label: string; week: number } | null;
  columbiaCohort: { label: string; week: number } | null;
  live: { tabTitle: string; blocks: Block[] } | null;
  needsAccess: boolean;
  serviceAccount?: string | null;
  sheetId?: string;
  error?: string | null;
}

function fmt(n: number | null) { return n === null ? '—' : n.toLocaleString(); }

// ── Pro forma figures from Aubrey's 6/29 weekly email (Jun 22–28) — these
// sections wire to her sheet's other tabs once identified. ──
const CONSULTS_DEMO = [
  { advisor: 'Kelin', colBaseline: 27, colActual: 33, colCvrB: 11.1, colCvrA: 45.5, whB: 1, whA: 2 },
  { advisor: 'Kristen', colBaseline: 19, colActual: 35, colCvrB: 31.6, colCvrA: 14.3, whB: 10, whA: 6 },
  { advisor: 'Alicia', colBaseline: 26, colActual: 23, colCvrB: 23.1, colCvrA: 4.4, whB: 10, whA: 5 },
];
const INFO_SESSIONS_DEMO = [
  { label: 'Info Session Registrations', current: 662 },
  { label: 'Info Session Attendance', current: 294 },
  { label: 'Winter 2026 attendance — same week (C3)', current: 416 },
  { label: 'Fall 2025 attendance — same week (C2)', current: 322 },
  { label: 'Summer 2025 attendance — same week (C1)', current: 354 },
];

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

  const block = data?.live?.blocks?.[0] ?? null;
  const advisors = block ? block.totals.map(t => t.advisor) : [];

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-xl font-bold text-white">Enrollment Team — Lower Funnel</h1>
          <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30">
            L2 · Aubrey&apos;s weekly
          </span>
        </div>
        <p className="text-sm text-gray-400">
          {data?.whartonCohort ? `${data.whartonCohort.label} · Wk ${data.whartonCohort.week}` : ''}
          {data?.columbiaCohort ? `  ·  ${data.columbiaCohort.label} · Wk ${data.columbiaCohort.week}` : ''}
          {'  ·  '}Replaces the weekly email tables: consults, info sessions, TA, advisor KPIs
        </p>
      </div>

      {loading && (
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-6 mb-6 text-sm text-gray-400 animate-pulse">
          Loading enrollment team data…
        </div>
      )}

      {/* Access banner */}
      {data?.needsAccess && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 text-sm text-yellow-200">
          <p className="font-semibold mb-1">Live wiring pending — sheet access needed</p>
          <p className="text-yellow-200/80 text-xs leading-relaxed">
            Share the enrollment team dashboard (Google Sheet) with{' '}
            <code className="bg-black/30 px-1.5 py-0.5 rounded">{data.serviceAccount}</code>{' '}
            (Viewer). The advisor outreach section below activates automatically once shared; the remaining sections wire tab-by-tab after that.
          </p>
        </div>
      )}
      {data?.error && !data.needsAccess && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-sm text-red-300">{data.error}</div>
      )}

      <div className="space-y-6">
        {/* ── LIVE: advisor outreach ── */}
        {block && (
          <>
            <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-white">Advisor Outreach — {block.cohortLabel} cycle to date</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">Emails sent by contact stage, per advisor · live from Aubrey&apos;s sheet (&quot;{data?.live?.tabTitle}&quot;)</p>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                  Live
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Advisor</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Contacts</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Leads</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Active / Qualified</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Customers</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Total sent</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.totals.filter(t => t.totalSent !== null).map((t, i) => (
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
            </div>

            <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="text-sm font-semibold text-white">Weekly Outreach Volume — {block.cohortLabel}</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">Total emails sent per advisor per cycle week (goal: 200–225/wk)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Week</th>
                      {advisors.map(a => (
                        <th key={a} className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider capitalize">{a.toLowerCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...block.weeks].filter(w => Object.values(w.perAdvisor).some(v => v.sent > 0)).sort((a, b) => b.week - a.week).map((w, i) => (
                      <tr key={w.week} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                        <td className="px-5 py-3 text-white whitespace-nowrap">Wk {w.week} <span className="text-gray-500 text-xs">· {w.dateRange}</span></td>
                        {advisors.map(a => {
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
            </div>
          </>
        )}

        {/* ── PRO FORMA: consult volume & CVR ── */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">Consult Volume &amp; Consult → Enroll CVR — Columbia, per advisor</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Baseline = same cohort weeks, prior cohort (Aubrey&apos;s comparison-dates method) · figures from the 6/29 email</p>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30">
              Pro forma — wires next
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Advisor</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Consults (baseline)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Consults (actual)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CVR (baseline)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CVR (actual)</th>
                </tr>
              </thead>
              <tbody>
                {CONSULTS_DEMO.map((r, i) => (
                  <tr key={r.advisor} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                    <td className="px-5 py-3 text-white font-medium">{r.advisor}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{r.colBaseline}</td>
                    <td className={`px-4 py-3 text-right font-medium ${r.colActual >= r.colBaseline ? 'text-emerald-400' : 'text-red-400'}`}>{r.colActual}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{r.colCvrB.toFixed(1)}%</td>
                    <td className={`px-4 py-3 text-right font-medium ${r.colCvrA >= r.colCvrB ? 'text-emerald-400' : 'text-red-400'}`}>{r.colCvrA.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── PRO FORMA: info sessions + TA ── */}
        <div className="flex gap-4 flex-wrap">
          <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden flex-1 min-w-[300px]">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Info Sessions — Columbia, cycle to date</h2>
              <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30">Pro forma</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {INFO_SESSIONS_DEMO.map((r, i) => (
                  <tr key={r.label} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                    <td className="px-5 py-3 text-gray-300">{r.label}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">{r.current.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 py-3 text-[11px] text-gray-500">Wharton Fall &apos;26 info sessions begin mid-July; reporting starts then.</p>
          </div>

          <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden flex-1 min-w-[300px]">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Tuition Assistance</h2>
              <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30">Pro forma</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="px-5 py-3 text-gray-300">Wharton TA applications (FA26)</td>
                  <td className="px-4 py-3 text-right text-white font-medium">14</td>
                </tr>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <td className="px-5 py-3 text-gray-300">Columbia TA applications (cycle)</td>
                  <td className="px-4 py-3 text-right text-white font-medium">209</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-5 py-3 text-gray-300">TA % of total enrollments</td>
                  <td className="px-4 py-3 text-right text-white font-medium">21.3%</td>
                </tr>
              </tbody>
            </table>
            <p className="px-5 py-3 text-[11px] text-gray-500">From the weekly email; wires to the TA tab of Aubrey&apos;s sheet.</p>
          </div>
        </div>

        <p className="text-[11px] text-gray-600 max-w-3xl">
          Sections marked &quot;pro forma&quot; show the structure with figures from Aubrey&apos;s June 22–28 email; they wire to the corresponding tabs of her dashboard sheet once access is granted and the tab schemas are mapped. The goal: this page replaces the manual weekly email build.
        </p>
      </div>
    </div>
  );
}
