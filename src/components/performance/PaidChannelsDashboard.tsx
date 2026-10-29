'use client';

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import type { School } from '@/data/performance/types';
import {
  CHANNEL_LABEL, PROGRAMS_BY_SCHOOL, MATRIX_CHANNELS, STATIC_PAID_DATA,
  derive, sumCounts,
  type PaidChannel, type PaidData, type PaidWeekPoint, type RawCounts,
  type ChannelTotal, type ProgramChannelLeaf, type DerivedMetrics,
} from '@/data/performance/paidOptimization';
import { CBS_PAID_PLATFORMS, CBS_OTHER_PAID, CBS_PRIOR_COHORT, type PaidPlatform } from '@/data/performance/paidChannels';
import { SCHOOL_LABEL, CHANNEL_COLOR, cohortTag, partCohort, SourceNotice } from './paidSource';
import {
  usePersistentSchoolFilter, PageHeader, SectionCard, KpiCard, DataAsOf, ChartTooltip,
  CHART_COLORS, AXIS_PROPS, fmt, fmtDollar, fmtPct,
} from './shared';

// Every figure on this page comes from the PaidData bundle the page is given —
// the same read as Paid Optimization — and is printed under the cohort tag of
// the part it came from (channel totals, weekly series and Wharton's program
// leaves can each be live or the snapshot on their own). The one exception is
// the Columbia Winter 2026 prior-cohort table at the bottom, static and
// labelled as a closed cohort.

const SCHOOLS: School[] = ['wharton', 'columbia'];

