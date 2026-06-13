'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, Info, Lightbulb } from 'lucide-react';
import type { School, SchoolFilter } from '@/data/performance/types';
import {
  CHANNEL_LABEL, PROGRAMS_BY_SCHOOL, MATRIX_CHANNELS,
  CHANNELS_BY_SCHOOL, WHARTON_PROGRAM_CHANNEL, WHARTON_WEEKLY, COLUMBIA_WEEKLY,
  COHORT_CONTEXT, MISSING_PLATFORM_METRICS, NET_REV,
  derive, sumCounts,
  type PaidChannel, type DerivedMetrics, type PaidWeekPoint,
} from '@/data/performance/paidOptimization';
import { COMBINED_EFFICIENCY } from '@/data/performance/historical';
import {
  usePersistentSchoolFilter, PageHeader, SectionCard, KpiCard, DataAsOf, ChartTooltip,
  CHART_COLORS, AXIS_PROPS, fmt, fmtDollar, fmtPct,
} from './shared';

const AS_OF = '2026-06-13';

const SCHOOL_LABEL: Record<School, string> = { wharton: 'Wharton', columbia: 'Columbia' };
const SCHOOLS: School[] = ['wharton', 'columbia'];

const CHANNEL_COLOR: Record<PaidChannel, string> = {
  google: CHART_COLORS.blue,
  meta: CHART_COLORS.violet,
  linkedin: CHART_COLORS.cyan,
  bing: CHART_COLORS.amber,
  affiliates: CHART_COLORS.gray,
};

