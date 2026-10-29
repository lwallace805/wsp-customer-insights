'use client';

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, BarChart, Bar,
} from 'recharts';
import { WHARTON_HISTORY, COLUMBIA_HISTORY, COMBINED_EFFICIENCY } from '@/data/performance/historical';
import {
  NET_REV, STATIC_PAID_DATA, summarizePaid, shortCohort, type PaidData, type PaidSummary,
} from '@/data/performance/paidOptimization';
import { PROGRAM_SCHOOL, type CohortHistory, type CurrentSnapshot, type School } from '@/data/performance/types';

// Columbia cohorts run ~5 weeks behind Wharton; the rollup aligns Columbia
// "Summer 2025" with the Wharton Spring 2025 cycle (C2'25).
const COLUMBIA_ALIGN: Record<string, string> = { 'Spring 2025': 'Summer 2025' };
import {
  usePersistentSchoolFilter, PageHeader, SectionCard, KpiCard, ChartTooltip, DataAsOf,
  CHART_COLORS, SCHOOL_COLORS, AXIS_PROPS, fmt, fmtPct, fmtDollar,
} from './shared';

function buildRows(school: 'all' | 'wharton' | 'columbia') {
  // Wharton is the trend backbone (9 cohorts); Columbia overlays where cohorts align by label.
  if (school === 'columbia') {
    return COLUMBIA_HISTORY.map(c => ({ label: c.cohort, wharton: null as CohortHistory | null, columbia: c }));
  }
  return WHARTON_HISTORY.map(w => ({
    label: w.cohort,
    wharton: w,
    columbia: school === 'all'
      ? COLUMBIA_HISTORY.find(c => c.cohort === w.cohort || c.cohort === COLUMBIA_ALIGN[w.cohort]) ?? null
      : null,
  }));
}

// In-progress cohort built from the current snapshot — only when its cohort
// isn't already a closed entry in that school's history.
function buildInProgress(snapshot: CurrentSnapshot, school: School) {
  // Optional-chained: a stale cached snapshot may predate this field.
  const label = snapshot.cohortLabels?.[school];
  if (!label) return null;
  const history = school === 'wharton' ? WHARTON_HISTORY : COLUMBIA_HISTORY;
  if (history.some(c => c.cohort === label)) return null;
  const programs = snapshot.programs.filter(p => PROGRAM_SCHOOL[p.program] === school);
  if (!programs.length) return null;
  const enrolls = programs.reduce((a, p) => a + p.enrolls.realTime, 0);
  const forecast = programs.reduce((a, p) => a + p.enrolls.forecast, 0);
  const leads = programs.reduce((a, p) => a + p.leads.realTime, 0);
  return {
    cohort: label,
    shortLabel: shortCohort(label) + '*',
    enrolls,
    forecast,
    leads,
    cvr: leads > 0 ? +((enrolls / leads) * 100).toFixed(1) : null,
  };
}
type InProgress = NonNullable<ReturnType<typeof buildInProgress>>;

// To-date paid figures for an in-progress row come from the paid layer (the
// cohort docs' "Paid WoW Performance & Goals" tabs, or the curated snapshot
// when a doc can't be read) — and only when they describe the SAME cohort the
// enrollment snapshot's row does; a snapshot of that cohort is shown tagged:
//  · spend    = paid spend to date (Google + Bing + Meta + LinkedIn)
//  · CPL      = paid spend to date ÷ all leads to date
//  · PPC ROAS = paid-attributed enrolls × net revenue/enroll ÷ paid spend
//               (NET_REV — the Paid Optimization page's basis; 1.0× = breakeven)
// A school whose paid layer is on the snapshot, or whose doc records no paid
// actuals yet, gets no to-date paid figures — never another cohort's.
// CPE and blended ROAS are intentionally left out — they finalize at close.
interface PaidToDate { live: boolean; spend: number; paidEnrolls: number; cpl: number | null; ppcRoas: number | null }

function paidToDate(cur: InProgress | null, p: PaidSummary): PaidToDate | null {
  if (!cur || p.cohort !== cur.cohort) return null;
  return {
    live: p.live,
    spend: p.spend,
    paidEnrolls: p.paidEnrolls,
    cpl: cur.leads > 0 ? Math.round(p.spend / cur.leads) : null,
    ppcRoas: p.roas,
  };
}

