'use client';

import { useEffect, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ExternalLink, AlertTriangle, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import type {
  BudgetPacingData, BudgetPacingChannel, BudgetChannel,
} from '@/lib/performance/budgetPlanTypes';
import { BUDGET_CHANNELS } from '@/lib/performance/budgetPlanTypes';

interface ApiResponse {
  live: BudgetPacingData | null;
  needsAccess: boolean;
  serviceAccount?: string | null;
  sheetId?: string | null;
  error?: string | null;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function money(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
function moneyK(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function signedMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return `${n < 0 ? '−' : '+'}${money(Math.abs(n))}`;
}
function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}
function signedPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return `${n < 0 ? '−' : '+'}${(Math.abs(n) * 100).toFixed(1)}%`;
}
function num(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
function fmtDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Spend variance is a pacing fact, not a win: within ±10% of plan reads
 *  neutral, further out is flagged in amber, far out in red. */
function varianceClass(r: number | null): string {
  if (r === null || !isFinite(r)) return 'text-gray-400';
  const a = Math.abs(r);
  if (a <= 0.10) return 'text-emerald-400';
  if (a <= 0.25) return 'text-amber-400';
  return 'text-red-400';
}

const CHANNEL_COLORS: Record<BudgetChannel, string> = {
  Google: '#4285F4', Bing: '#00A4EF', Meta: '#8b5cf6', LinkedIn: '#0A66C2',
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#161b22] border border-white/10 rounded-xl ${className}`}>{children}</div>;
}

function LiveChip() {
  return (
    <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
      Live
    </span>
  );
}

function Kpi({ label, value, sub, subClass = 'text-gray-500' }: {
  label: string; value: string; sub?: string; subClass?: string;
}) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className="text-2xl font-semibold text-white mt-1 tabular-nums">{value}</div>
      {sub && <div className={`text-[11px] mt-1.5 ${subClass}`}>{sub}</div>}
    </div>
  );
}

const TH = 'text-right px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap';
const THL = 'text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider';
const TD = 'px-4 py-2.5 text-right tabular-nums';
const TDL = 'px-5 py-2.5 text-left';

// ─── Channel table ────────────────────────────────────────────────────────────

