'use client';

import { useState, Fragment } from 'react';
import type { CommandLive, WoWProgramRow } from '@/lib/pulseLive';
import {
  FULL_FUNNEL,
  COMPARISON_LABELS,
  type ComparisonKey,
  type FunnelRow,
} from '@/data/proforma';
import ProFormaBanner from './ProFormaBanner';

type Fmt = 'usd' | 'usd2' | 'int' | 'pct';

function fmtVal(n: number | null | undefined, format: Fmt) {
  if (n === null || n === undefined) return '—';
  switch (format) {
    case 'usd': return `$${Math.round(n).toLocaleString()}`;
    case 'usd2': return `$${n.toFixed(2)}`;
    case 'pct': return `${n.toFixed(1)}%`;
    default: return Math.round(n).toLocaleString();
  }
}

function DeltaCell({ actual, reference, higherIsBetter, format }: {
  actual: number | null; reference: number | null; higherIsBetter: boolean; format: Fmt;
}) {
  if (actual === null || reference === null || reference === 0) return <span className="text-gray-600">—</span>;
  const isPctPoint = format === 'pct';
  const delta = isPctPoint ? actual - reference : ((actual - reference) / reference) * 100;
  const good = higherIsBetter ? delta >= 0 : delta <= 0;
  const sign = delta >= 0 ? '+' : '';
  return (
    <span className={`font-medium ${good ? 'text-emerald-400' : 'text-red-400'}`}>
      {sign}{delta.toFixed(isPctPoint ? 1 : 0)}{isPctPoint ? 'pt' : '%'}
    </span>
  );
}

interface LiveRow {
  metric: string;
  format: Fmt;
  higherIsBetter: boolean;
  toDate: number | null;
  forecast: number | null;
  perProgram: Array<{ program: string; toDate: number | null; forecast: number | null }>;
}

function buildLiveRows(live: CommandLive): LiveRow[] | null {
  const t = live.totals;
  if (!t) return null;
  const progs = live.leadsDetail?.programs ?? [];
  const pp = (f: (p: WoWProgramRow) => [number | null, number | null]) =>
    progs.map(p => { const [a, b] = f(p); return { program: p.program, toDate: a, forecast: b }; });
  return [
    { metric: 'Spend', format: 'usd', higherIsBetter: false, toDate: t.spend, forecast: t.spendF, perProgram: pp(p => [p.spend, null]) },
    { metric: 'CPL', format: 'usd2', higherIsBetter: false, toDate: t.cpl, forecast: t.cplF, perProgram: pp(p => [p.cpl, null]) },
    { metric: 'Leads', format: 'int', higherIsBetter: true, toDate: t.leads, forecast: t.leadsF, perProgram: pp(p => [p.leads, p.leadsF]) },
    { metric: 'Lead → Enroll CVR', format: 'pct', higherIsBetter: true, toDate: t.cvr, forecast: t.cvrF, perProgram: pp(p => [p.cvr, p.cvrF]) },
    { metric: 'Enrollments', format: 'int', higherIsBetter: true, toDate: t.enrolls, forecast: t.enrollsF, perProgram: pp(p => [p.enrolls, p.enrollsF]) },
    { metric: 'CPE', format: 'usd', higherIsBetter: false, toDate: t.cpe, forecast: t.cpeF, perProgram: pp(p => [p.cpe, null]) },
  ];
}

interface Props {
  family: 'wharton' | 'columbia';
  live?: CommandLive | null;
}

