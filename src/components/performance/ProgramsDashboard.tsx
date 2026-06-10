'use client';

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, BarChart, Bar,
} from 'recharts';
import { PROGRAM_HISTORY, FALL25_LEAD_CHANGE } from '@/data/performance/programHistory';
import { CURRENT_SNAPSHOT } from '@/data/performance/currentSnapshot';
import { PROGRAM_LABELS, PROGRAM_SCHOOL, type ProgramKey } from '@/data/performance/types';
import {
  usePersistentSchoolFilter, PageHeader, SectionCard, ChartTooltip, DataAsOf,
  CHART_COLORS, AXIS_PROPS, fmt, fmtPct,
} from './shared';

const PROGRAM_COLORS: Record<ProgramKey, string> = {
  pe: CHART_COLORS.violet,
  re: CHART_COLORS.blue,
  fpa: CHART_COLORS.amber,
  avi: CHART_COLORS.pink,
  rdi: CHART_COLORS.cyan,
  ai: CHART_COLORS.emerald,
};

// Cohort axis for the program history charts (Wharton cohort naming).
// Spring 2026 is the current cohort, in progress.
const COHORT_AXIS = ['Spring 2024', 'Fall 2024', 'Winter 2025', 'Spring 2025', 'Fall 2025', 'Winter 2026', 'Spring 2026'];
const SHORT: Record<string, string> = {
  'Spring 2024': "S'24", 'Fall 2024': "F'24", 'Winter 2025': "W'25",
  'Spring 2025': "S'25", 'Fall 2025': "F'25", 'Winter 2026': "W'26",
  'Spring 2026': "S'26*", 'Summer 2025': "Su'25",
};

export default function ProgramsDashboard() {
  const [school, setSchool] = usePersistentSchoolFilter();

  const programs = PROGRAM_HISTORY.filter(p =>
    school === 'all' ? true : PROGRAM_SCHOOL[p.program] === school
  );

  // Build cohort-aligned rows for leads + CVR charts.
  // AI cohorts (Summer'25/Fall'25/Winter'26) align onto the Wharton axis at
  // Spring'25/Fall'25/Winter'26 slots by sequence — chart AI on its own axis
  // when filtered to Columbia.
  const axisCohorts = school === 'columbia'
    ? PROGRAM_HISTORY.find(p => p.program === 'ai')!.stats.map(s => s.cohort)
    : COHORT_AXIS;

  const leadRows = axisCohorts.map(cohort => {
    const row: Record<string, string | number | null> = { cohort: SHORT[cohort] ?? cohort };
    for (const p of programs) {
      const stat = p.stats.find(s => s.cohort === cohort);
      row[`${p.program}Leads`] = stat?.leads ?? null;
      row[`${p.program}Cvr`] = stat?.cvr ?? null;
    }
    return row;
  });

  // Current cohort (live/snapshot) per-program view
  const currentPrograms = CURRENT_SNAPSHOT.programs.filter(p =>
    school === 'all' ? true : PROGRAM_SCHOOL[p.program] === school
  );

  const currentChart = currentPrograms.map(p => ({
    name: PROGRAM_LABELS[p.program].split(' ')[0] === 'AI' ? 'AI' : PROGRAM_LABELS[p.program],
    shortName: p.program.toUpperCase(),
    realTime: p.enrolls.realTime,
    forecast: p.enrolls.forecast,
    target: p.enrolls.finalTarget,
  }));

  return (
    <div>
      <PageHeader
        title="Program Performance"
        subtitle="Per-program lead volume, conversion, and current-cohort pacing"
        school={school}
        onSchoolChange={setSchool}
        right={<DataAsOf asOf={CURRENT_SNAPSHOT.asOf} live={CURRENT_SNAPSHOT.live} />}
      />

      {/* Current cohort actual vs forecast vs target */}
      <div className="mb-6">
        <SectionCard
          title="Current Cohort — Enrollments vs. Forecast vs. Target"
          subtitle={CURRENT_SNAPSHOT.forecastNote}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={currentChart} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="shortName" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="realTime" name="Real time" fill={CHART_COLORS.emerald} radius={[3, 3, 0, 0]} />
              <Bar dataKey="forecast" name="Forecast" fill={CHART_COLORS.blue} radius={[3, 3, 0, 0]} />
              <Bar dataKey="target" name="Final target" fill={CHART_COLORS.gray} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Lead volume */}
        <SectionCard title="Lead Volume by Program" subtitle="Per cohort · F'25 leads are bot-inflated (unfiltered at program level) · S'26* in progress">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={leadRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="cohort" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {programs.map(p => (
                <Line
                  key={p.program}
                  type="monotone"
                  dataKey={`${p.program}Leads`}
                  name={PROGRAM_LABELS[p.program]}
                  stroke={PROGRAM_COLORS[p.program]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* CVR */}
        <SectionCard title="Lead → Enrollment CVR by Program" subtitle="Per cohort · F'25 CVR understated by bot-inflated lead base · S'26* in progress">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={leadRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="cohort" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v.toFixed(1)}%`} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {programs.map(p => (
                <Line
                  key={p.program}
                  type="monotone"
                  dataKey={`${p.program}Cvr`}
                  name={PROGRAM_LABELS[p.program]}
                  stroke={PROGRAM_COLORS[p.program]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Current cohort table */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Current Cohort Detail</h2>
          <p className="text-xs text-gray-500 mt-0.5">Updated through {CURRENT_SNAPSHOT.asOf} · info sessions through 2026-05-31</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {['Program', 'Enrolls', 'Forecast', 'Target', '% to Target', 'Leads', 'Lead Target', 'CVR', 'Info RSVPs'].map((h, i) => (
                  <th key={h} className={`${i === 0 ? 'text-left px-5' : 'text-right px-4'} py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentPrograms.map((p, i) => {
                const pct = p.enrolls.finalTarget > 0 ? (p.enrolls.realTime / p.enrolls.finalTarget) * 100 : 0;
                return (
                  <tr key={p.program} className={`border-b border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                    <td className="px-5 py-3 text-white font-medium whitespace-nowrap">
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: PROGRAM_COLORS[p.program] }} />
                      {PROGRAM_LABELS[p.program]}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(p.enrolls.realTime)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(p.enrolls.forecast)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(p.enrolls.finalTarget)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${pct >= 90 ? 'text-emerald-400' : pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{fmtPct(pct, 0)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(p.leads.realTime)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmt(p.leads.finalTarget)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {p.leadCvr != null
                        ? fmtPct(p.leadCvr)
                        : p.leads.realTime > 0
                          ? fmtPct((p.enrolls.realTime / p.leads.realTime) * 100)
                          : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{p.infoSessionRsvps ? fmt(p.infoSessionRsvps.realTime) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fall 2025 lead change callout */}
      {school !== 'columbia' && (
        <SectionCard title="Fall 2025 vs. Spring 2025 — Program Lead Change" subtitle="The one clean F'25 program-level comparison in the source data">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {FALL25_LEAD_CHANGE.map(r => (
              <div key={r.program} className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{PROGRAM_LABELS[r.program]}</p>
                <p className={`text-2xl font-bold ${r.pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.pctChange >= 0 ? '+' : ''}{r.pctChange}%
                </p>
                <p className="text-xs text-gray-500 mt-1">{fmt(r.fall2025)} vs {fmt(r.spring2025)}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
