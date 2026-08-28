'use client';

import { useMemo } from 'react';
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { SERIES_COLORS, shortDate } from './shared';

const TOTAL_COLOR = SERIES_COLORS[0];
const AXIS = '#6b7684';
const GRID = 'rgba(255,255,255,0.07)';

interface TooltipPayload {
  active?: boolean;
  label?: string;
  payload?: Array<{ name: string; value: number | null; color: string; dataKey: string }>;
}

function ChartTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter(p => p.value !== null && p.value !== undefined);
  if (!rows.length) return null;
  return (
    <div className="bg-[#161b22] border border-white/15 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1.5">{label ? shortDate(label) : ''}</p>
      {rows.map(r => (
        <div key={r.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
          <span className="text-gray-300">{r.name}</span>
          <span className="text-white font-medium ml-auto tabular-nums">{r.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Cohort running total ─────────────────────────────────────────────────────

const PRIOR_COLOR = '#9aa4b2';

export function RunningTotalChart({ series, currentLabel, prior, goal }: {
  series: Array<{ date: string; total: number }>;
  /** Name for the active cohort's line in the tooltip (defaults to "Enrollments"). */
  currentLabel?: string;
  /** The prior cohort's curve, already re-dated onto this cohort's calendar by
   *  the payload (whartonPartner.ts) — this component never does day math. */
  prior?: { label: string; series: Array<{ date: string; total: number }> };
  goal?: number | null;
}) {
  // Joined on date because the prior curve runs all the way to the close while
  // the active cohort's stops at the keyed day; rows past that day simply have
  // no `total`, and the area ends there instead of dropping to zero.
  const data = useMemo(() => {
    const byDate = new Map<string, { date: string; total?: number; prior?: number }>();
    for (const pt of series) {
      byDate.set(pt.date, { ...(byDate.get(pt.date) ?? { date: pt.date }), total: pt.total });
    }
    for (const pt of prior?.series ?? []) {
      byDate.set(pt.date, { ...(byDate.get(pt.date) ?? { date: pt.date }), prior: pt.total });
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [series, prior]);

  if (series.length < 2) {
    return <p className="text-sm text-gray-500 py-8">Not enough days keyed yet to draw the trend.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="wh-total-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TOTAL_COLOR} stopOpacity={0.35} />
              <stop offset="100%" stopColor={TOTAL_COLOR} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            // Let Recharts thin the ticks by available width rather than by a
            // fixed count — the same count that reads well on a laptop collides
            // into "Jun 16Jun 26" on a phone.
            interval="preserveStartEnd"
            minTickGap={44}
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <YAxis
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1 }} />
          {typeof goal === 'number' && goal > 0 && (
            <ReferenceLine
              y={goal}
              stroke="rgba(255,255,255,0.35)"
              strokeDasharray="2 5"
              ifOverflow="extendDomain"
              label={{ value: `Goal · ${goal.toLocaleString()}`, position: 'insideTopLeft', fill: '#9aa4b2', fontSize: 11 }}
            />
          )}
          {prior && (
            <Line
              type="monotone"
              dataKey="prior"
              name={prior.label}
              stroke={PRIOR_COLOR}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 2, stroke: '#0d1117' }}
              isAnimationActive={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="total"
            name={currentLabel ?? 'Enrollments'}
            stroke={TOTAL_COLOR}
            strokeWidth={2}
            fill="url(#wh-total-fill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#0d1117' }}
            // No draw-in animation: on a page whose whole job is one number and
            // its curve, an empty plot for the first second reads as "no data".
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
