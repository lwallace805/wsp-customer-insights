'use client';

import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { PacingDataPoint } from '@/lib/sheets';

interface Props {
  data: PacingDataPoint[];
  program: 'Wharton' | 'CBSEE';
  goal: number;
  daysRemaining?: number;
}

interface ChartPoint {
  day: number;
  actualEnrolled: number | null;
  forecastEnrolled: number | null;
  bandHigh: number | null;
  bandLow: number | null;
}

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
            <span className="text-white font-medium">{Math.round(entry.value).toLocaleString()}</span>
          </div>
        ) : null
      ))}
    </div>
  );
}

export default function ForecastChart({ data, program, goal, daysRemaining }: Props) {
  if (!data.length) return null;

  const isW = program === 'Wharton';
  const bandColor = isW ? '#3b82f6' : '#10b981';
  const forecastColor = isW ? '#60a5da' : '#34d399';

  const chartData: ChartPoint[] = [...data]
    .filter(d => d.day <= 120)
    .sort((a, b) => b.day - a.day)
    .map(pt => {
      const actual   = isW ? pt.wActual   : pt.cActual;
      const forecast = isW ? pt.wForecast : pt.cForecast;

      const forecastEnrolled = forecast !== undefined ? forecast : null;
      const actualEnrolled   = actual   !== undefined ? actual   : null;
      const bandHigh = forecastEnrolled !== null ? forecastEnrolled + 0.05 * goal : null;
      const bandLow  = forecastEnrolled !== null ? Math.max(0, forecastEnrolled - 0.05 * goal) : null;

      return {
        day: pt.day,
        actualEnrolled,
        forecastEnrolled,
        bandHigh,
        bandLow,
      };
    });

  const axisProps = {
    tick: { fill: '#6b7280', fontSize: 11 },
    tickLine: false,
  };

  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 40, bottom: 24, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis
            dataKey="day"
            type="number"
            domain={[0, 120]}
            reversed
            label={{ value: 'Enrollment Days Remaining', position: 'insideBottom', offset: -12, fill: '#6b7280', fontSize: 11 }}
            {...axisProps}
          />
          <YAxis
            domain={[0, goal]}
            label={{ value: 'Enrollments', angle: -90, position: 'insideRight', offset: 20, fill: '#6b7280', fontSize: 11 }}
            tickFormatter={v => v.toLocaleString()}
            {...axisProps}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 12 }} />

          {daysRemaining !== undefined && (
            <ReferenceLine
              x={daysRemaining}
              stroke="#ffffff30"
              strokeDasharray="4 2"
              label={{ value: 'Today', position: 'top', fill: '#9ca3af', fontSize: 10 }}
            />
          )}

          {/* Band: render bandHigh then bandLow; the second Area paints over the bottom portion white to create a shaded band */}
          <Area
            dataKey="bandHigh"
            name="Upper band"
            fill={bandColor}
            fillOpacity={0.15}
            stroke="none"
            legendType="none"
            connectNulls
          />
          <Area
            dataKey="bandLow"
            name="Lower band"
            fill="#0d1117"
            fillOpacity={1}
            stroke="none"
            legendType="none"
            connectNulls
          />

          {/* Forecast dashed line */}
          <Line
            dataKey="forecastEnrolled"
            name="Forecast"
            stroke={forecastColor}
            strokeWidth={1.8}
            strokeDasharray="6 3"
            dot={false}
            connectNulls
          />

          {/* Actual solid orange line */}
          <Line
            dataKey="actualEnrolled"
            name="Actual"
            stroke="#f97316"
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-600 mt-3 text-center">
        Y-axis = cumulative enrollments. Actual above forecast = ahead of pace.
      </p>
    </div>
  );
}
