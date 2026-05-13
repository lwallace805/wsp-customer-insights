'use client';

import { useState, useEffect } from 'react';
import NPSScoreCard from '@/components/NPSScoreCard';
import NPSTrendChart from '@/components/NPSTrendChart';
import BreakdownChart from '@/components/BreakdownChart';
import ResponseTable from '@/components/ResponseTable';
import { Filter } from 'lucide-react';
import type { NPSSummary } from '@/lib/nps';

type AvgRatings = { course: number; presenter: number; relevance: number; materials: number };
type NPSData = {
  summary: NPSSummary;
  trend: { period: string; score: number; responses: number }[];
  responses: { id: string; score: number; date: string; product: string; comment: string; respondent: string }[];
  products: string[];
  regions: string[];
  clientTypes: string[];
  avgRatings: AvgRatings | null;
  error?: string;
};

export default function NPSPage() {
  const [data, setData] = useState<NPSData | null>(null);
  const [product, setProduct]       = useState('');
  const [region, setRegion]         = useState('');
  const [clientType, setClientType] = useState('');
  const [period, setPeriod]         = useState<'month' | 'quarter'>('month');
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (product)    params.set('product', product);
    if (region)     params.set('region', region);
    if (clientType) params.set('clientType', clientType);
    params.set('period', period);
    fetch(`/api/nps?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [product, region, clientType, period]);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading NPS data…</div>;

  if (!data || data.error) {
    return (
      <div className="text-center py-20">
        <p className="font-medium text-gray-600">Could not load NPS data</p>
        <p className="text-sm text-gray-400 mt-1">{data?.error || 'Check your .env.local and Airtable connection.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">NPS Deep Dive</h1>
        <p className="text-gray-500 mt-1">{data.summary.totalResponses.toLocaleString()} responses · filter by course, region, or client type</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
        <Filter size={15} className="text-gray-400 shrink-0" />

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Course</label>
          <select value={product} onChange={e => setProduct(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">All Courses</option>
            {data.products.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Region</label>
          <select value={region} onChange={e => setRegion(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">All Regions</option>
            {data.regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Client Type</label>
          <select value={clientType} onChange={e => setClientType(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">All Types</option>
            {data.clientTypes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs font-medium text-gray-500">Group by</label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['month', 'quarter'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 capitalize transition-colors ${period === p ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NPSScoreCard summary={data.summary} />
        <BreakdownChart summary={data.summary} />
      </div>

      {/* Avg ratings */}
      {data.avgRatings && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Course Rating',     value: data.avgRatings.course },
            { label: 'Presenter Rating',  value: data.avgRatings.presenter },
            { label: 'Relevance',         value: data.avgRatings.relevance },
            { label: 'Materials Rating',  value: data.avgRatings.materials },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-3xl font-bold text-gray-900">{value > 0 ? value.toFixed(1) : '—'}</p>
              <p className="text-xs text-gray-400">out of 5</p>
            </div>
          ))}
        </div>
      )}

      <NPSTrendChart data={data.trend} />

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Individual Responses</h2>
        <ResponseTable responses={data.responses} />
      </div>
    </div>
  );
}
