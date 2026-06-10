'use client';

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart,
} from 'recharts';
import {
  WHARTON_PAID_OVERALL, WHARTON_PAID_GOOGLE, WHARTON_PAID_WEEKLY,
  CBS_PAID_PLATFORMS, CBS_OTHER_PAID, CBS_PAID_WEEKLY, PAID_COHORT_LABELS,
  type PaidProgramRow, type PaidWeek,
} from '@/data/performance/paidChannels';
import {
  usePersistentSchoolFilter, PageHeader, SectionCard, KpiCard, ChartTooltip,
  CHART_COLORS, AXIS_PROPS, fmt, fmtDollar, fmtPct,
} from './shared';

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

function WeeklyPaidChart({ title, subtitle, weeks }: { title: string; subtitle?: string; weeks: PaidWeek[] }) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={weeks}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="week" {...AXIS_PROPS} interval={1} />
          <YAxis yAxisId="spend" {...AXIS_PROPS} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
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

export default function PaidChannelsDashboard() {
  const [school, setSchool] = usePersistentSchoolFilter();

  const whartonTotal = WHARTON_PAID_OVERALL.find(r => r.program === 'Total')!;
  const cbsSpend = CBS_PAID_PLATFORMS.reduce((a, p) => a + p.spend, 0);
  const cbsLeads = CBS_PAID_PLATFORMS.reduce((a, p) => a + (p.leads ?? 0), 0);
  const cbsEnrolls = CBS_PAID_PLATFORMS.reduce((a, p) => a + (p.enrolls ?? 0), 0);

  const showWharton = school !== 'columbia';
  const showColumbia = school !== 'wharton';

  const cbsPlatformChart = CBS_PAID_PLATFORMS.map(p => ({
    platform: p.platform,
    spend: p.spend,
    cpl: p.cpl,
    cpe: p.cpe,
  }));

  return (
    <div>
      <PageHeader
        title="Paid Channel Performance"
        subtitle="Platform-level paid media — Google, Meta, LinkedIn, Bing, and sponsored placements"
        school={school}
        onSchoolChange={setSchool}
      />

      {/* KPI row */}
      <div className="flex gap-4 flex-wrap mb-6">
        {showWharton && (
          <>
            <KpiCard label={`Wharton Paid Spend (${PAID_COHORT_LABELS.wharton})`} value={fmtDollar(whartonTotal.spend)} sub={`${fmt(whartonTotal.leads)} leads · ${fmt(whartonTotal.enrolls)} enrolls`} />
            <KpiCard label="Wharton Paid CPL / CPE" value={`$${whartonTotal.cpl?.toFixed(0)}`} sub={`CPE ${fmtDollar(whartonTotal.cpe)} · ROAS ${whartonTotal.roas?.toFixed(2)}x`} positive={(whartonTotal.roas ?? 0) >= 1.5} />
          </>
        )}
        {showColumbia && (
          <>
            <KpiCard label={`Columbia Paid Spend (${PAID_COHORT_LABELS.columbia})`} value={fmtDollar(cbsSpend)} sub={`${fmt(cbsLeads)} leads · ${fmt(cbsEnrolls)} enrolls`} />
            <KpiCard label="Columbia Blended Paid CPE" value={fmtDollar(cbsSpend / Math.max(cbsEnrolls, 1))} sub={`CPL $${(cbsSpend / Math.max(cbsLeads, 1)).toFixed(0)} blended`} />
          </>
        )}
      </div>

      {/* Columbia platform breakdown */}
      {showColumbia && (
        <div className="space-y-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Columbia — Spend by Platform" subtitle="Winter 2026 cohort · Google 70% · LinkedIn 21% · Meta 8% · Bing <1%">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={cbsPlatformChart} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="platform" {...AXIS_PROPS} />
                  <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => `$${v.toLocaleString()}`} />} />
                  <Bar dataKey="spend" name="Spend" fill={CHART_COLORS.violet} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            <WeeklyPaidChart
              title="Columbia — Weekly Google Performance"
              subtitle="Winter 2026 cohort · spend vs leads vs enrollments"
              weeks={CBS_PAID_WEEKLY}
            />
          </div>

          {/* Platform table */}
          <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white">Columbia — Platform Detail ({PAID_COHORT_LABELS.columbia})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Platform', 'Spend', 'Leads', 'Enrolls', 'CPL', 'CPE', 'CVR', 'Notes'].map((h, i) => (
                      <th key={h} className={`${i === 0 || i === 7 ? 'text-left px-5' : 'text-right px-4'} py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...CBS_PAID_PLATFORMS, ...CBS_OTHER_PAID].map((p, i) => (
                    <tr key={p.platform} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                      <td className="px-5 py-3 text-white font-medium whitespace-nowrap">{p.platform}</td>
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
        </div>
      )}

      {/* Wharton paid sections */}
      {showWharton && (
        <div className="space-y-6">
          <WeeklyPaidChart
            title="Wharton — Weekly Paid Performance"
            subtitle={`${PAID_COHORT_LABELS.wharton} · all paid platforms · spend vs leads vs enrollments`}
            weeks={WHARTON_PAID_WEEKLY}
          />

          <PaidProgramTable
            title={`Wharton — All Paid Channels by Program (${PAID_COHORT_LABELS.wharton})`}
            subtitle="Overall paid performance vs forecast, per program"
            rows={WHARTON_PAID_OVERALL}
          />

          <PaidProgramTable
            title="Wharton — Google Ads by Program"
            subtitle="Google is ~59% of Wharton paid spend. Meta/LinkedIn/Bing are not broken out per-platform in the Wharton cohort doc."
            rows={WHARTON_PAID_GOOGLE}
          />
        </div>
      )}
    </div>
  );
}