const dollarsK = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v.toFixed(0)}`);
const dollars = (v: number) => `$${Math.round(v).toLocaleString()}`;

// CPL / CPE health vs goal — matches the cohort docs' tolerance bands.
function costColor(value: number | null, goal: number | null | undefined): string {
  if (value == null) return 'text-gray-500';
  if (goal == null) return 'text-gray-300';
  if (value <= goal * 1.25) return 'text-emerald-400';
  if (value <= goal * 2) return 'text-yellow-400';
  return 'text-red-400';
}
// Net-revenue ROAS: 1.0× = contribution breakeven.
function roasColor(v: number | null): string {
  if (v == null) return 'text-gray-300';
  if (v >= 1.25) return 'text-emerald-400';
  if (v >= 1) return 'text-yellow-400';
  return 'text-red-400';
}

/* ────────────────────────────────────────────────────────────────────────────
   Channel scorecard — the headline "what's working by channel" table
   ──────────────────────────────────────────────────────────────────────────── */
function ChannelScorecard({ school }: { school: School }) {
  const channels = CHANNELS_BY_SCHOOL[school];
  const total = derive(sumCounts(channels), school);
  const rows = channels
    .map(c => ({ channel: c.channel, m: derive(c, school) }))
    .sort((a, b) => b.m.spend - a.m.spend);

  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-white">{SCHOOL_LABEL[school]} — Channel Scorecard</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {COHORT_CONTEXT[school].cohort} · paid-attributed spend → leads → enrollments. CVR is lead→enroll.
          </p>
        </div>
        <span className="text-xs text-gray-500">{fmtDollar(total.spend)} total paid · {fmt(total.enrolls)} paid enrolls</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {['Channel', 'Spend', '% Spend', 'Leads', 'Enrolls', 'CPL', 'vs goal', 'CPE', 'CVR', 'ROAS'].map((h, i) => (
                <th key={h} className={`${i === 0 ? 'text-left px-5' : 'text-right px-4'} py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ channel, m }) => {
              const pctSpend = total.spend > 0 ? (m.spend / total.spend) * 100 : 0;
              return (
                <tr key={channel} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-5 py-3 text-white font-medium whitespace-nowrap">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: CHANNEL_COLOR[channel] }} />
                    {CHANNEL_LABEL[channel]}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-200">{fmtDollar(m.spend)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{pctSpend.toFixed(0)}%</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(m.leads)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(m.enrolls)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${costColor(m.cpl, m.cplGoal)}`}>{m.cpl != null ? `$${m.cpl.toFixed(0)}` : '—'}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">{m.cplGoal != null ? `$${m.cplGoal}` : '—'}</td>
                  <td className={`px-4 py-3 text-right font-medium ${costColor(m.cpe, m.cpeGoal)}`}>{m.cpe != null ? dollars(m.cpe) : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmtPct(m.cvr)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${roasColor(m.roas)}`}>{m.roas != null ? `${m.roas.toFixed(2)}x` : '—'}</td>
                </tr>
              );
            })}
            <tr className="bg-white/5 font-semibold">
              <td className="px-5 py-3 text-white">Total paid</td>
              <td className="px-4 py-3 text-right text-white">{fmtDollar(total.spend)}</td>
              <td className="px-4 py-3 text-right text-gray-500">100%</td>
              <td className="px-4 py-3 text-right text-gray-200">{fmt(total.leads)}</td>
              <td className="px-4 py-3 text-right text-gray-200">{fmt(total.enrolls)}</td>
              <td className="px-4 py-3 text-right text-gray-200">{total.cpl != null ? `$${total.cpl.toFixed(0)}` : '—'}</td>
              <td className="px-4 py-3" />
              <td className="px-4 py-3 text-right text-gray-200">{total.cpe != null ? dollars(total.cpe) : '—'}</td>
              <td className="px-4 py-3 text-right text-gray-200">{fmtPct(total.cvr)}</td>
              <td className={`px-4 py-3 text-right ${roasColor(total.roas)}`}>{total.roas != null ? `${total.roas.toFixed(2)}x` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Program × Channel efficiency matrix (Wharton) — spot the best/worst combos
   ──────────────────────────────────────────────────────────────────────────── */
type MatrixMetric = 'cpe' | 'cvr' | 'roas' | 'cpl' | 'spend';
const MATRIX_METRICS: { key: MatrixMetric; label: string; lowerBetter: boolean }[] = [
  { key: 'cpe', label: 'CPE', lowerBetter: true },
  { key: 'roas', label: 'ROAS', lowerBetter: false },
  { key: 'cvr', label: 'CVR', lowerBetter: false },
  { key: 'cpl', label: 'CPL', lowerBetter: true },
  { key: 'spend', label: 'Spend', lowerBetter: false },
];

function ProgramChannelMatrix() {
  const [metric, setMetric] = useState<MatrixMetric>('cpe');
  const programs = PROGRAMS_BY_SCHOOL.wharton;
  const cfg = MATRIX_METRICS.find(m => m.key === metric)!;

  // Build a program×channel grid of derived metrics.
  const grid = useMemo(() => {
    const map = new Map<string, DerivedMetrics>();
    for (const leaf of WHARTON_PROGRAM_CHANNEL) {
      map.set(`${leaf.program}|${leaf.channel}`, derive(leaf, 'wharton'));
    }
    return map;
  }, []);

  // Collect values for the selected metric to build a color scale (skip nulls/0-spend).
  const values: number[] = [];
  for (const p of programs) for (const c of MATRIX_CHANNELS) {
    const m = grid.get(`${p}|${c}`);
    const v = m ? (m[metric] as number | null) : null;
    if (v != null && !(metric !== 'spend' && m!.spend === 0)) values.push(v);
  }
  const min = Math.min(...values), max = Math.max(...values);

  // Map a value → background tint (emerald=good, red=bad) by metric direction.
  function cellStyle(v: number | null): React.CSSProperties {
    if (v == null || max === min) return {};
    const norm = (v - min) / (max - min);          // 0..1
    const good = cfg.lowerBetter ? 1 - norm : norm; // 1 = best
    const hue = 142 * good + 0 * (1 - good);        // 0=red, 142=emerald
    return { backgroundColor: `hsl(${hue}, 60%, ${18 + good * 6}%)` };
  }
  function fmtCell(m: DerivedMetrics | undefined): string {
    if (!m) return '—';
    const v = m[metric] as number | null;
    if (v == null) return '—';
    if (metric === 'spend') return fmtDollar(v);
    if (metric === 'cvr') return `${v.toFixed(1)}%`;
    if (metric === 'roas') return `${v.toFixed(2)}x`;
    return `$${Math.round(v).toLocaleString()}`;
  }

  return (
    <SectionCard
      title="Wharton — Program × Channel Efficiency"
      subtitle="Where each program's paid dollars work hardest. Greener = better. Spend is program-attributed (excludes ~$131K Google brand search)."
    >
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {MATRIX_METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              metric === m.key ? 'bg-white text-gray-900 border-white' : 'bg-transparent text-gray-400 border-white/15 hover:border-white/40 hover:text-gray-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Program</th>
              {MATRIX_CHANNELS.map(c => (
                <th key={c} className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: CHANNEL_COLOR[c] }} />
                  {CHANNEL_LABEL[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {programs.map(p => (
              <tr key={p}>
                <td className="px-3 py-2 text-white font-medium whitespace-nowrap">{p}</td>
                {MATRIX_CHANNELS.map(c => {
                  const m = grid.get(`${p}|${c}`);
                  const v = m ? (m[metric] as number | null) : null;
                  const showScale = !(metric !== 'spend' && (m?.spend ?? 0) === 0);
                  return (
                    <td key={c} className="px-3 py-2 text-right rounded-md text-gray-100 tabular-nums" style={showScale ? cellStyle(v) : {}}>
                      {fmtCell(m)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Weekly trend within the cohort — metric toggle, per-channel series
   ──────────────────────────────────────────────────────────────────────────── */
type WeeklyMetric = 'spend' | 'leads' | 'enrolls' | 'cpl';
const WEEKLY_METRICS: { key: WeeklyMetric; label: string }[] = [
  { key: 'spend', label: 'Spend' },
  { key: 'leads', label: 'Leads' },
  { key: 'enrolls', label: 'Enrollments' },
  { key: 'cpl', label: 'CPL' },
];

function weeklyValue(p: PaidWeekPoint, metric: WeeklyMetric): number | null {
  if (metric === 'cpl') return p.leads > 0 ? p.spend / p.leads : null;
  return p[metric];
}

function WeeklyTrend({ school }: { school: School }) {
  const [metric, setMetric] = useState<WeeklyMetric>('spend');

  // Per-channel series available for the school.
  const series: { channel: PaidChannel; data: PaidWeekPoint[] }[] =
    school === 'wharton'
      ? [
          { channel: 'google', data: WHARTON_WEEKLY.google },
          { channel: 'meta', data: WHARTON_WEEKLY.meta },
          { channel: 'linkedin', data: WHARTON_WEEKLY.linkedin },
        ]
      : [{ channel: 'google', data: COLUMBIA_WEEKLY.google }];

  // Weeks with any activity (drop trailing all-zero future weeks).
  const allWeeks = (school === 'wharton' ? WHARTON_WEEKLY.all : COLUMBIA_WEEKLY.all)
    .filter(w => w.spend > 0 || w.leads > 0 || w.enrolls > 0)
    .map(w => w.week);

  const chartData = allWeeks.map(week => {
    const row: Record<string, number | string | null> = { week };
    for (const s of series) {
      const pt = s.data.find(d => d.week === week);
      row[s.channel] = pt ? weeklyValue(pt, metric) : null;
    }
    return row;
  });

  const isCost = metric === 'cpl';
  const isBar = metric === 'spend';

  return (
    <SectionCard
      title={`${SCHOOL_LABEL[school]} — Weekly Trend (current cohort)`}
      subtitle={
        school === 'wharton'
          ? 'Google / Meta / LinkedIn by week · LinkedIn & Meta launched ~3/17'
          : 'Columbia is Google-led this cohort; combined paid shown where channels aren’t split weekly'
      }
    >
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {WEEKLY_METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              metric === m.key ? 'bg-white text-gray-900 border-white' : 'bg-transparent text-gray-400 border-white/15 hover:border-white/40 hover:text-gray-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="week" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} tickFormatter={isCost || isBar ? dollarsK : (v: number) => `${v}`} />
          <Tooltip content={<ChartTooltip valueFormatter={isCost || isBar ? dollars : (v: number) => v.toLocaleString()} />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map(s =>
            isBar ? (
              <Bar key={s.channel} dataKey={s.channel} name={CHANNEL_LABEL[s.channel]} stackId="spend" fill={CHANNEL_COLOR[s.channel]} fillOpacity={0.8} />
            ) : (
              <Line key={s.channel} dataKey={s.channel} name={CHANNEL_LABEL[s.channel]} type="monotone" stroke={CHANNEL_COLOR[s.channel]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   By-cohort efficiency history (blended Wharton + Columbia)
   ──────────────────────────────────────────────────────────────────────────── */
function CohortHistory() {
  const data = COMBINED_EFFICIENCY.map(c => ({
    cohort: c.cohort, cpl: c.cpl, cpe: c.cpe, leadCvr: c.leadCvr,
  }));
  return (
    <SectionCard
      title="Cost Efficiency by Cohort (blended Wharton + Columbia)"
      subtitle="The longer-run trend behind the current cohort. CPE (bars, left) and CPL (line, left) in $; lead→enroll CVR (line, right). Source: historical performance sheet."
    >
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="cohort" {...AXIS_PROPS} />
          <YAxis yAxisId="cost" {...AXIS_PROPS} tickFormatter={dollarsK} />
          <YAxis yAxisId="pct" orientation="right" {...AXIS_PROPS} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="cost" dataKey="cpe" name="CPE ($)" fill={CHART_COLORS.orange} fillOpacity={0.55} radius={[3, 3, 0, 0]} />
          <Line yAxisId="cost" dataKey="cpl" name="CPL ($)" type="monotone" stroke={CHART_COLORS.blue} strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="pct" dataKey="leadCvr" name="Lead→Enroll CVR (%)" type="monotone" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Optimization signals — auto-generated "where to put time & dollars"
   ──────────────────────────────────────────────────────────────────────────── */
type Severity = 'critical' | 'warning' | 'positive';
interface Signal { severity: Severity; title: string; detail: string }

function buildSignals(school: School): Signal[] {
  const channels = CHANNELS_BY_SCHOOL[school].map(c => ({ channel: c.channel, m: derive(c, school) }));
  const withEnrolls = channels.filter(c => c.m.enrolls > 0);
  const signals: Signal[] = [];

  // Best managed ad channel (positive). Restrict to Google/Meta/LinkedIn/Bing
  // (exclude affiliates — a different motion) and require meaningful volume so a
  // low-sample channel can't be crowned "best" off a handful of enrollments.
  const paidEnrollsTotal = withEnrolls.reduce((s, c) => s + c.m.enrolls, 0);
  const minVol = Math.max(5, paidEnrollsTotal * 0.12);
  const adChannels = withEnrolls.filter(c => c.channel !== 'affiliates' && c.m.enrolls >= minVol);
  const bestRoas = [...adChannels].sort((a, b) => (b.m.roas ?? 0) - (a.m.roas ?? 0))[0];
  if (bestRoas) {
    signals.push({
      severity: 'positive',
      title: `${CHANNEL_LABEL[bestRoas.channel]} is ${SCHOOL_LABEL[school]}'s most efficient ad channel`,
      detail: `${bestRoas.m.roas?.toFixed(2)}x ROAS at ${fmtDollar(bestRoas.m.cpe)} CPE (${fmtPct(bestRoas.m.cvr)} lead→enroll, ${fmt(bestRoas.m.enrolls)} enrolls on ${fmtDollar(bestRoas.m.spend)}). Protect and scale budget here before chasing the weaker channels.`,
    });
  }

  // Cheap leads / low CVR → lead-quality or landing-page problem
  const channelsSorted = [...channels].sort((a, b) => (a.m.cpl ?? 9e9) - (b.m.cpl ?? 9e9));
  const cheapest = channelsSorted[0];
  const avgCvr = withEnrolls.length ? withEnrolls.reduce((s, c) => s + (c.m.cvr ?? 0), 0) / withEnrolls.length : 0;
  if (cheapest && cheapest.m.cvr != null && cheapest.m.cvr < avgCvr * 0.6 && cheapest.m.leads > 50) {
    signals.push({
      severity: 'warning',
      title: `${CHANNEL_LABEL[cheapest.channel]} buys cheap leads that don't convert`,
      detail: `Lowest CPL ($${cheapest.m.cpl?.toFixed(0)}) but ${fmtPct(cheapest.m.cvr)} lead→enroll — well below the ${fmtPct(avgCvr)} channel average. Its CPE is ${cheapest.m.cpe != null ? fmtDollar(cheapest.m.cpe) : 'n/a'}. This is a lead-quality / landing-fit problem, not a volume win — tighten targeting or qualification before adding spend.`,
    });
  }

  // CPL running well over goal (the biggest efficiency gap)
  const overGoal = channels
    .filter(c => c.m.cpl != null && c.m.cplGoal != null && c.m.cpl > c.m.cplGoal * 1.5)
    .sort((a, b) => (b.m.cpl! / b.m.cplGoal!) - (a.m.cpl! / a.m.cplGoal!))[0];
  if (overGoal) {
    const x = (overGoal.m.cpl! / overGoal.m.cplGoal!).toFixed(1);
    signals.push({
      severity: 'warning',
      title: `${CHANNEL_LABEL[overGoal.channel]} CPL is ${x}× its goal`,
      detail: `$${overGoal.m.cpl?.toFixed(0)} actual vs $${overGoal.m.cplGoal} target — the largest cost gap. ${overGoal.channel === 'google' ? 'Auction/Quality-Score pressure: prioritize landing-page relevance, search-term pruning, and bid discipline.' : 'Refresh creative and audiences to bring CPL back toward goal.'}`,
    });
  }

  // Programs below 1.0x ROAS (Wharton only — multi-program)
  if (school === 'wharton') {
    const progTotals = PROGRAMS_BY_SCHOOL.wharton.map(p => {
      const leaves = WHARTON_PROGRAM_CHANNEL.filter(l => l.program === p);
      return { program: p, m: derive(sumCounts(leaves), 'wharton') };
    });
    const underwater = progTotals.filter(p => p.m.roas != null && p.m.roas < 1).sort((a, b) => (a.m.roas ?? 0) - (b.m.roas ?? 0));
    if (underwater.length) {
      signals.push({
        severity: 'critical',
        title: `${underwater.map(u => u.program).join(' & ')} ${underwater.length > 1 ? 'are' : 'is'} below 1.0× ROAS across all paid`,
        detail: `${underwater.map(u => `${u.program} ${u.m.roas?.toFixed(2)}x (${fmtDollar(u.m.cpe)} CPE)`).join(', ')}. On net revenue, every paid dollar returns less than $1 — below contribution breakeven. These are the programs to fix (creative, landing, targeting) or pull spend from, not to scale.`,
      });
    }
  }

  // Biggest spend concentration
  const total = derive(sumCounts(CHANNELS_BY_SCHOOL[school]), school);
  const top = [...channels].sort((a, b) => b.m.spend - a.m.spend)[0];
  if (top && total.spend > 0) {
    const share = (top.m.spend / total.spend) * 100;
    if (share > 55) {
      signals.push({
        severity: 'positive',
        title: `${share.toFixed(0)}% of ${SCHOOL_LABEL[school]} paid spend is on ${CHANNEL_LABEL[top.channel]}`,
        detail: `${fmtDollar(top.m.spend)} of ${fmtDollar(total.spend)}. Concentration is fine while ${CHANNEL_LABEL[top.channel]} performs, but it's also the single biggest lever — small CPE moves here outweigh anything on the smaller channels.`,
      });
    }
  }

  return signals;
}

