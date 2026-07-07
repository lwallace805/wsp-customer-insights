'use client';

import { useEffect, useState } from 'react';
import type { CohortData } from '@/data/cohortPerformance';
import type { CommandLive } from '@/lib/pulseLive';
import { getActiveCohort } from '@/lib/cohortCalendar';

// Default to the calendar-resolved active cohort ("Fall '26" → "Fall 2026"),
// falling back to the last active-flagged entry, then the newest.
function defaultCohort(cohorts: CohortData[]): string {
  const family = cohorts[0]?.family;
  if (family) {
    const win = getActiveCohort(family);
    if (win) {
      const expanded = win.label.replace(/'(\d\d)/, '20$1');
      const match = cohorts.find(c => c.cohort === expanded);
      if (match) return match.cohort;
    }
  }
  const lastActive = [...cohorts].reverse().find(c => c.status === 'active');
  return (lastActive ?? cohorts[cohorts.length - 1]).cohort;
}
import TabNav, { type Tab } from './TabNav';
import OverviewTab from './OverviewTab';
import ProgramTab from './ProgramTab';
import ChannelTab from './ChannelTab';
import PacingTab from './PacingTab';
import PaidMediaTab from './PaidMediaTab';
import FullFunnelTab from './FullFunnelTab';
import LeadsTab from './LeadsTab';
import LowerFunnelTab from './LowerFunnelTab';

interface Props {
  cohorts: CohortData[];
  title: string;
  subtitle: string;
}

export default function CohortDashboard({ cohorts, title, subtitle }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [activeCohort, setActiveCohort] = useState(() => defaultCohort(cohorts));
  const [live, setLive] = useState<CommandLive | null>(null);

  const family = cohorts[0]?.family ?? 'wharton';

  // Live overview for the active cohort — same sources as Pulse, so the two
  // pages can never disagree on the headline numbers.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cohort-command?family=${family}`)
      .then(r => r.json())
      .then(json => { if (!cancelled && json.live) setLive(json.live); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [family]);

  const cohort = cohorts.find(c => c.cohort === activeCohort) ?? cohorts[cohorts.length - 1];
  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {cohort.status === 'active' && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
            <h1 className="text-xl font-bold text-white">
              {title} — Cohort Performance
            </h1>
          </div>
          <p className="text-sm text-gray-400">{subtitle} · Updated {now}</p>
        </div>

        {/* Cohort selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Cohort</span>
          <select
            value={activeCohort}
            onChange={e => setActiveCohort(e.target.value)}
            className="bg-[#161b22] border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/20"
          >
            {[...cohorts].reverse().map(c => (
              <option key={c.cohort} value={c.cohort}>
                {c.cohort}{c.status === 'active' ? ' (Active)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <TabNav active={activeTab} onChange={setActiveTab} />

      {activeTab === 'Overview'     && <OverviewTab cohort={cohort} allCohorts={cohorts} live={cohort.status === 'active' ? live : null} />}
      {activeTab === 'Pacing'       && <PacingTab cohort={cohort} allCohorts={cohorts} />}
      {activeTab === 'Full Funnel'  && <FullFunnelTab family={cohort.family} />}
      {activeTab === 'Leads'        && <LeadsTab family={cohort.family} />}
      {activeTab === 'Lower Funnel' && <LowerFunnelTab family={cohort.family} />}
      {activeTab === 'By Program'   && <ProgramTab cohort={cohort} />}
      {activeTab === 'By Channel'   && <ChannelTab cohort={cohort} />}
      {activeTab === 'Paid Media'   && <PaidMediaTab cohort={cohort} />}
    </div>
  );
}