const dollarsK = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v.toFixed(0)}`);
const dollars = (v: number) => `$${Math.round(v).toLocaleString()}`;

// CPL-vs-goal and net-revenue ROAS bands — the same as Paid Optimization.
function cplColor(cpl: number | null, goal: number | null | undefined): string {
  if (cpl == null) return 'text-gray-500';
  if (goal == null) return 'text-gray-300';
  if (cpl <= goal * 1.25) return 'text-emerald-400';
  if (cpl <= goal * 2) return 'text-yellow-400';
  return 'text-red-400';
}
function roasColor(v: number | null | undefined): string {
  if (v == null) return 'text-gray-300';
  if (v >= 1.25) return 'text-emerald-400';
  if (v >= 1) return 'text-yellow-400';
  return 'text-red-400';
}

/** Colour for a platform row by its display name; the prior-cohort table also
 *  lists lines that are not PaidChannels (affiliates, sponsored content). */
function platformColor(platform: string): string {
  const key = (Object.keys(CHANNEL_LABEL) as PaidChannel[]).find(c => CHANNEL_LABEL[c] === platform);
  return key ? CHANNEL_COLOR[key] : CHART_COLORS.gray;
}

/** A school's channel totals as platform rows, spend-desc, with CPL / CPE /
 *  CVR / ROAS derived. ROAS is on net revenue per enrollment (NET_REV), the
 *  basis every ROAS on the paid pages uses: 1.0× = contribution breakeven. */
function platformRows(channels: ChannelTotal[], school: School): PaidPlatform[] {
  return [...channels]
    .sort((a, b) => b.spend - a.spend)
    .map(c => {
      const m = derive(c, school);
      const goals = [
        c.cplGoal != null ? `CPL goal $${c.cplGoal}` : null,
        c.cpeGoal != null ? `CPE goal ${dollars(c.cpeGoal)}` : null,
      ].filter(Boolean);
      return {
        platform: CHANNEL_LABEL[c.channel],
        spend: m.spend, leads: m.leads, enrolls: m.enrolls,
        cpl: m.cpl, cpe: m.cpe, cvr: m.cvr, roas: m.roas ?? undefined,
        note: goals.length ? goals.join(' · ') : undefined,
      };
    });
}

/** Weeks with any activity — the live series run through the cohort's last
 *  planned week, so future weeks arrive as zeros. */
const activeWeeks = (weeks: PaidWeekPoint[]) => weeks.filter(w => w.spend > 0 || w.leads > 0 || w.enrolls > 0);

/* ── Weekly spend/leads/enrolls chart ──────────────────────────────── */
function WeeklyPaidChart({ title, subtitle, weeks }: { title: string; subtitle?: string; weeks: PaidWeekPoint[] }) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      {weeks.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">No weekly paid activity recorded yet.</p>
      ) : (
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
      )}
    </SectionCard>
  );
}

/* ── Spend & enrollments by channel ────────────────────────────────── */
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
              <Cell key={p.platform} fill={platformColor(p.platform)} />
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

/* ── Platform detail table ─────────────────────────────────────────── */
function PlatformTable({ title, subtitle, platforms }: { title: string; subtitle?: string; platforms: PaidPlatform[] }) {
  const headers = ['Channel', 'Spend', 'Leads', 'Enrolls', 'CPL', 'CPE', 'CVR', 'ROAS', 'Notes'];
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
              {headers.map((h, i) => (
                <th key={h} className={`${i === 0 || i === headers.length - 1 ? 'text-left px-5' : 'text-right px-4'} py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platforms.map((p, i) => (
              <tr key={p.platform} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                <td className="px-5 py-3 text-white font-medium whitespace-nowrap">
                  <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: platformColor(p.platform) }} />
                  {p.platform}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{fmtDollar(p.spend)}</td>
                <td className="px-4 py-3 text-right text-gray-300">{p.leads != null ? fmt(p.leads) : '—'}</td>
                <td className="px-4 py-3 text-right text-gray-300">{p.enrolls != null ? fmt(p.enrolls) : '—'}</td>
                <td className="px-4 py-3 text-right text-gray-300">{p.cpl != null ? `$${p.cpl.toFixed(0)}` : '—'}</td>
                <td className="px-4 py-3 text-right text-gray-300">{p.cpe != null ? dollars(p.cpe) : '—'}</td>
                <td className="px-4 py-3 text-right text-gray-300">{p.cvr != null ? fmtPct(p.cvr) : '—'}</td>
                <td className={`px-4 py-3 text-right font-medium ${roasColor(p.roas)}`}>{p.roas != null ? `${p.roas.toFixed(2)}x` : '—'}</td>
                <td className="px-5 py-3 text-left text-xs text-gray-500 max-w-xs">{p.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Program tables (Wharton) ──────────────────────────────────────── */
interface ProgramRow { program: string; m: DerivedMetrics; isTotal: boolean }

/** The channels that have program rows, in display order — the snapshot has
 *  Google / Meta / LinkedIn; a live doc adds Bing when its rows reconcile. */
function leafChannels(leaves: ProgramChannelLeaf[]): PaidChannel[] {
  return ([...MATRIX_CHANNELS, 'bing'] as PaidChannel[]).filter(c => leaves.some(l => l.channel === c));
}

/** Per-program rows for one channel (or every channel that has program rows)
 *  from the program × channel leaves, with a Total row from the channel totals
 *  those leaves reconcile to — only the channels represented, so a channel
 *  without program rows (Bing, in the snapshot) is left out of the Total rather
 *  than counted as untagged spend. Leads and enrollments are fully
 *  program-attributed; spend is program-attributed only, so the program rows'
 *  spend sums to LESS than the Total (Google brand/generic search is not tagged
 *  to a program). */
function programRows(leaves: ProgramChannelLeaf[], channels: ChannelTotal[], channel: PaidChannel | 'all'): ProgramRow[] {
  const covered = channel === 'all' ? leafChannels(leaves) : [channel];
  const pick = leaves.filter(l => covered.includes(l.channel));
  const rows: ProgramRow[] = PROGRAMS_BY_SCHOOL.wharton.map(program => {
    const ls = pick.filter(l => l.program === program);
    const cplGoal = channel === 'all' ? null : (ls[0]?.cplGoal ?? null);
    return { program, m: derive({ ...sumCounts(ls), cplGoal }, 'wharton'), isTotal: false };
  });
  // A single channel's Total keeps its goals; a multi-channel Total has none.
  const total: RawCounts = channel === 'all'
    ? sumCounts(channels.filter(c => covered.includes(c.channel)))
    : (channels.find(c => c.channel === channel) ?? { spend: 0, leads: 0, enrolls: 0 });
  const label = channel === 'all' ? `Total (${covered.map(c => CHANNEL_LABEL[c]).join(' + ')})` : 'Total';
  rows.push({ program: label, m: derive(total, 'wharton'), isTotal: true });
  return rows;
}

function PaidProgramTable({ title, subtitle, rows, showGoal }: { title: string; subtitle?: string; rows: ProgramRow[]; showGoal: boolean }) {
  const headers = ['Program', 'Spend', 'Leads', 'Enrolls', 'CPL', ...(showGoal ? ['CPL Goal'] : []), 'CPE', 'CVR', 'ROAS'];
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
              {headers.map((h, i) => (
                <th key={h} className={`${i === 0 ? 'text-left px-5' : 'text-right px-4'} py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ program, m, isTotal }, i) => (
              <tr key={program} className={`border-b border-white/5 ${isTotal ? 'bg-white/5 font-medium' : i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                <td className="px-5 py-3 text-white whitespace-nowrap">{program}</td>
                <td className="px-4 py-3 text-right text-gray-300">{fmtDollar(m.spend)}</td>
                <td className="px-4 py-3 text-right text-gray-300">{fmt(m.leads)}</td>
                <td className="px-4 py-3 text-right text-gray-300">{fmt(m.enrolls)}</td>
                <td className={`px-4 py-3 text-right font-medium ${cplColor(m.cpl, m.cplGoal)}`}>{m.cpl != null ? `$${m.cpl.toFixed(0)}` : '—'}</td>
                {showGoal && <td className="px-4 py-3 text-right text-gray-500">{m.cplGoal != null ? `$${m.cplGoal}` : '—'}</td>}
                <td className="px-4 py-3 text-right text-gray-300">{m.cpe != null ? dollars(m.cpe) : '—'}</td>
                <td className="px-4 py-3 text-right text-gray-300">{fmtPct(m.cvr)}</td>
                <td className={`px-4 py-3 text-right font-medium ${roasColor(m.roas)}`}>{m.roas != null ? `${m.roas.toFixed(2)}x` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Paid spend by program, stacked by channel (Wharton) ───────────── */
function ProgramChannelSpendChart({ title, subtitle, leaves }: { title: string; subtitle: string; leaves: ProgramChannelLeaf[] }) {
  const present = leafChannels(leaves);
  const rows = PROGRAMS_BY_SCHOOL.wharton.map(program => {
    const row: Record<string, string | number> = { program };
    for (const c of present) {
      row[c] = leaves.filter(l => l.program === program && l.channel === c).reduce((a, l) => a + l.spend, 0);
    }
    return row;
  });
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={rows} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="program" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} tickFormatter={dollarsK} />
          <Tooltip content={<ChartTooltip valueFormatter={dollars} />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {present.map((c, i) => (
            <Bar key={c} dataKey={c} name={CHANNEL_LABEL[c]} stackId="s" fill={CHANNEL_COLOR[c]} radius={i === present.length - 1 ? [4, 4, 0, 0] : undefined} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

/* ── Per-school KPI cards ──────────────────────────────────────────── */
function SchoolKpis({ school, data }: { school: School; data: PaidData }) {
  const src = data.sources[school];
  const channels = data.channelsBySchool[school];
  const total = derive(sumCounts(channels), school);
  const google = channels.find(c => c.channel === 'google');
  const googleShare = total.spend > 0 && google ? (google.spend / total.spend) * 100 : null;
  const others = [...channels]
    .filter(c => c.channel !== 'google')
    .sort((a, b) => b.spend - a.spend)
    .map(c => `${CHANNEL_LABEL[c.channel]} ${fmtDollar(c.spend)}`)
    .join(' · ');
  const name = SCHOOL_LABEL[school];
  return (
    <div className="flex gap-4 flex-wrap">
      <KpiCard
        label={`${name} Paid Spend (${cohortTag(src)})`}
        value={fmtDollar(total.spend)}
        sub={`${fmt(total.leads)} leads · ${fmt(total.enrolls)} paid enrolls · ${channels.length} channels`}
      />
      <KpiCard
        label={`${name} Channel Split (${cohortTag(src)})`}
        value={googleShare != null ? `${googleShare.toFixed(0)}% Google` : '—'}
        sub={google ? `Google ${fmtDollar(google.spend)}${others ? ` · ${others}` : ''}` : 'No Google table in the source'}
      />
      <KpiCard
        label={`${name} Paid CPL / CPE (${cohortTag(src)})`}
        value={total.cpl != null ? `$${total.cpl.toFixed(0)}` : '—'}
        sub={`CPE ${total.cpe != null ? dollars(total.cpe) : '—'} · CVR ${fmtPct(total.cvr)} · ROAS ${total.roas != null ? `${total.roas.toFixed(2)}x` : '—'} (net rev)`}
        positive={total.roas == null ? undefined : total.roas >= 1}
      />
    </div>
  );
}

/* ── Per-school sections ───────────────────────────────────────────── */
function SchoolSection({ school, data }: { school: School; data: PaidData }) {
  const src = data.sources[school];
  const name = SCHOOL_LABEL[school];
  const tag = cohortTag(src);
  const rows = platformRows(data.channelsBySchool[school], school);
  const totalSpend = rows.reduce((a, r) => a + r.spend, 0);
  const totalEnrolls = rows.reduce((a, r) => a + (r.enrolls ?? 0), 0);
  const channelBasis = src.state === 'live'
    ? `Cohort-to-date, read from the ${src.cohort} cohort doc's platform tables`
    : `${src.cohort} snapshot (curated ${STATIC_PAID_DATA.asOf}) — not the current cohort`;

  // The weekly series describe the live cohort only when they were read from
  // its doc and reconciled; otherwise they are the snapshot's cohort.
  const weekly = partCohort(src, src.weeklyLive, school);
  const weeks = activeWeeks(data.weekly[school].all);

  // Wharton's program leaves and the channel totals they reconcile to come from
  // the same source — both the live doc, or both the snapshot — never mixed.
  const programs = partCohort(src, src.programsLive, 'wharton');
  const programChannels = src.programsLive ? data.channelsBySchool.wharton : STATIC_PAID_DATA.channelsBySchool.wharton;
  const leaves = data.whartonProgramChannel;
  // Channel spend not tagged to a program, over the channels that have program rows.
  const covered = leafChannels(leaves);
  const untagged = Math.max(0, sumCounts(programChannels.filter(c => covered.includes(c.channel))).spend - leaves.reduce((a, l) => a + l.spend, 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChannelSpendChart
          title={`${name} — Spend & Results by Channel (${tag})`}
          subtitle={`${fmtDollar(totalSpend)} across ${rows.length} channels · ${fmt(totalEnrolls)} paid enrolls`}
          platforms={rows}
        />
        <ChannelEfficiencyChart
          title={`${name} — CPL & CPE by Channel (${tag})`}
          subtitle="Cost per lead (left) vs cost per enrollment (right)"
          platforms={rows}
        />
      </div>

      <PlatformTable
        title={`${name} — Channel Detail (${tag})`}
        subtitle={`${channelBasis} · CVR is lead→enroll · ROAS on net revenue/enroll (1.0× = contribution breakeven)`}
        platforms={rows}
      />

      {school === 'wharton' && (
        <>
          <ProgramChannelSpendChart
            title={`Wharton — Paid Spend by Program & Channel (${programs.tag})`}
            subtitle={`Program-attributed spend per channel${untagged > 0 ? ` · ${fmtDollar(untagged)} of channel spend is not tagged to a program (Google brand/generic search) and is not in the stacks` : ''}`}
            leaves={leaves}
          />
          <PaidProgramTable
            title={`Wharton — All Paid Channels by Program (${programs.tag})`}
            subtitle="Channels with program rows only. Leads and enrollments are fully program-attributed; program spend sums to less than the Total (untagged Google brand/generic search sits in the Total only)"
            rows={programRows(leaves, programChannels, 'all')}
            showGoal={false}
          />
          <PaidProgramTable
            title={`Wharton — Google Ads by Program (${programs.tag})`}
            subtitle="Google program rows against the Google channel total and the doc's per-program CPL goals"
            rows={programRows(leaves, programChannels, 'google')}
            showGoal
          />
        </>
      )}

      <WeeklyPaidChart
        title={`${name} — Weekly Paid Performance, all channels (${weekly.tag})`}
        subtitle={
          src.weeklyLive
            ? `Per-platform “Overall Performance by Week” tables from the ${weekly.cohort} cohort doc, summed per week (each platform's weeks sum to its channel total) · the latest week is partial`
            : `From the ${weekly.cohort} snapshot (curated ${STATIC_PAID_DATA.asOf}) — not the current cohort${src.state === 'live' ? `; the ${src.cohort} doc's weekly tables did not parse or reconcile` : ''}`
        }
        weeks={weeks}
      />
    </div>
  );
}

/* ── Columbia prior cohort (static, closed) ────────────────────────── */
function PriorCohortTable() {
  const spend = CBS_PAID_PLATFORMS.reduce((a, p) => a + p.spend, 0);
  const enrolls = CBS_PAID_PLATFORMS.reduce((a, p) => a + (p.enrolls ?? 0), 0);
  return (
    <PlatformTable
      title={`Columbia — Prior Cohort Channel Detail (${CBS_PRIOR_COHORT.cohort}, closed)`}
      subtitle={`Closed cohort, curated ${CBS_PRIOR_COHORT.asOf} — kept for comparison with the current cohort above · ${fmtDollar(spend)} across ${CBS_PAID_PLATFORMS.length} ad platforms · ${fmt(enrolls)} paid enrolls · ROAS not recorded per platform`}
      platforms={[...CBS_PAID_PLATFORMS, ...CBS_OTHER_PAID]}
    />
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function PaidChannelsDashboard({ data }: { data: PaidData }) {
  const [school, setSchool] = usePersistentSchoolFilter();
  const activeSchools: School[] = school === 'all' ? SCHOOLS : [school];

  return (
    <div>
      <PageHeader
        title="Paid Channel Performance"
        subtitle={`Platform-level paid media — by channel, by week and (Wharton) by program. Showing: ${SCHOOLS.map(s => `${SCHOOL_LABEL[s]} ${cohortTag(data.sources[s])}`).join(' · ')}.`}
        school={school}
        onSchoolChange={setSchool}
        right={<DataAsOf asOf={data.asOf} live={data.live} />}
      />

      {/* Source / coverage note */}
      <div className="mb-6 rounded-xl border border-white/10 bg-[#161b22] px-5 py-3 text-xs text-gray-400 leading-relaxed">
        <span className="font-semibold text-gray-300">Source:</span> the same paid layer as Paid Optimization — each school&rsquo;s
        active cohort doc (the &ldquo;Paid WoW Performance &amp; Goals&rdquo; platform tables), read daily by label and reconciled to
        the doc&rsquo;s own totals. A school whose doc does not parse, or reads $0 on every platform, shows the curated{' '}
        {STATIC_PAID_DATA.cohortContext.wharton.cohort} snapshot and is labelled as such — every card names the cohort it
        describes. Metrics are <span className="text-gray-300">paid-attributed</span>; CVR is lead→enroll; ROAS is on{' '}
        <span className="text-gray-300">net revenue/enroll</span>, so 1.0× = contribution breakeven.
      </div>

      {/* A school whose paid figures are not live from its cohort doc says so up front */}
      {activeSchools.some(s => data.sources[s].state !== 'live') && (
        <div className="mb-6 space-y-3">
          {activeSchools.map(s => <SourceNotice key={s} school={s} data={data} />)}
        </div>
      )}

      {/* KPI rows */}
      <div className="space-y-4 mb-6">
        {activeSchools.map(s => <SchoolKpis key={s} school={s} data={data} />)}
      </div>

      {/* Per-school sections */}
      <div className="space-y-6">
        {activeSchools.map(s => <SchoolSection key={s} school={s} data={data} />)}
        {activeSchools.includes('columbia') && <PriorCohortTable />}
      </div>
    </div>
  );
}
