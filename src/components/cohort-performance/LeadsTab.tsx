'use client';

import { LEADS } from '@/data/proforma';

function fmt(n: number) { return n.toLocaleString(); }

function DeltaPct({ actual, forecast }: { actual: number; forecast: number }) {
  const d = ((actual - forecast) / forecast) * 100;
  const good = d >= 0;
  return (
    <span className={`font-medium ${good ? 'text-emerald-400' : 'text-red-400'}`}>
      {good ? '+' : ''}{d.toFixed(0)}%
    </span>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="w-full bg-white/5 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
    </div>
  );
}

interface Props {
  family: 'wharton' | 'columbia';
}

export default function LeadsTab({ family }: Props) {
  const data = LEADS[family];
  const maxWeek = Math.max(...data.weeks.map(w => Math.max(w.total, w.totalForecast)));

  return (
    <div className="space-y-6">
      <p className="text-[11px] text-gray-500">{data.basisNote} This tab replaces the weekly Top-of-Funnel deck — same four views, always current.</p>

      {/* Weekly: total + Google breakout */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Weekly Lead Volume — Total &amp; Google Breakout</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Google separated per the post-fraud playbook: big Google swings drove past misses, so it gets its own forecast line.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Week</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-1/4">Volume</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Forecast</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Δ</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Google</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Google fcst</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Δ</th>
              </tr>
            </thead>
            <tbody>
              {data.weeks.map((w, i) => (
                <tr key={w.week} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="px-5 py-3 text-white whitespace-nowrap">
                    Wk {w.week} <span className="text-gray-500 text-xs">· {w.dateRange}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Bar value={w.total} max={maxWeek} color="bg-blue-400" />
                    <Bar value={w.google} max={maxWeek} color="bg-orange-400/70" />
                  </td>
                  <td className="px-4 py-3 text-right text-white font-medium">{fmt(w.total)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{fmt(w.totalForecast)}</td>
                  <td className="px-4 py-3 text-right"><DeltaPct actual={w.total} forecast={w.totalForecast} /></td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(w.google)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt(w.googleForecast)}</td>
                  <td className="px-4 py-3 text-right"><DeltaPct actual={w.google} forecast={w.googleForecast} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2.5 border-t border-white/5 flex gap-5 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 rounded-full bg-blue-400 inline-block" /> Total leads</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 rounded-full bg-orange-400/70 inline-block" /> Google only</span>
        </div>
      </div>

      {/* Per-program lead pacing + CVR lift needed */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Lead Pacing by Program — CVR Needed to Hit Goal</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            &quot;Every cohort that underperformed simply had fewer leads than expected&quot; — this table is the early-warning view: given lead pacing, what CVR does each program need vs. what it historically converts?
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Program</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Leads to date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Forecast</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Pacing</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CVR needed</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Historical CVR</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Risk</th>
              </tr>
            </thead>
            <tbody>
              {data.programs.map((p, i) => {
                const pacing = ((p.leadsToDate - p.leadsForecast) / p.leadsForecast) * 100;
                const atRisk = p.cvrNeeded > p.cvrHistorical;
                return (
                  <tr key={p.program} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                    <td className="px-5 py-3 text-white font-medium">{p.program}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(p.leadsToDate)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmt(p.leadsForecast)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${pacing >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pacing >= 0 ? '+' : ''}{pacing.toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{p.cvrNeeded.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-gray-500">{p.cvrHistorical.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                        atRisk
                          ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {atRisk ? 'CVR lift needed' : 'on track'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