function ChannelTable({ rows, data }: { rows: BudgetPacingChannel[]; data: BudgetPacingData }) {
  const wk = data.alignment.currentWeek;
  const priorLabel = data.plan.summary?.priorLabel ?? 'Prior cohort';
  const hasActuals = data.actuals !== null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className={THL}>Channel</th>
            <th className={TH}>Budget</th>
            <th className={TH}>Share</th>
            <th className={TH}>Planned to date</th>
            <th className={TH}>Actual to date</th>
            <th className={TH}>Variance</th>
            <th className={TH}>vs plan</th>
            <th className={TH}>Plan thru wk {wk ?? '—'}</th>
            <th className={TH}>Doc forecast</th>
            <th className={TH}>{priorLabel.replace(/\s*actual$/i, '')} final</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isTotal = r.channel === 'Total';
            const color = isTotal ? undefined : CHANNEL_COLORS[r.channel as BudgetChannel];
            return (
              <tr
                key={r.channel}
                className={`border-b border-white/5 ${isTotal ? 'bg-white/[0.03] font-semibold' : ''}`}
              >
                <td className={`${TDL} text-white`}>
                  <span className="inline-flex items-center gap-2">
                    {color && <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                    {r.channel}
                    {r.budget === null && !isTotal && (
                      <span className="text-[10px] text-amber-400 font-normal">plan withheld</span>
                    )}
                  </span>
                </td>
                <td className={`${TD} text-gray-200`}>{money(r.budget)}</td>
                <td className={`${TD} text-gray-400`}>{pct(r.share)}</td>
                <td className={`${TD} text-gray-200`}>{money(r.plannedToDate)}</td>
                <td className={`${TD} text-white`}>{hasActuals ? money(r.actualToDate) : '—'}</td>
                <td className={`${TD} ${varianceClass(r.variancePct)}`}>{hasActuals ? signedMoney(r.variance) : '—'}</td>
                <td className={`${TD} ${varianceClass(r.variancePct)}`}>{hasActuals ? signedPct(r.variancePct) : '—'}</td>
                <td className={`${TD} text-gray-400`}>{money(r.plannedThroughWeek)}</td>
                <td className={`${TD} text-gray-400`}>{hasActuals ? money(r.docForecastToDate) : '—'}</td>
                <td className={`${TD} text-gray-400`}>{money(r.priorActual)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Weekly chart ─────────────────────────────────────────────────────────────

function WeeklyChart({ data }: { data: BudgetPacingData }) {
  const present = BUDGET_CHANNELS.filter(ch => data.plan.channels[ch]);
  const hasActuals = data.actuals !== null;
  const rows = data.weekly.map(w => ({
    name: `W${w.week}`,
    label: `Week ${w.week} · ${w.dateRange}${w.bucket ? ` · ${w.bucket}` : ''}`,
    ...Object.fromEntries(present.map(ch => [ch, w.plannedByChannel[ch] ?? 0])),
    Actual: hasActuals && w.status !== 'future' ? (w.actual ?? 0) : null,
    'Cumulative plan': w.cumPlanned,
    'Cumulative actual': w.cumActual,
    status: w.status,
  }));
  const cur = data.alignment.currentWeek;
  return (
    <div style={{ height: 340 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={{ stroke: '#ffffff20' }} tickLine={false} />
          <YAxis
            yAxisId="week"
            tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false}
            tickFormatter={(v: number) => moneyK(v)} width={64}
          />
          <YAxis
            yAxisId="cum" orientation="right"
            tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false}
            tickFormatter={(v: number) => moneyK(v)} width={64}
          />
          <Tooltip
            contentStyle={{ background: '#161b22', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#fff' }}
            labelFormatter={(_, payload) => (payload?.[0]?.payload as { label?: string } | undefined)?.label ?? ''}
            formatter={(v) => money(typeof v === 'number' ? v : null)}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#8b949e' }} />
          {cur !== null && (
            <ReferenceLine yAxisId="week" x={`W${cur}`} stroke="#fbbf24" strokeDasharray="4 3" label={{ value: 'now', fill: '#fbbf24', fontSize: 11, position: 'top' }} />
          )}
          {present.map(ch => (
            <Bar key={ch} yAxisId="week" dataKey={ch} stackId="plan" fill={CHANNEL_COLORS[ch]} radius={0} />
          ))}
          {hasActuals && <Bar yAxisId="week" dataKey="Actual" fill="#e5e7eb" radius={[3, 3, 0, 0]} />}
          <Line yAxisId="cum" type="monotone" dataKey="Cumulative plan" stroke="#64748b" strokeWidth={2} dot={false} strokeDasharray="5 3" />
          {hasActuals && (
            <Line yAxisId="cum" type="monotone" dataKey="Cumulative actual" stroke="#34d399" strokeWidth={2} dot={false} connectNulls={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Weekly table ─────────────────────────────────────────────────────────────

function WeeklyTable({ data }: { data: BudgetPacingData }) {
  const present = BUDGET_CHANNELS.filter(ch => data.plan.channels[ch]);
  const hasActuals = data.actuals !== null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className={THL}>Week</th>
            <th className={`${THL} px-4`}>Dates</th>
            <th className={`${THL} px-4`}>Bucket</th>
            {present.map(ch => <th key={ch} className={TH}>{ch}</th>)}
            <th className={TH}>Planned</th>
            {hasActuals && <th className={TH}>Actual</th>}
            <th className={TH}>Cum. plan</th>
            {hasActuals && <th className={TH}>Cum. actual</th>}
          </tr>
        </thead>
        <tbody>
          {data.weekly.map(w => (
            <tr
              key={w.week}
              className={`border-b border-white/5 ${
                w.status === 'current' ? 'bg-amber-500/[0.06]' : w.status === 'future' ? 'text-gray-500' : ''
              }`}
            >
              <td className={`${TDL} text-white tabular-nums`}>
                {w.week}
                {w.status === 'current' && <span className="ml-2 text-[10px] text-amber-400 uppercase">now</span>}
              </td>
              <td className={`${TDL} px-4 text-gray-400 whitespace-nowrap`}>{w.dateRange}</td>
              <td className={`${TDL} px-4 text-gray-400 whitespace-nowrap`}>{w.bucket || '—'}</td>
              {present.map(ch => (
                <td key={ch} className={`${TD} text-gray-300`}>{money(w.plannedByChannel[ch])}</td>
              ))}
              <td className={`${TD} text-gray-200 font-medium`}>{money(w.planned)}</td>
              {hasActuals && <td className={`${TD} text-white`}>{w.status === 'future' ? '—' : money(w.actual)}</td>}
              <td className={`${TD} text-gray-400`}>{money(w.cumPlanned)}</td>
              {hasActuals && <td className={`${TD} text-gray-400`}>{money(w.cumActual)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Buckets ──────────────────────────────────────────────────────────────────

function BucketTable({ data }: { data: BudgetPacingData }) {
  const buckets = data.plan.byBucket ?? [];
  const present = BUDGET_CHANNELS.filter(ch => data.plan.channels[ch]);
  const total = data.plan.totalBudget;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className={THL}>Days to deadline</th>
            <th className={`${THL} px-4`}>Weeks</th>
            {present.map(ch => <th key={ch} className={TH}>{ch}</th>)}
            <th className={TH}>Planned</th>
            <th className={TH}>% of budget</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map(b => (
            <tr key={b.bucket} className="border-b border-white/5">
              <td className={`${TDL} text-white`}>{b.bucket || '—'}</td>
              <td className={`${TDL} px-4 text-gray-400 tabular-nums`}>
                {b.weeks.length > 1 ? `${b.weeks[0]}–${b.weeks[b.weeks.length - 1]}` : b.weeks[0]}
              </td>
              {present.map(ch => <td key={ch} className={`${TD} text-gray-300`}>{money(b.byChannel[ch])}</td>)}
              <td className={`${TD} text-gray-200 font-medium`}>{money(b.total)}</td>
              <td className={`${TD} text-gray-400`}>{total ? pct(b.total / total) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Executive summary tables ─────────────────────────────────────────────────

function ChannelMixTable({ data }: { data: BudgetPacingData }) {
  const rows = data.plan.summary?.channelMix ?? [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className={THL}>Channel</th>
            <th className={TH}>Budget</th>
            <th className={TH}>% of total</th>
            <th className={TH}>Proj. enrollments</th>
            <th className={TH}>Proj. CPE</th>
            <th className={TH}>Proj. leads</th>
            <th className={TH}>Proj. CPL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isTotal = /^total$/i.test(r.channel);
            return (
              <tr key={r.channel} className={`border-b border-white/5 ${isTotal ? 'bg-white/[0.03] font-semibold' : ''}`}>
                <td className={`${TDL} text-white`}>{r.channel}</td>
                <td className={`${TD} text-gray-200`}>{money(r.budget)}</td>
                <td className={`${TD} text-gray-400`}>{pct(r.share)}</td>
                <td className={`${TD} text-gray-300`}>{num(r.projEnrollments)}</td>
                <td className={`${TD} text-gray-300`}>{money(r.projCpe)}</td>
                <td className={`${TD} text-gray-300`}>{num(r.projLeads)}</td>
                <td className={`${TD} text-gray-300`}>{money(r.projCpl, 2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProgramMatrix({ data }: { data: BudgetPacingData }) {
  const rows = data.plan.summary?.programByChannel ?? [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className={THL}>Program</th>
            {BUDGET_CHANNELS.map(ch => <th key={ch} className={TH}>{ch}</th>)}
            <th className={TH}>Total</th>
            <th className={TH}>Enrollments</th>
            <th className={TH}>CPE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isTotal = /^total$/i.test(r.program);
            return (
              <tr key={r.program} className={`border-b border-white/5 ${isTotal ? 'bg-white/[0.03] font-semibold' : ''}`}>
                <td className={`${TDL} text-white`}>{r.program}</td>
                {BUDGET_CHANNELS.map(ch => (
                  <td key={ch} className={`${TD} text-gray-300`}>{money(r.byChannel[ch])}</td>
                ))}
                <td className={`${TD} text-gray-200`}>{money(r.total)}</td>
                <td className={`${TD} text-gray-300`}>{num(r.enrollments)}</td>
                <td className={`${TD} text-gray-300`}>{money(r.cpe)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetPacingDashboard() {
  const [res, setRes] = useState<ApiResponse | null>(null);
  const [showChecks, setShowChecks] = useState(false);
  const [showWeeks, setShowWeeks] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/performance/budget-pacing')
      .then(r => r.json() as Promise<ApiResponse>)
      .then(r => { if (!cancelled) setRes(r); })
      .catch(e => { if (!cancelled) setRes({ live: null, needsAccess: false, error: String(e) }); });
    return () => { cancelled = true; };
  }, []);

  if (res === null) {
    return <div className="text-gray-500 text-sm py-16 text-center">Loading budget plan…</div>;
  }
  const data = res.live;
  if (!data) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold text-white mb-4">Budget Pacing — Wharton</h1>
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-gray-300 space-y-2">
              <p className="font-semibold text-white">Budget pacing unavailable</p>
              {res.needsAccess ? (
                <p>
                  The service account can&apos;t open the budget workbook. Share it (Viewer) with{' '}
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

  const total = data.channels.find(c => c.channel === 'Total');
  const channelRows = data.channels.filter(c => c.channel !== 'Total');
  const wk = data.alignment.currentWeek;
  const curWeek = wk !== null ? data.weekly.find(w => w.week === wk) : undefined;
  const nWeeks = data.plan.weeks.length;
  const spentShare = total?.budget && total.actualToDate !== null ? total.actualToDate / total.budget : null;
  const plannedShare = total?.budget && total.plannedToDate !== null ? total.plannedToDate / total.budget : null;
  const failed = data.plan.checks.filter(c => !c.ok);
  const hasActuals = data.actuals !== null;
  const planUrl = `https://docs.google.com/spreadsheets/d/${data.plan.sheetId}/edit`;
  const docUrl = data.actuals ? `https://docs.google.com/spreadsheets/d/${data.actuals.sheetId}/edit` : null;
  const priorLabel = data.plan.summary?.priorLabel ?? 'Prior cohort';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-white">Budget Pacing — Wharton</h1>
            <LiveChip />
            <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-white/5 text-gray-400 border-white/15">
              Internal
            </span>
          </div>
          <p className="text-[13px] text-gray-500 mt-1">
            {data.plan.docTitle} · {data.cohort.termLabel}
            {wk !== null && <> · week {wk} of {nWeeks}{curWeek?.bucket ? ` (${curWeek.bucket})` : ''}</>}
            {' '}· planned through {fmtDate(data.alignment.throughDate)} · as of {fmtDate(data.asOf)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={planUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 transition-colors">
            <ExternalLink size={13} /> Budget workbook
          </a>
          {docUrl && (
            <a href={docUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 transition-colors">
              <ExternalLink size={13} /> Cohort doc
            </a>
          )}
        </div>
      </div>

      {/* Reader warnings — anything withheld or failing a check */}
      {(failed.length > 0 || data.plan.notes.length > 0) && (
        <Card className="p-4 border-amber-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-[12px] text-gray-300 space-y-1">
              {failed.length > 0 && (
                <p className="text-amber-300 font-medium">
                  {failed.length} source check{failed.length > 1 ? 's' : ''} failed — see “Source checks” below.
                </p>
              )}
              {data.plan.notes.map(n => <p key={n}>{n}</p>)}
            </div>
          </div>
        </Card>
      )}

      {/* Actuals cross-check: the doc's raw Ad Spend tab vs its Paid WoW roll-up */}
      {data.actuals?.adSpend && !data.actuals.adSpend.agreesWithPaidWoW && (
        <Card className="p-4 border-red-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <div className="text-[12px] text-gray-300 space-y-1">
              <p className="text-red-300 font-medium">
                Actual spend may be unrolled-up in the cohort doc — read the variance with care.
              </p>
              <p>
                “{data.actuals.tab}” reports {money(data.actuals.totalSpend)} paid spend to date, but the doc&apos;s
                “{data.actuals.adSpend.tab}” tab has {money(data.actuals.adSpend.total)} keyed
                {data.actuals.adSpend.lastKeyedDate && <> through {fmtDate(data.actuals.adSpend.lastKeyedDate)}</>}
                {' '}({BUDGET_CHANNELS.filter(ch => (data.actuals!.adSpend!.byChannel[ch] ?? 0) !== 0)
                  .map(ch => `${ch} ${money(data.actuals!.adSpend!.byChannel[ch])}`).join(', ') || 'no channel'}).
                The Paid WoW tab is the hub&apos;s paid source, so it is still what &ldquo;Actual to date&rdquo; shows.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Kpi label="Cohort paid budget" value={money(total?.budget)} sub={`${nWeeks} planned weeks · ${data.cohort.label}`} />
        <Kpi
          label="Planned to date" value={money(total?.plannedToDate)}
          sub={plannedShare !== null ? `${pct(plannedShare)} of budget · through ${fmtDate(data.alignment.throughDate)}` : undefined}
        />
        <Kpi
          label="Actual to date" value={hasActuals ? money(total?.actualToDate) : '—'}
          sub={hasActuals ? (spentShare !== null ? `${pct(spentShare)} of budget · cohort doc` : 'cohort doc') : 'cohort doc unavailable'}
        />
        <Kpi
          label="Variance vs plan" value={hasActuals ? signedMoney(total?.variance) : '—'}
          sub={hasActuals ? `${signedPct(total?.variancePct)} · actual − planned` : undefined}
          subClass={varianceClass(total?.variancePct ?? null)}
        />
        <Kpi
          label={`Plan thru week ${wk ?? '—'}`} value={money(total?.plannedThroughWeek)}
          sub={curWeek ? `full week · ${curWeek.dateRange}` : undefined}
        />
        <Kpi
          label="Doc forecast to date" value={hasActuals ? money(total?.docForecastToDate) : '—'}
          sub="cohort doc's own spend forecast"
        />
      </div>

      {/* Per-channel plan vs actual */}
      <Card>
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Plan vs actual by channel — to date</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Planned to date = whole weeks ended + the current week&apos;s daily plan × {data.alignment.daysIntoWeek} complete day{data.alignment.daysIntoWeek === 1 ? '' : 's'}.
            Actual = the cohort doc&apos;s cohort-to-date spend per channel.
            {' '}{priorLabel.replace(/\s*actual$/i, '')} final is the whole prior cohort, not week-aligned.
          </p>
        </div>
        <ChannelTable rows={[...channelRows, ...(total ? [total] : [])]} data={data} />
      </Card>

      {/* Weekly curve */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Planned weekly spend{hasActuals ? ' vs actual' : ''}</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Stacked bars are the plan by channel; the grey bar is the week&apos;s actual all-paid spend.
              Lines are cumulative (right axis). Week 1 is the partial opening week.
            </p>
          </div>
          <button
            onClick={() => setShowWeeks(v => !v)}
            className="inline-flex items-center gap-1 text-[12px] text-gray-400 hover:text-white"
          >
            {showWeeks ? 'Hide' : 'Show'} weekly table
            <ChevronDown size={13} className={`transition-transform ${showWeeks ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <WeeklyChart data={data} />
        {showWeeks && <div className="mt-4 -mx-5 -mb-5 border-t border-white/10"><WeeklyTable data={data} /></div>}
      </Card>

      {/* Buckets */}
      {data.plan.byBucket && (
        <Card>
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">Planned spend by days to deadline</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              The workbook&apos;s own phase buckets, summed from the weekly plan per channel.
            </p>
          </div>
          <BucketTable data={data} />
        </Card>
      )}

      {/* Executive Budget Summary */}
      {data.plan.summary?.channelMix && (
        <Card>
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">Channel mix — Executive Budget Summary</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              From “{data.plan.summaryTab}”: the plan&apos;s channel budgets and the projections they were set with.
            </p>
          </div>
          <ChannelMixTable data={data} />
        </Card>
      )}
      {data.plan.summary?.programByChannel && (
        <Card>
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">Program × channel — {data.plan.summary.planLabel}</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Planned spend per program and channel from the Executive Budget Summary. Cohort totals only — the
              weekly plan is not split by program.
            </p>
          </div>
          <ProgramMatrix data={data} />
        </Card>
      )}

      {/* Source checks */}
      <Card className="p-5">
        <button
          onClick={() => setShowChecks(v => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Source checks — {data.plan.checks.length - failed.length} of {data.plan.checks.length} passed
          </span>
          <ChevronDown size={14} className={`text-gray-500 transition-transform ${showChecks ? 'rotate-180' : ''}`} />
        </button>
        {showChecks && (
          <ul className="mt-3 space-y-1.5 text-[12px]">
            {data.plan.checks.map(c => (
              <li key={c.name} className="flex items-start gap-2">
                {c.ok
                  ? <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                  : <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />}
                <span className={c.ok ? 'text-gray-300' : 'text-red-300'}>
                  {c.name} <span className="text-gray-500">— {c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* How to read this */}
      <Card className="p-5">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2.5">How to read this</h3>
        <ul className="text-[12px] text-gray-500 space-y-1.5 list-disc pl-4">
          <li><span className="text-gray-400">Alignment.</span> {data.alignment.note}</li>
          {data.notes.map(n => <li key={n}>{n}</li>)}
          <li>
            <span className="text-gray-400">Sources.</span> Plan: “{data.plan.pacingTab}”
            {data.plan.summaryTab && <> and “{data.plan.summaryTab}”</>} in {data.plan.docTitle}.
            {data.actuals && <> Actual: “{data.actuals.tab}” in {data.actuals.docTitle}.</>}
            {' '}Every block is checked against the sheet&apos;s own TOTAL rows on each read; a block that stops
            reconciling is withheld rather than shown.
          </li>
          <li>
            <span className="text-gray-400">Variance colour</span> is pacing, not performance: within ±10% of plan
            is green, ±25% amber, beyond that red. Underspend is not a win and overspend is not a loss.
          </li>
          <li>
            <span className="text-gray-400">Internal only.</span> Budget figures never appear on the external
            Wharton partner page.
          </li>
        </ul>
      </Card>
    </div>
  );
}