/** Why an in-progress row has no to-date paid figures (null when it has them). */
function paidGap(cur: InProgress | null, p: PaidSummary): string | null {
  if (!cur || paidToDate(cur, p)) return null;
  if (p.state === 'unpopulated') return `the ${p.docCohort ?? cur.cohort} cohort doc's paid tab shows no actuals yet`;
  return `paid layer is on ${p.cohort}${p.live ? '' : ' (snapshot)'}, not ${cur.cohort}`;
}

export default function TrendsDashboard({ snapshot, paid }: { snapshot: CurrentSnapshot; paid: PaidData }) {
  const [school, setSchool] = usePersistentSchoolFilter();
  const rows = buildRows(school);

  const wCurrent = school !== 'columbia' ? buildInProgress(snapshot, 'wharton') : null;
  const cCurrent = school !== 'wharton' ? buildInProgress(snapshot, 'columbia') : null;

  const wPaid = summarizePaid(paid, 'wharton');
  const cPaid = summarizePaid(paid, 'columbia');
  const wToDate = paidToDate(wCurrent, wPaid);
  const cToDate = paidToDate(cCurrent, cPaid);
  const wGap = paidGap(wCurrent, wPaid);
  const cGap = paidGap(cCurrent, cPaid);
  const gaps = [
    wCurrent && wGap ? `Wharton ${wCurrent.cohort}: ${wGap}` : null,
    cCurrent && cGap ? `Columbia ${cCurrent.cohort}: ${cGap}` : null,
  ].filter((g): g is string => !!g);
  const liveFor = [
    wCurrent && wToDate?.live ? `Wharton ${wCurrent.cohort}` : null,
    cCurrent && cToDate?.live ? `Columbia ${cCurrent.cohort}` : null,
  ].filter((g): g is string => !!g);
  const snapshotFor = [
    wCurrent && wToDate && !wToDate.live ? `Wharton ${wCurrent.cohort}` : null,
    cCurrent && cToDate && !cToDate.live ? `Columbia ${cCurrent.cohort}` : null,
  ].filter((g): g is string => !!g);

  // One label for the in-progress point(s): "W'27*", or "W'27* / F'26*" when
  // the two schools are on different cohorts under All Schools.
  const currentLabel = [wCurrent?.shortLabel, cCurrent?.shortLabel]
    .filter((l): l is string => !!l)
    .filter((l, i, a) => a.indexOf(l) === i)
    .join(' / ');

  const chartData = rows.map(r => ({
    cohort: r.wharton?.shortLabel ?? r.columbia?.shortLabel ?? r.label,
    wEnrolls: r.wharton?.totalEnrollsExB2B ?? null,
    cEnrolls: r.columbia?.totalEnrollsExB2B ?? null,
    wPaid: r.wharton?.paidEnrolls ?? null,
    wOrganic: r.wharton?.organicEnrolls ?? null,
    wCvr: r.wharton?.leadCvr ?? null,
    cCvr: r.columbia?.leadCvr ?? null,
    wCpl: r.wharton?.cpl ?? null,
    cCpl: r.columbia?.cpl ?? null,
    wCpe: r.wharton?.cpe ?? null,
    cCpe: r.columbia?.cpe ?? null,
    wPpcRoas: r.wharton?.ppcRoas ?? null,
    cPpcRoas: r.columbia?.ppcRoas ?? null,
    wBlended: r.wharton?.blendedRoas ?? null,
    cBlended: r.columbia?.blendedRoas ?? null,
    wLeads: r.wharton?.leadsExBots ?? r.wharton?.totalLeads ?? null,
    cLeads: r.columbia?.leadsExBots ?? r.columbia?.totalLeads ?? null,
  }));

  // Append the in-progress cohort as a final point. Volume metrics come from
  // the live enrollment snapshot; to-date paid metrics from the live paid layer
  // (see paidToDate). Wharton's paid/organic split uses the paid layer's
  // platform-attributed enrollments with organic as the remainder, and is shown
  // only when the paid layer is live for the row's cohort.
  // CPE and blended ROAS stay blank — they're only meaningful at cohort close.
  if (wCurrent || cCurrent) {
    chartData.push({
      cohort: currentLabel,
      wEnrolls: wCurrent?.enrolls ?? null,
      cEnrolls: cCurrent?.enrolls ?? null,
      wPaid: wToDate?.paidEnrolls ?? null,
      wOrganic: wCurrent && wToDate ? Math.max(0, wCurrent.enrolls - wToDate.paidEnrolls) : null,
      wCvr: wCurrent?.cvr ?? null,
      cCvr: cCurrent?.cvr ?? null,
      wCpl: wToDate?.cpl ?? null,
      cCpl: cToDate?.cpl ?? null,
      wCpe: null, cCpe: null,
      wPpcRoas: wToDate?.ppcRoas ?? null,
      cPpcRoas: cToDate?.ppcRoas ?? null,
      wBlended: null, cBlended: null,
      wLeads: wCurrent?.leads ?? null,
      cLeads: cCurrent?.leads ?? null,
    });
  }

  const visible: CohortHistory[] = [
    ...(school !== 'columbia' ? WHARTON_HISTORY : []),
    ...(school !== 'wharton' ? COLUMBIA_HISTORY : []),
  ];
  const latest = visible.filter(c => school === 'all' ? c.school === 'wharton' : true).slice(-1)[0];
  const prior = visible.filter(c => c.school === latest?.school).slice(-2)[0];

  const showW = school !== 'columbia';
  const showC = school !== 'wharton';

  const callouts = visible.filter(c => c.callout);

  return (
    <div>
      <PageHeader
        title="Historical Trends"
        subtitle="Cohort-over-cohort performance — Wharton Spring 2023 →, Columbia Summer 2025 →. * = current cohort in progress. All Schools aligns Columbia Su'25 with the concurrent Wharton S'25 cycle."
        school={school}
        onSchoolChange={setSchool}
        right={(
          <span className="inline-flex items-center gap-3">
            <DataAsOf asOf={snapshot.asOf} live={snapshot.live} />
            <span className="text-xs text-gray-500">paid: {paid.live ? `live · ${paid.asOf}` : <span className="text-amber-400/80">snapshot</span>}</span>
          </span>
        )}
      />

      {/* KPI row — current cohort first; finals from the last closed cohort.
          Under "All Schools" everything is Wharton + Columbia combined. */}
      {latest && (() => {
        let cur: { shortLabel: string; enrolls: number; forecast: number; leads: number; cvr: number | null } | null;
        let finals: { label: string; enrolls: number; cvr: number; cpl: number; cpe: number; ppcRoas: number; blended: number; priorLabel: string; priorCpe: number; priorBlended: number };

        if (school === 'all') {
          const enrolls = (wCurrent?.enrolls ?? 0) + (cCurrent?.enrolls ?? 0);
          const forecast = (wCurrent?.forecast ?? 0) + (cCurrent?.forecast ?? 0);
          const leads = (wCurrent?.leads ?? 0) + (cCurrent?.leads ?? 0);
          cur = { shortLabel: currentLabel || 'current*', enrolls, forecast, leads, cvr: leads > 0 ? +((enrolls / leads) * 100).toFixed(1) : null };
          const ce = COMBINED_EFFICIENCY[COMBINED_EFFICIENCY.length - 1];
          const cePrior = COMBINED_EFFICIENCY[COMBINED_EFFICIENCY.length - 2];
          finals = {
            label: `${ce.cohort} combined`, enrolls: ce.b2cEnrolls, cvr: ce.leadCvr, cpl: ce.cpl,
            cpe: ce.cpe, ppcRoas: ce.ppcRoas, blended: ce.blendedRoas,
            priorLabel: cePrior.cohort, priorCpe: cePrior.cpe, priorBlended: cePrior.blendedRoas,
          };
        } else {
          cur = school === 'columbia' ? cCurrent : wCurrent;
          finals = {
            label: `${latest.shortLabel} final`, enrolls: latest.totalEnrollsExB2B, cvr: latest.leadCvr,
            cpl: latest.cpl, cpe: latest.cpe, ppcRoas: latest.ppcRoas, blended: latest.blendedRoas,
            priorLabel: prior?.shortLabel ?? '', priorCpe: prior?.cpe ?? 0, priorBlended: prior?.blendedRoas ?? 0,
          };
        }

        // Paid to date over the in-progress school(s) whose paid layer is live
        // for their cohort. A school without live paid is left out of the sum
        // and named in the tile — never filled from another cohort's figures.
        // CPL = combined paid spend ÷ those schools' leads; PPC ROAS = their
        // paid enrolls × each school's net revenue ÷ combined paid spend.
        const parts = [
          wCurrent && wToDate ? { school: 'wharton' as const, label: wCurrent.shortLabel, leads: wCurrent.leads, ...wToDate } : null,
          cCurrent && cToDate ? { school: 'columbia' as const, label: cCurrent.shortLabel, leads: cCurrent.leads, ...cToDate } : null,
        ].filter((p): p is NonNullable<typeof p> => !!p);
        const paidSpend = parts.reduce((a, p) => a + p.spend, 0);
        const paidLeads = parts.reduce((a, p) => a + p.leads, 0);
        const curCpl = parts.length && paidLeads > 0 ? Math.round(paidSpend / paidLeads) : null;
        const curRoas = parts.length && paidSpend > 0
          ? +(parts.reduce((a, p) => a + p.paidEnrolls * NET_REV[p.school], 0) / paidSpend).toFixed(2)
          : null;
        const paidScope = parts.map(p => p.label).filter((l, i, a) => a.indexOf(l) === i).join(' / ')
          + (parts.some(p => !p.live) ? ', snapshot' : '');
        const gapText = gaps.length ? `No live paid for ${gaps.join('; ')}` : undefined;

        return (
          <div className="flex gap-4 flex-wrap mb-6">
            <KpiCard label={`Enrolls (${cur?.shortLabel ?? finals.label})`}
              value={fmt(cur?.enrolls ?? finals.enrolls)}
              sub={cur ? `forecast ${fmt(cur.forecast)} · ${finals.label}: ${fmt(finals.enrolls)}` : undefined}
              positive={cur ? cur.enrolls >= cur.forecast : undefined} />
            <KpiCard label={`Lead CVR (${cur?.shortLabel ?? finals.label})`}
              value={fmtPct(cur?.cvr ?? finals.cvr)}
              sub={`${finals.label}: ${fmtPct(finals.cvr)}`}
              positive={cur?.cvr != null ? cur.cvr >= finals.cvr : undefined} />
            <KpiCard label={curCpl != null ? `CPL (${paidScope} to date)` : `CPL (${finals.label})`}
              value={curCpl != null ? `$${curCpl}` : `$${finals.cpl}`}
              sub={curCpl != null ? `${finals.label}: $${finals.cpl}${gaps.length ? ` · ${gapText}` : ''}` : gapText}
              positive={curCpl != null ? curCpl <= finals.cpl : undefined} />
            <KpiCard label={curRoas != null ? `PPC ROAS (${paidScope} to date)` : `PPC ROAS (${finals.label})`}
              value={curRoas != null ? `${curRoas.toFixed(2)}x` : `${finals.ppcRoas.toFixed(1)}x`}
              sub={curRoas != null ? `net revenue basis · ${finals.label}: ${finals.ppcRoas.toFixed(1)}x` : gapText ?? 'to-date ROAS finalizes at close'}
              positive={curRoas != null ? curRoas >= 1 : undefined} />
            <KpiCard label={`CPE (${finals.label})`} value={`$${finals.cpe}`}
              sub={finals.priorLabel ? `${finals.priorLabel}: $${finals.priorCpe}` : undefined}
              positive={finals.priorLabel ? finals.cpe <= finals.priorCpe : undefined} />
            <KpiCard label={`Blended ROAS (${finals.label})`} value={`${finals.blended.toFixed(1)}x`}
              sub={finals.priorLabel ? `${finals.priorLabel}: ${finals.priorBlended.toFixed(1)}x` : undefined}
              positive={finals.priorLabel ? finals.blended >= finals.priorBlended : undefined} />
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Enrollments trend */}
        <SectionCard title="Enrollments by Cohort (excl. B2B)" subtitle="Net of refunds, during marketing cycle">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="cohort" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {showW && <Line type="monotone" dataKey="wEnrolls" name="Wharton" stroke={SCHOOL_COLORS.wharton} strokeWidth={2} dot={{ r: 3 }} connectNulls />}
              {showC && <Line type="monotone" dataKey="cEnrolls" name="Columbia" stroke={SCHOOL_COLORS.columbia} strokeWidth={2} dot={{ r: 3 }} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Paid vs organic (Wharton) */}
        {showW ? (
          <SectionCard
            title="Paid vs. Organic Enrollments — Wharton"
            subtitle={`Traditional paid (PPC + sponsored) vs. organic/direct/owned${
              wCurrent
                ? wToDate
                  ? ` · ${wCurrent.shortLabel} = platform-attributed paid enrolls to date from the cohort doc, organic = remainder`
                  : ` · ${wCurrent.shortLabel} omitted — ${wGap}`
                : ''
            }`}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="cohort" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="wPaid" name="Paid" stackId="a" fill={CHART_COLORS.violet} />
                <Bar dataKey="wOrganic" name="Organic/Owned" stackId="a" fill={CHART_COLORS.cyan} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        ) : (
          <SectionCard title="Leads by Cohort" subtitle="Bot-adjusted where available">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="cohort" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="cLeads" name="Columbia leads" stroke={SCHOOL_COLORS.columbia} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </SectionCard>
        )}

        {/* CVR trend */}
        <SectionCard title="Lead → Enrollment CVR" subtitle="Bot-adjusted lead base where available">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="cohort" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v.toFixed(1)}%`} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {showW && <Line type="monotone" dataKey="wCvr" name="Wharton CVR" stroke={SCHOOL_COLORS.wharton} strokeWidth={2} dot={{ r: 3 }} connectNulls />}
              {showC && <Line type="monotone" dataKey="cCvr" name="Columbia CVR" stroke={SCHOOL_COLORS.columbia} strokeWidth={2} dot={{ r: 3 }} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* CPL / CPE */}
        <SectionCard title="Cost per Lead & Cost per Enrollment" subtitle="Dollars, by cohort · * = in progress: CPL is paid spend to date ÷ leads · CPE shown for closed cohorts only">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="cohort" {...AXIS_PROPS} />
              <YAxis yAxisId="cpl" {...AXIS_PROPS} tickFormatter={(v: number) => `$${v}`} />
              <YAxis yAxisId="cpe" orientation="right" {...AXIS_PROPS} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `$${v.toLocaleString()}`} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {showW && <Line yAxisId="cpl" type="monotone" dataKey="wCpl" name="Wharton CPL" stroke={SCHOOL_COLORS.wharton} strokeWidth={2} dot={{ r: 3 }} connectNulls />}
              {showC && <Line yAxisId="cpl" type="monotone" dataKey="cCpl" name="Columbia CPL" stroke={SCHOOL_COLORS.columbia} strokeWidth={2} dot={{ r: 3 }} connectNulls />}
              {showW && <Line yAxisId="cpe" type="monotone" dataKey="wCpe" name="Wharton CPE" stroke={CHART_COLORS.amber} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls />}
              {showC && <Line yAxisId="cpe" type="monotone" dataKey="cCpe" name="Columbia CPE" stroke={CHART_COLORS.orange} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* ROAS */}
        <SectionCard title="PPC vs. Blended ROAS" subtitle="Return on ad spend (x) · * = in progress: PPC ROAS to date on net revenue; blended ROAS finalizes at cohort close">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="cohort" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `${v}x`} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v.toFixed(1)}x`} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {showW && <Line type="monotone" dataKey="wPpcRoas" name="Wharton PPC" stroke={SCHOOL_COLORS.wharton} strokeWidth={2} dot={{ r: 3 }} connectNulls />}
              {showW && <Line type="monotone" dataKey="wBlended" name="Wharton blended" stroke={SCHOOL_COLORS.wharton} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls />}
              {showC && <Line type="monotone" dataKey="cPpcRoas" name="Columbia PPC" stroke={SCHOOL_COLORS.columbia} strokeWidth={2} dot={{ r: 3 }} connectNulls />}
              {showC && <Line type="monotone" dataKey="cBlended" name="Columbia blended" stroke={SCHOOL_COLORS.columbia} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Leads */}
        <SectionCard title="Lead Volume by Cohort" subtitle="Bot-adjusted where available (Wharton S'25/F'25)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="cohort" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {showW && <Line type="monotone" dataKey="wLeads" name="Wharton leads" stroke={SCHOOL_COLORS.wharton} strokeWidth={2} dot={{ r: 3 }} connectNulls />}
              {showC && <Line type="monotone" dataKey="cLeads" name="Columbia leads" stroke={SCHOOL_COLORS.columbia} strokeWidth={2} dot={{ r: 3 }} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Cohort callouts */}
      {callouts.length > 0 && (
        <div className="mb-6">
          <SectionCard title="Cohort Callouts" subtitle="Events affecting comparability">
            <ul className="space-y-2">
              {callouts.map(c => (
                <li key={`${c.school}-${c.cohort}`} className="flex gap-3 text-sm">
                  <span className="text-xs font-semibold text-gray-400 shrink-0 w-32">
                    {c.cohort} <span className="text-gray-600">({c.school === 'wharton' ? 'W' : 'C'})</span>
                  </span>
                  <span className="text-gray-300">{c.callout}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}

      {/* Full history table */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">All Cohorts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {['Cohort', 'School', 'Certs', 'Enrolls (ex-B2B)', 'Leads', 'CVR', 'CPL', 'CPE', 'PPC ROAS', 'Blended', 'Total Spend'].map((h, i) => (
                  <th key={h} className={`${i === 0 ? 'text-left px-5' : 'text-right px-4'} py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((c, i) => (
                <tr key={`${c.school}-${c.cohort}`} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="px-5 py-3 text-white font-medium whitespace-nowrap">{c.cohort}</td>
                  <td className="px-4 py-3 text-right text-gray-300 capitalize">{c.school}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{c.certCount}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(c.totalEnrollsExB2B)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(c.leadsExBots ?? c.totalLeads)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${c.leadCvr >= 6 ? 'text-emerald-400' : c.leadCvr >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>{fmtPct(c.leadCvr)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">${c.cpl}</td>
                  <td className={`px-4 py-3 text-right font-medium ${c.cpe <= 700 ? 'text-emerald-400' : c.cpe <= 800 ? 'text-yellow-400' : 'text-red-400'}`}>${c.cpe}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{c.ppcRoas.toFixed(1)}x</td>
                  <td className="px-4 py-3 text-right text-gray-300">{c.blendedRoas.toFixed(1)}x</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmtDollar(c.totalSpend)}</td>
                </tr>
              ))}
              {[
                ...(wCurrent ? [{ ...wCurrent, school: 'wharton' as const, certCount: 5, toDate: wToDate, gap: wGap }] : []),
                ...(cCurrent ? [{ ...cCurrent, school: 'columbia' as const, certCount: 1, toDate: cToDate, gap: cGap }] : []),
              ].map(c => (
                <tr key={`current-${c.school}`} className="border-b border-white/5 bg-white/5">
                  <td className="px-5 py-3 text-white font-medium whitespace-nowrap">
                    {c.cohort}
                    <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                      In progress
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 capitalize">{c.school}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{c.certCount}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(c.enrolls)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(c.leads)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-300">{c.cvr != null ? fmtPct(c.cvr) : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-300" title={c.gap ?? undefined}>{c.toDate?.cpl != null ? `$${c.toDate.cpl}` : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-500" title="Finalizes at cohort close">—</td>
                  <td className="px-4 py-3 text-right text-gray-300" title={c.gap ?? undefined}>{c.toDate?.ppcRoas != null ? `${c.toDate.ppcRoas.toFixed(1)}x` : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-500" title="Finalizes at cohort close">—</td>
                  <td className="px-4 py-3 text-right text-gray-300" title={c.gap ?? undefined}>{c.toDate?.spend != null ? fmtDollar(c.toDate.spend) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-white/10 text-[11px] text-gray-500 leading-relaxed space-y-1">
          <p>
            In-progress rows show to-date figures from the cohort doc&apos;s paid tables (Google · Bing · Meta · LinkedIn):
            Total Spend is paid spend so far, CPL is paid spend so far ÷ all leads so far, and PPC ROAS is paid-attributed
            enrolls × net revenue per enroll (≈${(NET_REV.wharton / 1000).toFixed(1)}K Wharton / ${(NET_REV.columbia / 1000).toFixed(1)}K Columbia)
            ÷ paid spend — the Paid Optimization page&apos;s basis, where 1.0× is contribution breakeven. Closed cohorts&apos; PPC ROAS is the
            historical sheet&apos;s own figure. CPE and blended ROAS are blank until the cohort closes.
          </p>
          {liveFor.length > 0 && (
            <p>Live from the cohort docs as of {paid.asOf}: {liveFor.join(', ')}.</p>
          )}
          {snapshotFor.length > 0 && (
            <p className="text-amber-400/80">Snapshot figures (curated {STATIC_PAID_DATA.asOf}) for {snapshotFor.join(', ')} — the paid layer is not live for that cohort doc.</p>
          )}
          {gaps.length > 0 && (
            <p className="text-amber-400/80">No to-date paid figures for {gaps.join('; ')}.</p>
          )}
        </div>
      </div>
    </div>
  );
}
