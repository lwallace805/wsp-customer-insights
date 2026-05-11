'use client';

import { useState, useEffect } from 'react';
import FilterBar from '@/components/FilterBar';
import { Search } from 'lucide-react';

type SurveyResponse = {
  id: string;
  date: string;
  product: string;
  respondent: string;
  source: string;
  answers: Record<string, unknown>;
};

type SurveyData = {
  responses: SurveyResponse[];
  products: string[];
  sources: string[];
  total: number;
  error?: string;
};

export default function SurveysPage() {
  const [data, setData] = useState<SurveyData | null>(null);
  const [product, setProduct] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SurveyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (product) params.set('product', product);
    fetch(`/api/surveys?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [product]);

  const filtered = (data?.responses || []).filter(r =>
    !search ||
    r.respondent.toLowerCase().includes(search.toLowerCase()) ||
    Object.values(r.answers).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="text-center py-20 text-gray-400">Loading survey data…</div>;

  if (!data || data.error) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="font-medium text-gray-600">Could not load survey data</p>
        <p className="text-sm mt-1">{data?.error || 'Check your .env.local and Airtable connection.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Survey Responses</h1>
        <p className="text-gray-500 mt-1">{data.total.toLocaleString()} total responses from Airtable.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterBar products={data.products} selectedProduct={product} onProductChange={setProduct} />
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex-1 min-w-48">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search responses…"
            className="text-sm flex-1 focus:outline-none bg-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map(r => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className={`w-full text-left bg-white rounded-xl border p-4 hover:border-gray-300 transition-all ${selected?.id === r.id ? 'border-emerald-400 shadow-sm' : 'border-gray-100'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-800 text-sm truncate">{r.respondent || 'Anonymous'}</p>
                <span className="text-xs text-gray-400 whitespace-nowrap">{r.date ? new Date(r.date).toLocaleDateString() : '—'}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{r.product} · {r.source}</p>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No responses match your filters.</p>}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{selected.respondent || 'Anonymous'}</h2>
                  <p className="text-sm text-gray-500">{selected.product} · {selected.source} · {selected.date ? new Date(selected.date).toLocaleDateString() : '—'}</p>
                </div>
              </div>
              <div className="space-y-3">
                {Object.entries(selected.answers).map(([question, answer]) => (
                  <div key={question}>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{question}</p>
                    <p className="text-sm text-gray-800 mt-0.5">{String(answer) || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-48 text-gray-400 bg-white rounded-2xl border border-gray-100">
              Select a response to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
