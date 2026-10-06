'use client';

// Channel Performance — channel × cohort comparison for every marketing
// channel (paid and non-paid), per program, from the cohort doc's
// "Channel Tables V2" tab, plus the current cohort's channel economics from
// "Overall Performance Tables - V2". Both follow the V2 attribution model:
// Paid/Non-Paid tier → Channel → Sub-Channel (see channelV2.ts).
//
// The `ChannelMatrixSection` piece is also embedded by the Paid Marketing
// Aggregate page when its scope filter is set to a channel-tables view.

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ExternalLink, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import type {
  ChannelTablesData, ChannelMetricKey, ChannelScope, ProgramKey,
  ProgramChannelBlock, ChannelSeriesRow, ForecastSide, ProgramForecast,
  ChannelEconFigures, ChannelTier,
} from '@/lib/performance/channelTablesTypes';
import {
  CHANNEL_METRIC_KEYS, PROGRAM_DISPLAY, PROGRAM_ORDER, econMetrics, sumEcon,
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

/** The forecast slice matching the current scope, with what it covers. The
 *  WoW tabs forecast all channels and the PPC slice only, so neither V2 tier
 *  has a forecast of its own: Paid is compared on its PPC part and Non-paid
 *  on "everything except PPC" (which also holds affiliates, sponsored content
 *  and Paid Other) — each labelled for what it is. */
function forecastForScope(
  f: ProgramForecast | undefined, scope: ChannelScope,
): { side: ForecastSide | null; label: string } {
  if (!f) return { side: null, label: 'of forecast' };
  if (scope === 'all') return { side: f.overall, label: 'of forecast' };
  if (scope === 'paid') return { side: f.ppc, label: 'PPC of forecast' };
  return { side: f.nonPpc, label: 'non-PPC of forecast' };
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
  paid: 'Paid',
  nonpaid: 'Non-paid',
};

const TIER_LABEL: Record<ChannelTier, string> = { paid: 'Paid', nonpaid: 'Non-paid' };

function rowsForScope<T extends { tier: ChannelTier }>(rows: T[], scope: ChannelScope): T[] {
  if (scope === 'all') return rows;
  return rows.filter(r => r.tier === scope);
}

/** Sum a metric across rows per cohort column. A column no row has data for
 *  stays null (RDI predates the older cohorts); otherwise blanks were already
 *  normalised to 0 by the reader, so summing is safe. */
function sumSeries(
  rows: Array<Pick<ChannelSeriesRow, 'leads' | 'enrollments'>>,
  metric: 'leads' | 'enrollments', nCols: number,
): Array<number | null> {
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

/** Which channels show their sub-channels. Paid Search and Paid Social open by
 *  default — the platform split is what most questions about them turn on. */
const DEFAULT_OPEN = ['Paid Search', 'Paid Social'];

function useExpanded() {
  const [open, setOpen] = useState<Set<string>>(() => new Set(DEFAULT_OPEN));
  const toggle = (ch: string) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(ch)) next.delete(ch); else next.add(ch);
    return next;
  });
  return { open, toggle, setOpen };
}

/** A channel row expands only when it has more than one sub-channel; a single
 *  named sub ("Paid Other → Employer Test") is folded into its label. */
const expandable = (subs: unknown[]) => subs.length > 1;
const channelLabel = (channel: string, subs: Array<{ name: string }>) =>
  subs.length === 1 ? `${channel} · ${subs[0].name}` : channel;

interface MatrixRow {
  key: string;
  label: string;
  kind: 'tier' | 'channel' | 'sub' | 'memo' | 'total';
  values: Array<number | null>;
  channel?: string;
  canExpand?: boolean;
}

/** Display rows for one metric. Tier rows head their group, as in the sheet;
 *  the PPC memo line ties the Paid tier back to the per-platform figures the
 *  Paid Marketing Aggregate page and the Paid WoW tab report. */
