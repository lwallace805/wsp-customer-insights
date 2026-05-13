export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { BarChart2, MessageSquare, Lightbulb, ArrowRight, GraduationCap, Database } from 'lucide-react';
import { getAllRecords } from '@/lib/airtable';
import { calculateNPS } from '@/lib/nps';
import historicalData from '@/data/historicalNPS.json';

async function getOverviewStats() {
  try {
    // Live Airtable data
    const records = await getAllRecords(
      process.env.NPS_TABLE_NAME || 'Course Survey Results'
    );
    const liveScores = records
      .map(r => Number(r.fields[process.env.NPS_SCORE_FIELD || 'Recommend Likelihood (Number)']))
      .filter(s => !isNaN(s) && s >= 0 && s <= 10);

    // Historical data
    const histScores = (historicalData as { score: number }[]).map(r => r.score);

    const allScores = [...histScores, ...liveScores];
    const summary = calculateNPS(allScores);

    return {
      connected: true,
      npsScore: summary.score,
      promoterPct: summary.promoterPct,
      totalResponses: summary.totalResponses,
      liveCount: liveScores.length,
      historicalCount: histScores.length,
    };
  } catch {
    return { connected: false };
  }
}

export default async function HomePage() {
  const stats = await getOverviewStats();

  const pages = [
    {
      href: '/certificates',
      icon: GraduationCap,
      label: 'Certificate Programs',
      desc: 'NPS trends, promoter/detractor breakdown, learner voices, and theme analysis across all cohorts.',
      color: 'text-violet-600 bg-violet-50',
      highlight: true,
    },
    {
      href: '/nps',
      icon: BarChart2,
      label: 'All NPS',
      desc: 'Full NPS dashboard across all course types — corporate, university, and public.',
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      href: '/surveys',
      icon: MessageSquare,
      label: 'Survey Responses',
      desc: 'Browse individual SurveyMonkey surveys with ratings, NPS, and executive summaries.',
      color: 'text-blue-600 bg-blue-50',
    },
    {
      href: '/insights',
      icon: Lightbulb,
      label: 'Marketing Insights',
      desc: 'Positioning signals, messaging proof points, and downloadable Learner Intelligence doc.',
      color: 'text-amber-600 bg-amber-50',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WSP Customer Insights</h1>
        <p className="text-gray-500 mt-1">NPS scores, survey responses, and marketing signals — live from Airtable.</p>
      </div>

      {/* KPI strip */}
      {stats.connected ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Overall NPS</p>
            <p className={`text-5xl font-bold ${stats.npsScore! >= 50 ? 'text-emerald-600' : stats.npsScore! >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
              {stats.npsScore}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Promoters</p>
            <p className="text-5xl font-bold text-emerald-600">{stats.promoterPct}%</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Responses</p>
            <p className="text-5xl font-bold text-gray-800">{stats.totalResponses?.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Live from Airtable</p>
            <p className="text-5xl font-bold text-gray-800">{stats.liveCount?.toLocaleString()}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
          <Database size={16} className="shrink-0 text-gray-400" />
          Could not reach Airtable — check that your API key and Base ID are set in your environment variables.
        </div>
      )}

      {/* Page cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {pages.map(({ href, icon: Icon, label, desc, color, highlight }) => (
          <Link
            key={href}
            href={href}
            className={`group bg-white rounded-2xl border shadow-sm p-6 hover:shadow-md transition-all ${highlight ? 'border-violet-200 hover:border-violet-300' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className={`inline-flex p-2 rounded-xl mb-3 ${color}`}>
              <Icon size={20} />
            </div>
            <h2 className="font-semibold text-gray-900 mb-1">{label}</h2>
            <p className="text-sm text-gray-500 mb-3">{desc}</p>
            <span className="text-xs font-medium text-gray-400 group-hover:text-gray-600 flex items-center gap-1 transition-colors">
              Open <ArrowRight size={12} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
