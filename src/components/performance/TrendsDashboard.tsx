'use client';

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, BarChart, Bar,
} from 'recharts';
import { WHARTON_HISTORY, COLUMBIA_HISTORY, WHARTON_CURRENT_CHANNELS } from '@/data/performance/historical';
import { WHARTON_PAID_OVERALL, CBS_SPRING_GOOGLE } from '@/data/performance/paidChannels';
import { PROGRAM_SCHOOL, type CohortHistory, type CurrentSnapshot, type School } from '@/data/performance/types';
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
    columbia: school === 'all' ? COLUMBIA_HISTORY.find(c => c.cohort === w.cohort) ?? null : null,
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
  const leads = programs.reduce((a, p) => a + p.leads.realTime, 0);
  return {
    cohort: label,
    shortLabel: label.replace(/(\w+) 20(\d\d)/, (_, s, y) => `${s[0]}'${y}`) + '*',
    enrolls,
    leads,
    cvr: leads > 0 ? +((enrolls / leads) * 100).toFixed(1) : null,
  };
}

export default function TrendsDashboard({ snapshot }: { snapshot: CurrentSnapshot }) {
  const [school, setSchool] = usePersistentSchoolFilter();
  const rows = buildRows(school);

  const wCurrent = school !== 'columbia' ? buildInProgress(snapshot, 'wharton') : null;
  const cCurrent = school !== 'wharton' ? buildInProgress(snapshot, 'columbia') : null;

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
  // the live snapshot; to-date cost metrics come from the cohort docs:
  // - paid/organic split: channel-attributed enrollments (Channel Tables)
  // - CPL to date: paid spend so far ÷ total leads so far
  // - PPC ROAS to date: the cohort doc's own running figure
  // CPE and blended ROAS stay blank — they're only meaningful at cohort close.
  if (wCurrent || cCurrent) {
    const wPaidEnrolls = (WHARTON_CURRENT_CHANNELS.channelEnrolls.ppc ?? 0) + (WHARTON_CURRENT_CHANNELS.channelEnrolls.sponsored ?? 0);
    const wOrganicEnrolls = WHARTON_CURRENT_CHANNELS.total - wPaidEnrolls;
    const wPaidTotal = WHARTON_PAID_OVERALL.find(r => r.program === 'Total');
    chartData.push({
      cohort: wCurrent?.shortLabel ?? cCurrent!.shortLabel,
      wEnrolls: wCurrent?.enrolls ?? null,
      cEnrolls: cCurrent?.enrolls ?? null,
      wPaid: wCurrent ? wPaidEnrolls : null,
      wOrganic: wCurrent ? wOrganicEnrolls : null,
      wCvr: wCurrent?.cvr ?? null,
      cCvr: cCurrent?.cvr ?? null,
      wCpl: wCurrent && wPaidTotal && wCurrent.leads > 0 ? +(wPaidTotal.spend / wCurrent.leads).toFixed(0) : null,
      cCpl: cCurrent && cCurrent.leads > 0 ? +(CBS_SPRING_GOOGLE.spend / cCurrent.leads).toFixed(0) : null,
      wCpe: null, cCpe: null,
      wPpcRoas: wCurrent ? (wPaidTotal?.roas ?? null) : null,
      cPpcRoas: null, wBlended: null, cBlended: null,
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
        subtitle="Cohort-over-cohort performance — Wharton Spring 2023 →, Columbia Summer 2025 →. * = current cohort in progress (volume metrics only)."
        school={school}
        onSchoolChange={setSchool}
        right={<DataAsOf asOf={snapshot.asOf} live={snapshot.live} />}
      />

      {/* Latest-cohort KPI row */}
      {latest && (
        <div className="flex gap-4 flex-wrap mb-6">
          <KpiCard label={`Enrolls (${latest.shortLabel})`} value={fmt(latest.totalEnrollsExB2B)}
            sub={prior ? `${latest.totalEnrollsExB2B >= prior.totalEnrollsExB2B ? '+' : ''}${fmt(latest.totalEnrollsExB2B - prior.totalEnrollsExB2B)} vs ${prior.shortLabel}` : undefined}
            positive={prior ? latest.totalEnrollsExB2B >= prior.totalEnrollsExB2B : undefined} />
          <KpiCard label="Lead CVR" value={fmtPct(latest.leadCvr)}
            sub={prior ? `${prior.shortLabel}: ${fmtPct(prior.leadCvr)}` : undefined}
            positive={prior ? latest.leadCvr >= prior.leadCvr : undefined} />
          <KpiCard label="CPL" value={`$${latest.cpl}`}
            sub={prior ? `${prior.shortLabel}: $${prior.cpl}` : undefined}
            positive={prior ? latest.cpl <= prior.cpl : undefined} />
          <KpiCard label="CPE" value={`$${latest.cpe}`}
            sub={prior ? `${prior.shortLabel}: $${prior.cpe}` : undefined}
            positive={prior ? latest.cpe <= prior.cpe : undefined} />
          <KpiCard label="PPC ROAS" value={`${latest.ppcRoas.toFixed(1)}x`}
            sub={prior ? `${prior.shortLabel}: ${prior.ppcRoas.toFixed(1)}x` : undefined}
            positive={prior ? latest.ppcRoas >= prior.ppcRoas : undefined} />
          <KpiCard label="Blended ROAS" value={`${latest.blendedRoas.toFixed(1)}x`}
            sub={prior ? `${prior.shortLabel}: ${prior.blendedRoas.toFixed(1)}x` : undefined}
            positive={prior ? latest.blendedRoas >= prior.blendedRoas : undefined} />
        </div>
      )}

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
          <SectionCard title="Paid vs. Organic Enrollments — Wharton" subtitle="Traditional paid (PPC + sponsored) vs. organic/direct/owned · S'26* = channel-attributed to date">
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
        <SectionCard title="Cost per Lead & Cost per Enrollment" subtitle="Dollars, by cohort · S'26* CPL = paid spend to date ÷ leads · CPE shown for closed cohorts only">
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
        <SectionCard title="PPC vs. Blended ROAS" subtitle="Return on ad spend (x) · S'26* PPC ROAS is to date; blended ROAS finalizes at cohort close">
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
                ...(wCurrent ? [{ ...wCurrent, school: 'wharton' as const, certCount: 5 }] : []),
                ...(cCurrent ? [{ ...cCurrent, school: 'columbia' as const, certCount: 1 }] : []),
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
                  <td className="px-4 py-3 text-right text-gray-500">—</td>
                  <td className="px-4 py-3 text-right text-gray-500">—</td>
                  <td className="px-4 py-3 text-right text-gray-500">—</td>
                  <td className="px-4 py-3 text-right text-gray-500">—</td>
                  <td className="px-4 py-3 text-right text-gray-500">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
