'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { PacingDataPoint } from '@/lib/sheets';

interface Props {
  data: PacingDataPoint[];
  program: 'Wharton' | 'CBSEE';
  daysRemaining?: number;
}

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#1c2330', border: '1px solid #ffffff20', borderRadius: 8, color: '#e5e7eb' },
  labelStyle: { color: '#9ca3af' },
  formatter: (v: number) => [v?.toLocaleString(), ''],
  labelFormatter: (d: number) => `${d} days remaining`,
};

export default function PacingChart({ data, program, daysRemaining }: Props) {
  if (!data.length) return null;

  const isW = program === 'Wharton';

  // Build chart-ready array sorted descending (120 → 0 = left to right in enrollment time order)
  const chartData = [...data]
    .filter(d => d.day <= 120)
    .sort((a, b) => b.day - a.day);

  const axisProps = {
    tick: { fill: '#6b7280', fontSize: 11 },
    tickLine: false,
  };

  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-1">
        {isW ? 'Wharton' : 'CBSEE'} — Cohort Enrollment Pacing Trend
      </h3>
      <p className="text-xs text-gray-500 mb-4">Cumulative enrollments by days remaining. X-axis runs from campaign start (right) to deadline (left).</p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis
            dataKey="day"
            reversed
            label={{ value: 'Days Remaining', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 10 }}
            {...axisProps}
          />
          <YAxis {...axisProps} axisLine={false} tickFormatter={v => v.toLocaleString()} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }} />
          {daysRemaining !== undefined && (
            <ReferenceLine x={daysRemaining} stroke="#ffffff30" strokeDasharray="4 2"
              label={{ value: 'Today', position: 'top', fill: '#9ca3af', fontSize: 10 }} />
          )}

          {isW ? (
            <>
              <Line dataKey="wSp24" name="Spring '24" stroke="#1e3a5f" strokeWidth={1.2} dot={false} connectNulls />
              <Line dataKey="wFa24" name="Fall '24"   stroke="#1e4d8c" strokeWidth={1.2} dot={false} connectNulls />
              <Line dataKey="wWi25" name="Winter '25" stroke="#2563b0" strokeWidth={1.3} dot={false} connectNulls />
              <Line dataKey="wSp25" name="Spring '25" stroke="#3b82c4" strokeWidth={1.4} dot={false} connectNulls />
              <Line dataKey="wFa25" name="Fall '25"   stroke="#60a5da" strokeWidth={1.5} dot={false} connectNulls />
              <Line dataKey="wWi26" name="Winter '26" stroke="#93c5f0" strokeWidth={1.7} dot={false} connectNulls />
              <Line dataKey="wForecast" name="Forecast" stroke="#60a5da" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
              <Line dataKey="wActual"   name="Spring '26 (actual)" stroke="#f97316" strokeWidth={2.5} dot={false} connectNulls />
            </>
          ) : (
            <>
              <Line dataKey="cSu25" name="Summer '25" stroke="#064e3b" strokeWidth={1.2} dot={false} connectNulls />
              <Line dataKey="cFa25" name="Fall '25"   stroke="#065f46" strokeWidth={1.4} dot={false} connectNulls />
              <Line dataKey="cWi26" name="Winter '26" stroke="#10b981" strokeWidth={1.7} dot={false} connectNulls />
              <Line dataKey="cForecast" name="Forecast" stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
              <Line dataKey="cActual"   name="Active (actual)" stroke="#f97316" strokeWidth={2.5} dot={false} connectNulls />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
