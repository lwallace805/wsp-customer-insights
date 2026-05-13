export const dynamic = 'force-dynamic';

import Link from 'next/link';
import {
  BarChart2, MessageSquare, Lightbulb, ArrowRight,
  GraduationCap, Database, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { getAllRecords } from '@/lib/airtable';
import { calculateNPS } from '@/lib/nps';
import historicalData from '@/data/historicalNPS.json';
import type { CohortSummary } from '@/lib/sheets';

// ── NPS stats ────────────────────────────────────────────────────────────────
async function getOverviewStats() {
  try {
    const records = await getAllRecords(
      process.env.NPS_TABLE_NAME || 'Course Survey Results'
    );
    const liveScores = records
      .map(r => Number(r.fields[process.env.NPS_SCORE_FIELD || 'Recommend Likelihood (Number)']))
      .filter(s => !isNaN(s) && s >= 0 && s <= 10);

    const histScores = (historicalData as { score: number }[]).map(r => r.score);
    const allScores = [...histScores, ...liveScores];
    const summary = calculateNPS(allScores);

    return {
      connected: true,
      npsScore: summary.score,
      promoterPct: summary.promoterPct,
      totalResponses: summary.totalResponses,
      liveCount: liveScores.length,
    };
  } catch {
    return { connected: false };
  }
}

// ── Enrollment stats ──────────────────────────────────────────────────────────
async function getEnrollmentStats(): Promise<CohortSummary[] | null> {
  const hasCredentials =
    !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !!process.env.GOOGLE_PACING_SHEET_ID;
  if (!hasCredentials) return null;
  try {
    const { getPacingData } = await import('@/lib/sheets');
    const { summary } = await getPacingData();
    return summary;
  } catch {
    return null;
  }
}

// ── Enrollment pacing card ────────────────────────────────────────────────────
function EnrollmentCard({ cohort }: { cohort: CohortSummary }) {
  const pct = cohort.goal > 0 ? Math.round((cohort.enrolled / cohort.goal) * 100) : 0;
  const vsFC = cohort.enrolled - cohort.forecast;
  const vsHist = cohort.enrolled - cohort.histAvg;
  const isWharton = cohort.program === 'Wharton';
  const accentColor = isWharton ? 'bg-blue-500' : 'bg-emerald-500';
  const accentText  = isWharton ? 'text-blue-600' : 'text-emerald-600';
  const accentBg    = isWharton ? 'bg-blue-50 border-blue-100' : 'bg-emerald-50 border-emerald-100';

  const DeltaIcon = vsFC > 0 ? TrendingUp : vsFC < 0 ? TrendingDown : Minus;
  const deltaColor = vsFC > 0 ? 'text-emerald-600' : vsFC < 0 ? 'text-red-500' : 'text-gray-400';

  return (
    <Link
      href="/enrollment"
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md hover:border-gray-200 transition-all block"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border mb-2 ${accentBg} ${accentText}`}>
            {cohort.program === 'Wharton' ? 'Wharton Online' : 'CBSEE'}
          </span>
          <h3 className="font-semibold text-gray-900 text-sm">{cohort.cohort}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{cohort.daysRemaining} days remaining</p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${accentText}`}>{pct}%</p>
          <p className="text-xs text-gray-400 mt-0.5">of goal</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full ${accentColor} transition-all`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-sm font-semibold text-gray-900">{cohort.enrolled.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Enrolled</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{cohort.goal.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Goal</p>
        </div>
        <div>
          <div className={`flex items-center justify-center gap-1 ${deltaColor}`}>
            <DeltaIcon size={12} />
            <p className="text-sm font-semibold">
              {vsFC > 0 ? '+' : ''}{vsFC.toLocaleString()}
            </p>
          </div>
          <p className="text-xs text-gray-400">vs Forecast</p>
        </div>
      </div>

      {/* vs hist avg */}
      {cohort.histAvg > 0 && (
        <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-50">
          vs. last 3-cohort avg:{' '}
          <span className={vsHist >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
            {vsHist >= 0 ? '+' : ''}{vsHist.toLocaleString()}
          </span>
        </p>
      )}

      <span className="text-xs font-medium text-gray-400 group-hover:text-gray-600 flex items-center gap-1 transition-colors mt-3">
        View pacing details <ArrowRight size={12} />
      </span>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function HomePage() {
  const [stats, enrollmentCohorts] = await Promise.all([
    getOverviewStats(),
    getEnrollmentStats(),
  ]);

  const insightsPages = [
    {
      href: '/certificates',
      icon: GraduationCap,
      label: 'Certificate Programs',
      desc: 'NPS trends, promoter/detractor breakdown, learner voices, and theme analysis across all cohorts.',
      color: 'text-violet-600 bg-violet-50',
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
    <div className="space-y-10 max-w-5xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WSP Analytics Hub</h1>
        <p className="text-gray-500 mt-1">Marketing dashboards, enrollment pacing, and customer insights — all in one place.</p>
      </div>

      {/* ── Enrollment Pacing ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Enrollment Pacing</h2>
        </div>
        {enrollmentCohorts && enrollmentCohorts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {enrollmentCohorts.map(c => (
              <EnrollmentCard key={c.cohort} cohort={c} />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
            <Database size={16} className="shrink-0 text-gray-400" />
            Enrollment data unavailable — add <code className="text-xs bg-gray-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY</code> and{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">GOOGLE_PACING_SHEET_ID</code> to your environment variables.
          </div>
        )}
      </section>

      {/* ── Customer Insights NPS strip ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Customer Insights — NPS</h2>
        </div>
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
      </section>

      {/* ── Section links ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Quick Access</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {insightsPages.map(({ href, icon: Icon, label, desc, color }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-gray-200 transition-all"
            >
              <div className={`inline-flex p-2 rounded-xl mb-3 ${color}`}>
                <Icon size={18} />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">{label}</h3>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">{desc}</p>
              <span className="text-xs font-medium text-gray-400 group-hover:text-gray-600 flex items-center gap-1 transition-colors">
                Open <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
