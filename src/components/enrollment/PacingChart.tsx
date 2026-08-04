'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { PacingDataPoint } from '@/lib/sheets';

interface Props {
  data: PacingDataPoint[];
  program: 'Wharton' | 'CBSEE' | 'Both';
  daysRemaining?: number;
}

type ZoomLevel = 30 | 60 | 90 | 120;
const ZOOM_OPTIONS: ZoomLevel[] = [30, 60, 90, 120];

// Blue gradient (oldest=darkest → newest=lightest) for Wharton historical lines
const W_COLORS = ['#1e3a5f', '#1e4d8c', '#2563b0', '#3b82c4', '#60a5da', '#93c5f0'];
// Green gradient for CBSEE historical lines
const C_COLORS = ['#064e3b', '#065f46', '#10b981'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c2330] border border-white/20 rounded-lg p-3 text-xs">
      <p className="text-gray-400 font-semibold mb-2">{label} Days Remaining</p>
      {payload.map((entry: { name: string; value: number | null; color: string }, i: number) => (
        entry.value !== null && entry.value !== undefined ? (
          <div key={i} className="flex items-center gap-2 mb-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-300">{entry.name}:</span>
            <span className="text-white font-medium">{entry.value.toFixed(1)}%</span>
          </div>
        ) : null
      ))}
    </div>
  );
}

export default function PacingChart({ data, program, daysRemaining }: Props) {
  const [zoom, setZoom] = useState<ZoomLevel>(120);

  // Union of historical labels across EVERY point, not just the first one that
  // has any. Cohorts have different enrollment-window lengths, so a single point
  // only carries the cohorts that were already running at that days-out mark —
  // reading labels off one point silently drops every shorter cohort (which are
  // the most recent ones, the ones people actually want to compare against).
  // The longest array is used as the base so legend order stays oldest→newest.
  const labelUnion = (pick: (d: PacingDataPoint) => Array<{ label: string }>) => {
    let base: string[] = [];
    for (const d of data) {
      const labels = pick(d).map(h => h.label);
      if (labels.length > base.length) base = labels;
    }
    const seen = new Set(base);
    for (const d of data) {
      for (const h of pick(d)) {
        if (!seen.has(h.label)) { seen.add(h.label); base = [...base, h.label]; }
      }
    }
    return base;
  };
  const wHistLabels = useMemo(() => labelUnion(d => d.wHistoricals), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const cHistLabels = useMemo(() => labelUnion(d => d.cHistoricals), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flatten wHistoricals/cHistoricals arrays into flat objects for Recharts
  const chartData = useMemo(() => {
    return [...data]
      .filter(d => d.day <= zoom)
      .sort((a, b) => b.day - a.day)
      .map(pt => {
        const flat: Record<string, unknown> = {
          day: pt.day,
          wActualPct: pt.wActualPct,
          wLast3Pct: pt.wLast3Pct,
          cActualPct: pt.cActualPct,
          cLast3Pct: pt.cLast3Pct,
        };
        pt.wHistoricals.forEach(h => { flat[`w|${h.label}`] = h.pct; });
        pt.cHistoricals.forEach(h => { flat[`c|${h.label}`] = h.pct; });
        return flat;
      });
  }, [data, zoom]);

  if (!data.length) return null;

  const axisProps = {
    tick: { fill: '#6b7280', fontSize: 11 },
    tickLine: false,
  };

  const isWharton = program === 'Wharton' || program === 'Both';
  const isCBSEE   = program === 'CBSEE'   || program === 'Both';
  const isAll     = program === 'Both';

  const todayVisible = daysRemaining !== undefined && daysRemaining <= zoom;

  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
      {/* Zoom controls */}
      <div className="flex items-center justify-end gap-1 mb-3">
        <span className="text-xs text-gray-500 mr-2">Zoom:</span>
        {ZOOM_OPTIONS.map(z => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              zoom === z
                ? 'bg-emerald-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {z === 120 ? 'Full' : `${z}d`}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={chartData} margin={{ top: 8, right: 40, bottom: 24, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis
            dataKey="day"
            type="number"
            domain={[0, zoom]}
            reversed
            label={{ value: 'Enrollment Days Remaining', position: 'insideBottom', offset: -12, fill: '#6b7280', fontSize: 11 }}
            {...axisProps}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={v => v + '%'}
            label={{ value: '% of Cohort Completion', angle: -90, position: 'insideRight', offset: 20, fill: '#6b7280', fontSize: 11 }}
            {...axisProps}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 12 }} />

          {todayVisible && (
            <ReferenceLine
              x={daysRemaining}
              stroke="#ffffff30"
              strokeDasharray="4 2"
              label={{ value: 'Today', position: 'top', fill: '#9ca3af', fontSize: 10 }}
            />
          )}

          {/* Wharton historical lines — blue gradient (oldest darkest); Goal Pace gets gray dashed */}
          {isWharton && (() => {
            let ci = 0;
            return wHistLabels.map(label => {
              const isGoalPace = label === 'Goal Pace';
              const colorIdx = ci;
              if (!isGoalPace) ci++;
              return (
                <Line
                  key={`w|${label}`}
                  dataKey={`w|${label}`}
                  name={isAll ? `W: ${label}` : label}
                  stroke={isGoalPace ? '#9ca3af' : (W_COLORS[colorIdx] ?? '#93c5f0')}
                  strokeWidth={isGoalPace ? 1.5 : 1.2 + colorIdx * 0.1}
                  strokeDasharray={isGoalPace ? '5 3' : undefined}
                  dot={false}
                  connectNulls
                />
              );
            });
          })()}

          {/* Wharton active + last-3 */}
          {isWharton && (
            <>
              <Line dataKey="wActualPct" name={isAll ? 'W: Current' : 'Current'} stroke="#f97316" strokeWidth={2.5} dot={false} connectNulls />
              <Line dataKey="wLast3Pct"  name={isAll ? 'W: Last 3 avg' : 'Last 3 avg'} stroke="#e5e7eb" strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls />
            </>
          )}

          {/* CBSEE historical lines — green gradient */}
          {isCBSEE && cHistLabels.map((label, i) => (
            <Line
              key={`c|${label}`}
              dataKey={`c|${label}`}
              name={isAll ? `C: ${label}` : label}
              stroke={C_COLORS[i] ?? '#10b981'}
              strokeWidth={1.2 + i * 0.25}
              dot={false}
              connectNulls
            />
          ))}

          {/* CBSEE active + last-3 */}
          {isCBSEE && (
            <>
              <Line dataKey="cActualPct" name={isAll ? 'C: Current' : 'Current'} stroke="#f97316" strokeWidth={2.5} dot={false} connectNulls />
              <Line dataKey="cLast3Pct"  name={isAll ? 'C: Last 3 avg' : 'Last 3 avg'} stroke="#d1fae5" strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
