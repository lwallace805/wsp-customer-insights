'use client';

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, BarChart, Bar, Cell,
} from 'recharts';
import {
  SS_WEEK_LABELS_2025, SS_WEEK_LABELS_2026,
  SELF_STUDY_2025, SELF_STUDY_2026, PREMIUM_PACKAGE_2026,
} from '@/data/performance/selfStudy';
import {
  usePersistentSchoolFilter, PageHeader, SectionCard, KpiCard, ChartTooltip,
  CHART_COLORS, AXIS_PROPS, fmt, fmtDollar,
} from './shared';

export default function SelfStudyDashboard() {
  const [school, setSchool] = usePersistentSchoolFilter();

  const rows2026 = SS_WEEK_LABELS_2026.map((week, i) => {
    const actual = SELF_STUDY_2026.actual[i] ?? null;
    const prior = SELF_STUDY_2026.priorYear[i] ?? null;
    return {
      week,
      actual,
      prior,
      variance: actual != null && prior != null ? actual - prior : null,
    };
  });

  const rows2025 = SS_WEEK_LABELS_2025.map((week, i) => ({
    week,
    actual: SELF_STUDY_2025.actual[i] ?? null,
    budget: SELF_STUDY_2025.budget[i] ?? null,
    prior: SELF_STUDY_2025.priorYear[i] ?? null,
  }));

  const ytd2026 = SELF_STUDY_2026.actual.reduce((a, b) => a + b, 0);
  const ytdPrior = SELF_STUDY_2026.priorYear.reduce((a, b) => a + b, 0);
  const ytdDelta = ytdPrior > 0 ? ((ytd2026 - ytdPrior) / ytdPrior) * 100 : 0;

  const premiumRows = SS_WEEK_LABELS_2026.map((week, i) => ({
    week,
    actual: PREMIUM_PACKAGE_2026.actual[i] ?? null,
    prior: PREMIUM_PACKAGE_2026.priorYear[i] ?? null,
  }));
  const premYtd = PREMIUM_PACKAGE_2026.actual.reduce((a, b) => a + b, 0);
  const premPrior = PREMIUM_PACKAGE_2026.priorYear.reduce((a, b) => a + b, 0);
  const premDelta = premPrior > 0 ? ((premYtd - premPrior) / premPrior) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Self-Study / Retail"
        subtitle="Weekly self-study revenue and premium package units — school filter does not apply to retail"
        school={school}
        onSchoolChange={setSchool}
      />

      {/* KPI row */}
      <div className="flex gap-4 flex-wrap mb-6">
        <KpiCard label="2026 YTD Revenue" value={fmtDollar(ytd2026)} sub={`${ytdDelta >= 0 ? '+' : ''}${ytdDelta.toFixed(1)}% YoY`} positive={ytdDelta >= 0} />
        <KpiCard label="2025 Full Year" value={fmtDollar(SELF_STUDY_2025.ytd.actual)} sub={`vs ${fmtDollar(SELF_STUDY_2025.ytd.budget)} budget (+${(((SELF_STUDY_2025.ytd.actual! - SELF_STUDY_2025.ytd.budget!) / SELF_STUDY_2025.ytd.budget!) * 100).toFixed(1)}%)`} positive />
        <KpiCard label="Premium Units YTD" value={fmt(premYtd)} sub={`${premDelta >= 0 ? '+' : ''}${premDelta.toFixed(1)}% YoY`} positive={premDelta >= 0} />
      </div>

      {/* 2026 weekly revenue */}
      <div className="mb-6">
        <SectionCard title="2026 Weekly Revenue — Actual vs. Prior Year" subtitle="2026 budget not yet populated in source doc">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={rows2026}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="week" {...AXIS_PROPS} interval={2} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `$${v.toLocaleString()}`} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="actual" name="2026 actual" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="prior" name="Prior year" stroke={CHART_COLORS.gray} strokeWidth={2} strokeDasharray="5 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly variance */}
        <SectionCard title="2026 Weekly Variance vs. Prior Year" subtitle="Green = ahead of prior year">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rows2026}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="week" {...AXIS_PROPS} interval={2} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `$${v.toLocaleString()}`} />} />
              <Bar dataKey="variance" name="vs prior year" radius={[3, 3, 0, 0]}>
                {rows2026.map((r, i) => (
                  <Cell key={i} fill={(r.variance ?? 0) >= 0 ? CHART_COLORS.emerald : CHART_COLORS.red} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Premium package units */}
        <SectionCard title="Premium Package Units — 2026 vs. Prior Year" subtitle="Weekly units sold">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={premiumRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="week" {...AXIS_PROPS} interval={2} />
              <YAxis {...AXIS_PROPS} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="actual" name="2026 units" stroke={CHART_COLORS.violet} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="prior" name="Prior year" stroke={CHART_COLORS.gray} strokeWidth={2} strokeDasharray="5 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* 2025 full year */}
      <SectionCard title="2025 Full Year — Actual vs. Budget vs. Prior Year" subtitle={`Finished ${fmtDollar(SELF_STUDY_2025.ytd.actual)} vs ${fmtDollar(SELF_STUDY_2025.ytd.budget)} budget`}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={rows2025}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="week" {...AXIS_PROPS} interval={4} />
            <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip content={<ChartTooltip valueFormatter={(v) => `$${v.toLocaleString()}`} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="budget" name="Budget" stroke={CHART_COLORS.amber} strokeWidth={2} strokeDasharray="5 3" dot={false} />
            <Line type="monotone" dataKey="prior" name="Prior year" stroke={CHART_COLORS.gray} strokeWidth={1.5} strokeDasharray="2 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}
