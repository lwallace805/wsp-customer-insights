'use client';

import { useState, Fragment } from 'react';
import {
  FULL_FUNNEL,
  COMPARISON_LABELS,
  type ComparisonKey,
  type FunnelRow,
} from '@/data/proforma';

function fmtVal(n: number, format: FunnelRow['format']) {
  switch (format) {
    case 'usd': return `$${Math.round(n).toLocaleString()}`;
    case 'usd2': return `$${n.toFixed(2)}`;
    case 'pct': return `${n.toFixed(1)}%`;
    default: return Math.round(n).toLocaleString();
  }
}

function DeltaCell({ actual, reference, higherIsBetter, format }: {
  actual: number; reference: number; higherIsBetter: boolean; format: FunnelRow['format'];
}) {
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

interface Props {
  family: 'wharton' | 'columbia';
}

export default function FullFunnelTab({ family }: Props) {
  const data = FULL_FUNNEL[family];
  const [comparison, setComparison] = useState<ComparisonKey>('prior');
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Context bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-white font-medium">
            Full funnel · day-out aligned <span className="text-gray-500 font-normal">· {data.dayOut} days to deadline · {data.phase}</span>
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">{data.phaseNote}</p>
        </div>
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

      {/* Funnel table */}
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
              {data.rows.map((row, i) => {
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
        <p className="px-5 py-3 text-[11px] text-gray-500 border-t border-white/5">
          Click a row to expand per-program detail. Comparisons are day-out aligned (&quot;equal days&quot;), not calendar aligned — the picker replaces the hardcoded cross-sheet formulas that kept breaking in the old Health Check tab. Per-program prior values shown for the prior-cohort comparison; demo data.
        </p>
      </div>
    </div>
  );
}
