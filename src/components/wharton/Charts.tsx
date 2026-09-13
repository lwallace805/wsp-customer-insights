'use client';

import { useMemo } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine,
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

/** The tooltip is shared by a date-axis chart and a cohort-axis one, so a label
 *  is only date-formatted when it actually is a date — running `shortDate` over
 *  "Spring 2026" rendered a literal "Invalid Date" above the stack. */
function formatAxisLabel(label?: string): string {
  if (!label) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(label) ? shortDate(label) : label;
}

function ChartTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter(p => p.value !== null && p.value !== undefined);
  if (!rows.length) return null;
  return (
    <div className="bg-[#161b22] border border-white/15 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1.5">{formatAxisLabel(label)}</p>
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

export function RunningTotalChart({ series, currentLabel, prior, goal, overlays = [] }: {
  series: Array<{ date: string; total: number }>;
  /** Name for the active cohort's line in the tooltip (defaults to "Enrollments"). */
  currentLabel?: string;
  /** The prior cohort's curve, already re-dated onto this cohort's calendar by
   *  the payload (whartonPartner.ts) — this component never does day math. */
  prior?: { label: string; series: Array<{ date: string; total: number }> };
  goal?: number | null;
  /** Per-program curves to draw over the cohort total, chosen by the reader in
   *  the selector above the chart. Empty by default: the cohort total is the
   *  headline, and the breakdown is opt-in. */
  overlays?: Array<{ program: string; color: string; series: Array<{ date: string; total: number }> }>;
}) {
  // Joined on date because the prior curve runs all the way to the close while
  // the active cohort's stops at the keyed day; rows past that day simply have
  // no `total`, and the area ends there instead of dropping to zero.
  const data = useMemo(() => {
    type Row = { date: string; total?: number; prior?: number } & Record<string, unknown>;
    const byDate = new Map<string, Row>();
    const at = (date: string): Row => byDate.get(date) ?? { date };
    for (const pt of series) byDate.set(pt.date, { ...at(pt.date), total: pt.total });
    for (const pt of prior?.series ?? []) byDate.set(pt.date, { ...at(pt.date), prior: pt.total });
    for (const o of overlays) {
      // Prefixed so a program called "total" or "prior" can never collide with
      // the cohort keys above.
      for (const pt of o.series) byDate.set(pt.date, { ...at(pt.date), [`p:${o.program}`]: pt.total });
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [series, prior, overlays]);

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
          {overlays.map(o => (
            <Line
              key={o.program}
              type="monotone"
              dataKey={`p:${o.program}`}
              name={o.program}
              stroke={o.color}
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 2, stroke: '#0d1117' }}
              isAnimationActive={false}
            />
          ))}
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

// ─── Programs' performance across cohorts ─────────────────────────────────────

interface MixCohort {
  cohort: string;
  byProgram: Record<string, number>;
  total: number;
  inProgress: boolean;
}

/** Season and year stack on separate lines: six cohorts across a phone leaves
 *  roughly 50px a tick, and "Winter 2025" on one line overlapped its neighbours
 *  into an unreadable run. The in-progress caveat rides the third line, on the
 *  axis itself, where nobody can read that column without also reading it. */
function CohortTick({ x, y, payload, inProgress }: {
  x?: number; y?: number; payload?: { value?: string }; inProgress: Set<string>;
}) {
  const label = String(payload?.value ?? '');
  const split = label.lastIndexOf(' ');
  const season = split > 0 ? label.slice(0, split) : label;
  const year = split > 0 ? label.slice(split + 1) : '';
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill={AXIS} fontSize={11}>{season}</text>
      {year && (
        <text x={0} y={0} dy={24} textAnchor="middle" fill={AXIS} fontSize={11}>{year}</text>
      )}
      {inProgress.has(label) && (
        <text x={0} y={0} dy={36} textAnchor="middle" fill="#c98500" fontSize={9}>in progress</text>
      )}
    </g>
  );
}

export function ProgramMixChart({ cohorts, programs, colors }: {
  cohorts: MixCohort[];
  /** Stacking order, bottom to top. */
  programs: string[];
  colors: Record<string, string>;
}) {
  const inProgress = useMemo(
    () => new Set(cohorts.filter(c => c.inProgress).map(c => c.cohort)),
    [cohorts],
  );

  // Absent programs are written as 0 rather than left undefined: the total label
  // hangs off the topmost bar in the stack, and that bar has to exist for every
  // column or cohorts predating a program would lose their total.
  const rows = useMemo(
    () => cohorts.map(c => ({
      cohort: c.cohort,
      total: c.total,
      ...Object.fromEntries(programs.map(p => [p, c.byProgram[p] ?? 0])),
    })),
    [cohorts, programs],
  );

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 py-8">Cohort history isn&apos;t available right now.</p>;
  }

  const topProgram = programs[programs.length - 1];

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 24, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="cohort"
            tick={<CohortTick inProgress={inProgress} />}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval={0}
            height={52}
          />
          <YAxis
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
            allowDecimals={false}
          />
          <Tooltip
            content={(props) => {
              const { active, payload, label } = props as unknown as TooltipPayload;
              if (!active || !payload?.length) return null;
              const row = rows.find(r => r.cohort === label);
              const parts = payload.filter(p => (p.value ?? 0) > 0);
              if (!parts.length) return null;
              return (
                <div className="bg-[#161b22] border border-white/15 rounded-lg px-3 py-2 text-xs shadow-xl">
                  <p className="text-gray-400 mb-1.5">
                    {formatAxisLabel(label)}
                    {row && inProgress.has(row.cohort) && (
                      <span className="text-amber-500"> · in progress</span>
                    )}
                  </p>
                  {[...parts].reverse().map(p => (
                    <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
                      <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-gray-300">{p.name}</span>
                      <span className="text-white font-medium ml-auto tabular-nums">{p.value?.toLocaleString()}</span>
                    </div>
                  ))}
                  {row && (
                    <div className="flex items-center gap-2 pt-1.5 mt-1 border-t border-white/10">
                      <span className="text-gray-400">Total</span>
                      <span className="text-white font-semibold ml-auto tabular-nums">
                        {row.total.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              );
            }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          {programs.map(program => (
            <Bar key={program} dataKey={program} stackId="mix" fill={colors[program]} isAnimationActive={false}>
              {rows.map(r => (
                // The live cohort is drawn lighter: its column is a running
                // total against finals, and the contrast is the visual half of
                // the axis caveat.
                <Cell key={r.cohort} fillOpacity={inProgress.has(r.cohort) ? 0.45 : 1} />
              ))}
              <LabelList
                dataKey={program}
                content={(props) => {
                  const { x, y, width, height, value } = props as
                    { x: number; y: number; width: number; height: number; value: number };
                  // Only label a band tall enough to hold the text — below that
                  // the numbers overlap their neighbours and read as noise.
                  if (!value || height < 15) return null;
                  return (
                    <text
                      x={x + width / 2}
                      y={y + height / 2 + 4}
                      textAnchor="middle"
                      fill="#0d1117"
                      fontSize={11}
                      fontWeight={600}
                    >
                      {value}
                    </text>
                  );
                }}
              />
              {program === topProgram && (
                <LabelList
                  dataKey="total"
                  content={(props) => {
                    const { x, y, width, index } = props as
                      { x: number; y: number; width: number; index: number };
                    const row = rows[index];
                    if (!row) return null;
                    return (
                      <text
                        x={x + width / 2}
                        y={y - 8}
                        textAnchor="middle"
                        fill={inProgress.has(row.cohort) ? '#c98500' : '#e6edf3'}
                        fontSize={12}
                        fontWeight={600}
                      >
                        {row.total.toLocaleString()}
                      </text>
                    );
                  }}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