function buildMatrixRows(
  block: ProgramChannelBlock, scope: ChannelScope, metric: ChannelMetricKey, open: Set<string>,
): MatrixRow[] {
  const n = block.cohorts.length;
  const seriesOf = (rows: Array<Pick<ChannelSeriesRow, 'leads' | 'enrollments'>>): Array<number | null> => {
    const leads = sumSeries(rows, 'leads', n);
    const enrolls = sumSeries(rows, 'enrollments', n);
    if (metric === 'leads') return leads;
    if (metric === 'enrollments') return enrolls;
    return leads.map((l, i) => ratio(enrolls[i], l));
  };
  const one = (r: Pick<ChannelSeriesRow, 'leads' | 'enrollments'>) => seriesOf([r]);

  const out: MatrixRow[] = [];
  const tiers: ChannelTier[] = scope === 'all' ? ['paid', 'nonpaid'] : [scope];
  for (const tier of tiers) {
    const rows = block.rows.filter(r => r.tier === tier);
    if (!rows.length) continue;
    if (scope === 'all') {
      out.push({ key: `tier-${tier}`, label: TIER_LABEL[tier], kind: 'tier', values: seriesOf(rows) });
    }
    for (const r of rows) {
      out.push({
        key: `ch-${r.channel}`, label: channelLabel(r.channel, r.subs), kind: 'channel',
        values: one(r), channel: r.channel, canExpand: expandable(r.subs),
      });
      if (expandable(r.subs) && open.has(r.channel)) {
        for (const s of r.subs) {
          out.push({ key: `sub-${r.channel}-${s.name}`, label: s.name, kind: 'sub', values: one(s) });
        }
      }
    }
    if (tier === 'paid') {
      const ppc = rows.filter(r => r.ppc);
      if (ppc.length && ppc.length < rows.length) {
        out.push({
          key: 'memo-ppc', label: `of which PPC (${ppc.map(r => r.channel).join(' + ')})`,
          kind: 'memo', values: seriesOf(ppc),
        });
      }
    }
  }
  const scoped = rowsForScope(block.rows, scope);
  out.push({
    key: 'total',
    label: scope === 'all' ? 'Total' : `${TIER_LABEL[scope]} total`,
    kind: 'total',
    values: seriesOf(scoped),
  });
  return out;
}

// ─── Enrollment origin (the doc's "In Cohort" tab) ────────────────────────────

/** Which enrollments the matrix counts: all of them, only those whose lead was
 *  created inside the cohort's own window, or the carry-over from earlier
 *  cohorts' leads. In-cohort CVR is the cleanest conversion rate the doc
 *  offers — numerator and denominator from the same window. */
type EnrollOrigin = 'all' | 'in' | 'carry';

const ORIGIN_LABEL: Record<EnrollOrigin, string> = {
  all: 'All leads',
  in: 'This cohort’s leads',
  carry: 'Earlier cohorts’ leads',
};

const ORIGIN_SUFFIX: Record<EnrollOrigin, string> = {
  all: '',
  in: ' — from this cohort’s leads',
  carry: ' — from earlier cohorts’ leads',
};

function originSeries(
  enrollments: Array<number | null>, inCohort: Array<number | null> | null, origin: EnrollOrigin,
): Array<number | null> {
  if (origin === 'all' || !inCohort) return enrollments;
  if (origin === 'in') return inCohort;
  return enrollments.map((e, i) => (e === null || inCohort[i] === null ? null : e - inCohort[i]!));
}

/** The block with its enrollments swapped for the chosen origin, so every
 *  table and chart below reads it unchanged. */
function withOrigin(block: ProgramChannelBlock, origin: EnrollOrigin): ProgramChannelBlock {
  if (origin === 'all' || !block.hasInCohort) return block;
  return {
    ...block,
    rows: block.rows.map(r => ({
      ...r,
      enrollments: originSeries(r.enrollments, r.inCohort, origin),
      subs: r.subs.map(s => ({ ...s, enrollments: originSeries(s.enrollments, s.inCohort, origin) })),
    })),
  };
}

