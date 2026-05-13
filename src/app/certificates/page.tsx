'use client';

import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { ChevronDown, ChevronUp, Database } from 'lucide-react';
import type { NPSSummary } from '@/lib/nps';

type ProgramSummary = {
  id: string; label: string; hex: string; color: string;
  npsScore: number; promoterPct: number; passivePct: number; detractorPct: number;
  totalResponses: number; avgCourseRating: number; avgPresenterRating: number; avgMaterialsRating: number;
};
type TrendPoint  = { period: string; score: number; responses: number };
type ProgramTrend = { id: string; label: string; hex: string; trend: TrendPoint[] };
type ThemeRow    = { id: string; label: string; total: number; promoterHits: number; detractorHits: number; pct: number };
type Comment     = { comment: string; program: string | null; cohort?: string; respondent: string };
type Response    = { id: string; score: number; date: string; cohort: string; programLabel: string | null; comment: string; respondent: string; source: string };
type CertData    = {
  summary: NPSSummary;
  byProgram: ProgramSummary[];
  trend: TrendPoint[];
  trendByProgram: ProgramTrend[];
  distribution: { score: number; count: number }[];
  themeAnalysis: ThemeRow[];
  cohorts: string[];
  totalHistorical: number;
  totalLive: number;
  responses: Response[];
  promoterComments: Comment[];
  detractorComments: Comment[];
  error?: string;
};

const NPS_COLOR = (s: number) => s >= 50 ? 'text-emerald-600' : s >= 0 ? 'text-amber-500' : 'text-red-500';
const SCORE_HEX = (s: number) => s >= 50 ? '#059669' : s >= 0 ? '#d97706' : '#dc2626';

type Tab = 'overview' | 'byProgram' | 'voices' | 'themes';

