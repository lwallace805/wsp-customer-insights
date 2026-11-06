'use client';

// Cohort Dashboard — the hub's rebuild of the HubSpot partner cohort
// dashboards ("Wharton Winter 2027 Cohort Dashboard", "Fall 2026 Cohort
// Dashboard - AI") on the cohort performance doc instead of HubSpot.
//
// HubSpot's reports map onto four controls rather than twenty fixed charts:
//   Students / New Leads by Day · by Week         → Interval, split by Program
//   New Leads / Enrollments by Week - <program>    → the Program filter
//   New Leads / Students by Week · Month - Source  → split by Source
// HubSpot's "Students" are contacts entering its Customer lifecycle stage;
// here they are the doc's own enrollment count (the basis Pulse and Cohort
// Command use), and sources are the doc's V2 attribution.
//
// Two payloads, never summed together:
//   /api/performance/cohort-dashboard — the doc's daily tab, reconciled week by
//     week to its WoW tab. Drives the KPIs and both charts.
//   /api/performance/channels — Channel Tables V2, the only place the non-paid
//     channels are split out. Cohort-to-date only, and it counts leads on a
//     slightly different basis from the daily tab, so it gets its own section
//     with both totals stated.

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { AlertTriangle, CheckCircle2, ExternalLink, Info } from 'lucide-react';
import type {
  CohortDashboardData, DayRow, SourceKey,
} from '@/lib/performance/cohortDashboardTypes';
import { SOURCE_META } from '@/lib/performance/cohortDashboardTypes';
import type { ProgramChannelBlock, ProgramKey } from '@/lib/performance/channelTablesTypes';
import type { PartnerKey } from '@/lib/performance/partners';
import { PARTNER_DISPLAY } from '@/lib/performance/partners';
import { PartnerPills, type ChannelsApiResponse } from './ChannelPerformanceDashboard';

interface CohortApiResponse {
  live: CohortDashboardData | null;
  needsAccess: boolean;
  serviceAccount?: string | null;
  sheetId?: string | null;
  error?: string | null;
}

type Interval = 'day' | 'week' | 'month';
type Split = 'program' | 'source';
type Metric = 'enrolls' | 'leads';
type ProgramFilter = 'all' | ProgramKey;

interface Series { key: string; label: string; color: string }

interface Bucket {
  key: string;
  /** Axis tick. */
  short: string;
  /** Tooltip / table heading. */
  label: string;
  start: string;
  end: string;
}

interface Period extends Bucket {
  /** Ends after the last keyed day, so the figure is to date, not final. */
  partial: boolean;
  values: Record<string, number>;
  total: number;
}

type Datum = Record<string, string | number | null>;

const SEGMENT_GAP = 2;

const HUBSPOT_URL: Record<PartnerKey, string> = {
  wharton: 'https://app.hubspot.com/reports-dashboard/21335947/view/24040891',
  cbs: 'https://app.hubspot.com/reports-dashboard/21335947/view/21419448',
};

const METRIC_TEXT: Record<Metric, { title: string; noun: string }> = {
  enrolls: { title: 'Enrollments', noun: 'enrollments' },
  leads: { title: 'Leads', noun: 'leads' },
};

const INTERVAL_TEXT: Record<Interval, string> = { day: 'day', week: 'week', month: 'month' };

// ─── Formatting / dates (ISO strings, read as UTC noon so no TZ drift) ────────