function OriginPills({ origin, onChange, metric }: {
  origin: EnrollOrigin; onChange: (o: EnrollOrigin) => void; metric: ChannelMetricKey;
}) {
  // Carry-over enrollments ÷ this cohort's leads isn't a conversion rate.
  const options: EnrollOrigin[] = metric === 'cvr' ? ['all', 'in'] : ['all', 'in', 'carry'];
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
        Enrollments from
      </span>
      <div className="inline-flex rounded-md border border-white/10 overflow-hidden">
        {options.map(o => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`px-2.5 py-1 text-[11px] transition-colors ${
              o === origin ? 'bg-white/15 text-white font-medium' : 'bg-transparent text-gray-400 hover:text-white'
            }`}
          >
            {ORIGIN_LABEL[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** "72.8% of Current Cohort enrollments came from this cohort's leads
 *  (Spring 2026: 71.7%)" for the rows in scope. */
function InCohortShare({ block, scope }: { block: ProgramChannelBlock; scope: ChannelScope }) {
  if (!block.hasInCohort) return null;
  const rows = rowsForScope(block.rows, scope);
  const n = block.cohorts.length;
  const share = (i: number) => {
    let e = 0;
    let inc = 0;
    for (const r of rows) {
      if (r.enrollments[i] === null || r.inCohort?.[i] == null) return null;
      e += r.enrollments[i]!;
      inc += r.inCohort[i]!;
    }
    return e > 0 ? inc / e : null;
  };
  const cur = share(n - 1);
  const prior = n >= 2 ? share(n - 2) : null;
  if (cur === null) return null;
  return (
    <p className="text-[11px] text-gray-400 mt-1.5">
      <span className="text-white font-medium tabular-nums">{(cur * 100).toFixed(1)}%</span> of{' '}
      {block.cohorts[n - 1]} enrollments{scope !== 'all' ? ` (${SCOPE_LABELS[scope].toLowerCase()})` : ''}{' '}
      came from leads created in this cohort&apos;s window
      {prior !== null && <> — {block.cohorts[n - 2]}: {(prior * 100).toFixed(1)}% at the same point</>}.
      The rest are earlier cohorts&apos; leads enrolling now.
    </p>
  );
}

// ─── KPI tiles ────────────────────────────────────────────────────────────────

function ChannelKpiTile({
  metricKey, block, scope, forecast, active, onClick,
}: {
  metricKey: ChannelMetricKey;
  block: ProgramChannelBlock;
  scope: ChannelScope;
  forecast: { side: ForecastSide | null; label: string };
  active: boolean;
  onClick: () => void;
}) {
  const m = METRIC_META[metricKey];
  const n = block.cohorts.length;
  const scoped = rowsForScope(block.rows, scope);
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
  const fs = forecast.side;
  const att = fs === null ? null :
    metricKey === 'leads' ? attainment(fs.leads, fs.leadsF) :
    metricKey === 'enrollments' ? attainment(fs.enrolls, fs.enrollsF) :
    attainment(ratio(fs.enrolls, fs.leads), ratio(fs.enrollsF, fs.leadsF));

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
          <span className="text-gray-500">{forecast.label}</span>
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
    { label: 'PPC (Paid Search + Paid Social)', side: forecast.ppc },
    { label: 'Everything except PPC', side: forecast.nonPpc },
    { label: 'All channels', side: forecast.overall },
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
          Cumulative through the current cohort week. The doc forecasts only the ad platforms
          and all channels together; &ldquo;everything except PPC&rdquo; is the difference. That
          is not the Non-paid tier — it also holds Paid Other, Paid Affiliate and Sponsored
          Content, which have no forecast of their own.
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
              const isTotal = i === slices.length - 1;
              return (
                <tr
                  key={s.label}
                  className={`border-b border-white/5 ${isTotal ? 'bg-white/5 font-semibold' : ''}`}
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

const ROW_STYLE: Record<MatrixRow['kind'], string> = {
  tier: 'bg-white/[0.04] font-semibold',
  channel: '',
  sub: 'text-[13px]',
  memo: 'italic',
  total: 'bg-white/5 font-semibold',
};

function LabelCell({ row, open, onToggle }: {
  row: { label: string; kind: MatrixRow['kind']; channel?: string; canExpand?: boolean };
  open: Set<string>;
  onToggle: (ch: string) => void;
}) {
  const pad = row.kind === 'sub' ? 'pl-12' : row.kind === 'channel' || row.kind === 'memo' ? 'pl-7' : 'pl-5';
  const tone = row.kind === 'sub' || row.kind === 'memo' ? 'text-gray-400' : 'text-gray-200';
  if (row.kind === 'channel' && row.canExpand && row.channel) {
    const isOpen = open.has(row.channel);
    return (
      <td className={`pr-5 py-2.5 ${pad} ${tone}`}>
        <button
          onClick={() => onToggle(row.channel!)}
          className="inline-flex items-center gap-1 -ml-5 hover:text-white"
          aria-expanded={isOpen}
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {row.label}
        </button>
      </td>
    );
  }
  return <td className={`pr-5 py-2.5 ${pad} ${tone}`}>{row.label}</td>;
}

function MatrixTable({
  block, scope, metric, open, onToggle,
}: {
  block: ProgramChannelBlock; scope: ChannelScope; metric: ChannelMetricKey;
  open: Set<string>; onToggle: (ch: string) => void;
}) {
  const m = METRIC_META[metric];
  const n = block.cohorts.length;
  const rows = buildMatrixRows(block, scope, metric, open);
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
          {rows.map(r => {
            const vsPrior = priorIdx >= 0 ? coc(r.values[n - 1], r.values[priorIdx]) : null;
            return (
              <tr key={r.key} className={`border-b border-white/5 ${ROW_STYLE[r.kind]}`}>
                <LabelCell row={r} open={open} onToggle={onToggle} />
                {r.values.map((v, j) => (
                  <td
                    key={j}
                    className={`px-4 py-2.5 text-right tabular-nums ${
                      j === n - 1 && r.kind !== 'sub' && r.kind !== 'memo' ? 'text-white' : 'text-gray-400'
                    }`}
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
  const scoped = rowsForScope(block.rows, scope);
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

function SpendCell({ f, decimals = 0, value }: {
  f: ChannelEconFigures; decimals?: number; value: number | null;
}) {
  if (f.spendWithheld) {
    return (
      <td
        className="px-4 py-2.5 text-right tabular-nums text-amber-400/80"
        title="The sheet's spend here failed a consistency check — see the notes at the top of the page."
      >
        withheld
      </td>
    );
  }
  return (
    <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">
      {money(value, decimals)}
      {f.spendCorrected && value !== null && (
        <span
          className="text-sky-400/80 ml-0.5"
          title="Corrected: the sheet repeated another platform's spend here; this is the Paid WoW tab's figure for the same program and platform. See the notes at the top of the page."
        >†</span>
      )}
    </td>
  );
}

function EconTable({ data, programKey, scope, open, onToggle }: {
  data: ChannelTablesData; programKey: ProgramKey; scope: ChannelScope;
  open: Set<string>; onToggle: (ch: string) => void;
}) {
  const econ = data.econ.find(e => e.program === programKey);
  if (!econ) return null;
  const totalEnrolls = econ.total?.enrolls ?? null;

  type EconLine = {
    key: string; label: string; kind: MatrixRow['kind']; f: ChannelEconFigures;
    channel?: string; canExpand?: boolean;
  };
  const lines: EconLine[] = [];
  const tiers: ChannelTier[] = scope === 'all' ? ['paid', 'nonpaid'] : [scope];
  for (const tier of tiers) {
    const rows = econ.rows.filter(r => r.tier === tier);
    if (!rows.length) continue;
    if (scope === 'all') {
      lines.push({ key: `tier-${tier}`, label: TIER_LABEL[tier], kind: 'tier', f: sumEcon(rows) });
    }
    for (const r of rows) {
      lines.push({
        key: `ch-${r.channel}`, label: channelLabel(r.channel, r.subs), kind: 'channel', f: r,
        channel: r.channel, canExpand: expandable(r.subs),
      });
      if (expandable(r.subs) && open.has(r.channel)) {
        for (const s of r.subs) lines.push({ key: `sub-${r.channel}-${s.name}`, label: s.name, kind: 'sub', f: s });
      }
    }
    if (tier === 'paid') {
      const ppc = rows.filter(r => r.ppc);
      if (ppc.length && ppc.length < rows.length) {
        lines.push({
          key: 'memo-ppc', label: `of which PPC (${ppc.map(r => r.channel).join(' + ')})`,
          kind: 'memo', f: sumEcon(ppc),
        });
      }
    }
  }
  const scopedTotal = scope === 'all' ? econ.total : sumEcon(rowsForScope(econ.rows, scope));
  if (scopedTotal) {
    lines.push({
      key: 'total', label: scope === 'all' ? 'Total' : `${TIER_LABEL[scope]} total`,
      kind: 'total', f: scopedTotal,
    });
  }
  if (lines.length <= 1) return null;
  const showSpend = scope !== 'nonpaid';

  return (
    <Card>
      <div className="px-5 py-4 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white">
          Current-cohort channel economics — {PROGRAM_DISPLAY[programKey]}
        </h2>
        <p className="text-[11px] text-gray-500 mt-0.5">
          From the doc&apos;s &ldquo;{data.econTab}&rdquo;. Current cohort to date; no prior-cohort or
          forecast columns exist for these figures. Spend is direct, program-attributed spend —
          non-paid channels carry none.
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
              {showSpend && <th className={TH}>Spend</th>}
              {showSpend && <th className={TH}>CPL</th>}
              {showSpend && <th className={TH}>CPE</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map(l => {
              const mx = econMetrics(l.f, totalEnrolls);
              const paidish = l.f.spend !== null || l.f.spendWithheld;
              return (
                <tr key={l.key} className={`border-b border-white/5 ${ROW_STYLE[l.kind]}`}>
                  <LabelCell row={l} open={open} onToggle={onToggle} />
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-300">
                    {l.f.leads === null ? '—' : Math.round(l.f.leads).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-white">
                    {l.f.enrolls === null ? '—' : Math.round(l.f.enrolls).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">
                    {mx.share === null ? '—' : `${(mx.share * 100).toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">
                    {mx.cvr === null ? '—' : `${(mx.cvr * 100).toFixed(2)}%`}
                  </td>
                  {showSpend && (paidish
                    ? <SpendCell f={l.f} value={l.f.spend} />
                    : <td className="px-4 py-2.5 text-right text-gray-600">·</td>)}
                  {showSpend && (paidish
                    ? <SpendCell f={l.f} value={mx.cpl} decimals={2} />
                    : <td className="px-4 py-2.5 text-right text-gray-600">·</td>)}
                  {showSpend && (paidish
                    ? <SpendCell f={l.f} value={mx.cpe} />
                    : <td className="px-4 py-2.5 text-right text-gray-600">·</td>)}
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

/** What the reader found when it checked the sheet against itself — upstream
 *  gaps, subtotals that don't add up, spend it withheld. Shown above the
 *  numbers rather than in the footnotes: they are the reason a figure on this
 *  page reads "—" or differs from the sheet, and someone comparing against the
 *  doc needs that first. Renders nothing in the normal case. */
function SourceGapNotes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold text-amber-200">
            Source-sheet checks — {notes.length} {notes.length === 1 ? 'issue' : 'issues'} to know before quoting
          </p>
          {notes.map(n => (
            <p key={n} className="text-[12px] text-amber-100/80 leading-relaxed">{n}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChannelMatrixSection({
  data, programKey, scope,
}: { data: ChannelTablesData; programKey: ProgramKey; scope: ChannelScope }) {
  const [metric, setMetric] = useState<ChannelMetricKey>('leads');
  const [originPick, setOrigin] = useState<EnrollOrigin>('all');
  const { open, toggle, setOpen } = useExpanded();
  const block =
    data.programs.find(p => p.program === programKey) ?? data.programs[0] ?? null;
  if (!block) return null;
  // Origin applies to enrollments and CVR only; leads have no origin split.
  // Derived (not reset in an effect) so a stale pick can't outlive its metric.
  const origin: EnrollOrigin =
    !block.hasInCohort || metric === 'leads' || (metric === 'cvr' && originPick === 'carry')
      ? 'all' : originPick;
  const viewBlock = withOrigin(block, origin);
  const forecast = data.forecasts.find(f => f.program === block.program);
  const scopedForecast = forecastForScope(forecast, scope);
  const isCbs = data.partner === 'cbs';
  const expandableChannels = block.rows.filter(r => expandable(r.subs)).map(r => r.channel);
  const allOpen = expandableChannels.every(c => open.has(c));
  // WoW all-channel leads vs the matrix's current column — two keyings of the
  // same cohort, quoted live rather than as a figure that will drift.
  const wowLeads = forecast?.overall?.leads ?? null;
  const matrixLeads = block.totals.leads[block.cohorts.length - 1] ?? null;

  return (
    <div className="space-y-5">
      <SourceGapNotes notes={data.notes} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {CHANNEL_METRIC_KEYS.map(k => (
          <ChannelKpiTile
            key={k}
            metricKey={k}
            block={block}
            scope={scope}
            forecast={scopedForecast}
            active={k === metric}
            onClick={() => setMetric(k)}
          />
        ))}
      </div>

      <ForecastCard forecast={forecast} programKey={block.program} source={data.forecastSource} />

      <Card>
        <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {METRIC_META[metric].label}{ORIGIN_SUFFIX[origin]} by channel — {PROGRAM_DISPLAY[block.program]} · {SCOPE_LABELS[scope]}
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Click a tile above to change the metric, a channel to show its sub-channels. Prior
              cohorts are cumulative through the same point of those cohorts.
            </p>
            {block.hasInCohort && metric !== 'leads' && (
              <div className="mt-2.5">
                <OriginPills origin={origin} onChange={setOrigin} metric={metric} />
              </div>
            )}
            {metric !== 'leads' && <InCohortShare block={block} scope={scope} />}
          </div>
          {expandableChannels.length > 0 && (
            <button
              onClick={() => setOpen(allOpen ? new Set() : new Set(expandableChannels))}
              className="shrink-0 text-[11px] text-gray-400 hover:text-white border border-white/10 rounded-md px-2.5 py-1"
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
        <MatrixTable block={viewBlock} scope={scope} metric={metric} open={open} onToggle={toggle} />
      </Card>

      <MatrixChart block={viewBlock} scope={scope} metric={metric} />

      <EconTable data={data} programKey={block.program} scope={scope} open={open} onToggle={toggle} />

      <Card className="p-5">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2.5">
          How to read this
        </h3>
        <ul className="text-[12px] text-gray-500 space-y-1.5 list-disc pl-4">
          <li>
            <span className="text-gray-400">Attribution model V2</span>{' '}
            (the doc&apos;s &ldquo;Channel Definitions&rdquo; tab): every lead and enrollment is
            credited to its <em>original</em>{' '}source, grouped Paid / Non-paid → channel →
            sub-channel. Read from &ldquo;{data.tab}&rdquo; and &ldquo;{data.econTab}&rdquo;; the
            retired V1 tabs are no longer read.
          </li>
          <li>
            <span className="text-gray-400">&ldquo;Paid&rdquo; is the doc&apos;s Paid tier</span>{' '}
            — Paid Search, Paid Social, Paid Other ({isCbs ? 'Open AI' : 'Employer Test'}), Paid
            Affiliate and Sponsored Content. This is broader than the old PPC-only definition. The
            &ldquo;of which PPC&rdquo; line (Paid Search + Paid Social) is the slice the Paid WoW tab
            and the Paid Marketing Aggregate page report
            {isCbs
              ? ' (CBS’s Paid WoW also counts Open AI). If the notes above report a channel folded into another row, this line won’t tie until the sheet is fixed.'
              : ', and ties to them.'}
          </li>
          <li>
            <span className="text-gray-400">Rollups are rebuilt from the sub-channels up,</span>{' '}
            so Paid + Non-paid always equals Total. Where the sheet&apos;s own subtotal row
            disagrees, it&apos;s listed in the notes at the top.
          </li>
          <li>
            <span className="text-gray-400">Prior-cohort columns are snapshots</span>{' '}imported
            from each program&apos;s own doc and refreshed by hand; only the current-cohort column
            is formula-driven. They are meant to sit at the same days-before-deadline as the
            current cohort, not full-cohort finals
            {data.alignment.length > 0 ? (
              <>
                {' '}— checked on every load against {data.alignmentSource}:{' '}
                {data.alignment.map(a =>
                  `${a.cohort} ${a.value.toLocaleString()} vs ${a.matchValue.toLocaleString()} at ` +
                  `${a.matchDay} days out${a.ok ? '' : ' (OUT OF LINE)'}`).join('; ')}
                {' '}(current cohort: {data.alignment[0].currentDay} days out)
              </>
            ) : ' (no pacing curve was reachable to check them against)'}
            . Blank cells mean the program predates that cohort
            {!isCbs && <> (RDI before Spring 2026)</>}.
          </li>
          {data.inCohortTab && (
            <li>
              <span className="text-gray-400">&ldquo;Enrollments from&rdquo;</span>{' '}splits
              enrollments by when the lead was created, from &ldquo;{data.inCohortTab}&rdquo;:
              this cohort&apos;s own window vs earlier cohorts&apos; leads enrolling now. CVR on
              this cohort&apos;s leads only is the like-for-like conversion rate — numerator and
              denominator from the same window.
            </li>
          )}
          <li>
            <span className="text-gray-400">CVR = enrollments ÷ leads</span>{' '}for the same
            cohort-to-date window. Sub-channels like SamCart and Inbound can exceed 100%: they
            record enrollments whose lead was never created under that channel.
          </li>
          <li>
            <span className="text-gray-400">Forecasts come from the doc&apos;s WoW tabs</span>{' '}
            and exist only for all channels and for the PPC slice, so &ldquo;% of forecast&rdquo;
            under Paid is the PPC slice&apos;s and under Non-paid is &ldquo;everything except
            PPC&rdquo;. It is always WoW-actual ÷ WoW-forecast, never a mix
            {wowLeads !== null && matrixLeads !== null &&
              ` — the WoW tab keys ${Math.round(wowLeads).toLocaleString()} leads to date ` +
              `against this matrix’s ${Math.round(matrixLeads).toLocaleString()}`}.
          </li>
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

/** Generic over the scope type so the paid-aggregate page can add its own
 *  per-platform PPC view beside the channel-tables scopes. */
export function ScopePills<S extends string = ChannelScope>({
  scope, onChange, scopes = ['all', 'paid', 'nonpaid'] as S[], labels,
}: {
  scope: S;
  onChange: (s: S) => void;
  scopes?: S[];
  labels?: Partial<Record<S, string>>;
}) {
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
          {labels?.[s] ?? SCOPE_LABELS[s as unknown as ChannelScope] ?? s}
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
