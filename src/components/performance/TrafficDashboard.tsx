'use client';

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts';
import {
  WEEK_LABELS_2026, CHANNEL_TRAFFIC, SITEWIDE_YOY,
  CERT_PAGES_WHARTON_YOY, CERT_PAGES_COLUMBIA_YOY, SELF_STUDY_PAGES_YOY,
} from '@/data/performance/traffic';
import type { YoYWeeklySeries } from '@/data/performance/types';
import {
  usePersistentSchoolFilter, PageHeader, SectionCard, KpiCard, ChartTooltip,
  CHART_COLORS, AXIS_PROPS, fmt,
} from './shared';

function yoyRows(series: YoYWeeklySeries) {
  return WEEK_LABELS_2026.map((week, i) => ({
    week,
    y2025: series.y2025[i] ?? null,
    y2026: series.y2026[i] ?? null,
  }));
}

function sumValid(arr: (number | null)[], pairWith?: (number | null)[]) {
  // Sum entries; when pairWith is provided only sum indices valid in BOTH
  // series so YoY comparisons are like-for-like.
  let total = 0;
  arr.forEach((v, i) => {
    if (v == null) return;
    if (pairWith && pairWith[i] == null) return;
    total += v;
  });
  return total;
}

function YoYCard({ title, subtitle, series }: { title: string; subtitle?: string; series: YoYWeeklySeries }) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={yoyRows(series)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="week" {...AXIS_PROPS} interval={2} />
          <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`)} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="y2026" name="2026" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="y2025" name="2025" stroke={CHART_COLORS.gray} strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

export default function TrafficDashboard() {
  const [school, setSchool] = usePersistentSchoolFilter();

  const t2025 = CHANNEL_TRAFFIC.find(t => t.year === 2025)!;
  const t2026 = CHANNEL_TRAFFIC.find(t => t.year === 2026)!;

  const channelRows = WEEK_LABELS_2026.map((week, i) => ({
    week,
    seo: t2026.seo[i],
    ai: t2026.ai[i],
    direct: t2026.direct[i],
    paid: t2026.paid[i],
    other: t2026.other[i],
  }));

  // YoY KPI deltas (like-for-like weeks only)
  const site25 = sumValid(SITEWIDE_YOY.y2025, SITEWIDE_YOY.y2026);
  const site26 = sumValid(SITEWIDE_YOY.y2026, SITEWIDE_YOY.y2025);
  const siteDelta = site25 > 0 ? ((site26 - site25) / site25) * 100 : 0;

  const seo25 = sumValid(t2025.seo, t2026.seo);
  const seo26 = sumValid(t2026.seo, t2025.seo);
  const seoDelta = seo25 > 0 ? ((seo26 - seo25) / seo25) * 100 : 0;

  const ai25 = sumValid(t2025.ai, t2026.ai);
  const ai26 = sumValid(t2026.ai, t2025.ai);
  const aiDelta = ai25 > 0 ? ((ai26 - ai25) / ai25) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Traffic Analytics"
        subtitle="GA4 weekly sessions — channel mix, sitewide YoY, and key page groups"
        school={school}
        onSchoolChange={setSchool}
      />

      {/* KPI row */}
      <div className="flex gap-4 flex-wrap mb-6">
        <KpiCard label="Sitewide YTD (2026)" value={fmt(site26)} sub={`${siteDelta >= 0 ? '+' : ''}${siteDelta.toFixed(1)}% YoY`} positive={siteDelta >= 0} />
        <KpiCard label="SEO YTD" value={fmt(seo26)} sub={`${seoDelta >= 0 ? '+' : ''}${seoDelta.toFixed(1)}% YoY`} positive={seoDelta >= 0} />
        <KpiCard label="AI Referral YTD" value={fmt(ai26)} sub={`${aiDelta >= 0 ? '+' : ''}${aiDelta.toFixed(1)}% YoY`} positive={aiDelta >= 0} />
      </div>

      {/* Channel traffic 2026 */}
      <div className="mb-6">
        <SectionCard
          title="2026 Weekly Sessions by Channel"
          subtitle="Note: from week of 3/1 Direct jumps ~3x while Other drops — GA4 channel reclassification, not a real traffic shift"
        >
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={channelRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="week" {...AXIS_PROPS} interval={2} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="seo" name="SEO" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="direct" name="Direct" stroke={CHART_COLORS.blue} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="other" name="Other" stroke={CHART_COLORS.gray} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="paid" name="Paid" stroke={CHART_COLORS.violet} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="ai" name="AI Referral" stroke={CHART_COLORS.cyan} strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <YoYCard title="Sitewide Sessions — YoY" series={SITEWIDE_YOY} />
        <YoYCard title="Self-Study Pages — YoY" series={SELF_STUDY_PAGES_YOY} />
        {school !== 'columbia' && (
          <YoYCard
            title="Certificate Pages — Wharton YoY"
            subtitle="2026 trails early-year, recovers strongly from mid-April"
            series={CERT_PAGES_WHARTON_YOY}
          />
        )}
        {school !== 'wharton' && (
          <YoYCard
            title="Certificate Pages — Columbia YoY"
            subtitle="Columbia pages launched March 2025"
            series={CERT_PAGES_COLUMBIA_YOY}
          />
        )}
      </div>
    </div>
  );
}
