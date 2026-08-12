'use client';

import { useEffect, useState } from 'react';
import AsOfPicker from '@/components/AsOfPicker';
import Link from 'next/link';
import { PULSE as DEMO } from '@/data/proforma';

// Shapes returned by /api/pulse (see src/lib/pulseLive.ts)
interface TodayCardLive {
  cohortLabel: string;
  todayGoal: number;
  yesterdayGoal: number;
  yesterdayActual: number | null;
  cohortToDate: number | null;
  updatedThrough: string | null;
}
interface LeadsWeekLive { week: number; dateRange: string; leads: number; leadsForecast: number | null; }
interface LeadsLive {
  cohortLabel: string;
  weeks: LeadsWeekLive[];
  cohortLeads: number | null;
  cohortLeadsForecast: number | null;
  updatedThrough: string | null;
}
interface PulseFamilyLive {
  family: 'wharton' | 'columbia';
  cohort: {
    key: string; label: string; week: number; phase: string; endgame: string;
    enrolls: number; goal: number; goalSource?: string; goalPlanTotal?: number;
    forecastToDate: number; daysRemaining: number; wired: boolean;
  };
  today: TodayCardLive | null;
  leads: LeadsLive | null;
}
interface PulseLive {
  asOf: string;
  asOfDate: string;
  isToday: boolean;
  families: PulseFamilyLive[];
  freshness: Array<{ source: string; updatedThrough: string; cadence: string; lagging: boolean }>;
}

function fmt(n: number) { return n.toLocaleString(); }

