'use client';

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import {
  WHARTON_PAID_OVERALL, WHARTON_PAID_GOOGLE, WHARTON_PAID_WEEKLY,
  CBS_SPRING_GOOGLE, CBS_SPRING_WEEKLY,
  CBS_PAID_PLATFORMS, CBS_OTHER_PAID, PAID_COHORT_LABELS,
  type PaidProgramRow, type PaidPlatform, type PaidWeek,
} from '@/data/performance/paidChannels';
import {
  usePersistentSchoolFilter, PageHeader, SectionCard, KpiCard, ChartTooltip,
  CHART_COLORS, AXIS_PROPS, fmt, fmtDollar, fmtPct,
} from './shared';

// Per-channel color key, reused across every chart on this page.
const CHANNEL_COLORS: Record<string, string> = {
  Google: CHART_COLORS.blue,
  LinkedIn: CHART_COLORS.cyan,
  Meta: CHART_COLORS.violet,
  Bing: CHART_COLORS.amber,
  Other: CHART_COLORS.gray,
};

const dollarsK = (v: number) => `$${(v / 1000).toFixed(0)}K`;
const dollars = (v: number) => `$${v.toLocaleString()}`;

/* ── Program table (Wharton) ───────────────────────────────────────── */
function PaidProgramTable({ title, subtitle, rows }: { title: string; subtitle?: string; rows: PaidProgramRow[] }) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {['Program', 'Spend', 'vs Forecast', 'Leads', 'Enrolls', 'CPL', 'CPL Goal', 'CPE', 'CVR', 'ROAS'].map((h, i) => (
                <th key={h} className={`${i === 0 ? 'text-left px-5' : 'text-right px-4'} py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isTotal = r.program === 'Total';
              const spendDelta = r.spendForecast ? ((r.spend - r.spendForecast) / r.spendForecast) * 100 : null;
              return (
                <tr key={r.program} className={`border-b border-white/5 ${isTotal ? 'bg-white/5 font-medium' : i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                  <td className="px-5 py-3 text-white whitespace-nowrap">{r.program}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmtDollar(r.spend)}</td>
                  <td className={`px-4 py-3 text-right text-xs ${spendDelta == null ? 'text-gray-500' : spendDelta > 5 ? 'text-amber-400' : 'text-gray-400'}`}>
                    {spendDelta == null ? '—' : `${spendDelta >= 0 ? '+' : ''}${spendDelta.toFixed(0)}%`}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(r.leads)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(r.enrolls)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${r.cpl != null && r.cplGoal != null ? (r.cpl <= r.cplGoal * 1.25 ? 'text-emerald-400' : r.cpl <= r.cplGoal * 2 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-300'}`}>
                    {r.cpl != null ? `$${r.cpl.toFixed(0)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{r.cplGoal != null ? `$${r.cplGoal}` : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{r.cpe != null ? fmtDollar(r.cpe) : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{r.cvr != null ? fmtPct(r.cvr) : '—'}</td>
                  <td className={`px-4 py-3 text-right font-medium ${r.roas != null ? (r.roas >= 1.5 ? 'text-emerald-400' : r.roas >= 1 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-300'}`}>
                    {r.roas != null ? `${r.roas.toFixed(2)}x` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Weekly spend/leads/enrolls chart ──────────────────────────────── */
function WeeklyPaidChart({ title, subtitle, weeks }: { title: string; subtitle?: string; weeks: PaidWeek[] }) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={weeks}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="week" {...AXIS_PROPS} interval={1} />
          <YAxis yAxisId="spend" {...AXIS_PROPS} tickFormatter={dollarsK} />
          <YAxis yAxisId="count" orientation="right" {...AXIS_PROPS} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="spend" dataKey="spend" name="Spend" fill={CHART_COLORS.violet} fillOpacity={0.6} radius={[3, 3, 0, 0]} />
          <Line yAxisId="count" type="monotone" dataKey="leads" name="Leads" stroke={CHART_COLORS.cyan} strokeWidth={2} dot={false} />
          <Line yAxisId="count" type="monotone" dataKey="enrolls" name="Enrollments" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

/* ── Spend & enrollments by channel (combined, separated by channel) ── */
function ChannelSpendChart({ title, subtitle, platforms }: { title: string; subtitle?: string; platforms: PaidPlatform[] }) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={platforms} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="platform" {...AXIS_PROPS} />
          <YAxis yAxisId="spend" {...AXIS_PROPS} tickFormatter={dollarsK} />
          <YAxis yAxisId="count" orientation="right" {...AXIS_PROPS} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="spend" dataKey="spend" name="Spend" radius={[4, 4, 0, 0]}>
            {platforms.map(p => (
              <Cell key={p.platform} fill={CHANNEL_COLORS[p.platform] ?? CHART_COLORS.violet} />
            ))}
          </Bar>
          <Line yAxisId="count" type="monotone" dataKey="enrolls" name="Enrollments" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={{ r: 3 }} connectNulls />
          <Line yAxisId="count" type="monotone" dataKey="leads" name="Leads" stroke={CHART_COLORS.cyan} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

/* ── Cost efficiency (CPL/CPE) by channel ──────────────────────────── */
function ChannelEfficiencyChart({ title, subtitle, platforms }: { title: string; subtitle?: string; platforms: PaidPlatform[] }) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={platforms} barCategoryGap="20%" barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="platform" {...AXIS_PROPS} />
          <YAxis yAxisId="cpl" {...AXIS_PROPS} tickFormatter={(v: number) => `$${v}`} />
          <YAxis yAxisId="cpe" orientation="right" {...AXIS_PROPS} tickFormatter={dollarsK} />
          <Tooltip content={<ChartTooltip valueFormatter={dollars} />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="cpl" dataKey="cpl" name="CPL" fill={CHART_COLORS.blue} radius={[3, 3, 0, 0]} />
          <Bar yAxisId="cpe" dataKey="cpe" name="CPE" fill={CHART_COLORS.orange} radius={[3, 3, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

/* ── Google vs. other paid spend, by program (Wharton) ─────────────── */
function ChannelByProgramChart({ rows }: { rows: { program: string; google: number; other: number }[] }) {
  return (
    <SectionCard
      title="Wharton — Google vs. Other Paid Spend by Program"
      subtitle="Spring 2026 · 'Other' = total paid − Google (Meta/LinkedIn/Bing/etc. — not split out in the Wharton cohort doc)"
    >
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={rows} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="program" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} tickFormatter={dollarsK} />
          <Tooltip content={<ChartTooltip valueFormatter={dollars} />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="google" name="Google" stackId="s" fill={CHANNEL_COLORS.Google} />
          <Bar dataKey="other" name="Other paid" stackId="s" fill={CHANNEL_COLORS.Other} radius={[4, 4, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

/* ── Platform detail table ─────────────────────────────────────────── */
function PlatformTable({ title, subtitle, platforms }: { title: string; subtitle?: string; platforms: PaidPlatform[] }) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {['Channel', 'Spend', 'Leads', 'Enrolls', 'CPL', 'CPE', 'CVR', 'Notes'].map((h, i) => (
                <th key={h} className={`${i === 0 || i === 7 ? 'text-left px-5' : 'text-right px-4'} py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platforms.map((p, i) => (
              <tr key={p.platform} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                <td className="px-5 py-3 text-white font-medium whitespace-nowrap">
                  <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: CHANNEL_COLORS[p.platform] ?? CHART_COLORS.gray }} />
                  {p.platform}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{fmtDollar(p.spend)}</td>
                <td className="px-4 py-3 text-right text-gray-300">{p.leads != null ? fmt(p.leads) : '—'}</td>
                <td className="px-4 py-3 text-right text-gray-300">{p.enrolls != null ? fmt(p.enrolls) : '—'}</td>
                <td className="px-4 py-3 text-right text-gray-300">{p.cpl != null ? `$${p.cpl.toFixed(0)}` : '—'}</td>
                <td className={`px-4 py-3 text-right font-medium ${p.cpe != null ? (p.cpe <= 1500 ? 'text-emerald-400' : p.cpe <= 2200 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-300'}`}>
                  {p.cpe != null ? fmtDollar(p.cpe) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{p.cvr != null ? fmtPct(p.cvr) : '—'}</td>
                <td className="px-5 py-3 text-left text-xs text-gray-500 max-w-xs">{p.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PaidChannelsDashboard() {
  const [school, setSchool] = usePersistentSchoolFilter();

  const whartonTotal = WHARTON_PAID_OVERALL.find(r => r.program === 'Total')!;
  const whartonGoogleTotal = WHARTON_PAID_GOOGLE.find(r => r.program === 'Total')!;
  const showWharton = school !== 'columbia';
  const showColumbia = school !== 'wharton';

  // Derive Wharton's Google vs. other-paid split per program (Overall − Google).
  // The Wharton cohort doc only breaks out Google, so everything else collapses
  // into a single "Other paid" bucket (Meta/LinkedIn/Bing/etc.).
  const whartonChannelByProgram = WHARTON_PAID_OVERALL
    .filter(o => o.program !== 'Total')
    .map(o => {
      const g = WHARTON_PAID_GOOGLE.find(r => r.program === o.program);
      const google = g?.spend ?? 0;
      return { program: o.program, google, other: Math.max(0, o.spend - google) };
    });
  const whartonOtherSpend = Math.max(0, whartonTotal.spend - whartonGoogleTotal.spend);
  const whartonGoogleShare = whartonTotal.spend > 0 ? (whartonGoogleTotal.spend / whartonTotal.spend) * 100 : 0;

  // Combined "all paid channels" totals for the prior CBS cohort (multi-channel).
  const cbsTotalSpend = CBS_PAID_PLATFORMS.reduce((a, p) => a + p.spend, 0);
  const cbsTotalEnrolls = CBS_PAID_PLATFORMS.reduce((a, p) => a + (p.enrolls ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Paid Channel Performance"
        subtitle="Platform-level paid media, broken out by channel and (where available) by program"
        school={school}
        onSchoolChange={setSchool}
      />

      {/* Data-coverage note */}
      <div className="mb-6 rounded-xl border border-white/10 bg-[#161b22] px-5 py-3 text-xs text-gray-400 leading-relaxed">
        <span className="font-semibold text-gray-300">Channel coverage:</span> Columbia Winter 2026
        is the most recent cohort with full per-channel detail (Google, LinkedIn, Meta, Bing). The
        current Spring 2026 cohorts are Google-dominant in the cohort docs — Columbia Spring is
        Google-only so far, and Wharton splits into Google vs. a combined &ldquo;other paid&rdquo;
        bucket. Per-channel weekly and by-program breakouts for Meta/LinkedIn/Bing aren&rsquo;t in
        the current cohort docs yet.
      </div>

      {/* KPI row */}
      <div className="flex gap-4 flex-wrap mb-6">
        {showWharton && (
          <>
            <KpiCard label={`Wharton Paid Spend (${PAID_COHORT_LABELS.wharton})`} value={fmtDollar(whartonTotal.spend)} sub={`${fmt(whartonTotal.leads)} leads · ${fmt(whartonTotal.enrolls)} enrolls · all paid channels`} />
            <KpiCard label="Wharton Channel Split" value={`${whartonGoogleShare.toFixed(0)}% Google`} sub={`Google ${fmtDollar(whartonGoogleTotal.spend)} · Other ${fmtDollar(whartonOtherSpend)}`} />
            <KpiCard label="Wharton Paid CPL / CPE" value={`$${whartonTotal.cpl?.toFixed(0)}`} sub={`CPE ${fmtDollar(whartonTotal.cpe)} · ROAS ${whartonTotal.roas?.toFixed(2)}x`} positive={(whartonTotal.roas ?? 0) >= 1.5} />
          </>
        )}
        {showColumbia && (
          <>
            <KpiCard label={`Columbia Paid Spend (${PAID_COHORT_LABELS.columbia})`} value={fmtDollar(CBS_SPRING_GOOGLE.spend)} sub={`${fmt(CBS_SPRING_GOOGLE.leads)} leads · ${fmt(CBS_SPRING_GOOGLE.enrolls)} enrolls · Google-only`} />
            <KpiCard label="Columbia CPL / CPE" value={`$${CBS_SPRING_GOOGLE.cpl?.toFixed(0)}`} sub={`CPE ${fmtDollar(CBS_SPRING_GOOGLE.cpe)} vs $2,067 goal · CVR ${fmtPct(CBS_SPRING_GOOGLE.cvr ?? 0)}`} positive={(CBS_SPRING_GOOGLE.cpe ?? Infinity) <= 2067} />
          </>
        )}
      </div>

      {/* Wharton paid sections */}
      {showWharton && (
        <div className="space-y-6 mb-6">
          <ChannelByProgramChart rows={whartonChannelByProgram} />

          <WeeklyPaidChart
            title="Wharton — Weekly Paid Performance (all channels)"
            subtitle={`${PAID_COHORT_LABELS.wharton} · combined paid spend vs leads vs enrollments`}
            weeks={WHARTON_PAID_WEEKLY}
          />

          <PaidProgramTable
            title={`Wharton — All Paid Channels by Program (${PAID_COHORT_LABELS.wharton})`}
            subtitle="Combined paid performance vs forecast, per program"
            rows={WHARTON_PAID_OVERALL}
          />

          <PaidProgramTable
            title="Wharton — Google Ads by Program"
            subtitle={`Google is ${whartonGoogleShare.toFixed(0)}% of Wharton paid spend; the rest is the combined 'other paid' bucket`}
            rows={WHARTON_PAID_GOOGLE}
          />
        </div>
      )}

      {/* Columbia sections */}
      {showColumbia && (
        <div className="space-y-6">
          {/* Per-channel comparison — the cohort that has it */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChannelSpendChart
              title="Columbia — Spend & Results by Channel"
              subtitle={`${PAID_COHORT_LABELS.columbiaPrior} · ${fmtDollar(cbsTotalSpend)} across ${CBS_PAID_PLATFORMS.length} channels · ${fmt(cbsTotalEnrolls)} paid enrolls`}
              platforms={CBS_PAID_PLATFORMS}
            />
            <ChannelEfficiencyChart
              title="Columbia — CPL & CPE by Channel"
              subtitle={`${PAID_COHORT_LABELS.columbiaPrior} · cost per lead (left) vs cost per enrollment (right)`}
              platforms={CBS_PAID_PLATFORMS}
            />
          </div>

          <PlatformTable
            title={`Columbia — Channel Detail (${PAID_COHORT_LABELS.columbiaPrior})`}
            subtitle="Last cohort with multi-channel spend; Spring 2026 is Google-only so far"
            platforms={[...CBS_PAID_PLATFORMS, ...CBS_OTHER_PAID]}
          />

          {/* Current cohort — Google only so far */}
          <WeeklyPaidChart
            title={`Columbia — Weekly Google Performance (${PAID_COHORT_LABELS.columbia})`}
            subtitle={`Cohort runs 3/24 → 7/20 · Google-only so far · ${CBS_SPRING_GOOGLE.note}`}
            weeks={CBS_SPRING_WEEKLY}
          />
        </div>
      )}
    </div>
  );
}