const fmtN = (n: number) => Math.round(n).toLocaleString('en-US');
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const md = (iso: string) =>
  at(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const slash = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const weekday = (iso: string) =>
  at(iso).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

function addDays(iso: string, n: number): string {
  const d = at(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((at(b).getTime() - at(a).getTime()) / 86_400_000);
}

function monthEnd(iso: string): string {
  const d = at(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10);
}

function pct(n: number, d: number, digits = 1): string {
  return d > 0 ? `${((n / d) * 100).toFixed(digits)}%` : '—';
}

// ─── Bucketing ────────────────────────────────────────────────────────────────

/** One day's counts for the programs in view, keyed by program or by source. */
function dayValues(row: DayRow, metric: Metric, split: Split, programs: ProgramKey[]): Record<string, number> {
  const block = metric === 'leads' ? row.leads : row.enrolls;
  const out: Record<string, number> = {};
  for (const p of programs) {
    const counts = block[p];
    if (!counts) continue;
    for (const [src, v] of Object.entries(counts) as Array<[SourceKey, number | undefined]>) {
      if (!v) continue;
      const key = split === 'program' ? p : src;
      out[key] = (out[key] ?? 0) + v;
    }
  }
  return out;
}

/** Monday–Sunday weeks over the keyed days — only used when the doc's own
 *  weeks can't be (the reader couldn't parse the WoW tab, or a day falls
 *  outside every week it lists). */
function mondayWeeks(first: string, through: string): Bucket[] {
  const offset = (at(first).getUTCDay() + 6) % 7;
  const out: Bucket[] = [];
  for (let mon = addDays(first, -offset), n = 1; mon <= through; mon = addDays(mon, 7), n++) {
    const end = addDays(mon, 6);
    out.push({ key: `m${n}`, short: slash(mon), label: `Week of ${md(mon)} (${md(mon)} – ${md(end)})`, start: mon, end });
  }
  return out;
}

function buckets(data: CohortDashboardData, interval: Interval): { list: Bucket[]; note: string | null } {
  const through = data.throughDate;
  if (!through || data.days.length === 0) return { list: [], note: null };
  const first = data.days[0].date;

  if (interval === 'day') {
    return {
      list: data.days.map(d => ({
        key: d.date, short: slash(d.date), label: `${weekday(d.date)} ${md(d.date)}`, start: d.date, end: d.date,
      })),
      note: null,
    };
  }

  if (interval === 'month') {
    const list: Bucket[] = [];
    for (let cur = first; cur <= through; cur = addDays(monthEnd(cur), 1)) {
      const d = at(cur);
      list.push({
        key: cur.slice(0, 7),
        short: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
        label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        start: cur,
        end: monthEnd(cur),
      });
    }
    return { list, note: null };
  }

  // Weeks exactly as the doc's WoW tab defines them, so each bar can be read
  // against that tab's row for the same week.
  const weeks = data.weeks.filter(w => w.start <= through);
  const covered = weeks.length > 0 &&
    data.days.every(d => weeks.some(w => d.date >= w.start && d.date <= w.end));
  if (covered) {
    return {
      list: weeks.map(w => ({
        key: `w${w.week}`, short: `Wk ${w.week}`,
        label: `Week ${w.week} · ${md(w.start)} – ${md(w.end)}`, start: w.start, end: w.end,
      })),
      note: null,
    };
  }
  return {
    list: mondayWeeks(first, through),
    // The reader already says so when the WoW tab couldn't be read at all.
    note: data.weeks.length
      ? `Some keyed days fall outside the weeks listed in "${data.wowTab}", so weeks here are Monday–Sunday and won't line up with that tab's rows.`
      : null,
  };
}

function buildPeriods(
  data: CohortDashboardData, list: Bucket[], metric: Metric, split: Split, programs: ProgramKey[],
): Period[] {
  const through = data.throughDate ?? '';
  return list.map(b => {
    const values: Record<string, number> = {};
    for (const d of data.days) {
      if (d.date < b.start || d.date > b.end) continue;
      for (const [k, v] of Object.entries(dayValues(d, metric, split, programs))) {
        values[k] = (values[k] ?? 0) + v;
      }
    }
    const total = Object.values(values).reduce((s, v) => s + v, 0);
    return { ...b, partial: b.end > through, values, total };
  });
}

function seriesFor(data: CohortDashboardData, split: Split, programs: ProgramKey[]): Series[] {
  if (split === 'program') {
    return data.programs
      .filter(p => programs.includes(p.key))
      .map(p => ({ key: p.key, label: p.label, color: p.color }));
  }
  return data.sources.map(k => ({ key: k, label: SOURCE_META[k].label, color: SOURCE_META[k].color }));
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#161b22] border border-white/10 rounded-xl ${className}`}>{children}</div>;
}

function Segmented<T extends string>({
  label, value, options, onChange,
}: {
  label?: string;
  value: T;
  options: Array<{ key: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      {label && (
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</span>
      )}
      <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
        {options.map(o => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            aria-pressed={o.key === value}
            className={`px-3 py-1.5 text-[13px] transition-colors ${
              o.key === value
                ? 'bg-white text-gray-900 font-medium'
                : 'bg-[#161b22] text-gray-400 hover:text-white'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className="text-2xl font-semibold text-white mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[12px] text-gray-500 mt-0.5">{sub}</div>}
    </Card>
  );
}

function Swatch({ color }: { color: string }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: color }} />;
}

// ─── Chart ────────────────────────────────────────────────────────────────────

interface SegmentProps {
  x?: number; y?: number; width?: number; height?: number;
  fill?: string; payload?: Datum; seriesKey: string;
}

/** One stacked segment: a 2px surface gap under every segment but the lowest,
 *  and a 4px rounded cap on whichever segment is on top for that bar. */
function Segment({ x = 0, y = 0, width = 0, height = 0, fill, payload, seriesKey }: SegmentProps) {
  if (!(height > 0) || !(width > 0)) return <g />;
  const gap = payload?.__bottom === seriesKey ? 0 : SEGMENT_GAP;
  const h = Math.max(height - gap, Math.min(height, 1));
  const r = payload?.__top === seriesKey ? Math.min(4, width / 2, h) : 0;
  const d = r > 0
    ? `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + h} Z`
    : `M${x},${y} H${x + width} V${y + h} H${x} Z`;
  return <path d={d} fill={fill} />;
}

function PeriodTooltip({
  active, datum, periods, series, metric, through,
}: {
  active?: boolean;
  datum: Datum | undefined;
  periods: Period[];
  series: Series[];
  metric: Metric;
  through: string;
}) {
  if (!active || !datum) return null;
  const p = periods.find(x => x.key === datum.__key);
  if (!p) return null;
  // Top of the stack first, so the list reads in the same order as the bar.
  const rows = [...series].reverse().filter(s => (p.values[s.key] ?? 0) !== 0);
  return (
    <div className="bg-[#0d1117] border border-white/15 rounded-lg px-3 py-2 text-[12px] shadow-xl min-w-[190px]">
      <div className="text-gray-100 font-medium">{p.label}</div>
      {p.partial && <div className="text-gray-500 text-[11px]">To date, keyed through {md(through)}</div>}
      <div className="mt-1.5 space-y-0.5">
        {rows.map(s => (
          <div key={s.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-gray-300"><Swatch color={s.color} />{s.label}</span>
            <span className="tabular-nums text-gray-100">{fmtN(p.values[s.key] ?? 0)}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="text-gray-500">No {METRIC_TEXT[metric].noun}</div>}
      </div>
      {rows.length > 1 && (
        <div className="mt-1.5 pt-1.5 border-t border-white/10 flex justify-between text-gray-100 font-medium">
          <span>Total</span><span className="tabular-nums">{fmtN(p.total)}</span>
        </div>
      )}
    </div>
  );
}

function PeriodTable({ periods, series }: { periods: Period[]; series: Series[] }) {
  const totals: Record<string, number> = {};
  for (const p of periods) for (const [k, v] of Object.entries(p.values)) totals[k] = (totals[k] ?? 0) + v;
  const grand = periods.reduce((s, p) => s + p.total, 0);
  return (
    <div className="mt-3 max-h-[340px] overflow-auto rounded-lg border border-white/10">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-[#1c2230]">
          <tr>
            <th className="text-left px-3 py-2 font-semibold text-gray-400">Period</th>
            {series.map(s => (
              <th key={s.key} className="text-right px-3 py-2 font-semibold text-gray-400 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5"><Swatch color={s.color} />{s.label}</span>
              </th>
            ))}
            <th className="text-right px-3 py-2 font-semibold text-gray-300">Total</th>
          </tr>
        </thead>
        <tbody>
          {periods.map(p => (
            <tr key={p.key} className="border-t border-white/5">
              <td className="px-3 py-1.5 text-gray-300 whitespace-nowrap">
                {p.label}{p.partial && <span className="text-gray-500"> (to date)</span>}
              </td>
              {series.map(s => (
                <td key={s.key} className="px-3 py-1.5 text-right tabular-nums text-gray-300">
                  {fmtN(p.values[s.key] ?? 0)}
                </td>
              ))}
              <td className="px-3 py-1.5 text-right tabular-nums text-white font-medium">{fmtN(p.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/15 bg-[#1c2230]">
            <td className="px-3 py-2 text-gray-200 font-semibold">To date</td>
            {series.map(s => (
              <td key={s.key} className="px-3 py-2 text-right tabular-nums text-gray-200 font-semibold">
                {fmtN(totals[s.key] ?? 0)}
              </td>
            ))}
            <td className="px-3 py-2 text-right tabular-nums text-white font-semibold">{fmtN(grand)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PeriodChart({
  metric, interval, periods, series, through, subtitle,
}: {
  metric: Metric;
  interval: Interval;
  periods: Period[];
  series: Series[];
  through: string;
  subtitle: string;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const p of periods) for (const [k, v] of Object.entries(p.values)) t[k] = (t[k] ?? 0) + v;
    return t;
  }, [periods]);
  const grand = periods.reduce((s, p) => s + p.total, 0);

  const rows: Datum[] = useMemo(() => periods.map(p => {
    const row: Datum = { __key: p.key, __short: p.short, __total: p.total, __top: null, __bottom: null };
    for (const s of series) {
      const v = p.values[s.key] ?? 0;
      row[s.key] = v;
      if (v > 0) {
        row.__top = s.key;
        if (row.__bottom === null) row.__bottom = s.key;
      }
    }
    return row;
  }), [periods, series]);

  const n = periods.length;
  const tickInterval = n > 16 ? Math.ceil(n / 14) - 1 : 0;
  // A total above each bar only where bars are few and wide enough to carry
  // one; the day view relies on the tooltip and the table.
  const showTotals = interval !== 'day' && n <= 24;
  const title = `${METRIC_TEXT[metric].title} by ${INTERVAL_TEXT[interval]}`;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-white">{title}</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-gray-400">
            <span className="text-white font-semibold tabular-nums">{fmtN(grand)}</span> to date
          </span>
          <Segmented
            value={view}
            onChange={setView}
            options={[{ key: 'chart', label: 'Chart' }, { key: 'table', label: 'Table' }]}
          />
        </div>
      </div>

      {series.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {series.map(s => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-[12px] text-gray-300">
              <Swatch color={s.color} />
              {s.label}
              <span className="text-gray-500 tabular-nums">{fmtN(totals[s.key] ?? 0)}</span>
            </span>
          ))}
        </div>
      )}

      {view === 'table' ? (
        <PeriodTable periods={periods} series={series} />
      ) : (
        <div
          className="h-[260px] mt-3"
          role="img"
          aria-label={`${title}: ${fmtN(grand)} to date over ${n} ${INTERVAL_TEXT[interval]}s. Switch to Table for the figures.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              margin={{ top: showTotals ? 18 : 6, right: 4, left: -8, bottom: 0 }}
              barCategoryGap={interval === 'day' ? '16%' : '28%'}
            >
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="__short"
                interval={tickInterval}
                tick={{ fill: '#8b949e', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                width={44}
                tick={{ fill: '#8b949e', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                isAnimationActive={false}
                content={(tp: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) => (
                  <PeriodTooltip
                    active={tp.active}
                    datum={tp.payload?.[0]?.payload as Datum | undefined}
                    periods={periods}
                    series={series}
                    metric={metric}
                    through={through}
                  />
                )}
              />
              {series.map(s => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="s"
                  fill={s.color}
                  maxBarSize={56}
                  isAnimationActive={false}
                  shape={(p: unknown) => <Segment {...(p as Omit<SegmentProps, 'seriesKey'>)} seriesKey={s.key} />}
                >
                  {/* The bar's total, drawn once, above whichever segment is on top. */}
                  {showTotals && (
                    <LabelList
                      dataKey="__total"
                      content={(lp: unknown) => {
                        const { x, y, width, index } = lp as {
                          x?: number | string; y?: number | string; width?: number | string; index?: number;
                        };
                        const row = index === undefined ? undefined : rows[index];
                        if (!row || row.__top !== s.key) return null;
                        return (
                          <text
                            x={Number(x) + Number(width) / 2}
                            y={Number(y) - 6}
                            textAnchor="middle"
                            fill="#8b949e"
                            fontSize={11}
                          >
                            {fmtN(Number(row.__total))}
                          </text>
                        );
                      }}
                    />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

// ─── Channel mix to date (Channel Tables V2) ─────────────────────────────────

function ShareBar({ share }: { share: number }) {
  return (
    <span className="inline-block w-16 h-1.5 rounded-full bg-white/10 align-middle overflow-hidden">
      <span className="block h-full rounded-full bg-[#3987e5]" style={{ width: `${Math.min(100, share * 100)}%` }} />
    </span>
  );
}

function ChannelMix({
  program, res, dailyLeads, dailyEnrolls,
}: {
  program: ProgramFilter;
  res: ChannelsApiResponse | null;
  dailyLeads: number;
  dailyEnrolls: number;
}) {
  const data = res?.live ?? null;
  let block: ProgramChannelBlock | undefined;
  if (data) {
    block = program === 'all'
      ? (data.programs.find(b => b.program === 'overall') ?? (data.programs.length === 1 ? data.programs[0] : undefined))
      : data.programs.find(b => b.program === program);
  }

  const header = (
    <div>
      <h2 className="text-[15px] font-semibold text-white">Channel mix to date</h2>
      <p className="text-[12px] text-gray-500 mt-0.5">
        Every V2 channel, paid and non-paid, from the doc&apos;s Channel Tables V2. The daily tab only splits
        out the ad platforms, so this is where the rest of &ldquo;All other channels&rdquo; is broken down.
      </p>
    </div>
  );

  if (!res) {
    return <Card className="p-5">{header}<p className="text-[13px] text-gray-500 mt-4">Loading channel tables…</p></Card>;
  }
  if (!data || !block) {
    return (
      <Card className="p-5">
        {header}
        <p className="text-[13px] text-gray-400 mt-4 flex items-start gap-2">
          <AlertTriangle size={15} className="text-amber-400 mt-0.5 shrink-0" />
          {res.needsAccess
            ? `The service account can't open the cohort doc's Channel Tables (share it with ${res.serviceAccount}).`
            : res.error ?? 'No Channel Tables V2 block for this program.'}
        </p>
      </Card>
    );
  }

  const i = block.cohorts.length - 1;
  const v = (a: Array<number | null>) => a[i] ?? 0;
  const totalL = block.totals.leads[i] ?? 0;
  const totalE = block.totals.enrollments[i] ?? 0;
  const tiers: Array<{ tier: 'paid' | 'nonpaid'; label: string }> = [
    { tier: 'paid', label: 'Paid' },
    { tier: 'nonpaid', label: 'Non-paid' },
  ];
  const leadsDiffer = Math.round(totalL) !== Math.round(dailyLeads);
  const enrollsDiffer = Math.round(totalE) !== Math.round(dailyEnrolls);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {header}
        <a
          href="/channels"
          className="text-[12px] text-gray-400 hover:text-white whitespace-nowrap"
        >
          Full channel view →
        </a>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-[12px]">
          <thead className="bg-[#1c2230]">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-gray-400">Channel</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-400">Leads</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-400">Share of leads</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-400">Enrollments</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-400">Share</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map(({ tier, label }) => {
              const rows = block!.rows.filter(r => r.tier === tier && (v(r.leads) !== 0 || v(r.enrollments) !== 0));
              if (rows.length === 0) return null;
              const tL = rows.reduce((s, r) => s + v(r.leads), 0);
              const tE = rows.reduce((s, r) => s + v(r.enrollments), 0);
              return [
                <tr key={`${tier}-h`} className="border-t border-white/10 bg-white/[0.03]">
                  <td className="px-3 py-1.5 text-gray-200 font-semibold">{label}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-200 font-semibold">{fmtN(tL)}</td>
                  <td className="px-3 py-1.5 text-gray-400 tabular-nums">{pct(tL, totalL)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-200 font-semibold">{fmtN(tE)}</td>
                  <td className="px-3 py-1.5 text-right text-gray-400 tabular-nums">{pct(tE, totalE)}</td>
                </tr>,
                ...rows.flatMap(r => {
                  const subs = r.subs.filter(s => v(s.leads) !== 0 || v(s.enrollments) !== 0);
                  const showSubs = subs.length >= 2 || (subs.length === 1 && subs[0].name !== r.channel);
                  return [
                    <tr key={`${tier}-${r.channel}`} className="border-t border-white/5">
                      <td className="px-3 py-1.5 pl-6 text-gray-300">{r.channel}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-200">{fmtN(v(r.leads))}</td>
                      <td className="px-3 py-1.5 text-gray-400 tabular-nums whitespace-nowrap">
                        <ShareBar share={totalL ? v(r.leads) / totalL : 0} />
                        <span className="ml-2">{pct(v(r.leads), totalL)}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-200">{fmtN(v(r.enrollments))}</td>
                      <td className="px-3 py-1.5 text-right text-gray-400 tabular-nums">{pct(v(r.enrollments), totalE)}</td>
                    </tr>,
                    ...(showSubs ? subs.map(s => (
                      <tr key={`${tier}-${r.channel}-${s.name}`}>
                        <td className="px-3 py-1 pl-10 text-gray-500">{s.name}</td>
                        <td className="px-3 py-1 text-right tabular-nums text-gray-400">{fmtN(v(s.leads))}</td>
                        <td className="px-3 py-1 text-gray-500 tabular-nums">{pct(v(s.leads), totalL)}</td>
                        <td className="px-3 py-1 text-right tabular-nums text-gray-400">{fmtN(v(s.enrollments))}</td>
                        <td className="px-3 py-1 text-right text-gray-500 tabular-nums">{pct(v(s.enrollments), totalE)}</td>
                      </tr>
                    )) : []),
                  ];
                }),
              ];
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/15 bg-[#1c2230]">
              <td className="px-3 py-2 text-gray-200 font-semibold">Total (Channel Tables V2)</td>
              <td className="px-3 py-2 text-right tabular-nums text-white font-semibold">{fmtN(totalL)}</td>
              <td />
              <td className="px-3 py-2 text-right tabular-nums text-white font-semibold">{fmtN(totalE)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[12px] text-gray-500 mt-3">
        {leadsDiffer || enrollsDiffer ? (
          <>
            Channel Tables V2 counts {fmtN(totalL)} leads and {fmtN(totalE)} enrollments to date; the daily tab
            behind the charts above has {fmtN(dailyLeads)} and {fmtN(dailyEnrolls)}. They are separate tabs in the
            doc and aren&apos;t reconciled to each other, so read the shares here rather than adding these counts to
            the charts.
          </>
        ) : (
          <>Channel Tables V2&apos;s totals match the daily tab behind the charts above.</>
        )}
      </p>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CohortDashboard({ initialPartner }: { initialPartner: PartnerKey }) {
  const [partner, setPartner] = useState<PartnerKey>(initialPartner);
  // Payloads stored with the partner they were fetched for, so one partner's
  // numbers can never render under the other's pill mid-switch.
  const [fetched, setFetched] = useState<{ partner: PartnerKey; res: CohortApiResponse } | null>(null);
  const [channels, setChannels] = useState<{ partner: PartnerKey; res: ChannelsApiResponse } | null>(null);
  const [program, setProgram] = useState<ProgramFilter>('all');
  const [interval, setIntervalChoice] = useState<Interval>('week');
  const [split, setSplit] = useState<Split>('program');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/performance/cohort-dashboard?partner=${partner}`)
      .then(r => r.json())
      .then((j: CohortApiResponse) => { if (!cancelled) setFetched({ partner, res: j }); })
      .catch((e: unknown) => {
        if (!cancelled) setFetched({ partner, res: { live: null, needsAccess: false, error: String(e) } });
      });
    fetch(`/api/performance/channels?partner=${partner}`)
      .then(r => r.json())
      .then((j: ChannelsApiResponse) => { if (!cancelled) setChannels({ partner, res: j }); })
      .catch((e: unknown) => {
        if (!cancelled) setChannels({ partner, res: { live: null, needsAccess: false, error: String(e) } });
      });
    return () => { cancelled = true; };
  }, [partner]);

  const choosePartner = (p: PartnerKey) => {
    setPartner(p);
    const url = new URL(window.location.href);
    url.searchParams.set('partner', p);
    window.history.replaceState(null, '', url);
  };

  const res = fetched?.partner === partner ? fetched.res : null;
  const channelsRes = channels?.partner === partner ? channels.res : null;
  const data = res?.live ?? null;

  // A program picked under one partner doesn't exist under the other; derived
  // rather than reset in an effect so the pills and charts never disagree.
  const activeProgram: ProgramFilter =
    program !== 'all' && data && !data.programs.some(p => p.key === program) ? 'all' : program;
  const inView: ProgramKey[] = useMemo(
    () => (data ? (activeProgram === 'all' ? data.programs.map(p => p.key) : [activeProgram]) : []),
    [data, activeProgram],
  );

  const { list, note: bucketNote } = useMemo(
    () => (data ? buckets(data, interval) : { list: [] as Bucket[], note: null }),
    [data, interval],
  );
  const series = useMemo(() => (data ? seriesFor(data, split, inView) : []), [data, split, inView]);
  const enrollPeriods = useMemo(
    () => (data ? buildPeriods(data, list, 'enrolls', split, inView) : []),
    [data, list, split, inView],
  );
  const leadPeriods = useMemo(
    () => (data ? buildPeriods(data, list, 'leads', split, inView) : []),
    [data, list, split, inView],
  );

  const kpi = useMemo(() => {
    let leads = 0, enrolls = 0, platformLeads = 0;
    for (const d of data?.days ?? []) {
      for (const p of inView) {
        for (const [src, v] of Object.entries(d.leads[p] ?? {})) {
          leads += v ?? 0;
          if (src !== 'other') platformLeads += v ?? 0;
        }
        for (const v of Object.values(d.enrolls[p] ?? {})) enrolls += v ?? 0;
      }
    }
    return { leads, enrolls, platformLeads };
  }, [data, inView]);

  if (!res) {
    return <div className="text-gray-500 text-sm py-20 text-center">Loading cohort dashboard…</div>;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PartnerPills partner={partner} onChange={choosePartner} />
        <Card className="p-6 max-w-2xl">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-gray-300 space-y-2">
              <p className="font-semibold text-white">Cohort dashboard unavailable</p>
              {res.needsAccess ? (
                <p>
                  The service account can&apos;t open the cohort performance doc. Share it (Viewer) with{' '}
                  <code className="text-emerald-400">{res.serviceAccount}</code>.
                </p>
              ) : (
                <p className="text-gray-400">{res.error ?? 'Unknown error.'}</p>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const through = data.throughDate;
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${data.sheetId}/edit`;
  const cohortDays = daysBetween(data.cohort.opens, data.cohort.closes) + 1;
  const dayN = through ? daysBetween(data.cohort.opens, through) + 1 : 0;
  const multiProgram = data.programs.length > 1;
  const programLabel = activeProgram === 'all'
    ? (multiProgram ? 'all programs' : data.programs[0]?.label ?? '')
    : data.programs.find(p => p.key === activeProgram)?.label ?? '';

  let intervalNote = '';
  if (through) {
    if (interval === 'day') intervalNote = `Every day from open (${md(data.cohort.opens)}) to the last keyed day, ${md(through)}.`;
    else if (interval === 'month') intervalNote = `Calendar months. ${list.at(-1)?.label ?? ''} runs to ${md(through)}.`;
    else if (!bucketNote && data.weeks.length && list.length) {
      const w1 = list[0];
      intervalNote = `Weeks as the doc's WoW tab defines them (week 1: ${md(w1.start)} – ${md(w1.end)}). ` +
        `${list.at(-1)!.short.replace('Wk', 'Week')} runs to ${md(through)}.`;
    } else intervalNote = `Monday–Sunday weeks. The latest runs to ${md(through)}.`;
  }

  const notes = [...data.notes, ...(bucketNote ? [bucketNote] : [])];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-white">
              {PARTNER_DISPLAY[partner]} {data.cohort.label} Cohort Dashboard
            </h1>
            <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              Live
            </span>
          </div>
          <p className="text-[13px] text-gray-500 mt-1">
            {data.docTitle} · {through
              ? <>day {dayN} of {cohortDays} · keyed through {md(through)}</>
              : <>nothing keyed yet</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={HUBSPOT_URL[partner]}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 transition-colors"
          >
            <ExternalLink size={13} /> HubSpot version
          </a>
          <a
            href={sheetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 transition-colors"
          >
            <ExternalLink size={13} /> Source sheet
          </a>
        </div>
      </div>

      {/* How this differs from HubSpot */}
      <div className="flex items-start gap-2.5 text-[12.5px] text-gray-400 border border-white/10 rounded-xl px-4 py-3 bg-white/[0.02]">
        <Info size={15} className="text-gray-500 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>
            <span className="text-gray-200 font-medium">Enrollments</span>{' '}are the cohort doc&apos;s count, the
            same figure Pulse and Cohort Command show. HubSpot&apos;s &ldquo;Students&rdquo; are contacts that
            entered its Customer lifecycle stage, so the two counts don&apos;t match.
          </p>
          <p>
            <span className="text-gray-200 font-medium">Sources</span>{' '}follow the doc&apos;s V2 attribution, not
            HubSpot&apos;s Original Source property. Day by day the doc splits out the ad platforms only; everything
            else is grouped as &ldquo;All other channels&rdquo; and broken down to date at the bottom of the page.
          </p>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="space-y-2">
          {notes.map((n, k) => (
            <div key={k} className="flex items-start gap-2.5 text-[12.5px] text-amber-200/90 border border-amber-500/30 bg-amber-500/10 rounded-xl px-4 py-2.5">
              <AlertTriangle size={15} className="text-amber-400 mt-0.5 shrink-0" />
              <span>{n}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters — one row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <PartnerPills partner={partner} onChange={choosePartner} />
        {multiProgram && (
          <Segmented<ProgramFilter>
            label="Program"
            value={activeProgram}
            onChange={setProgram}
            options={[
              { key: 'all', label: 'All' },
              ...data.programs.map(p => ({ key: p.key as ProgramFilter, label: p.label })),
            ]}
          />
        )}
        <Segmented<Interval>
          label="Interval"
          value={interval}
          onChange={setIntervalChoice}
          options={[{ key: 'day', label: 'Day' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }]}
        />
        <Segmented<Split>
          label="Split by"
          value={split}
          onChange={setSplit}
          options={[
            { key: 'program', label: multiProgram ? 'Program' : 'Total' },
            { key: 'source', label: 'Source' },
          ]}
        />
      </div>

      {!through ? (
        <Card className="p-6 text-sm text-gray-400">
          Nothing has been keyed in &ldquo;{data.dailyTab}&rdquo; for {data.cohort.label} yet.
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Enrollments" value={fmtN(kpi.enrolls)} sub={`${programLabel}, to date`} />
            <Kpi label="Leads" value={fmtN(kpi.leads)} sub={`${programLabel}, to date`} />
            <Kpi label="Enrollments ÷ leads" value={pct(kpi.enrolls, kpi.leads, 2)} sub="CVR (L2E), the doc's basis" />
            <Kpi
              label="Leads from ad platforms"
              value={pct(kpi.platformLeads, kpi.leads)}
              sub={`${fmtN(kpi.platformLeads)} of ${fmtN(kpi.leads)} · rest in all other channels`}
            />
          </div>

          <PeriodChart
            metric="enrolls"
            interval={interval}
            periods={enrollPeriods}
            series={series}
            through={through}
            subtitle={intervalNote}
          />
          <PeriodChart
            metric="leads"
            interval={interval}
            periods={leadPeriods}
            series={series}
            through={through}
            subtitle={intervalNote}
          />
        </>
      )}

      <ChannelMix
        program={activeProgram}
        res={channelsRes}
        dailyLeads={kpi.leads}
        dailyEnrolls={kpi.enrolls}
      />

      {/* Reconciliation */}
      <Card className="p-5">
        <h2 className="text-[15px] font-semibold text-white">Reconciliation</h2>
        <p className="text-[12px] text-gray-500 mt-0.5">
          Read from &ldquo;{data.dailyTab}&rdquo;{data.wowTab ? <>{' '}and checked against &ldquo;{data.wowTab}&rdquo;</> : null}.
          Fetched {new Date(data.fetchedAt).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET.
        </p>
        <ul className="mt-3 space-y-2.5">
          {data.checks.map(c => (
            <li key={c.label} className="flex items-start gap-2.5">
              {c.ok
                ? <CheckCircle2 size={16} className="text-[#0ca30c] mt-0.5 shrink-0" aria-label="Pass" />
                : <AlertTriangle size={16} className="text-[#fab219] mt-0.5 shrink-0" aria-label="Mismatch" />}
              <div>
                <div className="text-[13px] text-gray-200">
                  {c.label} <span className="text-gray-500">· {c.ok ? 'pass' : 'mismatch'}</span>
                </div>
                <div className="text-[12px] text-gray-500">{c.detail}</div>
              </div>
            </li>
          ))}
          {data.checks.length === 0 && (
            <li className="text-[12px] text-gray-500">No checks could be run against this doc.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
