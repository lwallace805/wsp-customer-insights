'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Users, Megaphone, Package } from 'lucide-react';
import type { NPSSummary } from '@/lib/nps';

type Insight = {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
};

export default function InsightsPage() {
  const [npsData, setNpsData] = useState<{ summary: NPSSummary; products: string[]; responses: { score: number; product: string; comment: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/nps')
      .then(r => r.json())
      .then(d => { setNpsData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading insights…</div>;

  if (!npsData || (npsData as { error?: string }).error) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="font-medium text-gray-600">Connect Airtable to generate insights</p>
        <p className="text-sm mt-1">Add your credentials to .env.local and visit /explore to map your fields.</p>
      </div>
    );
  }

  const { summary, responses, products } = npsData;

  // Top product by promoter rate
  const productScores: Record<string, number[]> = {};
  responses.forEach(r => {
    if (!productScores[r.product]) productScores[r.product] = [];
    productScores[r.product].push(r.score);
  });
  const topProduct = Object.entries(productScores)
    .map(([p, scores]) => ({ product: p, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
    .sort((a, b) => b.avg - a.avg)[0];

  // Comments from promoters and detractors for messaging signals
  const promoterComments = responses.filter(r => r.score >= 9 && r.comment).map(r => r.comment).slice(0, 5);
  const detractorComments = responses.filter(r => r.score <= 6 && r.comment).map(r => r.comment).slice(0, 5);

  const insights: Insight[] = [
    {
      label: 'Overall NPS',
      value: String(summary.score),
      sub: summary.score >= 50 ? 'Excellent — leverage promoters in referral programs' : summary.score >= 0 ? 'Good — room to convert passives' : 'Needs attention — prioritize detractor outreach',
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Promoter Opportunity',
      value: `${summary.promoterCount} promoters`,
      sub: 'These are your best candidates for case studies, testimonials, and referral campaigns.',
      icon: Megaphone,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Detractor Risk',
      value: `${summary.detractorCount} detractors`,
      sub: 'Reach out proactively. Their feedback is your most valuable product signal.',
      icon: Users,
      color: 'text-red-600 bg-red-50',
    },
    ...(topProduct ? [{
      label: 'Top Rated Product',
      value: topProduct.product,
      sub: `Avg score ${topProduct.avg.toFixed(1)} — use this product's messaging as a model for others.`,
      icon: Package,
      color: 'text-violet-600 bg-violet-50',
    }] : []),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Marketing Insights</h1>
        <p className="text-gray-500 mt-1">Signals from your NPS data to inform positioning, messaging, and product decisions.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {insights.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className={`inline-flex p-2 rounded-xl mb-3 ${color}`}>
              <Icon size={18} />
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5 mb-2">{value}</p>
            {sub && <p className="text-sm text-gray-500">{sub}</p>}
          </div>
        ))}
      </div>

      {(promoterComments.length > 0 || detractorComments.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {promoterComments.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-1">What Promoters Say</h2>
              <p className="text-xs text-gray-500 mb-4">Use these as messaging proof points and testimonial seeds.</p>
              <div className="space-y-3">
                {promoterComments.map((c, i) => (
                  <blockquote key={i} className="text-sm text-gray-700 border-l-2 border-emerald-400 pl-3 italic">{c}</blockquote>
                ))}
              </div>
            </div>
          )}
          {detractorComments.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-1">What Detractors Say</h2>
              <p className="text-xs text-gray-500 mb-4">Common friction points to address in product and positioning.</p>
              <div className="space-y-3">
                {detractorComments.map((c, i) => (
                  <blockquote key={i} className="text-sm text-gray-700 border-l-2 border-red-400 pl-3 italic">{c}</blockquote>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Products in Your Data</h2>
        <p className="text-xs text-gray-500 mb-4">Compare NPS scores per product on the NPS page using the Product filter.</p>
        <div className="flex flex-wrap gap-2">
          {products.map(p => (
            <span key={p} className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">{p}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
