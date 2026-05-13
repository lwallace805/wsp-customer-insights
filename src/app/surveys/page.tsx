'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, ExternalLink } from 'lucide-react';

type Survey = {
  id: string;
  name: string;
  date: string;
  surveyType: string;
  region: string;
  clientType: string;
  npsScore: number | null;
  courseRating: number | null;
  presenterRating: number | null;
  relevanceRating: number | null;
  materialsRating: number | null;
  numResponses: number;
  promoters: number;
  detractors: number;
  executiveSummary: string;
  surveyUrl: string;
};

type SurveyData = {
  surveys: Survey[];
  products: string[];
  surveyTypes: string[];
  regions: string[];
  total: number;
  error?: string;
};

function RatingBadge({ value }: { value: number | null }) {
  if (value === null || value === 0) return <span className="text-gray-300">—</span>;
  const color = value >= 4 ? 'text-emerald-600' : value >= 3 ? 'text-amber-500' : 'text-red-500';
  return <span className={`font-semibold ${color}`}>{value.toFixed(1)}</span>;
}

export default function SurveysPage() {
  const [data, setData] = useState<SurveyData | null>(null);
  const [region, setRegion]       = useState('');
  const [surveyType, setSurveyType] = useState('');
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<Survey | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (region)     params.set('region', region);
    if (surveyType) params.set('type', surveyType);
    fetch(`/api/surveys?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [region, surveyType]);

  const filtered = (data?.surveys || []).filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.executiveSummary.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="text-center py-20 text-gray-400">Loading survey data…</div>;

  if (!data || data.error) {
    return (
      <div className="text-center py-20">
        <p className="font-medium text-gray-600">Could not load survey data</p>
        <p className="text-sm text-gray-400 mt-1">{data?.error || 'Check your .env.local and Airtable connection.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Survey Responses</h1>
        <p className="text-gray-500 mt-1">{data.total.toLocaleString()} surveys · click any row to see details</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <Filter size={15} className="text-gray-400 shrink-0" />
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">Type</label>
            <select value={surveyType} onChange={e => setSurveyType(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">All Types</option>
              {data.surveyTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">Region</label>
            <select value={region} onChange={e => setRegion(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">All Regions</option>
              {data.regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex-1 min-w-48">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search surveys…" className="text-sm flex-1 focus:outline-none bg-transparent" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Survey list */}
        <div className="lg:col-span-2 space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map(s => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`w-full text-left bg-white rounded-xl border p-4 hover:border-gray-300 transition-all ${selected?.id === s.id ? 'border-emerald-400 shadow-sm' : 'border-gray-100'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-medium text-gray-800 text-sm line-clamp-2 leading-tight">{s.name || 'Untitled Survey'}</p>
                {s.npsScore !== null && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${s.npsScore >= 50 ? 'bg-emerald-100 text-emerald-700' : s.npsScore >= 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    NPS {s.npsScore}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">{s.date ? new Date(s.date).toLocaleDateString() : '—'} · {s.numResponses} responses · {s.region || s.clientType || s.surveyType}</p>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No surveys match your filters.</p>}
        </div>

        {/* Survey detail */}
        <div className="lg:col-span-3">
          {selected ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900 leading-tight">{selected.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {selected.date ? new Date(selected.date).toLocaleDateString() : '—'}
                    {selected.surveyType && ` · ${selected.surveyType}`}
                    {selected.region && ` · ${selected.region}`}
                    {selected.clientType && ` · ${selected.clientType}`}
                  </p>
                </div>
                {selected.surveyUrl && (
                  <a href={selected.surveyUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                    View Survey <ExternalLink size={12} />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'NPS Score',        value: selected.npsScore !== null ? String(selected.npsScore) : '—' },
                  { label: 'Responses',         value: String(selected.numResponses) },
                  { label: 'Promoters',         value: String(selected.promoters) },
                  { label: 'Detractors',        value: String(selected.detractors) },
                  { label: 'Course Rating',     value: selected.courseRating    ? selected.courseRating.toFixed(1)    : '—' },
                  { label: 'Presenter Rating',  value: selected.presenterRating ? selected.presenterRating.toFixed(1) : '—' },
                  { label: 'Relevance',         value: selected.relevanceRating ? selected.relevanceRating.toFixed(1) : '—' },
                  { label: 'Materials',         value: selected.materialsRating ? selected.materialsRating.toFixed(1) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                    <p className="font-bold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>

              {selected.executiveSummary && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Executive Summary</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.executiveSummary}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-48 text-gray-400 bg-white rounded-2xl border border-gray-100">
              Select a survey to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
