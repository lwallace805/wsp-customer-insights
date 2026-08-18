'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import type {
  PaidAggregateData, MetricKey, MetricRow, ProgramBlock,
} from '@/lib/performance/paidAggregateTypes';
import { METRIC_KEYS } from '@/lib/performance/paidAggregateTypes';

interface ApiResponse {
  live: PaidAggregateData | null;
  needsAccess: boolean;
  serviceAccount?: string | null;
  sheetId?: string;
  error?: string | null;
}

// ─── Metric formatting + direction ────────────────────────────────────────────
// `higherIsBetter: null` = neutral (spend is a budget fact, not a win or a loss).
const META: Record<MetricKey, {
  short: string;
  fmt: (n: number | null) => string;
  higherIsBetter: boolean | null;
}> = {
  leads:       { short: 'Leads',       higherIsBetter: true,  fmt: n => n === null ? '—' : Math.round(n).toLocaleString() },
  spend:       { short: 'Spend',       higherIsBetter: null,  fmt: n => n === null ? '—' : `$${Math.round(n).toLocaleString()}` },
  enrollments: { short: 'Enrollments', higherIsBetter: true,  fmt: n => n === null ? '—' : Math.round(n).toLocaleString() },
  cpl:         { short: 'CPL',         higherIsBetter: false, fmt: n => n === null ? '—' : `$${n.toFixed(2)}` },
  cpe:         { short: 'CPE',         higherIsBetter: false, fmt: n => n === null ? '—' : `$${Math.round(n).toLocaleString()}` },
  cvr:         { short: 'CVR',         higherIsBetter: true,  fmt: n => n === null ? '—' : `${(n * 100).toFixed(2)}%` },
};

function pctStr(n: number | null): string {
  if (n === null || !isFinite(n)) return '—';
  const v = n * 100;
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

/** Attainment: actual as a share of forecast. Shown instead of a signed diff
 *  because the source doc divides the gap by ACTUAL, which throws off values
 *  like −107% whenever forecast exceeds actual. Both are derivable from the
 *  actual/forecast columns shown alongside; this one is bounded and readable. */
function attainment(actual: number | null, forecast: number | null): number | null {
  if (actual === null || forecast === null || forecast === 0) return null;
  const r = actual / forecast;
  return isFinite(r) ? r : null;
}

function attainStr(r: number | null): string {
  return r === null ? '—' : `${(r * 100).toFixed(0)}%`;
}

/** Colour attainment: 100% is par; which side of par is good depends on the metric. */
function attainClass(r: number | null, higherIsBetter: boolean | null): string {
  if (r === null || higherIsBetter === null) return 'text-gray-400';
  return (higherIsBetter ? r >= 1 : r <= 1) ? 'text-emerald-400' : 'text-red-400';
}

/** Cohort-over-cohort, same formula the sheet uses: (actual − prior) / prior. */
function coc(actual: number | null, prior: number | null): number | null {
  if (actual === null || prior === null || prior === 0) return null;
  const r = (actual - prior) / prior;
  return isFinite(r) ? r : null;
}

/** Colour a signed delta by whether the move is good for this metric. */
function deltaClass(n: number | null, higherIsBetter: boolean | null): string {
  if (n === null || !isFinite(n) || higherIsBetter === null) return 'text-gray-400';
  const good = higherIsBetter ? n >= 0 : n <= 0;
  return good ? 'text-emerald-400' : 'text-red-400';
}

const CHANNEL_COLORS: Record<string, string> = {
  Google: '#4285F4', Bing: '#00A4EF', Meta: '#0866FF', LinkedIn: '#0A66C2',
};
const SERIES_COLORS = ['#475569', '#64748b', '#10b981', '#f59e0b'];

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#161b22] border border-white/10 rounded-xl ${className}`}>{children}</div>
  );
}

