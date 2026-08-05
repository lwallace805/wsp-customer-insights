'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AsOfPicker from '@/components/AsOfPicker';
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
  comparison: { wharton: ComparisonPanel; cbsee: ComparisonPanel | null };
  programs: string[];
  activeCohort: string;
  /** Selector options, derived from the cohort calendar by the server. */
  cohortOptions?: Array<{ id: string; label: string }>;
  /** Day currently rendered (YYYY-MM-DD) and today's date, for the As-of control. */
  asOfDate: string;
  asOfIsToday: boolean;
  today: string;
  mock: boolean;
}

const FALLBACK_OPTIONS = [
  { id: 'current',  label: 'Current' },
  { id: 'previous', label: 'Previous' },
];

export default function EnrollmentDashboard({ summary, pacing, comparison, programs, activeCohort, cohortOptions, asOfDate, asOfIsToday, today, mock }: Props) {
  const options = cohortOptions?.length ? cohortOptions : FALLBACK_OPTIONS;
  const router = useRouter();
  // The page is server-rendered per request, so changing the date is a navigation
  // — that keeps the URL shareable and the data fetch on the server.
  const setAsOf = (ymd: string) =>
    router.push(`?cohort=${activeCohort}${ymd === today ? '' : `&asOf=${ymd}`}`);
  const hasCBSEE = programs.includes('cbsee');

  // Reset to Executive Summary if the active tab is CBSEE-only and this cohort lacks CBSEE
  const [activeTab, setActiveTab] = useState<Tab>('Executive Summary');
  const safeTab: Tab =
    !hasCBSEE && (activeTab === 'CBSEE Pacing' || activeTab === 'CBSEE Forecast')
      ? 'Executive Summary'
      : activeTab;

  const [y, m, d] = asOfDate.split('-').map(Number);
  const now = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-xl font-bold text-white">WSP Enrollment Dashboard</h1>
          </div>
          <p className="text-sm text-gray-400">
            {hasCBSEE ? 'Wharton Online & CBSEE' : 'Wharton Online'} · {asOfIsToday ? 'Updated' : 'As of'} {now}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AsOfPicker value={asOfDate} max={today} onChange={setAsOf} />

          {/* Cohort selector */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 gap-0.5">
            {options.map(opt => (
              <Link
                key={opt.id}
                href={`?cohort=${opt.id}${asOfIsToday ? '' : `&asOf=${asOfDate}`}`}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeCohort === opt.id
                    ? 'bg-white/15 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {mock && (
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-full">
              Using mock data — connect Google Sheets to see live numbers
            </span>
          )}
        </div>
      </div>

      <TabNav active={safeTab} onChange={setActiveTab} programs={programs} />

      {safeTab === 'Executive Summary'  && <ExecutiveSummary cohorts={summary} />}
      {safeTab === 'Cohort Comparison'  && <CohortComparison comparison={comparison} />}
      {safeTab === 'Wharton Pacing'     && <WhartonPacing cohorts={summary} pacing={pacing} />}
      {safeTab === 'CBSEE Pacing'       && hasCBSEE && <CBSEEPacing cohorts={summary} pacing={pacing} />}
      {safeTab === 'All Cohorts'        && <AllCohorts pacing={pacing} />}
      {safeTab === 'Wharton Forecast'   && <WhartonForecast cohorts={summary} pacing={pacing} />}
      {safeTab === 'CBSEE Forecast'     && hasCBSEE && <CBSEEForecast cohorts={summary} pacing={pacing} />}

      {!hasCBSEE && (
        <p className="text-xs text-gray-600 mt-4 text-center">
          No CBSEE data for this cohort — the Columbia pacing columns are empty in the source sheet.
        </p>
      )}
    </div>
  );
}