export default function CertificatesPage() {
  const [data, setData]       = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<Tab>('overview');
  const [program, setProgram] = useState('');
  const [cohort, setCohort]   = useState('');
  const [voiceFilter, setVoiceFilter] = useState<'all'|'promoter'|'passive'|'detractor'>('all');
  const [search, setSearch]   = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (program) p.set('program', program);
    if (cohort)  p.set('cohort', cohort);
    fetch(`/api/certificates?${p}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [program, cohort]);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading certificate data…</div>;
  if (!data || data.error) return (
    <div className="text-center py-20">
      <p className="font-medium text-gray-700">Could not load data</p>
      <p className="text-sm text-gray-400 mt-1">{data?.error}</p>
    </div>
  );

  const { summary, byProgram, trend, trendByProgram, distribution, themeAnalysis, cohorts, promoterComments, detractorComments } = data;

  const allComments = [
    ...promoterComments.map(c => ({ ...c, type: 'promoter' as const })),
    ...data.responses.filter(r => r.score >= 7 && r.score <= 8 && r.comment).map(r => ({ comment: r.comment, program: r.programLabel, cohort: r.cohort, respondent: r.respondent, type: 'passive' as const })),
    ...detractorComments.map(c => ({ ...c, type: 'detractor' as const })),
  ].filter(c =>
    (voiceFilter === 'all' || c.type === voiceFilter) &&
    (!search || c.comment.toLowerCase().includes(search.toLowerCase()) || (c.program||'').toLowerCase().includes(search.toLowerCase()))
  );

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'byProgram', label: 'By Program' },
    { id: 'voices',    label: 'What Learners Say' },
    { id: 'themes',    label: 'Themes' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">University Certificate Programs</h1>
          <p className="text-gray-500 mt-0.5">
            {summary.totalResponses.toLocaleString()} responses · {byProgram.length} programs
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Database size={12} className="text-gray-400" />
            <span className="text-xs text-gray-400">{data.totalHistorical.toLocaleString()} historical + {data.totalLive.toLocaleString()} live</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={program} onChange={e => { setProgram(e.target.value); setCohort(''); }} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="">All Programs</option>
            {byProgram.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select value={cohort} onChange={e => setCohort(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="">All Cohorts</option>
            {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Overall NPS', value: summary.score, extra: NPS_COLOR(summary.score) },
              { label: 'Promoters', value: `${summary.promoterPct}%`, extra: 'text-emerald-600' },
              { label: 'Passives',  value: `${summary.passivePct}%`,  extra: 'text-amber-500' },
              { label: 'Detractors',value: `${summary.detractorPct}%`,extra: 'text-red-500' },
            ].map(({ label, value, extra }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-4xl font-bold ${extra}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* NPS Trend by Program */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-sm font-medium text-gray-700 mb-4">NPS Trend by Program</p>
            {trendByProgram.some(p => (p.trend?.length || 0) > 1) ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart margin={{ right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="period" type="category" allowDuplicatedCategory={false} tick={{ fontSize: 11 }} />
                  <YAxis domain={[-100, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="4 4" />
                  {trendByProgram.filter(p => (p.trend?.length || 0) >= 1).map(p => (
                    <Line key={p.id} data={p.trend} type="monotone" dataKey="score" name={p.label} stroke={p.hex} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm text-gray-400">Select a narrower filter to see trend data.</div>
            )}
          </div>

          {/* Score Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <p className="text-sm font-medium text-gray-700 mb-4">Score Distribution (1–10)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="score" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => [v, 'Responses']} />
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {distribution.map(d => <Cell key={d.score} fill={d.score >= 9 ? '#059669' : d.score >= 7 ? '#d97706' : '#dc2626'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top themes */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <p className="text-sm font-medium text-gray-700 mb-4">Top Themes</p>
              <div className="space-y-2.5">
                {themeAnalysis.slice(0,6).map(t => (
                  <div key={t.id} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-36 shrink-0">{t.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(t.pct * 4, 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right">{t.total}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setTab('themes')} className="mt-4 text-xs text-violet-600 hover:underline">Full theme analysis →</button>
            </div>
          </div>
        </div>
      )}

      {/* BY PROGRAM */}
      {tab === 'byProgram' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {byProgram.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900 text-sm">{p.label}</p>
                  <span className="text-xs text-gray-400">{p.totalResponses.toLocaleString()} responses</span>
                </div>
                <p className={`text-4xl font-bold mb-3 ${NPS_COLOR(p.npsScore)}`}>{p.npsScore}</p>
                <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-3">
                  <div className="bg-emerald-500" style={{ width: `${p.promoterPct}%` }} title={`Promoters ${p.promoterPct}%`} />
                  <div className="bg-amber-400"   style={{ width: `${p.passivePct}%` }}  title={`Passives ${p.passivePct}%`} />
                  <div className="bg-red-400"     style={{ width: `${p.detractorPct}%` }} title={`Detractors ${p.detractorPct}%`} />
                </div>
                <div className="grid grid-cols-3 text-center text-xs">
                  <div><p className="font-semibold text-emerald-600">{p.promoterPct}%</p><p className="text-gray-400">Promo</p></div>
                  <div><p className="font-semibold text-amber-500">{p.passivePct}%</p><p className="text-gray-400">Passive</p></div>
                  <div><p className="font-semibold text-red-500">{p.detractorPct}%</p><p className="text-gray-400">Detrac</p></div>
                </div>
                {(p.avgCourseRating > 0 || p.avgPresenterRating > 0) && (
                  <div className="border-t border-gray-100 mt-3 pt-3 grid grid-cols-3 gap-1 text-center text-xs">
                    <div><p className="font-medium text-gray-800">{p.avgCourseRating > 0 ? p.avgCourseRating.toFixed(1) : '—'}</p><p className="text-gray-400">Course</p></div>
                    <div><p className="font-medium text-gray-800">{p.avgPresenterRating > 0 ? p.avgPresenterRating.toFixed(1) : '—'}</p><p className="text-gray-400">Presenter</p></div>
                    <div><p className="font-medium text-gray-800">{p.avgMaterialsRating > 0 ? p.avgMaterialsRating.toFixed(1) : '—'}</p><p className="text-gray-400">Materials</p></div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Program comparison bar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-sm font-medium text-gray-700 mb-4">NPS Score by Program</p>
            <ResponsiveContainer width="100%" height={Math.max(200, byProgram.length * 50)}>
              <BarChart data={byProgram} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" domain={[-100, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={140} />
                <Tooltip formatter={v => [v, 'NPS']} />
                <ReferenceLine x={0} stroke="#e5e7eb" />
                <Bar dataKey="npsScore" radius={[0,4,4,0]}>
                  {byProgram.map(p => <Cell key={p.id} fill={SCORE_HEX(p.npsScore)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Per-program cohort trend */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-sm font-medium text-gray-700 mb-4">NPS Over Cohorts by Program</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart margin={{ right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" type="category" allowDuplicatedCategory={false} tick={{ fontSize: 11 }} />
                <YAxis domain={[-100, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="4 4" />
                {trendByProgram.filter(p => (p.trend?.length||0) >= 1).map(p => (
                  <Line key={p.id} data={p.trend} type="monotone" dataKey="score" name={p.label} stroke={p.hex} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* VOICES */}
      {tab === 'voices' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <div className="flex rounded-lg border border-gray-200 text-sm overflow-hidden">
              {(['all','promoter','passive','detractor'] as const).map(v => (
                <button key={v} onClick={() => setVoiceFilter(v)} className={`px-3 py-1.5 capitalize ${voiceFilter === v ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{v === 'all' ? 'All' : v.charAt(0).toUpperCase()+v.slice(1)+'s'}</button>
              ))}
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search comments…" className="flex-1 min-w-48 text-sm border border-gray-200 rounded-xl px-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <p className="text-xs text-gray-400">{allComments.length.toLocaleString()} comments</p>
          <div className="space-y-3">
            {allComments.slice(0, showAll ? undefined : 30).map((c, i) => (
              <div key={i} className={`bg-white rounded-xl border border-gray-100 p-4 border-l-4 ${c.type === 'promoter' ? 'border-l-emerald-400' : c.type === 'detractor' ? 'border-l-red-400' : 'border-l-amber-400'}`}>
                <p className="text-sm text-gray-800 leading-relaxed">"{c.comment}"</p>
                <div className="flex items-center gap-2 mt-2">
                  {c.program && <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">{c.program}</span>}
                  {c.cohort  && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{c.cohort}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${c.type === 'promoter' ? 'bg-emerald-50 text-emerald-700' : c.type === 'detractor' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{c.type}</span>
                </div>
              </div>
            ))}
          </div>
          {allComments.length > 30 && (
            <button onClick={() => setShowAll(s => !s)} className="flex items-center gap-1 text-sm text-violet-600 hover:underline mx-auto">
              {showAll ? <><ChevronUp size={14}/> Show less</> : <><ChevronDown size={14}/> Show all {allComments.length} comments</>}
            </button>
          )}
        </div>
      )}

      {/* THEMES */}
      {tab === 'themes' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-sm font-medium text-gray-700 mb-1">Theme Frequency</p>
            <p className="text-xs text-gray-400 mb-5">Keyword analysis across {data.responses.filter(r=>r.comment.length>10).length.toLocaleString()} open-text responses. Green = promoters, Red = detractors.</p>
            <div className="space-y-5">
              {themeAnalysis.map(t => {
                const max = Math.max(...themeAnalysis.map(x=>x.total), 1);
                return (
                  <div key={t.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{t.label}</span>
                      <span className="text-xs text-gray-400">{t.total.toLocaleString()} mentions ({t.pct}%)</span>
                    </div>
                    <div className="flex gap-0.5 h-4 rounded-full overflow-hidden bg-gray-100">
                      <div className="bg-emerald-400 h-full" style={{ width: `${(t.promoterHits/max)*100}%` }} title={`${t.promoterHits} promoters`} />
                      <div className="bg-red-400 h-full"     style={{ width: `${(t.detractorHits/max)*100}%` }} title={`${t.detractorHits} detractors`} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5"><span className="text-emerald-600">↑ {t.promoterHits} promoters</span> · <span className="text-red-500">↓ {t.detractorHits} detractors</span></p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-sm font-medium text-gray-700 mb-4">Promoter vs. Detractor Sentiment by Theme</p>
            <ResponsiveContainer width="100%" height={Math.max(200, themeAnalysis.length * 38)}>
              <BarChart data={themeAnalysis} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={140} />
                <Tooltip />
                <Legend />
                <Bar dataKey="promoterHits"  name="Promoters"  fill="#059669" stackId="a" />
                <Bar dataKey="detractorHits" name="Detractors" fill="#dc2626" stackId="a" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
