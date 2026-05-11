'use client';

import { useState, useEffect } from 'react';
import NPSScoreCard from '@/components/NPSScoreCard';
import NPSTrendChart from '@/components/NPSTrendChart';
import BreakdownChart from '@/components/BreakdownChart';
import FilterBar from '@/components/FilterBar';
import ResponseTable from '@/components/ResponseTable';
import type { NPSSummary } from '@/lib/nps';

type NPSData = {
  summary: NPSSummary;
  trend: { period: string; score: number; responses: number }[];
  responses: { id: string; score: number; date: string; product: string; comment: string; respondent: string }[];
  products: string[];
  error?: string;
};

export default function NPSPage() {
  const [data, setData] = useState<NPSData | null>(null);
  const [product, setProduct] = useState('');
  const [period, setPeriod] = useState<'month' | 'quarter'>('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (product) params.set('product', product);
    params.set('period', period);
    fetch(`/api/nps?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [product, period]);

  if (loading) {
    return <div className="text-center py-20 text-gray-400">Loading NPS data…</div>;
  }

  if (!data || data.error) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="font-medium text-gray-600">Could not load NPS data</p>
        <p className="text-sm mt-1">{data?.error || 'Check your .env.local and Airtable connection.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">NPS Deep Dive</h1>
        <p className="text-gray-500 mt-1">Net Promoter Score trends and response breakdown.</p>
      </div>

      <FilterBar
        products={data.products}
        selectedProduct={product}
        onProductChange={setProduct}
        period={period}
        onPeriodChange={setPeriod}
        showPeriod
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NPSScoreCard summary={data.summary} />
        <BreakdownChart summary={data.summary} />
      </div>

      <NPSTrendChart data={data.trend} />

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Individual Responses</h2>
        <ResponseTable responses={data.responses} />
      </div>
    </div>
  );
}