function StatusPill({ kind, label }: { kind: 'good' | 'bad' | 'warn' | 'muted'; label: string }) {
  const styles = {
    good: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    bad: 'bg-red-500/15 text-red-400 border-red-500/30',
    warn: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    muted: 'bg-white/5 text-gray-500 border-white/10',
  }[kind];
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border whitespace-nowrap ${styles}`}>
      {label}
    </span>
  );
}

// Last COMPLETED week with data (a partial current week vs a full-week forecast
// reads as "behind" when the week just isn't over).
function weekEnded(range: string): boolean {
  const m = range.match(/-\s*(\d{1,2})\/(\d{1,2})/);
  if (!m) return true;
  const now = new Date();
  const end = new Date(now.getFullYear(), parseInt(m[1]) - 1, parseInt(m[2]));
  if (end.getTime() - now.getTime() > 182 * 86400000) end.setFullYear(end.getFullYear() - 1);
  return end.getTime() < new Date().setHours(0, 0, 0, 0);
}

function FamilyRow({ f }: { f: PulseFamilyLive }) {
  const dotColor = f.family === 'wharton' ? 'bg-blue-400' : 'bg-teal-400';
  const barColor = f.family === 'wharton' ? 'bg-blue-400' : 'bg-teal-400';
  const c = f.cohort;
  const delta = c.enrolls - c.forecastToDate;
  const ahead = delta >= 0;
  const pct = c.goal > 0 ? (c.enrolls / c.goal) * 100 : 0;

  const weeksWithData = f.leads ? f.leads.weeks.filter(w => w.leads > 0) : [];
  const completed = weeksWithData.filter(w => weekEnded(w.dateRange));
  const leadsWeek = completed[completed.length - 1] ?? weeksWithData[weeksWithData.length - 1] ?? null;
  const leadsPartial = leadsWeek !== null && !weekEnded(leadsWeek.dateRange);
  const leadsDelta = leadsWeek && leadsWeek.leadsForecast
    ? ((leadsWeek.leads - leadsWeek.leadsForecast) / leadsWeek.leadsForecast) * 100
    : null;

  // Cohort-to-date lead pacing: sum actual vs forecast over ended weeks through
  // the last completed week with data (full-cohort forecast would always read
  // "behind" mid-cycle). This drives the card's on-pace / behind flag.
  let ctdActual = 0, ctdForecast = 0;
  if (f.leads && leadsWeek) {
    for (const w of f.leads.weeks) {
      if (w.week > leadsWeek.week || !weekEnded(w.dateRange)) continue;
      if (w.leadsForecast === null) continue; // keep the comparison apples-to-apples
      ctdActual += w.leads;
      ctdForecast += w.leadsForecast;
    }
  }
  const ctdDelta = ctdForecast > 0 ? ((ctdActual - ctdForecast) / ctdForecast) * 100 : null;
  const pillDelta = ctdDelta ?? leadsDelta;
  // ±3% is treated as on pace — weekly keying noise shouldn't flip the flag.
  const pillGood = pillDelta !== null && pillDelta >= -3;

  const yesterdayHit = f.today && f.today.yesterdayActual !== null
    ? f.today.yesterdayActual >= f.today.yesterdayGoal
    : null;

  // The cumulative daily-goal curve is hand-rebuilt when a target moves, so it
  // lands a few enrollments off the goal by rounding (Fall '26: 1,103 vs 1,100).
  // Only flag a drift big enough to mean the curve is still on the OLD target —
  // an exact-equality check cried wolf on every rounding remainder.
  const curveDrifted =
    c.goalPlanTotal !== undefined &&
    c.goal > 0 &&
    Math.abs(c.goalPlanTotal - c.goal) / c.goal > 0.02;

  return (
    <div>
      {/* Family context line — calendar-driven */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <p className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          {c.label}
        </p>
        <span className="text-[11px] text-gray-500">
          Wk {c.week} of cycle · {c.phase} · {c.endgame}
        </span>
      </div>

      <div className="flex gap-4 flex-wrap">
        {/* Enrollment card */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5 flex-1 min-w-[220px]">
          <div className="flex items-center justify-between mb-3 gap-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Enrollments</p>
            {c.wired
              ? <StatusPill kind={ahead ? 'good' : 'bad'} label={ahead ? 'on pace' : 'behind'} />
              : <StatusPill kind="muted" label="not wired" />}
          </div>
          {c.wired ? (
            <>
              <p className="text-3xl font-bold text-white">
                {fmt(c.enrolls)} <span className="text-sm font-normal text-gray-500">/ {fmt(c.goal)}</span>
              </p>
              <p className={`text-xs font-medium mt-1 ${ahead ? 'text-emerald-400' : 'text-red-400'}`}>
                {ahead ? '+' : ''}{fmt(delta)} vs forecast <span className="text-gray-500 font-normal">· {c.daysRemaining} days left</span>
              </p>
              <div className="mt-3 w-full bg-white/5 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">
                Goal source: {c.goalSource ?? '—'}.
                {curveDrifted && (
                  <> Daily-goal curve still sums to {fmt(c.goalPlanTotal!)} — per-day goals are on the prior target.</>
                )}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-600 italic">Cohort doc not created / not shared with the service account yet.</p>
          )}
        </div>

        {/* Today card */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5 flex-1 min-w-[220px]">
          <div className="flex items-center justify-between mb-3 gap-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Today</p>
            {f.today
              ? (yesterdayHit !== null
                ? <StatusPill kind={yesterdayHit ? 'good' : 'warn'} label={yesterdayHit ? 'hit yesterday' : 'missed yesterday'} />
                : <StatusPill kind="warn" label="data lag" />)
              : <StatusPill kind="muted" label="n/a" />}
          </div>
          {f.today ? (
            <>
              <p className="text-3xl font-bold text-white">
                {fmt(f.today.todayGoal)} <span className="text-sm font-normal text-gray-500">goal today</span>
              </p>
              <p className="text-xs font-medium mt-1 text-gray-400">
                Yesterday:{' '}
                {f.today.yesterdayActual !== null ? (
                  <span className={yesterdayHit ? 'text-emerald-400' : 'text-red-400'}>
                    {f.today.yesterdayActual} of {f.today.yesterdayGoal} {yesterdayHit ? '✓' : ''}
                  </span>
                ) : (
                  <span className="text-yellow-400">not keyed yet (goal was {f.today.yesterdayGoal})</span>
                )}
                {f.today.cohortToDate !== null && <> · {fmt(f.today.cohortToDate)} to date</>}
              </p>
              <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">
                Keyed through {f.today.updatedThrough ?? '—'}. Intraday arrives with the HubSpot API (deferred).
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-600 italic">Deadline pacing table unavailable.</p>
          )}
        </div>

        {/* Leads card */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5 flex-1 min-w-[220px]">
          <div className="flex items-center justify-between mb-3 gap-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Leads</p>
            {pillDelta !== null
              ? <StatusPill
                  kind={pillGood ? 'good' : 'bad'}
                  label={`${pillGood ? 'on pace' : 'behind'} ${pillDelta >= 0 ? '+' : ''}${pillDelta.toFixed(1)}%`}
                />
              : <StatusPill kind="muted" label="n/a" />}
          </div>
          {f.leads && leadsWeek ? (
            <>
              <p className="text-3xl font-bold text-white">
                {fmt(leadsWeek.leads)} <span className="text-sm font-normal text-gray-500">wk {leadsWeek.week}</span>
              </p>
              <p className={`text-xs font-medium mt-1 ${leadsDelta !== null && leadsDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {leadsDelta !== null
                  ? <>{leadsDelta >= 0 ? '+' : ''}{leadsDelta.toFixed(0)}% vs forecast ({fmt(leadsWeek.leadsForecast!)})</>
                  : 'No weekly forecast'}
                <span className="text-gray-500 font-normal"> {leadsPartial ? '· partial week' : '· last completed wk'}</span>
              </p>
              {ctdDelta !== null && (
                <p className={`text-xs font-medium mt-1 ${ctdDelta >= -3 ? 'text-emerald-400' : 'text-red-400'}`}>
                  Cohort: {ctdDelta >= 0 ? '+' : ''}{ctdDelta.toFixed(1)}% vs forecast
                  <span className="text-gray-500 font-normal"> · {fmt(ctdActual)} thru wk {leadsWeek.week} vs {fmt(ctdForecast)} expected</span>
                </p>
              )}
              <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">
                Wk {leadsWeek.week} · {leadsWeek.dateRange}. Bot-excluded basis. Flag reflects cohort-to-date pacing.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-600 italic">
              {f.leads
                ? 'No week had closed yet on this date — leads report weekly, so the first full week has to finish before it shows here.'
                : 'Overall WoW tab unavailable.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// The API echoes back the day it rendered; when that IS today, it's also the max
// selectable date. When rewound, today is whatever the browser says it is — the
// server clamps anything later anyway, so a stale clock can't fabricate data.
function todayFrom(data: PulseLive): string {
  if (data.isToday) return data.asOfDate;
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export default function PulseDashboard() {
  const [data, setData] = useState<PulseLive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deadlineMode, setDeadlineMode] = useState(false);
  // Read straight from the URL so a shared "?asOf=" link loads rewound. Only the
  // fetch depends on it — no markup does — so the SSR/client difference is inert.
  const [asOf, setAsOf] = useState<string>(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('asOf') ?? ''
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pulse${asOf ? `?asOf=${asOf}` : ''}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.error) setError(json.error);
        else { setData(json); setError(null); }
        setLoading(false);
      })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [asOf]);

  // Keep the URL in step so a rewound view can be shared or reloaded.
  const changeAsOf = (ymd: string) => {
    const isToday = !!data && ymd === todayFrom(data);
    setLoading(true);
    setAsOf(isToday ? '' : ymd);
    const url = isToday ? window.location.pathname : `${window.location.pathname}?asOf=${ymd}`;
    window.history.replaceState(null, '', url);
  };

  const combinedEnrolls = data ? data.families.reduce((s, f) => s + (f.cohort.wired ? f.cohort.enrolls : 0), 0) : 0;
  const combinedForecast = data ? data.families.reduce((s, f) => s + (f.cohort.wired ? f.cohort.forecastToDate : 0), 0) : 0;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-xl font-bold text-white">WSP Marketing Pulse</h1>
            <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              Live data
            </span>
          </div>
          <p className="text-sm text-gray-400">
            Active cohorts (calendar-resolved) · All B2C · {data ? `As of ${data.asOf}` : 'Loading…'}
            {data && !data.isToday && (
              <span className="ml-2 text-amber-300">· rewound view, not today</span>
            )}
          </p>
        </div>

        {/* Right-hand control group. The date picker was previously a direct child
            of the justify-between header, which parked it in the middle of empty
            space where it read as decoration rather than a control. */}
        <div className="flex items-center gap-3 flex-wrap">
          {data && (
            <AsOfPicker value={data.asOfDate} max={todayFrom(data)} onChange={changeAsOf} />
          )}
          <button
            onClick={() => setDeadlineMode(d => !d)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              deadlineMode
                ? 'bg-orange-500/15 text-orange-400 border-orange-500/40'
                : 'bg-[#161b22] text-gray-400 border-white/10 hover:text-white'
            }`}
          >
            Deadline-day preview
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-sm text-red-300">
          Couldn&apos;t load live data: {error}
        </div>
      )}
      {loading && (
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-6 mb-6 text-sm text-gray-400 animate-pulse">
          Loading live pacing data…
        </div>
      )}

      {data && !loading && (
        <div className="space-y-8">
          {data.families.map(f => <FamilyRow key={f.family} f={f} />)}

          {/* Deadline-day hour tracker (structure preview) */}
          {deadlineMode && (
            <div className="bg-[#161b22] border border-orange-500/30 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-semibold text-white">Deadline-Day Hour Tracker — structure preview</h2>
                <span className="text-xs text-orange-400">Activates automatically within 48h of a deadline · demo values until then</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Time</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Current</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{DEMO.deadline.priorLabels[0]}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{DEMO.deadline.priorLabels[1]}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Goal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEMO.deadline.rows.map((r, i) => (
                      <tr key={r.time} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                        <td className="px-5 py-2.5 text-white">{r.time}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{r.current ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">{r.priorCohort}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">{r.priorCohort2}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">{r.goal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Combined B2C strip = the leadership snapshot */}
          <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-white">Combined B2C — Leadership Snapshot</h2>
              <span className="text-[11px] text-gray-500">Active cohorts combined · B2B excluded by design</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Metric</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actual</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Forecast</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5">
                    <td className="px-5 py-3 text-white">B2C Enrollments — active cohorts</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(combinedEnrolls)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(combinedForecast)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${combinedEnrolls - combinedForecast >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {combinedEnrolls - combinedForecast >= 0 ? '+' : ''}{fmt(combinedEnrolls - combinedForecast)}
                    </td>
                  </tr>
                  {data.families.map((f, i) => f.leads && f.leads.cohortLeads !== null ? (
                    <tr key={f.family} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                      <td className="px-5 py-3 text-white">Leads to date — {f.leads.cohortLabel}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{fmt(f.leads.cohortLeads)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{f.leads.cohortLeadsForecast !== null ? fmt(f.leads.cohortLeadsForecast) : '—'}</td>
                      <td className={`px-4 py-3 text-right font-medium ${
                        f.leads.cohortLeadsForecast !== null && f.leads.cohortLeads - f.leads.cohortLeadsForecast >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {f.leads.cohortLeadsForecast !== null
                          ? `${f.leads.cohortLeads - f.leads.cohortLeadsForecast >= 0 ? '+' : ''}${fmt(f.leads.cohortLeads - f.leads.cohortLeadsForecast)}`
                          : '—'}
                      </td>
                    </tr>
                  ) : null)}
                  <tr className="border-b border-white/5">
                    <td className="px-5 py-3 text-white">Bootcamps</td>
                    <td colSpan={3} className="px-4 py-3 text-right text-gray-600 italic text-xs">Feed TBD — placeholder per 6/26 call</td>
                  </tr>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <td className="px-5 py-3 text-white">Self-Study / Retail</td>
                    <td colSpan={3} className="px-4 py-3 text-right text-gray-600 italic text-xs">Feed TBD — placeholder per 6/26 call</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Drill-down links */}
          <div className="flex gap-4 flex-wrap">
            <Link href="/cohort-performance/wharton" className="flex-1 min-w-[240px] bg-[#161b22] border border-white/10 rounded-xl p-4 hover:border-white/25 transition-colors">
              <p className="text-sm font-semibold text-white">Wharton Cohort Command →</p>
              <p className="text-xs text-gray-500 mt-1">Pacing · Full Funnel · Leads · Lower Funnel · Channels · Paid Media</p>
            </Link>
            <Link href="/cohort-performance/columbia" className="flex-1 min-w-[240px] bg-[#161b22] border border-white/10 rounded-xl p-4 hover:border-white/25 transition-colors">
              <p className="text-sm font-semibold text-white">Columbia Cohort Command →</p>
              <p className="text-xs text-gray-500 mt-1">Pacing · Full Funnel · Leads · Lower Funnel · Channels · Paid Media</p>
            </Link>
            <Link href="/enrollment-team" className="flex-1 min-w-[240px] bg-[#161b22] border border-white/10 rounded-xl p-4 hover:border-white/25 transition-colors">
              <p className="text-sm font-semibold text-white">Enrollment Team →</p>
              <p className="text-xs text-gray-500 mt-1">Aubrey&apos;s weekly: consults · info sessions · TA · advisor KPIs</p>
            </Link>
            <Link href="/enrollment" className="flex-1 min-w-[240px] bg-[#161b22] border border-white/10 rounded-xl p-4 hover:border-white/25 transition-colors">
              <p className="text-sm font-semibold text-white">Enrollment Pacing (live) →</p>
              <p className="text-xs text-gray-500 mt-1">Full pacing curves &amp; cohort comparison</p>
            </Link>
          </div>

          {/* Source freshness */}
          <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white">Source Freshness</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Manual-first by design — staleness is visible, never silent. Automation swaps in behind the same intake schemas.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {data.freshness.map((s, i) => (
                    <tr key={s.source} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                      <td className="px-5 py-3 text-gray-300">{s.source}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">{s.cadence}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                          s.lagging
                            ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        }`}>
                          {s.updatedThrough}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