export default function FullFunnelTab({ family, live }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonKey>('prior');

  const liveRows = live ? buildLiveRows(live) : null;

  // ── LIVE path: to-date + forecast from the cohort doc's Overall WoW totals ──
  if (live && liveRows) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm text-white font-medium">
              Full funnel — {live.label}
              <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 ml-2">Live</span>
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Cohort-to-date actuals and forecasts from the Overall WoW totals block (Jon&apos;s intake). Day-out-aligned prior-cohort comparison wires next — it needs the historical daily grain.
            </p>
          </div>
        </div>

        <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Metric</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cohort to date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Forecast</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Δ vs forecast</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Prior cohort @ same day-out</th>
                </tr>
              </thead>
              <tbody>
                {liveRows.map((row, i) => {
                  const isOpen = expanded === row.metric;
                  const expandable = row.perProgram.length > 0;
                  return (
                    <Fragment key={row.metric}>
                      <tr
                        onClick={() => expandable && setExpanded(isOpen ? null : row.metric)}
                        className={`border-b border-white/5 ${expandable ? 'cursor-pointer hover:bg-white/[0.04]' : ''} transition-colors ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                      >
                        <td className="px-5 py-3 text-white font-medium">
                          <span className={`inline-block w-3 text-gray-600 transition-transform ${isOpen ? 'rotate-90' : ''}`}>{expandable ? '▸' : ''}</span>
                          {row.metric}
                        </td>
                        <td className="px-4 py-3 text-right text-white font-medium">{fmtVal(row.toDate, row.format)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{fmtVal(row.forecast, row.format)}</td>
                        <td className="px-4 py-3 text-right">
                          <DeltaCell actual={row.toDate} reference={row.forecast} higherIsBetter={row.higherIsBetter} format={row.format} />
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 text-xs italic">wires next</td>
                      </tr>
                      {isOpen && row.perProgram.map(p => (
                        <tr key={`${row.metric}-${p.program}`} className="border-b border-white/5 bg-black/20">
                          <td className="pl-12 pr-5 py-2 text-gray-400 text-xs">{p.program}</td>
                          <td className="px-4 py-2 text-right text-gray-300 text-xs">{fmtVal(p.toDate, row.format)}</td>
                          <td className="px-4 py-2 text-right text-gray-500 text-xs">{fmtVal(p.forecast, row.format)}</td>
                          <td className="px-4 py-2 text-right text-xs">
                            <DeltaCell actual={p.toDate} reference={p.forecast} higherIsBetter={row.higherIsBetter} format={row.format} />
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600 text-xs italic">—</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[11px] text-gray-500 border-t border-white/5">
            Click a row to expand per-program detail (live from the same WoW block). Enrollments here use the WoW basis so CVR stays internally consistent; the headline count on Overview/Pulse comes from the deadline pacing table and may lead by a day.
          </p>
        </div>
      </div>
    );
  }

  // ── PRO FORMA fallback (closed cohorts / live source unavailable) ──
  const data = FULL_FUNNEL[family];
  return (
    <div className="space-y-6">
      <ProFormaBanner note="This full-funnel comparison view is illustrative. The live version renders automatically for the active cohort when its cohort doc is reachable." />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[11px] text-gray-500">{data.phaseNote}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Compare vs</span>
          <select
            value={comparison}
            onChange={e => setComparison(e.target.value as ComparisonKey)}
            className="bg-[#161b22] border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/20"
          >
            {(Object.keys(COMPARISON_LABELS) as ComparisonKey[]).map(k => (
              <option key={k} value={k}>{COMPARISON_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Metric</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cohort to date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Forecast</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Δ vs forecast</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{COMPARISON_LABELS[comparison]} @ same day-out</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Δ vs prior</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row: FunnelRow, i: number) => {
                const isOpen = expanded === row.metric;
                const prior = row.prior[comparison];
                return (
                  <Fragment key={row.metric}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : row.metric)}
                      className={`border-b border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                    >
                      <td className="px-5 py-3 text-white font-medium">
                        <span className={`inline-block w-3 text-gray-600 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▸</span>
                        {row.metric}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-medium">{fmtVal(row.toDate, row.format)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{fmtVal(row.forecast, row.format)}</td>
                      <td className="px-4 py-3 text-right">
                        <DeltaCell actual={row.toDate} reference={row.forecast} higherIsBetter={row.higherIsBetter} format={row.format} />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">{fmtVal(prior, row.format)}</td>
                      <td className="px-4 py-3 text-right">
                        <DeltaCell actual={row.toDate} reference={prior} higherIsBetter={row.higherIsBetter} format={row.format} />
                      </td>
                    </tr>
                    {isOpen && row.perProgram.map(p => (
                      <tr key={`${row.metric}-${p.program}`} className="border-b border-white/5 bg-black/20">
                        <td className="pl-12 pr-5 py-2 text-gray-400 text-xs">{p.program}</td>
                        <td className="px-4 py-2 text-right text-gray-300 text-xs">{fmtVal(p.toDate, row.format)}</td>
                        <td className="px-4 py-2 text-right text-gray-500 text-xs">{fmtVal(p.forecast, row.format)}</td>
                        <td className="px-4 py-2 text-right text-xs">
                          <DeltaCell actual={p.toDate} reference={p.forecast} higherIsBetter={row.higherIsBetter} format={row.format} />
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500 text-xs">{fmtVal(p.prior, row.format)}</td>
                        <td className="px-4 py-2 text-right text-xs">
                          <DeltaCell actual={p.toDate} reference={p.prior} higherIsBetter={row.higherIsBetter} format={row.format} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
