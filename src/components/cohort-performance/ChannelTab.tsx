'use client';

import type { CohortData } from '@/data/cohortPerformance';
import type { CommandLive } from '@/lib/pulseLive';
import type { ChannelRowLive } from '@/lib/sheets';
import ProFormaBanner from './ProFormaBanner';

function fmtDollar(n: number | null) {
  if (n === null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtPct(n: number | null) { return n === null ? '—' : `${n.toFixed(1)}%`; }
/** Channel CVRs here run well under 1%, where one decimal rounds 0.96% to "1.0%"
 *  and throws away the signal the tab exists to show. */
function fmtCvr(n: number | null) { return n === null ? '—' : `${n.toFixed(n < 10 ? 2 : 1)}%`; }
function fmt(n: number | null) { return n === null ? '—' : n.toLocaleString(); }

// The demo dataset uses a fixed channel vocabulary; the cohort docs use their own
// ("Ads - Google / FB / LI / Other", "Offline / Direct (Channel Unkown)", ...) and
// it drifts between cohorts. Match on substrings so both render, and fall back to
// a neutral grey rather than dropping an unrecognised channel.
const CHANNEL_COLORS: Array<[RegExp, string]> = [
  [/^ads|google/i, '#4285f4'],
  [/facebook|meta/i, '#1877f2'],
  [/linkedin/i, '#0a66c2'],
  [/affiliate/i, '#14b8a6'],
  [/sponsored/i, '#fb923c'],
  [/customer|email/i, '#059669'],
  [/organic search|^seo/i, '#f59e0b'],
  [/ai referral/i, '#a78bfa'],
  [/social/i, '#8b5cf6'],
  [/website/i, '#22d3ee'],
  [/referral/i, '#ec4899'],
  [/b2b/i, '#94a3b8'],
  [/offline|direct/i, '#6b7280'],
];
function channelColor(name: string): string {
  return CHANNEL_COLORS.find(([re]) => re.test(name))?.[1] ?? '#6b7280';
}

interface Props {
  cohort: CohortData;
  live?: CommandLive | null;
}

export default function ChannelTab({ cohort, live }: Props) {
  const table = live?.channels ?? null;

  const rows: ChannelRowLive[] = table
    ? table.rows
    : cohort.channels.map(c => ({
        channel: c.channel,
        enrolls: c.enrolls,
        pct: c.pct,
        leads: c.leads,
        spend: c.spend || null,
        roas: c.roas || null,
        cpl: c.cpl || null,
        cpe: c.cpe || null,
        cvr: c.cvr || null,
        roasArpu: null,
      }));

  // A cohort with no channel rows has no attribution in its source doc yet.
  // Say that, rather than banner an empty table as "illustrative data".
  if (rows.length === 0) {
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

  const withEnrolls = rows.filter(c => (c.enrolls ?? 0) > 0);
  const totalEnrolls = withEnrolls.reduce((s, c) => s + (c.enrolls ?? 0), 0);
  const sorted = [...withEnrolls].sort((a, b) => (b.enrolls ?? 0) - (a.enrolls ?? 0));

  const cpeData = rows
    .filter(c => (c.cpe ?? 0) > 0)
    .sort((a, b) => (a.cpe ?? 0) - (b.cpe ?? 0))
    .map(c => ({
      channel: c.channel.replace(' Ads', '').replace(' / Instagram', ''),
      cpe: Math.round(c.cpe ?? 0),
      color: (c.cpe ?? 0) < 1200 ? '#10b981' : (c.cpe ?? 0) < 1800 ? '#f59e0b' : '#ef4444',
    }));
  const maxCpe = cpeData.length > 0 ? Math.max(...cpeData.map(c => c.cpe)) : 1;

  // The sheet computes each ROAS cell against its own revenue-per-enrollment
  // constant, so the column is only internally comparable where the basis matches.
  const arpus = Array.from(new Set(rows.concat(table?.total ? [table.total] : [])
    .map(r => (r.roas !== null ? r.roasArpu : null))
    .filter((a): a is number => a !== null)));
  const mixedBasis = arpus.length > 1;

  // The channel block is keyed separately from the deadline table, so its total
  // can trail the headline enrollment count. Reconcile rather than hide it.
  const totalEnr = table?.total?.enrolls ?? null;
  const headlineEnr = live?.enrolls ?? null;
  const lag = table && totalEnr !== null && headlineEnr !== null && totalEnr !== headlineEnr
    ? headlineEnr - totalEnr
    : null;

  return (
    <div className="space-y-6">
      {table ? (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-500">
            <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 mr-2">Live</span>
            {live!.label} · channel attribution from {table.source}. Only channels carrying direct spend have spend / ROAS / CPL / CPE — blanks are unmeasured, not zero.
          </p>
          {lag !== null && (
            <p className="text-[11px] text-yellow-400/80 bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2">
              This table covers {fmt(totalEnr)} enrollments; the deadline pacing table is at {fmt(headlineEnr)}
              {lag > 0 ? ` — the channel block trails by ${lag}.` : ` — the channel block leads by ${-lag}.`}{' '}
              The two are keyed separately, so they can sit a day apart.
            </p>
          )}
          {mixedBasis && (
            <p className="text-[11px] text-yellow-400/80 bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2">
              ROAS is not comparable down this column — the sheet computes each row against a different revenue per
              enrollment ({arpus.sort((a, b) => a - b).map(a => `$${a.toLocaleString()}`).join(' vs ')}). Each row is
              labelled with the basis it was calculated on.
            </p>
          )}
        </div>
      ) : (
        <ProFormaBanner />
      )}

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Channel share — CSS-based bar breakdown */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Enrollment Share by Channel</h2>
          <div className="space-y-2.5">
            {sorted.map(c => {
              const pct = totalEnrolls > 0 ? ((c.enrolls ?? 0) / totalEnrolls) * 100 : 0;
              const color = channelColor(c.channel);
              return (
                <div key={c.channel}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-300 flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="truncate">{c.channel}</span>
                    </span>
                    <span className="text-xs font-medium text-gray-200 flex-shrink-0 ml-2">{fmt(c.enrolls)} ({fmtPct(pct)})</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
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
                      <span className="text-xs text-gray-300 truncate">{c.channel}</span>
                      <span className="text-xs font-semibold flex-shrink-0 ml-2" style={{ color: c.color }}>
                        ${c.cpe.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-3">
                      <div className="h-3 rounded-full transition-all" style={{ width: `${barPct}%`, background: c.color }} />
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
          <h2 className="text-sm font-semibold text-white">Channel Attribution — {table ? live!.label : cohort.cohort}</h2>
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
              {rows.filter(c => (c.enrolls ?? 0) > 0 || (c.spend ?? 0) > 0 || (c.leads ?? 0) > 0).map((c, i) => (
                <tr key={c.channel} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: channelColor(c.channel) }} />
                      <span className="text-white">{c.channel}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(c.enrolls)}</td>
                  {/* Share is recomputed rather than read from the sheet's "% of
                      Total", which is rounded to whole percents — showing it as
                      "48.0%" next to the chart's 47.8% reads as two numbers for
                      the same thing. */}
                  <td className="px-4 py-3 text-right text-gray-300">
                    {c.enrolls !== null && totalEnrolls > 0 ? fmtPct((c.enrolls / totalEnrolls) * 100) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmt(c.leads)}</td>
                  <td className={`px-4 py-3 text-right ${(c.cvr ?? 0) >= 3 ? 'text-emerald-400' : 'text-gray-300'}`}>
                    {fmtCvr(c.cvr)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmtDollar(c.spend)}</td>
                  <td className={`px-4 py-3 text-right ${c.roas === null ? 'text-gray-500' : c.roas >= 2.5 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                    {c.roas === null ? '—' : `${c.roas.toFixed(1)}x`}
                    {c.roas !== null && c.roasArpu !== null && (
                      <span className="block text-[10px] text-gray-500 font-normal">@ ${c.roasArpu.toLocaleString()}/enr</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {c.cpl === null ? '—' : `$${c.cpl.toFixed(2)}`}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${c.cpe === null ? 'text-gray-500' : c.cpe < 1200 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                    {c.cpe === null ? '—' : `$${c.cpe.toFixed(0)}`}
                  </td>
                </tr>
              ))}
              {table?.total && (
                <tr className="border-t border-white/20 bg-white/5">
                  <td className="px-5 py-3 text-white font-semibold">{table.total.channel}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmt(table.total.enrolls)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmtPct(table.total.pct)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmt(table.total.leads)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmtCvr(table.total.cvr)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmtDollar(table.total.spend)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">
                    {table.total.roas === null ? '—' : `${table.total.roas.toFixed(1)}x`}
                    {table.total.roas !== null && table.total.roasArpu !== null && (
                      <span className="block text-[10px] text-gray-400 font-normal">@ ${table.total.roasArpu.toLocaleString()}/enr</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-white font-semibold">
                    {table.total.cpl === null ? '—' : `$${table.total.cpl.toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3 text-right text-white font-semibold">
                    {table.total.cpe === null ? '—' : `$${table.total.cpe.toFixed(0)}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
