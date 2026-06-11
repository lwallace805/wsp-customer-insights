'use client';

import { PROGRAM_LABELS, PROGRAM_SCHOOL, type CurrentSnapshot } from '@/data/performance/types';
import { WHARTON_HISTORY, COLUMBIA_HISTORY } from '@/data/performance/historical';
import { WHARTON_PAID_OVERALL, CBS_SPRING_GOOGLE } from '@/data/performance/paidChannels';
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
  // Green when real-time is beating the forecast, red when trailing it
  const beatingForecast = realTime >= forecast;
  // Bar color benchmarks against the forecast (the right mid-cohort yardstick):
  // ahead of forecast → green · within ~70% → yellow · meaningfully behind → red
  const ratio = forecast > 0 ? realTime / forecast : target > 0 ? realTime / target : 1;
  const barColor = ratio >= 1 ? 'bg-emerald-500' : ratio >= 0.7 ? 'bg-yellow-500' : 'bg-red-500';
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
          className={`h-2.5 rounded-full ${barColor}`}
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

  // Current-cohort paid spend to date (Wharton: all paid; Columbia: Google-only so far)
  const whartonPaidTotal = WHARTON_PAID_OVERALL.find(r => r.program === 'Total');
  const paidSpendToDate =
    school === 'wharton' ? (whartonPaidTotal?.spend ?? 0)
    : school === 'columbia' ? CBS_SPRING_GOOGLE.spend
    : (whartonPaidTotal?.spend ?? 0) + CBS_SPRING_GOOGLE.spend;
  const cplToDate = totals.leads > 0 ? Math.round(paidSpendToDate / totals.leads) : null;

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
          label="Paid Spend (to date)"
          value={fmtDollar(paidSpendToDate)}
          sub={`CPL to date $${cplToDate} · ${histLatest.cohort} final: $${histLatest.cpl}`}
          positive={cplToDate !== null && cplToDate <= histLatest.cpl}
        />
        {school === 'columbia' ? (
          <KpiCard
            label="PPC ROAS (last closed)"
            value={`${histLatest.ppcRoas.toFixed(1)}x`}
            sub={`${histLatest.cohort} · blended ${histLatest.blendedRoas.toFixed(1)}x · Spring to-date finalizes at close`}
          />
        ) : (
          <KpiCard
            label="Wharton PPC ROAS (to date)"
            value={`${whartonPaidTotal?.roas?.toFixed(2) ?? '—'}x`}
            sub={`${histLatest.cohort} final: ${histLatest.ppcRoas.toFixed(1)}x PPC · ${histLatest.blendedRoas.toFixed(1)}x blended`}
            positive={(whartonPaidTotal?.roas ?? 0) >= 1.5}
          />
        )}
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
