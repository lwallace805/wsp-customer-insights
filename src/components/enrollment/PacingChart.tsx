'use client';

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
  if (!data.length) return null;

  const chartData = [...data]
    .filter(d => d.day <= 120)
    .sort((a, b) => b.day - a.day);

  const axisProps = {
    tick: { fill: '#6b7280', fontSize: 11 },
    tickLine: false,
  };

  const isWharton = program === 'Wharton' || program === 'Both';
  const isCBSEE   = program === 'CBSEE'   || program === 'Both';
  const isAll     = program === 'Both';

  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={chartData} margin={{ top: 8, right: 40, bottom: 24, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis
            dataKey="day"
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

          {daysRemaining !== undefined && (
            <ReferenceLine
              x={daysRemaining}
              stroke="#ffffff30"
              strokeDasharray="4 2"
              label={{ value: 'Today', position: 'top', fill: '#9ca3af', fontSize: 10 }}
            />
          )}

          {/* Wharton historical lines — blue gradient, oldest darkest */}
          {isWharton && (
            <>
              <Line dataKey="wSp24Pct" name={isAll ? "W: Spring '24" : "Spring '24"} stroke="#1e3a5f" strokeWidth={1.2} dot={false} connectNulls />
              <Line dataKey="wFa24Pct" name={isAll ? "W: Fall '24"   : "Fall '24"}   stroke="#1e4d8c" strokeWidth={1.2} dot={false} connectNulls />
              <Line dataKey="wWi25Pct" name={isAll ? "W: Winter '25" : "Winter '25"} stroke="#2563b0" strokeWidth={1.3} dot={false} connectNulls />
              <Line dataKey="wSp25Pct" name={isAll ? "W: Spring '25" : "Spring '25"} stroke="#3b82c4" strokeWidth={1.4} dot={false} connectNulls />
              <Line dataKey="wFa25Pct" name={isAll ? "W: Fall '25"   : "Fall '25"}   stroke="#60a5da" strokeWidth={1.5} dot={false} connectNulls />
              <Line dataKey="wWi26Pct" name={isAll ? "W: Winter '26" : "Winter '26"} stroke="#93c5f0" strokeWidth={1.7} dot={false} connectNulls />
              <Line dataKey="wActualPct"  name={isAll ? "W: Spring '26 (current)" : "Spring '26 (current)"} stroke="#f97316" strokeWidth={2.5} dot={false} connectNulls />
              <Line dataKey="wLast3Pct"   name={isAll ? "W: Last 3 avg" : "Last 3 avg"} stroke="#e5e7eb" strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls />
            </>
          )}

          {/* CBSEE historical lines — green gradient */}
          {isCBSEE && (
            <>
              <Line dataKey="cSu25Pct" name={isAll ? "C: Summer '25" : "Summer '25"} stroke="#064e3b" strokeWidth={1.2} dot={false} connectNulls />
              <Line dataKey="cFa25Pct" name={isAll ? "C: Fall '25"   : "Fall '25"}   stroke="#065f46" strokeWidth={1.4} dot={false} connectNulls />
              <Line dataKey="cWi26Pct" name={isAll ? "C: Winter '26" : "Winter '26"} stroke="#10b981" strokeWidth={1.7} dot={false} connectNulls />
              <Line dataKey="cActualPct"  name={isAll ? "C: Summer '26 (current)" : "Summer '26 (current)"} stroke="#f97316" strokeWidth={2.5} dot={false} connectNulls />
              <Line dataKey="cLast3Pct"   name={isAll ? "C: Last 3 avg" : "Last 3 avg"} stroke="#d1fae5" strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
