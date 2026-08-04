'use client';

import type { CohortData } from '@/data/cohortPerformance';
import ProFormaBanner from './ProFormaBanner';

function fmtDollar(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return n === 0 ? '—' : `$${n.toFixed(0)}`;
}
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }
function fmt(n: number) { return n.toLocaleString(); }

const CHANNEL_COLORS: Record<string, string> = {
  'Google Ads': '#4285f4',
  'Facebook / Instagram Ads': '#1877f2',
  'LinkedIn Ads': '#0a66c2',
  'Other Paid': '#9ca3af',
  'Email – WSP Leads': '#10b981',
  'Email – WSP Customers': '#059669',
  'Organic Search': '#f59e0b',
  'WSP Social': '#8b5cf6',
  'Referrals': '#ec4899',
  'Offline / Direct': '#6b7280',
};

interface Props { cohort: CohortData }

export default function ChannelTab({ cohort }: Props) {
  const nonZero = cohort.channels.filter(c => c.enrolls > 0);
  const totalEnrolls = nonZero.reduce((s, c) => s + c.enrolls, 0);

  const sorted = [...nonZero].sort((a, b) => b.enrolls - a.enrolls);

  const cpeData = cohort.channels
    .filter(c => c.cpe > 0)
    .sort((a, b) => a.cpe - b.cpe)
    .map(c => ({
      channel: c.channel.replace(' Ads', '').replace(' / Instagram', ''),
      fullChannel: c.channel,
      cpe: Math.round(c.cpe),
      color: c.cpe < 1200 ? '#10b981' : c.cpe < 1800 ? '#f59e0b' : '#ef4444',
    }));

  const maxCpe = cpeData.length > 0 ? Math.max(...cpeData.map(c => c.cpe)) : 1;

  // A cohort with no channel rows has no attribution in its source doc yet.
  // Say that, rather than banner an empty table as "illustrative data".
  if (cohort.channels.length === 0) {
    return (
      <div className="bg-[#161b22] border border-white/10 rounded-xl p-8 text-center">
        <p className="text-sm font-semibold text-white">No channel attribution yet for {cohort.cohort}</p>
        <p className="text-xs text-gray-500 mt-2 max-w-lg mx-auto">
          The cohort performance doc has no per-channel enrollment or spend breakdown for this cohort so far.
          Nothing illustrative is shown in its place — this view fills in once the channel tables are keyed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProFormaBanner />
      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Channel share — CSS-based bar breakdown */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Enrollment Share by Channel</h2>
          <div className="space-y-2.5">
            {sorted.map(c => {
              const pct = totalEnrolls > 0 ? (c.enrolls / totalEnrolls) * 100 : 0;
              const color = CHANNEL_COLORS[c.channel] ?? '#6b7280';
              return (
                <div key={c.channel}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      {c.channel}
                    </span>
                    <span className="text-xs font-medium text-gray-200">{fmt(c.enrolls)} ({fmtPct(pct)})</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CPE by paid channel — CSS-based bar chart */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Cost per Enrollment — Paid Channels</h2>
          {cpeData.length > 0 ? (
            <div className="space-y-3 mt-2">
              {cpeData.map(c => {
                const barPct = (c.cpe / (maxCpe * 1.1)) * 100;
                return (
                  <div key={c.channel}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-300">{c.channel}</span>
                      <span className="text-xs font-semibold" style={{ color: c.color }}>
                        ${c.cpe.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all"
                        style={{ width: `${barPct}%`, background: c.color }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between text-[10px] text-gray-600 mt-1 px-0.5">
                <span>$0</span>
                <span>${Math.round(maxCpe * 1.1 / 2).toLocaleString()}</span>
                <span>${Math.round(maxCpe * 1.1).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
              No paid channel data available
            </div>
          )}
        </div>
      </div>

      {/* Channel attribution table */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Channel Attribution — {cohort.cohort}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Channel</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Enrolls</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">% Share</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Leads</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CVR</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Spend</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">ROAS</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CPL</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">CPE</th>
              </tr>
            </thead>
            <tbody>
              {cohort.channels.filter(c => c.enrolls > 0 || c.spend > 0).map((c, i) => (
                <tr key={c.channel} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: CHANNEL_COLORS[c.channel] ?? '#6b7280' }} />
                      <span className="text-white">{c.channel}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(c.enrolls)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{c.pct > 0 ? fmtPct(c.pct) : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(c.leads)}</td>
                  <td className={`px-4 py-3 text-right ${c.cvr >= 3 ? 'text-emerald-400' : c.cvr === 0 ? 'text-gray-500' : 'text-gray-300'}`}>
                    {c.cvr === 0 ? '—' : fmtPct(c.cvr)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmtDollar(c.spend)}</td>
                  <td className={`px-4 py-3 text-right ${c.roas === 0 ? 'text-gray-500' : c.roas >= 2.5 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                    {c.roas === 0 ? '—' : `${c.roas.toFixed(1)}x`}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {c.cpl === 0 ? '—' : `$${c.cpl.toFixed(2)}`}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${c.cpe === 0 ? 'text-gray-500' : c.cpe < 1200 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                    {c.cpe === 0 ? '—' : `$${c.cpe.toFixed(0)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
