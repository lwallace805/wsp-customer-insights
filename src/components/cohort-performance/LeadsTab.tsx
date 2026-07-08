'use client';

import type { CommandLive } from '@/lib/pulseLive';
import { LEADS } from '@/data/proforma';
import ProFormaBanner from './ProFormaBanner';

function fmt(n: number | null | undefined) { return n === null || n === undefined ? '—' : n.toLocaleString(); }
function pct(n: number | null | undefined) { return n === null || n === undefined ? '—' : `${n.toFixed(1)}%`; }

function DeltaPct({ actual, forecast }: { actual: number | null; forecast: number | null }) {
  if (actual === null || forecast === null || forecast === 0) return <span className="text-gray-600">—</span>;
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
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min((value / Math.max(max, 1)) * 100, 100)}%` }} />
    </div>
  );
}

const TH = 'text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider';
const THL = 'text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider';

interface Props {
  family: 'wharton' | 'columbia';
  live?: CommandLive | null;
}

export default function LeadsTab({ family, live }: Props) {
  const detail = live?.leadsDetail ?? null;

  // ── LIVE path: weekly rows + program totals from Overall WoW ──
  if (live && detail && detail.weeks.length > 0) {
    const weeksWithAny = detail.weeks.filter(w => w.leads > 0 || (w.leadsForecast ?? 0) > 0);
    const maxWeek = Math.max(...weeksWithAny.map(w => Math.max(w.leads, w.leadsForecast ?? 0)), 1);
    return (
      <div className="space-y-6">
        <p className="text-[11px] text-gray-500">
          <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 mr-2">Live</span>
          {live.label} · Overall WoW Performance &amp; Goals (Jon&apos;s intake) · bot-excluded basis. This tab replaces the weekly Top-of-Funnel deck. Google-only breakout wires next (Paid WoW tab).
        </p>

        {/* Weekly volume */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">Weekly Lead Volume — actual vs forecast</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className={THL}>Week</th>
                  <th className={`${THL} w-1/4`}>Volume</th>
                  <th className={TH}>Leads</th>
                  <th className={TH}>Forecast</th>
                  <th className={TH}>Δ</th>
                  <th className={TH}>Enrolls</th>
                  <th className={TH}>Enroll fcst</th>
                </tr>
              </thead>
              <tbody>
                {weeksWithAny.map((w, i) => (
                  <tr key={w.week} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''} ${w.leads === 0 ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3 text-white whitespace-nowrap">
                      Wk {w.week} <span className="text-gray-500 text-xs">· {w.dateRange}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Bar value={w.leads} max={maxWeek} color="bg-blue-400" />
                      <Bar value={w.leadsForecast ?? 0} max={maxWeek} color="bg-gray-500/60" />
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">{w.leads > 0 ? fmt(w.leads) : '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{fmt(w.leadsForecast)}</td>
                    <td className="px-4 py-3 text-right">{w.leads > 0 ? <DeltaPct actual={w.leads} forecast={w.leadsForecast} /> : <span className="text-gray-600">—</span>}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(w.enrolls)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmt(w.enrollForecast)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-white/5 flex gap-5 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 rounded-full bg-blue-400 inline-block" /> Actual</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 rounded-full bg-gray-500/60 inline-block" /> Forecast</span>
            <span>Future weeks show forecast only</span>
          </div>
        </div>

        {/* Per-program pacing */}
        {detail.programs.length > 0 && (
          <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white">Lead Pacing by Program — cohort to date</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                &quot;Every cohort that underperformed simply had fewer leads than expected&quot; — lead pacing and conversion vs forecast, per program.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className={THL}>Program</th>
                    <th className={TH}>Leads to date</th>
                    <th className={TH}>Forecast</th>
                    <th className={TH}>Pacing</th>
                    <th className={TH}>CVR actual</th>
                    <th className={TH}>CVR forecast</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.programs.map((p, i) => {
                    const behindLeads = p.leads !== null && p.leadsF !== null && p.leads < p.leadsF;
                    const behindCvr = p.cvr !== null && p.cvrF !== null && p.cvr < p.cvrF;
                    return (
                      <tr key={p.program} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                        <td className="px-5 py-3 text-white font-medium">{p.program}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{fmt(p.leads)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{fmt(p.leadsF)}</td>
                        <td className="px-4 py-3 text-right"><DeltaPct actual={p.leads} forecast={p.leadsF} /></td>
                        <td className="px-4 py-3 text-right text-gray-300">{pct(p.cvr)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{pct(p.cvrF)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                            behindLeads || behindCvr
                              ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          }`}>
                            {behindLeads ? 'leads behind' : behindCvr ? 'CVR behind' : 'on track'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PRO FORMA fallback ──
  const data = LEADS[family];
  const maxWeek = Math.max(...data.weeks.map(w => Math.max(w.total, w.totalForecast)));
  return (
    <div className="space-y-6">
      <ProFormaBanner note="Illustrative lead data. The live version renders automatically for the active cohort when its cohort doc is reachable." />
      <p className="text-[11px] text-gray-500">{data.basisNote}</p>
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Weekly Lead Volume — Total &amp; Google Breakout</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className={THL}>Week</th>
                <th className={`${THL} w-1/4`}>Volume</th>
                <th className={TH}>Total</th>
                <th className={TH}>Forecast</th>
                <th className={TH}>Δ</th>
                <th className={TH}>Google</th>
                <th className={TH}>Google fcst</th>
                <th className={TH}>Δ</th>
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
      </div>
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Lead Pacing by Program — CVR Needed to Hit Goal</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className={THL}>Program</th>
                <th className={TH}>Leads to date</th>
                <th className={TH}>Forecast</th>
                <th className={TH}>Pacing</th>
                <th className={TH}>CVR needed</th>
                <th className={TH}>Historical CVR</th>
              </tr>
            </thead>
            <tbody>
              {data.programs.map((p, i) => (
                <tr key={p.program} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="px-5 py-3 text-white font-medium">{p.program}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(p.leadsToDate)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt(p.leadsForecast)}</td>
                  <td className="px-4 py-3 text-right"><DeltaPct actual={p.leadsToDate} forecast={p.leadsForecast} /></td>
                  <td className="px-4 py-3 text-right text-gray-300">{p.cvrNeeded.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-gray-500">{p.cvrHistorical.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
