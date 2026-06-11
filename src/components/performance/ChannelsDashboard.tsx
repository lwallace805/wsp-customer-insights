'use client';

import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart, Bar,
} from 'recharts';
import { WHARTON_HISTORY, COLUMBIA_HISTORY, WHARTON_CURRENT_CHANNELS, COLUMBIA_CURRENT_CHANNELS } from '@/data/performance/historical';
import { CHANNEL_LABELS, type ChannelKey, type CurrentSnapshot, type School } from '@/data/performance/types';
import {
  usePersistentSchoolFilter, PageHeader, SectionCard, ChartTooltip, DataAsOf,
  CHART_COLORS, AXIS_PROPS, fmt, fmtPct,
} from './shared';

const CHANNEL_ORDER: ChannelKey[] = [
  'ppc', 'email', 'organicSearch', 'aiReferral', 'social', 'website',
  'referrals', 'sponsored', 'affiliates', 'offline',
];

const CHANNEL_COLORS: Record<ChannelKey, string> = {
  ppc: CHART_COLORS.violet,
  email: CHART_COLORS.blue,
  organicSearch: CHART_COLORS.emerald,
  aiReferral: CHART_COLORS.cyan,
  social: CHART_COLORS.pink,
  website: CHART_COLORS.lime,
  referrals: CHART_COLORS.amber,
  sponsored: CHART_COLORS.orange,
  affiliates: CHART_COLORS.red,
  offline: CHART_COLORS.gray,
};

export default function ChannelsDashboard({ snapshot }: { snapshot: CurrentSnapshot }) {
  const [school, setSchool] = usePersistentSchoolFilter();

  // Channel mix % over cohorts, plus the in-progress Spring 2026 point from
  // each school's cohort doc channel tables.
  const currentChannels = school === 'columbia' ? COLUMBIA_CURRENT_CHANNELS : WHARTON_CURRENT_CHANNELS;
  const mixSource = school === 'columbia' ? COLUMBIA_HISTORY.filter(c => Object.keys(c.channelEnrolls).length > 0) : WHARTON_HISTORY;
  const mixData = mixSource.map(c => {
    const total = c.totalEnrolls || 1;
    const row: Record<string, string | number> = { cohort: c.shortLabel };
    for (const key of CHANNEL_ORDER) {
      row[key] = +(((c.channelEnrolls[key] ?? 0) / total) * 100).toFixed(1);
    }
    return row;
  });
  {
    const cur: Record<string, string | number> = { cohort: currentChannels.shortLabel };
    for (const key of CHANNEL_ORDER) {
      cur[key] = +(((currentChannels.channelEnrolls[key] ?? 0) / currentChannels.total) * 100).toFixed(1);
    }
    mixData.push(cur);
  }

  // Paid vs organic share trend
  const paidTrendSource = school === 'columbia' ? COLUMBIA_HISTORY : WHARTON_HISTORY;
  const paidTrend = paidTrendSource.map(c => ({
    cohort: c.shortLabel,
    paid: +((c.paidEnrolls / (c.totalEnrolls || 1)) * 100).toFixed(1),
    organic: +((c.organicEnrolls / (c.totalEnrolls || 1)) * 100).toFixed(1),
  }));

  // Current-cohort channel mix comparison (from the live snapshot)
  const snapshotSchool: School = school === 'columbia' ? 'columbia' : 'wharton';
  const mixComparison = snapshot.channelMix[snapshotSchool];
  const paidVsOrganic = snapshot.paidVsOrganic[snapshotSchool];

  // Channel detail table — both schools show the in-progress current cohort.
  // Sorted largest → smallest.
  const detail = {
    title: `${currentChannels.cohort} (${snapshotSchool === 'columbia' ? 'Columbia' : 'Wharton'})`,
    subtitle: 'Current cohort, in progress — channel-attributed enrollments',
    channelEnrolls: currentChannels.channelEnrolls,
    total: currentChannels.total,
  };

  const detailRows = CHANNEL_ORDER
    .map(key => ({ key, count: detail.channelEnrolls[key] ?? 0 }))
    .filter(r => r.count > 0 || r.key === 'ppc')
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      <PageHeader
        title="Channel Performance"
        subtitle="Enrollment channel mix, paid vs. organic balance, and channel efficiency"
        school={school}
        onSchoolChange={setSchool}
        right={<DataAsOf asOf={snapshot.asOf} live={snapshot.live} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Channel mix stacked area */}
        <SectionCard
          title={`Channel Mix Over Time — ${school === 'columbia' ? 'Columbia' : 'Wharton'}`}
          subtitle="% of total enrollments by channel"
        >
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={mixData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="cohort" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v.toFixed(1)}%`} />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {CHANNEL_ORDER.map(key => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={CHANNEL_LABELS[key]}
                  stackId="1"
                  stroke={CHANNEL_COLORS[key]}
                  fill={CHANNEL_COLORS[key]}
                  fillOpacity={0.55}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Paid vs organic trend */}
        <SectionCard title="Paid vs. Organic Share" subtitle="% of enrollments from traditional paid channels (PPC + sponsored)">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={paidTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="cohort" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v.toFixed(1)}%`} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="paid" name="Paid" stroke={CHART_COLORS.violet} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="organic" name="Organic/Owned" stroke={CHART_COLORS.cyan} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Current cohort mix vs prior cohort vs prior year */}
      <div className="mb-6">
        <SectionCard
          title={`Current Cohort Channel Mix — ${snapshotSchool === 'wharton' ? 'Wharton' : 'Columbia'}`}
          subtitle={`% of enrollments · current vs. prior cohort vs. prior-year cohort · paid share ${paidVsOrganic.paid}% (prior cohort ${paidVsOrganic.priorCohortPaid}%, prior year ${paidVsOrganic.priorYearPaid}%)`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mixComparison} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="channel" {...AXIS_PROPS} interval={0} angle={-18} textAnchor="end" height={56} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v}%`} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="current" name="Current" fill={CHART_COLORS.emerald} radius={[3, 3, 0, 0]} />
              <Bar dataKey="priorCohort" name="Prior cohort" fill={CHART_COLORS.blue} radius={[3, 3, 0, 0]} />
              <Bar dataKey="priorYear" name="Prior year" fill={CHART_COLORS.gray} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Channel detail table — sorted largest to smallest */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Channel Detail — {detail.title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{detail.subtitle}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Channel</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Enrolls</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map(({ key, count }, i) => (
                <tr key={key} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="px-5 py-3 text-white font-medium flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[key] }} />
                    {CHANNEL_LABELS[key]}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(count)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmtPct((count / detail.total) * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
