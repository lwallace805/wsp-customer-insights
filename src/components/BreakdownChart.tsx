'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { NPSSummary } from '@/lib/nps';

const COLORS = { Promoters: '#10b981', Passives: '#f59e0b', Detractors: '#ef4444' };

type Props = { summary: NPSSummary };

export default function BreakdownChart({ summary }: Props) {
  const data = [
    { name: 'Promoters', value: summary.promoterCount },
    { name: 'Passives', value: summary.passiveCount },
    { name: 'Detractors', value: summary.detractorCount },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Response Breakdown</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [Number(value).toLocaleString(), 'Responses']} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
