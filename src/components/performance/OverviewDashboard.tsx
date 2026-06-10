'use client';

import { PROGRAM_LABELS, PROGRAM_SCHOOL, type CurrentSnapshot } from '@/data/performance/types';
import { WHARTON_HISTORY, COLUMBIA_HISTORY } from '@/data/performance/historical';
import { SELF_STUDY_2026 } from '@/data/performance/selfStudy';
import { SITEWIDE_YOY } from '@/data/performance/traffic';
import {
  usePersistentSchoolFilter, PageHeader, SectionCard, KpiCard, DataAsOf,
  fmt, fmtPct, fmtDollar,
} from './shared';

function ProgressToTarget({
  label, realTime, forecast, target,
}: {
  label: string; realTime: number; forecast: number; target: number;
}) {
  const max = Math.max(realTime, forecast, target, 1);
  const pctOfTarget = target > 0 ? (realTime / target) * 100 : 0;
  // Green when real-time is beating the forecast, red when trailing it
  const beatingForecast = realTime >= forecast;
  return (
    <div className="py-3 border-b border-white/5 last:border-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-400">
          <span className="text-white font-semibold">{fmt(realTime)}</span>
          {' '}of {fmt(target)} target · forecast{' '}
          <span className={beatingForecast ? 'text-emerald-400' : 'text-red-400'}>{fmt(forecast)}</span>
        </p>
      </div>
      <div className="relative w-full bg-white/5 rounded-full h-2.5">
        {/* forecast marker */}
        <div
          className="absolute top-[-3px] h-[16px] w-0.5 bg-blue-400/80 rounded"
          style={{ left: `${Math.min((forecast / max) * 100, 100)}%` }}
          title={`Forecast: ${fmt(forecast)}`}
        />
        {/* target marker */}
        <div
          className="absolute top-[-3px] h-[16px] w-0.5 bg-gray-400 rounded"
          style={{ left: `${Math.min((target / max) * 100, 100)}%` }}
          title={`Target: ${fmt(target)}`}
        />
        <div
          className={`h-2.5 rounded-full ${pctOfTarget >= 90 ? 'bg-emerald-500' : pctOfTarget >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${Math.min((realTime / max) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function OverviewDashboard({ snapshot }: { snapshot: CurrentSnapshot }) {
  const [school, setSchool] = usePersistentSchoolFilter();

  const programs = snapshot.programs.filter(p =>
    school === 'all' ? true : PROGRAM_SCHOOL[p.program] === school
  );

  const totals = programs.reduce(
    (acc, p) => ({
      realTime: acc.realTime + p.enrolls.realTime,
      forecast: acc.forecast + p.enrolls.forecast,
      target: acc.target + p.enrolls.finalTarget,
      leads: acc.leads + p.leads.realTime,
      leadForecast: acc.leadForecast + p.leads.forecast,
    }),
    { realTime: 0, forecast: 0, target: 0, leads: 0, leadForecast: 0 }
  );

  const pctToTarget = totals.target > 0 ? (totals.realTime / totals.target) * 100 : 0;
  const forecastGap = totals.forecast - totals.target;
  const leadGapPct = totals.leadForecast > 0 ? ((totals.leads - totals.leadForecast) / totals.leadForecast) * 100 : 0;

  // Historical context for the latest closed cohorts
  const histLatest = school === 'columbia' ? COLUMBIA_HISTORY.slice(-1)[0] : WHARTON_HISTORY.slice(-1)[0];

  // Self-study QTD-ish summary (last 13 weeks of 2026 data)
  const ssRecent = SELF_STUDY_2026.actual.slice(-13).reduce((a, b) => a + b, 0);
  const ssRecentPrior = SELF_STUDY_2026.priorYear.slice(-13).reduce((a, b) => a + b, 0);
  const ssDelta = ssRecentPrior > 0 ? ((ssRecent - ssRecentPrior) / ssRecentPrior) * 100 : 0;

  // Traffic summary (like-for-like weeks)
  let site25 = 0, site26 = 0;
  SITEWIDE_YOY.y2026.forEach((v, i) => {
    if (v != null && SITEWIDE_YOY.y2025[i] != null) { site26 += v; site25 += SITEWIDE_YOY.y2025[i]!; }
  });
  const siteDelta = site25 > 0 ? ((site26 - site25) / site25) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Executive Overview"
        subtitle="Current cohort performance vs. forecast vs. target"
        school={school}
        onSchoolChange={setSchool}
        right={<DataAsOf asOf={snapshot.asOf} live={snapshot.live} />}
      />

      {/* KPI row */}
      <div className="flex gap-4 flex-wrap mb-6">
        <KpiCard label="Enrollments" value={fmt(totals.realTime)} sub={`${fmtPct(pctToTarget, 0)} of ${fmt(totals.target)} target`} positive={pctToTarget >= 75} />
        <KpiCard label="Forecast" value={fmt(totals.forecast)} sub={`${forecastGap >= 0 ? '+' : ''}${fmt(forecastGap)} vs target`} positive={forecastGap >= 0} />
        <KpiCard label="Leads" value={fmt(totals.leads)} sub={`${leadGapPct >= 0 ? '+' : ''}${leadGapPct.toFixed(0)}% vs forecast`} positive={leadGapPct >= 0} />
        <KpiCard
          label={`${school === 'columbia' ? 'Columbia' : 'Wharton'} CPE (last closed)`}
          value={`$${histLatest.cpe}`}
          sub={`${histLatest.cohort} · CPL $${histLatest.cpl}`}
        />
        <KpiCard label="Blended ROAS (last closed)" value={`${histLatest.blendedRoas.toFixed(1)}x`} sub={`PPC ${histLatest.ppcRoas.toFixed(1)}x`} positive={histLatest.ppcRoas >= 2.5} />
      </div>

      {/* Per-program progress */}
      <div className="mb-6">
        <SectionCard
          title="Enrollment Progress by Program"
          subtitle={`Bar = real time · blue marker = forecast · gray marker = final target. ${snapshot.forecastNote}`}
        >
          {programs.map(p => (
            <ProgressToTarget
              key={p.program}
              label={PROGRAM_LABELS[p.program]}
              realTime={p.enrolls.realTime}
              forecast={p.enrolls.forecast}
              target={p.enrolls.finalTarget}
            />
          ))}
        </SectionCard>
      </div>

      {/* Secondary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard title="Self-Study / Retail" subtitle="Trailing 13 weeks vs. same weeks prior year">
          <div className="flex items-baseline gap-4">
            <p className="text-3xl font-bold text-white">{fmtDollar(ssRecent)}</p>
            <p className={`text-sm font-medium ${ssDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {ssDelta >= 0 ? '+' : ''}{ssDelta.toFixed(1)}% YoY
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">Full detail in Self-Study / Retail view</p>
        </SectionCard>

        <SectionCard title="Sitewide Traffic" subtitle="2026 YTD sessions vs. same weeks 2025">
          <div className="flex items-baseline gap-4">
            <p className="text-3xl font-bold text-white">{fmt(site26)}</p>
            <p className={`text-sm font-medium ${siteDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {siteDelta >= 0 ? '+' : ''}{siteDelta.toFixed(1)}% YoY
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">Full detail in Traffic Analytics view</p>
        </SectionCard>
      </div>
    </div>
  );
}
