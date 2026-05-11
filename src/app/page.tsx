import Link from 'next/link';
import { BarChart2, MessageSquare, Lightbulb, ArrowRight, AlertCircle } from 'lucide-react';

async function getNPSSummary() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/nps`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const data = await getNPSSummary();
  const isConnected = !!data && !data.error;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Insights Overview</h1>
        <p className="text-gray-500 mt-1">NPS scores, survey responses, and marketing signals from your Airtable data.</p>
      </div>

      {!isConnected && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Airtable not connected yet</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Add your API key and Base ID to <code className="bg-amber-100 px-1 rounded">.env.local</code>, then visit{' '}
              <Link href="/explore" className="underline font-medium">Data Explorer</Link> to map your table fields.
            </p>
          </div>
        </div>
      )}

      {isConnected && data.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">NPS Score</p>
            <p className={`text-5xl font-bold ${data.summary.score >= 50 ? 'text-emerald-600' : data.summary.score >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
              {data.summary.score}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Promoters</p>
            <p className="text-5xl font-bold text-emerald-600">{data.summary.promoterPct}%</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Responses</p>
            <p className="text-5xl font-bold text-gray-800">{data.summary.totalResponses.toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/nps', icon: BarChart2, label: 'NPS Deep Dive', desc: 'Score trends, Promoter/Passive/Detractor breakdown, and individual responses.', color: 'text-emerald-600 bg-emerald-50' },
          { href: '/surveys', icon: MessageSquare, label: 'Survey Responses', desc: 'Browse and filter all SurveyMonkey responses imported into Airtable.', color: 'text-blue-600 bg-blue-50' },
          { href: '/insights', icon: Lightbulb, label: 'Marketing Insights', desc: 'Key themes, positioning signals, and messaging takeaways from your data.', color: 'text-violet-600 bg-violet-50' },
        ].map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href} className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:border-gray-200 hover:shadow-md transition-all">
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
