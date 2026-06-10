'use client';

import { AlertOctagon, AlertTriangle, TrendingUp, Sparkles } from 'lucide-react';
import type { InsightsResult } from '@/lib/performance/aiInsights';
import type { CurrentSnapshot, Insight, InsightSeverity } from '@/data/performance/types';
import { usePersistentSchoolFilter, PageHeader, DataAsOf } from './shared';

const SEVERITY_CONFIG: Record<InsightSeverity, {
  label: string;
  icon: React.ElementType;
  border: string;
  badge: string;
  iconColor: string;
}> = {
  critical: {
    label: 'Act now',
    icon: AlertOctagon,
    border: 'border-red-500/30',
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    iconColor: 'text-red-400',
  },
  warning: {
    label: 'Investigate',
    icon: AlertTriangle,
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    iconColor: 'text-amber-400',
  },
  positive: {
    label: 'Double down',
    icon: TrendingUp,
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
};

function InsightCard({ insight }: { insight: Insight }) {
  const cfg = SEVERITY_CONFIG[insight.severity];
  const Icon = cfg.icon;
  return (
    <div className={`bg-[#161b22] border ${cfg.border} rounded-xl p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <Icon size={18} className={`${cfg.iconColor} mt-0.5 shrink-0`} />
          <h3 className="text-sm font-semibold text-white leading-snug">{insight.title}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cfg.badge}`}>
            {cfg.label}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full border border-white/15 text-gray-400">
            {insight.school === 'both' ? 'All' : insight.school}
          </span>
        </div>
      </div>
      <ul className="space-y-1 mb-3 ml-7">
        {insight.evidence.map((e, i) => (
          <li key={i} className="text-xs text-gray-400 leading-relaxed flex gap-2">
            <span className="text-gray-600 shrink-0">·</span>
            <span>{e}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-200 leading-relaxed ml-7 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2">
        <span className="font-semibold text-gray-400 uppercase tracking-wide text-[10px] mr-2">Action</span>
        {insight.action}
      </p>
    </div>
  );
}

export default function OptimizationDashboard({
  snapshot,
  result,
}: {
  snapshot: CurrentSnapshot;
  result: InsightsResult;
}) {
  const [school, setSchool] = usePersistentSchoolFilter();

  const insights = result.insights.filter(i =>
    school === 'all' ? true : i.school === school || i.school === 'both'
  );

  const critical = insights.filter(i => i.severity === 'critical');
  const warning = insights.filter(i => i.severity === 'warning');
  const positive = insights.filter(i => i.severity === 'positive');

  const isAi = result.source === 'ai';

  return (
    <div>
      <PageHeader
        title="Optimization Priorities"
        subtitle={
          isAi
            ? `AI analysis of the full performance picture — regenerated weekly. Generated ${result.generatedAt} by ${result.model}.`
            : 'Rule-based analysis (AI unavailable) — computed from historical trends, current pacing, and traffic data'
        }
        school={school}
        onSchoolChange={setSchool}
        right={
          <span className="flex items-center gap-3">
            {isAi && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-violet-500/15 text-violet-300 border-violet-500/30">
                <Sparkles size={10} />
                AI-generated
              </span>
            )}
            <DataAsOf asOf={snapshot.asOf} live={snapshot.live} />
          </span>
        }
      />

      {/* Executive summary */}
      {result.summary && (
        <div className="bg-[#161b22] border border-violet-500/20 rounded-xl p-5 mb-6">
          <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles size={12} />
            Executive Summary
          </p>
          <p className="text-sm text-gray-200 leading-relaxed">{result.summary}</p>
        </div>
      )}

      {/* Severity summary */}
      <div className="flex gap-4 flex-wrap mb-6">
        {([['critical', critical.length], ['warning', warning.length], ['positive', positive.length]] as const).map(([sev, count]) => {
          const cfg = SEVERITY_CONFIG[sev];
          const Icon = cfg.icon;
          return (
            <div key={sev} className={`bg-[#161b22] border ${cfg.border} rounded-xl px-5 py-4 flex items-center gap-3 flex-1 min-w-[160px]`}>
              <Icon size={20} className={cfg.iconColor} />
              <div>
                <p className="text-2xl font-bold text-white">{count}</p>
                <p className="text-xs text-gray-400">{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {insights.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-16">No insights for this filter.</p>
      ) : (
        <div className="space-y-4">
          {insights.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
