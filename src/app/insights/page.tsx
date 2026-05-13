'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Megaphone, Users, Download, Lightbulb, AlertCircle } from 'lucide-react';
import type { NPSSummary } from '@/lib/nps';

type ProgramSummary = { id: string; label: string; npsScore: number; totalResponses: number; promoterPct: number; detractorPct: number; hex: string };
type ThemeRow = { id: string; label: string; total: number; promoterHits: number; detractorHits: number };
type CertData = {
  summary: NPSSummary;
  byProgram: ProgramSummary[];
  themeAnalysis: ThemeRow[];
  promoterComments: { comment: string; program: string | null }[];
  detractorComments: { comment: string; program: string | null }[];
  error?: string;
};

export default function InsightsPage() {
  const [data, setData]       = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch('/api/certificates')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    const res = await fetch('/api/learner-intelligence');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `wsp-learner-intelligence-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading insights…</div>;

  if (!data || data.error || !data.summary.totalResponses) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="font-medium text-gray-700">Connect Airtable to generate insights</p>
        <p className="text-sm text-gray-400">Certificate program data not found. Check your .env.local credentials.</p>
      </div>
    );
  }

  const { summary, byProgram, themeAnalysis, promoterComments, detractorComments } = data;
  const topProgram    = [...byProgram].sort((a,b) => b.npsScore - a.npsScore)[0];
  const bottomProgram = [...byProgram].sort((a,b) => a.npsScore - b.npsScore)[0];

  const topPromoterTheme  = themeAnalysis.sort((a,b) => b.promoterHits - a.promoterHits)[0];
  const topDetractorTheme = themeAnalysis.sort((a,b) => b.detractorHits - a.detractorHits)[0];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing Insights</h1>
          <p className="text-gray-500 mt-0.5">Strategic signals from {summary.totalResponses.toLocaleString()} certificate program responses for positioning, messaging, and creative.</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
        >
          <Download size={15} />
          {downloading ? 'Generating…' : 'Download Learner Intelligence'}
        </button>
      </div>

      {/* Key signal cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-emerald-50 rounded-lg"><TrendingUp size={15} className="text-emerald-600" /></div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overall NPS</p>
          </div>
          <p className={`text-4xl font-bold ${summary.score >= 50 ? 'text-emerald-600' : summary.score >= 0 ? 'text-amber-500' : 'text-red-500'}`}>{summary.score}</p>
          <p className="text-xs text-gray-400 mt-1">{summary.score >= 50 ? 'World-class — use as proof point' : summary.score >= 0 ? 'Good — room to improve' : 'Needs attention'}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-blue-50 rounded-lg"><Megaphone size={15} className="text-blue-600" /></div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Promoter Pool</p>
          </div>
          <p className="text-4xl font-bold text-gray-900">{summary.promoterCount}</p>
          <p className="text-xs text-gray-400 mt-1">Candidates for testimonials, referrals, and case studies</p>
        </div>

        {topProgram && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-violet-50 rounded-lg"><Lightbulb size={15} className="text-violet-600" /></div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Top Program</p>
            </div>
            <p className="text-xl font-bold text-gray-900 leading-tight">{topProgram.label}</p>
            <p className="text-xs text-gray-400 mt-1">NPS {topProgram.npsScore} · lead messaging with this program</p>
          </div>
        )}

        {topPromoterTheme && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-amber-50 rounded-lg"><Users size={15} className="text-amber-600" /></div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Top Value Driver</p>
            </div>
            <p className="text-xl font-bold text-gray-900 leading-tight">{topPromoterTheme.label}</p>
            <p className="text-xs text-gray-400 mt-1">Most mentioned by promoters — emphasize in ads and landing pages</p>
          </div>
        )}
      </div>

      {/* Positioning signals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Positioning Angles</h2>
          <p className="text-xs text-gray-500 mb-4">Derived from what promoters consistently mention</p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>Real-world application is the #1 value driver — lead with "learn by doing"</li>
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>Instructor quality is a competitive differentiator — feature instructors prominently</li>
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>Materials are rated highly — use "professional-grade materials" as a proof point</li>
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>NPS of {summary.score} beats most training programs — use as a benchmark claim</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Objections to Pre-empt</h2>
          <p className="text-xs text-gray-500 mb-4">Common friction from detractors and passives</p>
          <ul className="space-y-2 text-sm text-gray-700">
            {topDetractorTheme && <li className="flex gap-2"><span className="text-red-400 shrink-0">!</span>"{topDetractorTheme.label}" is the top detractor theme — address pacing/difficulty expectations upfront</li>}
            <li className="flex gap-2"><span className="text-red-400 shrink-0">!</span>Set clear prerequisites in marketing — "this program is designed for X level"</li>
            <li className="flex gap-2"><span className="text-red-400 shrink-0">!</span>Passives ({summary.passivePct}%) are a conversion opportunity — targeted follow-up can move them to promoters</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Channel & Creative Signals</h2>
          <p className="text-xs text-gray-500 mb-4">What to test in paid and organic</p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2"><span className="text-blue-500 shrink-0">→</span>Test UGC-style ads using promoter quotes verbatim</li>
            <li className="flex gap-2"><span className="text-blue-500 shrink-0">→</span>Instructor-led creative (face-to-camera) likely to outperform — instructor quality is a key driver</li>
            <li className="flex gap-2"><span className="text-blue-500 shrink-0">→</span>Before/after framing: "I didn't know how to build an LBO — now I do"</li>
            <li className="flex gap-2"><span className="text-blue-500 shrink-0">→</span>Program comparison ads if {topProgram?.label} outperforms peers significantly</li>
          </ul>
        </div>
      </div>

      {/* Promoter quotes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Promoter Voices</h2>
          <p className="text-xs text-gray-500 mb-4">Use these verbatim in testimonials, ads, and landing pages</p>
          <div className="space-y-3">
            {promoterComments.filter(c => c.comment.length > 20).slice(0, 8).map((c, i) => (
              <blockquote key={i} className="text-sm text-gray-700 border-l-2 border-emerald-400 pl-3 italic leading-relaxed">
                "{c.comment}"
                {c.program && <span className="not-italic text-xs text-gray-400 ml-1">— {c.program}</span>}
              </blockquote>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Detractor Feedback</h2>
          <p className="text-xs text-gray-500 mb-4">Address these in product, onboarding, or pre-sale expectations</p>
          <div className="space-y-3">
            {detractorComments.filter(c => c.comment.length > 20).slice(0, 8).map((c, i) => (
              <blockquote key={i} className="text-sm text-gray-700 border-l-2 border-red-400 pl-3 italic leading-relaxed">
                "{c.comment}"
                {c.program && <span className="not-italic text-xs text-gray-400 ml-1">— {c.program}</span>}
              </blockquote>
            ))}
          </div>
        </div>
      </div>

      {/* Download CTA */}
      <div className="bg-violet-50 border border-violet-200 rounded-2xl p-6 flex items-start gap-4">
        <div className="p-2 bg-violet-100 rounded-xl shrink-0"><Download size={20} className="text-violet-600" /></div>
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900">Learner Intelligence Document</h2>
          <p className="text-sm text-gray-600 mt-0.5 mb-3">Download a structured plain-text document containing all NPS data, promoter/detractor quotes, theme analysis, and positioning signals — formatted as context for Claude or ChatGPT to generate messaging, ads, and positioning copy.</p>
          <button onClick={handleDownload} disabled={downloading} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-60">
            <Download size={14} />
            {downloading ? 'Generating…' : 'Download Learner Intelligence (.txt)'}
          </button>
        </div>
      </div>
    </div>
  );
}