function LiveChip() {
  return (
    <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
      Live
    </span>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────

function KpiTile({
  metricKey, program, active, onClick, priorBLabel,
}: {
  metricKey: MetricKey;
  program: ProgramBlock;
  active: boolean;
  onClick: () => void;
  priorBLabel: string;
}) {
  const m = META[metricKey];
  const block = program.metrics[metricKey];
  const total = block?.rows.find(r => r.channel === 'Total');
  const att = attainment(total?.actual ?? null, total?.forecast ?? null);
  const vsPrior = coc(total?.actual ?? null, total?.priorB ?? null);

  return (
    <button
      onClick={onClick}
      className={`text-left px-4 py-3 rounded-xl border transition-colors ${
        active
          ? 'bg-white/[0.07] border-emerald-500/40'
          : 'bg-[#161b22] border-white/10 hover:border-white/25'
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
        {block?.label ?? m.short}
      </div>
      <div className="text-2xl font-semibold text-white mt-1 tabular-nums">
        {m.fmt(total?.actual ?? null)}
      </div>
      <div className="mt-2 space-y-0.5 text-[11px]">
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">of forecast</span>
          <span className={`tabular-nums font-medium ${attainClass(att, m.higherIsBetter)}`}>
            {attainStr(att)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">vs {priorBLabel}</span>
          <span className={`tabular-nums font-medium ${deltaClass(vsPrior, m.higherIsBetter)}`}>
            {pctStr(vsPrior)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Channel table ────────────────────────────────────────────────────────────

const TH = 'text-right px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider';
const THL = 'text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider';

function ChannelTable({
  rows, metricKey, priorLabels,
}: { rows: MetricRow[]; metricKey: MetricKey; priorLabels: [string, string] }) {
  const m = META[metricKey];
  const ordered = [
    ...rows.filter(r => r.channel !== 'Total'),
    ...rows.filter(r => r.channel === 'Total'),
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className={THL}>Channel</th>
            <th className={TH}>{priorLabels[0]}</th>
            <th className={TH}>{priorLabels[1]}</th>
            <th className={TH}>Current — actual</th>
            <th className={TH}>Current — forecast</th>
            <th className={TH}>% of forecast</th>
            <th className={TH}>vs {priorLabels[1]}</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((r, i) => {
            const isTotal = r.channel === 'Total';
            // The sheet only publishes these for its Total row; derived per
            // channel here from the same actual/forecast/prior columns.
            const vsF = attainment(r.actual, r.forecast);
            const vsP = coc(r.actual, r.priorB);
            return (
              <tr
                key={r.channel}
                className={`border-b border-white/5 ${
                  isTotal ? 'bg-white/5 font-semibold' : i % 2 ? 'bg-white/[0.02]' : ''
                }`}
              >
                <td className="px-5 py-2.5 text-gray-200">
                  <span className="inline-flex items-center gap-2">
                    {!isTotal && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: CHANNEL_COLORS[r.channel] ?? '#64748b' }}
                      />
                    )}
                    {r.channel}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{m.fmt(r.priorA)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{m.fmt(r.priorB)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white">{m.fmt(r.actual)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{m.fmt(r.forecast)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${attainClass(vsF, m.higherIsBetter)}`}>{attainStr(vsF)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${deltaClass(vsP, m.higherIsBetter)}`}>{pctStr(vsP)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── All-programs comparison ──────────────────────────────────────────────────

function ProgramTable({
  programs, metricKey, priorLabels,
}: { programs: ProgramBlock[]; metricKey: MetricKey; priorLabels: [string, string] }) {
  const m = META[metricKey];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className={THL}>Program</th>
            <th className={TH}>{priorLabels[0]}</th>
            <th className={TH}>{priorLabels[1]}</th>
            <th className={TH}>Current — actual</th>
            <th className={TH}>Current — forecast</th>
            <th className={TH}>% of forecast</th>
            <th className={TH}>vs {priorLabels[1]}</th>
          </tr>
        </thead>
        <tbody>
          {programs.map((p, i) => {
            const b = p.metrics[metricKey];
            const t = b?.rows.find(r => r.channel === 'Total');
            const att = attainment(t?.actual ?? null, t?.forecast ?? null);
            const vsPrior = coc(t?.actual ?? null, t?.priorB ?? null);
            const isRollup = p.name.toLowerCase().startsWith('overall');
            return (
              <tr
                key={p.name}
                className={`border-b border-white/5 ${
                  isRollup ? 'bg-white/5 font-semibold' : i % 2 ? 'bg-white/[0.02]' : ''
                }`}
              >
                <td className="px-5 py-2.5 text-gray-200">{p.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{m.fmt(t?.priorA ?? null)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{m.fmt(t?.priorB ?? null)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white">{m.fmt(t?.actual ?? null)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{m.fmt(t?.forecast ?? null)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${attainClass(att, m.higherIsBetter)}`}>
                  {attainStr(att)}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${deltaClass(vsPrior, m.higherIsBetter)}`}>
                  {pctStr(vsPrior)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaidAggregateDashboard() {
  const [res, setRes] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [programName, setProgramName] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricKey>('leads');

  useEffect(() => {
    fetch('/api/performance/paid-aggregate')
      .then(r => r.json())
      .then((j: ApiResponse) => setRes(j))
      .catch((e: unknown) => setRes({ live: null, needsAccess: false, error: String(e) }))
      .finally(() => setLoading(false));
  }, []);

  const data = res?.live ?? null;
  const programs = useMemo(() => data?.programs ?? [], [data]);
  const program = programs.find(p => p.name === programName) ?? programs[0] ?? null;

  const chartData = useMemo(() => {
    if (!program) return [];
    const block = program.metrics[metric];
    if (!block) return [];
    return block.rows
      .filter(r => r.channel !== 'Total')
      .map(r => ({
        channel: r.channel,
        [data!.priorLabels[0]]: r.priorA ?? 0,
        [data!.priorLabels[1]]: r.priorB ?? 0,
        'Current actual': r.actual ?? 0,
        'Current forecast': r.forecast ?? 0,
      }));
  }, [program, metric, data]);

  if (loading) {
    return <div className="text-gray-500 text-sm py-20 text-center">Loading paid marketing aggregate…</div>;
  }

  if (!data) {
    return (
      <Card className="p-6 max-w-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-gray-300 space-y-2">
            <p className="font-semibold text-white">Paid Marketing Aggregate unavailable</p>
            {res?.needsAccess ? (
              <p>
                The service account can&apos;t open the funnel-analysis doc. Share it (Viewer) with{' '}
                <code className="text-emerald-400">{res.serviceAccount}</code>.
              </p>
            ) : (
              <p className="text-gray-400">{res?.error ?? 'Unknown error.'}</p>
            )}
          </div>
        </div>
      </Card>
    );
  }

  const priorLabels = data.priorLabels;
  const metricLabel = program?.metrics[metric]?.label ?? META[metric].short;
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${data.sheetId}/edit`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-white">Paid Marketing Aggregate</h1>
            <LiveChip />
          </div>
          <p className="text-[13px] text-gray-500 mt-1">
            {data.docTitle} · {data.cohortLabel}
            {data.week !== null && <> · through week {data.week}</>} · prior cohorts week-aligned to the same point
          </p>
        </div>
        <a
          href={sheetUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 transition-colors"
        >
          <ExternalLink size={13} /> Source sheet
        </a>
      </div>

      {/* Program selector */}
      <div className="flex flex-wrap gap-1.5">
        {programs.map(p => {
          const active = p.name === (program?.name ?? '');
          return (
            <button
              key={p.name}
              onClick={() => setProgramName(p.name)}
              className={`px-3.5 py-1.5 rounded-lg text-[13px] border transition-colors ${
                active
                  ? 'bg-white text-gray-900 border-white font-medium'
                  : 'bg-[#161b22] text-gray-400 border-white/10 hover:text-white hover:border-white/25'
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* KPI tiles — also the metric switcher for everything below */}
      {program && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {METRIC_KEYS.map(k => (
            <KpiTile
              key={k}
              metricKey={k}
              program={program}
              active={k === metric}
              onClick={() => setMetric(k)}
              priorBLabel={priorLabels[1]}
            />
          ))}
        </div>
      )}

      {/* Channel breakdown */}
      {program && (
        <Card>
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">
              {metricLabel} by channel — {program.name}
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Click a tile above to change the metric. Prior-cohort columns are cumulative through
              the same cohort week, so the comparison is like-for-like.
            </p>
          </div>
          <ChannelTable
            rows={program.metrics[metric]?.rows ?? []}
            metricKey={metric}
            priorLabels={priorLabels}
          />
        </Card>
      )}

      {/* Chart */}
      {program && chartData.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            {metricLabel} — channel vs cohort
          </h2>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" vertical={false} />
                <XAxis dataKey="channel" tick={{ fill: '#8b949e', fontSize: 12 }} axisLine={{ stroke: '#ffffff20' }} tickLine={false} />
                <YAxis
                  tick={{ fill: '#8b949e', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => META[metric].fmt(v)}
                  width={72}
                />
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(v) => META[metric].fmt(typeof v === 'number' ? v : null)}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8b949e' }} />
                {[priorLabels[0], priorLabels[1], 'Current actual', 'Current forecast'].map((k, i) => (
                  <Bar key={k} dataKey={k} fill={SERIES_COLORS[i]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* All programs */}
      <Card>
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">{metricLabel} — all programs</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Totals across Google, Bing, Meta and LinkedIn.
          </p>
        </div>
        <ProgramTable programs={programs} metricKey={metric} priorLabels={priorLabels} />
      </Card>

      {/* Read-this-right footnotes */}
      <Card className="p-5">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2.5">
          How to read this
        </h3>
        <ul className="text-[12px] text-gray-500 space-y-1.5 list-disc pl-4">
          <li>
            <span className="text-gray-400">Program-attributed spend only.</span> Every figure is the
            sum of the five program columns, so paid activity not tagged to a program (brand and
            generic campaigns) is excluded. Total paid spend in the source doc is higher.
          </li>
          <li>
            <span className="text-gray-400">Week-aligned comparisons.</span> {priorLabels[0]} and{' '}
            {priorLabels[1]} are cumulative through week {data.week ?? '—'} of those cohorts, not
            full-cohort totals — the current cohort is still in flight.
          </li>
          <li>
            <span className="text-gray-400">&ldquo;% of forecast&rdquo; is actual ÷ forecast</span>{' '}
            — 100% is on plan. This will <em>not</em>{' '}match the doc&apos;s &ldquo;% Diff vs.
            Forecast&rdquo; row, which divides the gap by <em>actual</em>{' '}rather than by forecast and
            so can exceed 100% (LinkedIn leads read −107% there). The actual and forecast columns
            are straight from the sheet, so either version is derivable from what&apos;s shown.
          </li>
          <li>
            <span className="text-gray-400">&ldquo;vs {priorLabels[1]}&rdquo;</span>{' '}uses the doc&apos;s
            own cohort-over-cohort formula, (actual − prior) ÷ prior, and ties out to it exactly.
          </li>
          <li>
            <span className="text-gray-400">Colour follows the metric.</span> Green is good — for CPL
            and CPE that means going down. Spend is shown neutral.
          </li>
          <li>
            Blank cells are <code>#DIV/0!</code>{' '}or empty in the source (typically a channel with no
            spend in that cohort), shown as &ldquo;—&rdquo; rather than zero.
          </li>
        </ul>
      </Card>
    </div>
  );
}
