'use client';

import { useState } from 'react';
import type { CohortSummary, PacingDataPoint, ComparisonPanel } from '@/lib/sheets';
import TabNav, { type Tab } from './TabNav';
import ExecutiveSummary from './ExecutiveSummary';
import CohortComparison from './CohortComparison';
import WhartonPacing from './WhartonPacing';
import CBSEEPacing from './CBSEEPacing';
import AllCohorts from './AllCohorts';
import WhartonForecast from './WhartonForecast';
import CBSEEForecast from './CBSEEForecast';

interface Props {
  summary: CohortSummary[];
  pacing: PacingDataPoint[];
  comparison: { wharton: ComparisonPanel; cbsee: ComparisonPanel };
  mock: boolean;
}

export default function EnrollmentDashboard({ summary, pacing, comparison, mock }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Executive Summary');

  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-xl font-bold text-white">WSP Enrollment Dashboard</h1>
          </div>
          <p className="text-sm text-gray-400">Wharton Online &amp; CBSEE · Updated {now}</p>
        </div>
        {mock && (
          <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-full">
            Using mock data — connect Google Sheets to see live numbers
          </span>
        )}
      </div>

      <TabNav active={activeTab} onChange={setActiveTab} />

      {activeTab === 'Executive Summary'  && <ExecutiveSummary cohorts={summary} />}
      {activeTab === 'Cohort Comparison'  && <CohortComparison comparison={comparison} />}
      {activeTab === 'Wharton Pacing'     && <WhartonPacing cohorts={summary} pacing={pacing} />}
      {activeTab === 'CBSEE Pacing'       && <CBSEEPacing cohorts={summary} pacing={pacing} />}
      {activeTab === 'All Cohorts'        && <AllCohorts pacing={pacing} />}
      {activeTab === 'Wharton Forecast'   && <WhartonForecast cohorts={summary} pacing={pacing} />}
      {activeTab === 'CBSEE Forecast'     && <CBSEEForecast cohorts={summary} pacing={pacing} />}
    </div>
  );
}
