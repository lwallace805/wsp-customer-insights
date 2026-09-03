'use client';

// Channel Performance — channel × cohort comparison for every marketing
// channel (paid and non-paid), per program, from the cohort doc's
// "Channel Tables" tab, plus the current cohort's channel economics from
// "Overall Performance Tables".
//
// The `ChannelMatrixSection` piece is also embedded by the Paid Marketing
// Aggregate page when its scope filter is set to Non-paid / All channels.

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import type {
  ChannelTablesData, ChannelMetricKey, ChannelScope, ProgramKey,
  ProgramChannelBlock, ChannelSeriesRow, ForecastSide, ProgramForecast,
} from '@/lib/performance/channelTablesTypes';
import {
  CHANNEL_METRIC_KEYS, PROGRAM_DISPLAY, PROGRAM_ORDER,
} from '@/lib/performance/channelTablesTypes';
import type { PartnerKey } from '@/lib/performance/partners';
import { PARTNER_DISPLAY, PARTNER_ORDER } from '@/lib/performance/partners';

export interface ChannelsApiResponse {
  live: ChannelTablesData | null;
  needsAccess: boolean;
  serviceAccount?: string | null;
  sheetId?: string;
  error?: string | null;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const METRIC_META: Record<ChannelMetricKey, {
  label: string;
  fmt: (n: number | null) => string;
}> = {
  leads:       { label: 'Leads',       fmt: n => n === null ? '—' : Math.round(n).toLocaleString() },
  enrollments: { label: 'Enrollments', fmt: n => n === null ? '—' : Math.round(n).toLocaleString() },
  cvr:         { label: 'CVR (L2E)',   fmt: n => n === null ? '—' : `${(n * 100).toFixed(2)}%` },
};

function money(n: number | null, decimals = 0): string {
  if (n === null) return '—';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function pctStr(n: number | null): string {
  if (n === null || !isFinite(n)) return '—';
  const v = n * 100;
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

/** Cohort-over-cohort, same formula the sheets use: (current − prior) / prior. */
function coc(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null || prior === 0) return null;
  const r = (current - prior) / prior;
  return isFinite(r) ? r : null;
}

/** Green is good — CVR and volume both read up-is-good on this page. */
function deltaClass(n: number | null): string {
  if (n === null || !isFinite(n)) return 'text-gray-400';
  return n >= 0 ? 'text-emerald-400' : 'text-red-400';
}

/** Attainment: actual as a share of forecast-to-date. 100% is on plan. */
function attainment(actual: number | null, forecast: number | null): number | null {
  if (actual === null || forecast === null || forecast === 0) return null;
  const r = actual / forecast;
  return isFinite(r) ? r : null;
}

function attainStr(r: number | null): string {
  return r === null ? '—' : `${(r * 100).toFixed(0)}%`;
}

function attainClass(r: number | null): string {
  if (r === null) return 'text-gray-400';
  return r >= 1 ? 'text-emerald-400' : 'text-red-400';
}

/** The forecast slice matching the current scope. */
function sideForScope(f: ProgramForecast | undefined, scope: ChannelScope): ForecastSide | null {
  if (!f) return null;
  return scope === 'all' ? f.overall : scope === 'paid' ? f.paid : f.nonpaid;
}

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

const TH = 'text-right px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider';
const THL = 'text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider';

// ─── Scope helpers ────────────────────────────────────────────────────────────

export const SCOPE_LABELS: Record<ChannelScope, string> = {
  all: 'All channels',
  paid: 'Paid (PPC)',
  nonpaid: 'Non-paid',
};

function rowsForScope(block: ProgramChannelBlock, scope: ChannelScope): ChannelSeriesRow[] {
  if (scope === 'paid') return block.rows.filter(r => r.paid);
  if (scope === 'nonpaid') return block.rows.filter(r => !r.paid);
  return block.rows;
}

/** Sum a metric across rows per cohort column. A column no row has data for
 *  stays null (RDI predates the older cohorts); otherwise blanks were already
 *  normalised to 0 by the reader, so summing is safe. */
function sumSeries(rows: ChannelSeriesRow[], metric: 'leads' | 'enrollments', nCols: number): Array<number | null> {
  return Array.from({ length: nCols }, (_, i) => {
    let any = false;
    let total = 0;
    for (const r of rows) {
      const v = metric === 'leads' ? r.leads[i] : r.enrollments[i];
      if (v !== null) { any = true; total += v; }
    }
    return any ? total : null;
  });
}

function ratio(e: number | null, l: number | null): number | null {
  if (e === null || l === null || l === 0) return null;
  return e / l;
}

interface MatrixRow {
  label: string;
  hasSpend: boolean;
  kind: 'channel' | 'subtotal' | 'total';
  values: Array<number | null>;
}

/** Build display rows for one metric: scoped channel rows, Paid/Non-paid
 *  subtotals (when the scope shows both), and the total for the scope. */
function buildMatrixRows(
  block: ProgramChannelBlock, scope: ChannelScope, metric: ChannelMetricKey,
): MatrixRow[] {
  const n = block.cohorts.length;
  const scoped = rowsForScope(block, scope);
  const paidRows = block.rows.filter(r => r.paid);
  const nonpaidRows = block.rows.filter(r => !r.paid);

  const seriesOf = (rows: ChannelSeriesRow[]): Array<number | null> => {
    const leads = sumSeries(rows, 'leads', n);
    const enrolls = sumSeries(rows, 'enrollments', n);
    if (metric === 'leads') return leads;
    if (metric === 'enrollments') return enrolls;
    return leads.map((l, i) => ratio(enrolls[i], l));
  };

  const rowValues = (r: ChannelSeriesRow): Array<number | null> => {
    if (metric === 'leads') return r.leads;
    if (metric === 'enrollments') return r.enrollments;
    return r.leads.map((l, i) => ratio(r.enrollments[i], l));
  };

  const out: MatrixRow[] = scoped.map(r => ({
    label: r.channel, hasSpend: r.hasSpend, kind: 'channel', values: rowValues(r),
  }));

  if (scope === 'all') {
    out.push({ label: 'Paid (PPC)', hasSpend: false, kind: 'subtotal', values: seriesOf(paidRows) });
    out.push({ label: 'Non-paid', hasSpend: false, kind: 'subtotal', values: seriesOf(nonpaidRows) });
    out.push({ label: 'Total', hasSpend: false, kind: 'total', values: seriesOf(block.rows) });
  } else {
    out.push({
      label: scope === 'paid' ? 'Paid total' : 'Non-paid total',
      hasSpend: false, kind: 'total', values: seriesOf(scoped),
    });
  }
  return out;
}

// ─── KPI tiles ────────────────────────────────────────────────────────────────

function ChannelKpiTile({
  metricKey, block, scope, forecastSide, active, onClick,
}: {
  metricKey: ChannelMetricKey;
  block: ProgramChannelBlock;
  scope: ChannelScope;
  forecastSide: ForecastSide | null;
  active: boolean;
  onClick: () => void;
}) {
  const m = METRIC_META[metricKey];
  const n = block.cohorts.length;
  const scoped = rowsForScope(block, scope);
  const leads = sumSeries(scoped, 'leads', n);
  const enrolls = sumSeries(scoped, 'enrollments', n);
  const series =
    metricKey === 'leads' ? leads :
    metricKey === 'enrollments' ? enrolls :
    leads.map((l, i) => ratio(enrolls[i], l));

  const current = series[n - 1] ?? null;
  const prior = n >= 2 ? series[n - 2] : null;
  const priorLabel = n >= 2 ? block.cohorts[n - 2] : null;
  const vsPrior = coc(current, prior);

  // Attainment is WoW-actual ÷ WoW-forecast — the two live on the same tab, so
  // the ratio is self-consistent even though the tile's headline number comes
  // from the channel matrix (bases drift slightly; see the footnotes).
  const att = forecastSide === null ? null :
    metricKey === 'leads' ? attainment(forecastSide.leads, forecastSide.leadsF) :
    metricKey === 'enrollments' ? attainment(forecastSide.enrolls, forecastSide.enrollsF) :
    attainment(
      ratio(forecastSide.enrolls, forecastSide.leads),
      ratio(forecastSide.enrollsF, forecastSide.leadsF),
    );

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
        {m.label}
      </div>
      <div className="text-2xl font-semibold text-white mt-1 tabular-nums">{m.fmt(current)}</div>
      <div className="mt-2 space-y-0.5 text-[11px]">
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">of forecast</span>
          <span className={`tabular-nums font-medium ${attainClass(att)}`}>{attainStr(att)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">vs {priorLabel ?? 'prior'}</span>
          <span className={`tabular-nums font-medium ${deltaClass(vsPrior)}`}>{pctStr(vsPrior)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">{priorLabel ?? 'prior'}</span>
          <span className="tabular-nums text-gray-400">{m.fmt(prior)}</span>
        </div>
      </div>
    </button>
  );
}

// ─── Actual vs forecast (to date) ─────────────────────────────────────────────

function ForecastCard({ forecast, programKey, source }: {
  forecast: ProgramForecast | undefined;
  programKey: ProgramKey;
  source: string | null;
}) {
  if (!forecast) return null;
  const slices: { label: string; side: ForecastSide | null }[] = [
    { label: 'Paid (PPC)', side: forecast.paid },
    { label: 'Non-paid', side: forecast.nonpaid },
    { label: 'Total', side: forecast.overall },
  ];
  if (slices.every(s => s.side === null)) return null;
  const fmtN = (v: number | null) => (v === null ? '—' : Math.round(v).toLocaleString());

  return (
    <Card>
      <div className="px-5 py-4 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white">
          Actual vs forecast, to date — {PROGRAM_DISPLAY[programKey]}
        </h2>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {source ? <>From &ldquo;{source}&rdquo;. </> : null}
          Forecasts are cumulative through the current cohort week. Non-paid is derived as
          Overall − Paid; per-channel forecasts exist only for the paid platforms, on the
          Paid Marketing Aggregate page.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className={THL}></th>
              <th className={TH}>Leads — actual</th>
              <th className={TH}>Leads — forecast</th>
              <th className={TH}>% of forecast</th>
              <th className={TH}>Enrolls — actual</th>
              <th className={TH}>Enrolls — forecast</th>
              <th className={TH}>% of forecast</th>
            </tr>
          </thead>
          <tbody>
            {slices.map((s, i) => {
              const lAtt = s.side ? attainment(s.side.leads, s.side.leadsF) : null;
              const eAtt = s.side ? attainment(s.side.enrolls, s.side.enrollsF) : null;
              const isTotal = s.label === 'Total';
              return (
                <tr
                  key={s.label}
                  className={`border-b border-white/5 ${
                    isTotal ? 'bg-white/5 font-semibold' : i % 2 ? 'bg-white/[0.02]' : ''
                  }`}
                >
                  <td className="px-5 py-2.5 text-gray-200">{s.label}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-white">{fmtN(s.side?.leads ?? null)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{fmtN(s.side?.leadsF ?? null)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${attainClass(lAtt)}`}>{attainStr(lAtt)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-white">{fmtN(s.side?.enrolls ?? null)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{fmtN(s.side?.enrollsF ?? null)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${attainClass(eAtt)}`}>{attainStr(eAtt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Matrix table + chart + economics ─────────────────────────────────────────

function MatrixTable({
  block, scope, metric,
}: { block: ProgramChannelBlock; scope: ChannelScope; metric: ChannelMetricKey }) {
  const m = METRIC_META[metric];
  const n = block.cohorts.length;
  const rows = buildMatrixRows(block, scope, metric);
  const priorIdx = n - 2;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className={THL}>Channel</th>
            {block.cohorts.map((c, i) => (
              <th key={c} className={`${TH} ${i === n - 1 ? 'text-white' : ''}`}>{c}</th>
            ))}
            {priorIdx >= 0 && <th className={TH}>vs {block.cohorts[priorIdx]}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const vsPrior = priorIdx >= 0 ? coc(r.values[n - 1], r.values[priorIdx]) : null;
            const emphasis =
              r.kind === 'total' ? 'bg-white/5 font-semibold'
              : r.kind === 'subtotal' ? 'bg-white/[0.03] font-medium'
              : i % 2 ? 'bg-white/[0.02]' : '';
            return (
              <tr key={`${r.kind}-${r.label}`} className={`border-b border-white/5 ${emphasis}`}>
                <td className="px-5 py-2.5 text-gray-200">
                  {r.label}
                  {r.hasSpend && (
                    <span className="text-amber-400/80 ml-1" title="Carries direct spend but sits outside the paid (PPC) rollup">$</span>
                  )}
                </td>
                {r.values.map((v, j) => (
                  <td
                    key={j}
                    className={`px-4 py-2.5 text-right tabular-nums ${j === n - 1 ? 'text-white' : 'text-gray-400'}`}
                  >
                    {m.fmt(v)}
                  </td>
                ))}
                {priorIdx >= 0 && (
                  <td className={`px-4 py-2.5 text-right tabular-nums ${deltaClass(vsPrior)}`}>
                    {pctStr(vsPrior)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Prior cohorts in greys, current cohort in emerald — matches the paid page.
const COHORT_COLORS = ['#475569', '#64748b', '#94a3b8', '#10b981'];

function MatrixChart({
  block, scope, metric,
}: { block: ProgramChannelBlock; scope: ChannelScope; metric: ChannelMetricKey }) {
  const m = METRIC_META[metric];
  const n = block.cohorts.length;
  const scoped = rowsForScope(block, scope);
  const data = scoped.map(r => {
    const values =
      metric === 'leads' ? r.leads :
      metric === 'enrollments' ? r.enrollments :
      r.leads.map((l, i) => ratio(r.enrollments[i], l));
    const entry: Record<string, string | number> = { channel: r.channel };
    block.cohorts.forEach((c, i) => { entry[c] = values[i] ?? 0; });
    return entry;
  });
  if (data.length === 0) return null;
  const colors = block.cohorts.map((_, i) =>
    i === n - 1 ? COHORT_COLORS[3] : COHORT_COLORS[Math.min(i, 2)]);

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-white mb-4">
        {m.label} — channel vs cohort
      </h2>
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" vertical={false} />
            <XAxis
              dataKey="channel"
              tick={{ fill: '#8b949e', fontSize: 11 }}
              axisLine={{ stroke: '#ffffff20' }}
              tickLine={false}
              interval={0}
              angle={data.length > 6 ? -20 : 0}
              textAnchor={data.length > 6 ? 'end' : 'middle'}
              height={data.length > 6 ? 52 : 30}
            />
            <YAxis
              tick={{ fill: '#8b949e', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => m.fmt(v)}
              width={72}
            />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#fff' }}
              formatter={(v) => m.fmt(typeof v === 'number' ? v : null)}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#8b949e' }} />
            {block.cohorts.map((c, i) => (
              <Bar key={c} dataKey={c} fill={colors[i]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function EconTable({ data, programKey, scope }: {
  data: ChannelTablesData; programKey: ProgramKey; scope: ChannelScope;
}) {
  const econ = data.econ.find(e => e.program === programKey);
  if (!econ) return null;
  const rows = econ.rows.filter(r =>
    scope === 'all' ? true : scope === 'paid' ? r.paid : !r.paid);
  if (rows.length === 0) return null;

  return (
    <Card>
      <div className="px-5 py-4 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white">
          Current-cohort channel economics — {PROGRAM_DISPLAY[programKey]}
        </h2>
        <p className="text-[11px] text-gray-500 mt-0.5">
          From the doc&apos;s &ldquo;Overall Performance Tables&rdquo;. Current cohort to date; no
          prior-cohort or forecast columns exist for these figures.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className={THL}>Channel</th>
              <th className={TH}>Leads</th>
              <th className={TH}>Enrolls</th>
              <th className={TH}>% of enrolls</th>
              <th className={TH}>CVR</th>
              <th className={TH}>Spend</th>
              <th className={TH}>CPL</th>
              <th className={TH}>CPE</th>
            </tr>
          </thead>
          <tbody>
            {[...rows, ...(scope === 'all' && econ.total ? [econ.total] : [])].map((r, i) => {
              const isTotal = /^grand total/i.test(r.channel);
              return (
                <tr
                  key={r.channel}
                  className={`border-b border-white/5 ${
                    isTotal ? 'bg-white/5 font-semibold' : i % 2 ? 'bg-white/[0.02]' : ''
                  }`}
                >
                  <td className="px-5 py-2.5 text-gray-200">{r.channel}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-300">
                    {r.leads === null ? '—' : Math.round(r.leads).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-white">
                    {r.enrolls === null ? '—' : Math.round(r.enrolls).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">
                    {r.pct === null ? '—' : `${(r.pct * 100).toFixed(0)}%`}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">
                    {r.cvr === null ? '—' : `${(r.cvr * 100).toFixed(2)}%`}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{money(r.spend)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{r.cpl === null ? '—' : money(r.cpl, 2)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{money(r.cpe)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── The reusable section (also embedded by the paid-aggregate page) ──────────

export function ChannelMatrixSection({
  data, programKey, scope,
}: { data: ChannelTablesData; programKey: ProgramKey; scope: ChannelScope }) {
  const [metric, setMetric] = useState<ChannelMetricKey>('leads');
  const block =
    data.programs.find(p => p.program === programKey) ?? data.programs[0] ?? null;
  if (!block) return null;
  const forecast = data.forecasts.find(f => f.program === block.program);
  const forecastSide = sideForScope(forecast, scope);
  // Several of the read-this-right notes describe quirks of one partner's doc.
  const isCbs = data.partner === 'cbs';
  // The WoW tabs and the channel matrix don't cover the same channel set; the
  // note below names the current gap rather than a figure that will drift.
  const wowLeads = forecast?.overall?.leads ?? null;
  const matrixLeads = block.totals.leads[block.cohorts.length - 1] ?? null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {CHANNEL_METRIC_KEYS.map(k => (
          <ChannelKpiTile
            key={k}
            metricKey={k}
            block={block}
            scope={scope}
            forecastSide={forecastSide}
            active={k === metric}
            onClick={() => setMetric(k)}
          />
        ))}
      </div>

      <ForecastCard forecast={forecast} programKey={block.program} source={data.forecastSource} />

      <Card>
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">
            {METRIC_META[metric].label} by channel — {PROGRAM_DISPLAY[block.program]} · {SCOPE_LABELS[scope]}
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Click a tile above to change the metric. Prior-cohort columns are cumulative through
            the same point of those cohorts, so the comparison is like-for-like.
          </p>
        </div>
        <MatrixTable block={block} scope={scope} metric={metric} />
      </Card>

      <MatrixChart block={block} scope={scope} metric={metric} />

      <EconTable data={data} programKey={block.program} scope={scope} />

      <Card className="p-5">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2.5">
          How to read this
        </h3>
        <ul className="text-[12px] text-gray-500 space-y-1.5 list-disc pl-4">
          <li>
            <span className="text-gray-400">&ldquo;Paid&rdquo; = PPC</span>{' '}
            {isCbs
              ? '(Google, Bing, Meta, LinkedIn and Open AI — the platforms inside this doc’s "Ads" line)'
              : '(Google, Bing, Meta, LinkedIn)'}{' '}
            — the same definition behind every paid figure on the Paid Marketing
            Aggregate page. Channels marked{' '}
            <span className="text-amber-400/80">$</span>{' '}(Sponsored Content, Paid Affiliates)
            carry direct spend but sit outside the paid rollup, matching how the source doc
            reports them.
          </li>
          <li>
            <span className="text-gray-400">Paid + Non-paid always equals Total here.</span>{' '}
            {!isCbs && (
              <>
                The source tab&apos;s own PPC/Non-PPC summary block excludes AI Referral (and, for
                Spring enrollments, Offline/Direct) from its ranges, so it reads slightly lower
                than these rollups.
              </>
            )}
            {isCbs && (
              <>
                Both rollups are computed here from the channel rows, so they always tie to the
                column total.
              </>
            )}
          </li>
          <li>
            <span className="text-gray-400">Prior-cohort columns are week-aligned snapshots</span>{' '}
            maintained by hand in the source tab; only the current-cohort column is
            formula-driven. Blank cells mean the program or channel predates that cohort
            {!isCbs && <> (e.g. RDI before Spring 2026)</>}, not zero.
          </li>
          {isCbs && (
            <li>
              <span className="text-gray-400">
                Two known gaps between this doc&apos;s own tabs.
              </span>{' '}
              The economics table&apos;s &ldquo;Ads&rdquo; spend leaves out the Open AI line&apos;s
              spend that the paid WoW total includes, even though both count its leads. And the
              all-channel WoW total
              {wowLeads !== null && matrixLeads !== null && (
                <> ({Math.round(wowLeads).toLocaleString()} leads)</>
              )}{' '}
              includes the doc&apos;s separate &ldquo;Employer Test&rdquo; line, which is not a row
              in the channel matrix
              {matrixLeads !== null && <> ({Math.round(matrixLeads).toLocaleString()})</>}.
              Neither is corrected here — figures are shown as each tab states them, which is why
              &ldquo;% of forecast&rdquo; is always computed WoW-against-WoW.
            </li>
          )}
          <li>
            <span className="text-gray-400">CVR = enrollments ÷ leads</span>{' '}for the same
            cohort-to-date window — identical to the source tab&apos;s Conversions block.
          </li>
          <li>
            <span className="text-gray-400">Forecast figures come from the doc&apos;s WoW tabs</span>{' '}
            (all-channel and paid, newest version), cumulative through the current week;
            Non-paid forecast is derived as Overall − Paid. They sit on a slightly different
            basis than the matrix — the WoW paid rows count the four ad platforms while the
            matrix&apos;s PPC row is the doc&apos;s &ldquo;Ads&rdquo; line, and refresh timing
            differs — so &ldquo;% of forecast&rdquo; is always WoW-actual ÷ WoW-forecast, never
            a mix. Per-channel forecasts exist only for paid platforms, on the Paid Marketing
            Aggregate page.
          </li>
          {!isCbs && (
            <li>
              <span className="text-gray-400">Overall spend includes brand/generic spend</span>{' '}
              not attributed to any program, so the program tables&apos; spends do not sum to the
              Overall table&apos;s.
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}

// ─── Partner pills (shared with the paid-aggregate page) ──────────────────────
//
// The top-level filter: each partner is a different source doc, so changing it
// re-fetches rather than re-slicing. Styled apart from the program pills
// (emerald, not white) so it reads as the outer scope it is.

export function PartnerPills({
  partner, onChange,
}: { partner: PartnerKey; onChange: (p: PartnerKey) => void }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
        Partner
      </span>
      <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
        {PARTNER_ORDER.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3.5 py-1.5 text-[13px] transition-colors ${
              p === partner
                ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                : 'bg-[#161b22] text-gray-400 hover:text-white'
            }`}
          >
            {PARTNER_DISPLAY[p]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Scope pills (shared with the paid-aggregate page) ────────────────────────

export function ScopePills({
  scope, onChange, scopes = ['all', 'paid', 'nonpaid'],
}: { scope: ChannelScope; onChange: (s: ChannelScope) => void; scopes?: ChannelScope[] }) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
      {scopes.map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`px-3.5 py-1.5 text-[13px] transition-colors ${
            s === scope
              ? 'bg-white text-gray-900 font-medium'
              : 'bg-[#161b22] text-gray-400 hover:text-white'
          }`}
        >
          {SCOPE_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

// ─── Standalone page ──────────────────────────────────────────────────────────

export default function ChannelPerformanceDashboard() {
  const [partner, setPartner] = useState<PartnerKey>('wharton');
  // Payload stored with the partner it was fetched for; "loading" and "stale
  // after a partner switch" are then derived, so one partner's numbers can
  // never render under the other's pills.
  const [fetched, setFetched] =
    useState<{ partner: PartnerKey; res: ChannelsApiResponse } | null>(null);
  const [programKey, setProgramKey] = useState<ProgramKey>('overall');
  const [scope, setScope] = useState<ChannelScope>('all');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/performance/channels?partner=${partner}`)
      .then(r => r.json())
      .then((j: ChannelsApiResponse) => { if (!cancelled) setFetched({ partner, res: j }); })
      .catch((e: unknown) => {
        if (!cancelled) {
          setFetched({ partner, res: { live: null, needsAccess: false, error: String(e) } });
        }
      });
    return () => { cancelled = true; };
  }, [partner]);

  const res = fetched?.partner === partner ? fetched.res : null;
  const loading = res === null;
  const data = res?.live ?? null;
  const availablePrograms = useMemo(() => {
    const have = new Set((data?.programs ?? []).map(p => p.program));
    return PROGRAM_ORDER.filter(k => have.has(k));
  }, [data]);

  // Programs don't overlap between partners, so a selection made under one
  // never survives the switch — fall back to that partner's first block.
  // Derived, not reset in an effect, so there's no frame where the pills and
  // the tables disagree about which program is showing.
  const activeProgram: ProgramKey =
    availablePrograms.length && !availablePrograms.includes(programKey)
      ? availablePrograms[0]
      : programKey;

  if (loading) {
    return <div className="text-gray-500 text-sm py-20 text-center">Loading channel performance…</div>;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PartnerPills partner={partner} onChange={setPartner} />
      <Card className="p-6 max-w-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-gray-300 space-y-2">
            <p className="font-semibold text-white">Channel performance unavailable</p>
            {res?.needsAccess ? (
              <p>
                The service account can&apos;t open the cohort performance doc. Share it (Viewer)
                with <code className="text-emerald-400">{res.serviceAccount}</code>.
              </p>
            ) : (
              <p className="text-gray-400">{res?.error ?? 'Unknown error.'}</p>
            )}
          </div>
        </div>
      </Card>
      </div>
    );
  }

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${data.sheetId}/edit`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-white">Marketing Channels</h1>
            <LiveChip />
          </div>
          <p className="text-[13px] text-gray-500 mt-1">
            {data.docTitle} · every channel, paid and non-paid · prior cohorts aligned to the
            same point in cohort
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

      {/* Partner (top-level) selector */}
      <PartnerPills partner={partner} onChange={setPartner} />

      {/* Program + scope selectors */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-1.5">
          {availablePrograms.map(k => (
            <button
              key={k}
              onClick={() => setProgramKey(k)}
              className={`px-3.5 py-1.5 rounded-lg text-[13px] border transition-colors ${
                k === activeProgram
                  ? 'bg-white text-gray-900 border-white font-medium'
                  : 'bg-[#161b22] text-gray-400 border-white/10 hover:text-white hover:border-white/25'
              }`}
            >
              {PROGRAM_DISPLAY[k]}
            </button>
          ))}
        </div>
        <ScopePills scope={scope} onChange={setScope} />
      </div>

      <ChannelMatrixSection data={data} programKey={activeProgram} scope={scope} />
    </div>
  );
}