const SEV_STYLE: Record<Severity, { ring: string; icon: React.ReactNode; chip: string }> = {
  critical: { ring: 'border-red-500/30 bg-red-500/[0.06]', icon: <AlertTriangle size={15} className="text-red-400" />, chip: 'text-red-400' },
  warning: { ring: 'border-amber-500/30 bg-amber-500/[0.06]', icon: <TrendingDown size={15} className="text-amber-400" />, chip: 'text-amber-400' },
  positive: { ring: 'border-emerald-500/30 bg-emerald-500/[0.06]', icon: <TrendingUp size={15} className="text-emerald-400" />, chip: 'text-emerald-400' },
};
const SEV_ORDER: Record<Severity, number> = { critical: 0, warning: 1, positive: 2 };

function OptimizationSignals({ schools }: { schools: School[] }) {
  const signals = schools
    .flatMap(s => buildSignals(s).map(sig => ({ ...sig, school: s })))
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
        <Lightbulb size={16} className="text-amber-300" />
        <div>
          <h2 className="text-sm font-semibold text-white">Where to put time & dollars</h2>
          <p className="text-xs text-gray-500 mt-0.5">Auto-derived from the current-cohort channel data — recomputes as the numbers refresh.</p>
        </div>
      </div>
      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {signals.map((s, i) => {
          const st = SEV_STYLE[s.severity];
          return (
            <div key={i} className={`rounded-lg border p-4 ${st.ring}`}>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5">{st.icon}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${st.chip}`}>{s.severity}</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">{SCHOOL_LABEL[s.school]}</span>
                  </div>
                  <p className="text-sm font-semibold text-white leading-snug">{s.title}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{s.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The funnel gap — what the sheets track vs. what lives in the ad consoles
   ──────────────────────────────────────────────────────────────────────────── */
function FunnelCoverage() {
  const stages = [
    { label: 'Impressions', metric: 'CPM', tracked: false },
    { label: 'Clicks', metric: 'CTR · CPC', tracked: false },
    { label: 'Leads', metric: 'CPL', tracked: true },
    { label: 'Enrollments', metric: 'CPE · CVR · ROAS', tracked: true },
  ];
  return (
    <SectionCard
      title="Funnel coverage — and the one gap"
      subtitle="What the Wharton & Columbia performance dashboards track, stage by stage."
    >
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 shrink-0">
            <div className={`rounded-lg border px-4 py-3 min-w-[140px] ${s.tracked ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-red-500/30 bg-red-500/[0.06]'}`}>
              <p className="text-sm font-semibold text-white">{s.label}</p>
              <p className={`text-xs mt-0.5 font-medium ${s.tracked ? 'text-emerald-300' : 'text-red-300'}`}>{s.metric}</p>
              <p className={`text-[10px] mt-1.5 uppercase tracking-wide ${s.tracked ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                {s.tracked ? 'In the sheets' : 'Not tracked'}
              </p>
            </div>
            {i < stages.length - 1 && <span className="text-gray-600 text-lg">→</span>}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-white/10 bg-[#0d1117] px-4 py-3">
        <Info size={15} className="text-blue-300 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-400 leading-relaxed">
          <span className="font-semibold text-gray-200">{MISSING_PLATFORM_METRICS.join(', ')} aren’t in any WSP sheet.</span>{' '}
          The performance dashboards start at <span className="text-gray-300">spend</span> and measure <span className="text-gray-300">cost-per-lead</span> down. To diagnose <em>why</em> CPL moves — rising CPM (auction/audience), falling CTR (creative fatigue), or weak click→lead conversion (landing page) — pull impressions/clicks/CPM/CTR/CPC from <span className="text-gray-300">Google Ads, Meta Ads Manager, and LinkedIn Campaign Manager</span>. Wire those in and this view becomes the full 5-metric chain (Spend → CPM → CTR → CVR → CPL → CPE).
        </p>
      </div>
    </SectionCard>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────────────────────── */
export default function PaidOptimizationDashboard() {
  const [school, setSchool] = usePersistentSchoolFilter();
  const activeSchools: School[] = school === 'all' ? SCHOOLS : [school as School];

  // Scope KPIs to the active school(s).
  const scopeChannels = activeSchools.flatMap(s => CHANNELS_BY_SCHOOL[s]);
  const scopeTotal = derive(sumCounts(scopeChannels), activeSchools[0]);
  const scopeContext = activeSchools.map(s => COHORT_CONTEXT[s]);
  const totalCohortEnrolls = scopeContext.reduce((a, c) => a + c.enrollsRealTime, 0);
  const totalCohortGoal = scopeContext.reduce((a, c) => a + c.enrollsGoal, 0);
  const blendedCpe = totalCohortEnrolls > 0 ? scopeTotal.spend / totalCohortEnrolls : null;
  // ROAS weighted by each school's net revenue (correct when scope = both).
  const scopeNetRev = activeSchools.reduce(
    (a, s) => a + sumCounts(CHANNELS_BY_SCHOOL[s]).enrolls * NET_REV[s], 0,
  );
  const scopeRoas = scopeTotal.spend > 0 ? scopeNetRev / scopeTotal.spend : null;

  return (
    <div>
      <PageHeader
        title="Paid Optimization"
        subtitle="One view of paid channel performance — by university, program, and channel (Google · Meta · LinkedIn · Bing). Current cohort: Spring 2026."
        school={school as SchoolFilter}
        onSchoolChange={setSchool}
        right={<DataAsOf asOf={AS_OF} live={false} />}
      />

      {/* Source / coverage banner */}
      <div className="mb-6 rounded-xl border border-white/10 bg-[#161b22] px-5 py-3 text-xs text-gray-400 leading-relaxed">
        <span className="font-semibold text-gray-300">Source of truth:</span> synced from the live{' '}
        <span className="text-gray-300">Wharton</span> & <span className="text-gray-300">Columbia</span> performance dashboards (the same sheets the paid team maintains).{' '}
        Metrics are <span className="text-gray-300">paid-attributed</span> (platform spend → leads → enrollments); CVR is lead→enroll; ROAS is on <span className="text-gray-300">net revenue/enroll</span> (≈$2.8K Wharton / $3.0K Columbia), so <span className="text-gray-300">1.0× = contribution breakeven</span>.{' '}
        <span className="text-gray-400">Both cohorts are in progress — enrollments lag spend, so CPE/ROAS improve toward each deadline (Wharton ~done; Columbia has ~37 days left).</span>{' '}
        <span className="text-amber-300/90">CPM / CTR / CPC live only in the ad-platform consoles — see “Funnel coverage” below.</span>
      </div>

      {/* KPI row */}
      <div className="flex gap-4 flex-wrap mb-6">
        <KpiCard
          label={`Paid Spend${school === 'all' ? ' (both)' : ` · ${SCHOOL_LABEL[activeSchools[0]]}`}`}
          value={fmtDollar(scopeTotal.spend)}
          sub={`${fmt(scopeTotal.leads)} leads · ${fmt(scopeTotal.enrolls)} paid enrolls`}
        />
        <KpiCard
          label="Blended Paid CPE"
          value={blendedCpe != null ? dollars(blendedCpe) : '—'}
          sub={`Paid spend ÷ all ${fmt(totalCohortEnrolls)} cohort enrolls (of ${fmt(totalCohortGoal)} goal)`}
        />
        <KpiCard
          label="Paid-Attributed CPE"
          value={scopeTotal.cpe != null ? dollars(scopeTotal.cpe) : '—'}
          sub={`Spend ÷ ${fmt(scopeTotal.enrolls)} paid-attributed enrolls · CPL $${scopeTotal.cpl?.toFixed(0)}`}
        />
        <KpiCard
          label="Paid Lead→Enroll CVR"
          value={fmtPct(scopeTotal.cvr)}
          sub={`Blended across channels · ROAS ${scopeRoas != null ? `${scopeRoas.toFixed(2)}x` : '—'} (net rev)`}
          positive={(scopeRoas ?? 0) >= 1}
        />
      </div>

      {/* Optimization signals — lead with the "so what" */}
      <div className="mb-6">
        <OptimizationSignals schools={activeSchools} />
      </div>

      {/* Channel scorecards */}
      <div className="space-y-6 mb-6">
        {activeSchools.map(s => (
          <ChannelScorecard key={s} school={s} />
        ))}
      </div>

      {/* Program × channel matrix — Wharton (multi-program) */}
      {activeSchools.includes('wharton') && (
        <div className="mb-6">
          <ProgramChannelMatrix />
        </div>
      )}

      {/* Weekly trend within cohort */}
      <div className="space-y-6 mb-6">
        {activeSchools.map(s => (
          <WeeklyTrend key={s} school={s} />
        ))}
      </div>

      {/* By-cohort efficiency + funnel coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <CohortHistory />
        <FunnelCoverage />
      </div>
    </div>
  );
}
