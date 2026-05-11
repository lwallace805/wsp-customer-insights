'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

type DataPoint = { period: string; score: number; responses: number };
type Props = { data: DataPoint[] };

export default function NPSTrendChart({ data }: Props) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-48 text-gray-400">No trend data yet</div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">NPS Over Time</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis domain={[-100, 100]} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [value, 'NPS Score']}
            labelFormatter={(label) => `Period: ${label}`}
          />
          <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="4 4" />
          <ReferenceLine y={50} stroke="#d1fae5" strokeDasharray="4 4" label={{ value: 'Excellent', fontSize: 10 }} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
