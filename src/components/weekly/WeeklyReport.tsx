'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AsOfPicker from '@/components/AsOfPicker';
import type { WeeklyReport, WeeklyFamily, WeeklyProgramRow } from '@/lib/weeklyReport';

// The page is built to be SCREENSHOT, not browsed: everything below the header
// sits inside one fixed-width card so a phone-sized crop of it stays legible.
const SHOT_WIDTH = 'max-w-[760px]';

function fmt(n: number | null | undefined) {
  return n === null || n === undefined ? '—' : n.toLocaleString();
}
function money(n: number | null | undefined, digits = 0) {
  return n === null || n === undefined ? '—' : `$${n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}
function pct(n: number | null | undefined, digits = 1) {
  return n === null || n === undefined ? '—' : `${n.toFixed(digits)}%`;
}
function signed(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString()}`;
}
function signedPct(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined) return '—';
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}%`;
}
function tone(n: number | null | undefined, goodWhenPositive = true) {
  if (n === null || n === undefined) return 'text-gray-500';
  const good = goodWhenPositive ? n >= 0 : n <= 0;
  return good ? 'text-emerald-400' : 'text-red-400';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 first:mt-0">
      <h2 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2.5">{title}</h2>
      {children}
    </section>
  );
}

function HeadlineCard({ f }: { f: WeeklyFamily }) {
  const behind = f.vsPace < 0;
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-4 flex-1 min-w-[210px]">
      <p className="text-xs text-gray-500">{f.label}</p>
      <p className="text-2xl font-bold text-white mt-1 font-mono">
        {fmt(f.enrolls)}
        <span className="text-sm font-normal text-gray-500"> / {fmt(f.goal)}</span>
      </p>
      <p className={`text-xs font-mono mt-1 ${behind ? 'text-red-400' : 'text-emerald-400'}`}>
        {signed(f.vsPace)} vs pace of {fmt(f.pace)}
        <span className="text-gray-500"> · {pct(f.pctOfGoal)}</span>
      </p>
      <div className="mt-3 w-full bg-white/5 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${f.family === 'wharton' ? 'bg-blue-400' : 'bg-teal-400'}`}
          style={{ width: `${Math.min(Math.max(f.pctOfGoal, 0), 100)}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-600 mt-2.5">
        Wk {f.week} · {f.daysRemaining} days left · {f.endgame}
      </p>
    </div>
  );
}

interface ProgramCell {
  program: string;
  enrolls: number | null;
  enrollsPace: number | null;
  enrollDelta: number | null;
  pctOfGoal: number | null;
}

function ProgramRow({ r, blendedPct, isTotal }: { r: ProgramCell; blendedPct: number; isTotal?: boolean }) {
  return (
    <tr className={isTotal ? 'border-t border-white/15' : 'border-t border-white/5'}>
      <td className={`py-2 text-sm ${isTotal ? 'text-white font-medium' : 'text-gray-200'}`}>{r.program}</td>
      <td className="py-2 text-sm text-right font-mono text-white">{fmt(r.enrolls)}</td>
      <td className="py-2 text-sm text-right font-mono text-gray-500">{fmt(r.enrollsPace)}</td>
      <td className={`py-2 text-sm text-right font-mono ${tone(r.enrollDelta)}`}>{signed(r.enrollDelta)}</td>
      <td className="py-2 pl-4">
        <div className="flex items-center gap-2 justify-end">
          <div className="flex-1 h-1.5 bg-white/5 rounded-full min-w-[60px]">
            <div
              className={`h-1.5 rounded-full ${(r.enrollDelta ?? 0) >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
              style={{ width: `${Math.min(((r.pctOfGoal ?? 0) / Math.max(blendedPct, 0.1)) * 50, 100)}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-gray-500 w-11 text-right">{pct(r.pctOfGoal)}</span>
        </div>
      </td>
    </tr>
  );
}

/** Bars are scaled against the cohort's own blended % of goal so a program that
 *  is simply early in the cycle doesn't read as failing — the signal is each
 *  program's position RELATIVE to the blended pace, not its raw share of goal. */
function ProgramTable({ rows, blendedPct }: { rows: WeeklyProgramRow[]; blendedPct: number }) {
  if (!rows.length) {
    return <p className="text-sm text-gray-600 italic">No per-program rows in this cohort&apos;s WoW tab.</p>;
  }
  const sorted = [...rows].sort((a, b) => (b.enrolls ?? 0) - (a.enrolls ?? 0));
  const total = {
    enrolls: sorted.reduce((s, r) => s + (r.enrolls ?? 0), 0),
    pace: sorted.reduce((s, r) => s + (r.enrollsPace ?? 0), 0),
    goal: sorted.reduce((s, r) => s + (r.goal ?? 0), 0),
  };

  return (
    <table className="w-full">
      <thead>
        <tr className="text-[11px] text-gray-500">
          <th className="text-left font-normal pb-1.5">Program</th>
          <th className="text-right font-normal pb-1.5">Enrolled</th>
          <th className="text-right font-normal pb-1.5">Pace</th>
          <th className="text-right font-normal pb-1.5">Δ</th>
          <th className="text-right font-normal pb-1.5 pl-4">% of goal</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(r => <ProgramRow key={r.program} r={r} blendedPct={blendedPct} />)}
        <ProgramRow
          isTotal
          blendedPct={blendedPct}
          r={{
            program: 'Total',
            enrolls: total.enrolls,
            enrollsPace: total.pace,
            enrollDelta: total.enrolls - total.pace,
            pctOfGoal: total.goal > 0 ? +(total.enrolls / total.goal * 100).toFixed(1) : null,
          }}
        />
      </tbody>
    </table>
  );
}

function LeadsTable({ rows, cohortCvr, cohortCpl }: { rows: WeeklyProgramRow[]; cohortCvr: number | null; cohortCpl: number | null }) {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => (b.leads ?? 0) - (a.leads ?? 0));
  // Totalled on the TABLE's basis (cohort-to-date, partial week included) rather
  // than reusing the completed-weeks tile above — mixing the two bases in one
  // block is how a reader ends up with two different "total leads".
  const total = {
    leads: sorted.reduce((s, r) => s + (r.leads ?? 0), 0),
    forecast: sorted.reduce((s, r) => s + (r.leadsForecast ?? 0), 0),
  };
  const totalDelta = total.forecast > 0
    ? +((total.leads - total.forecast) / total.forecast * 100).toFixed(1)
    : null;
  return (
    <table className="w-full mt-3">
      <thead>
        <tr className="text-[11px] text-gray-500">
          <th className="text-left font-normal pb-1.5">Program</th>
          <th className="text-right font-normal pb-1.5">Leads</th>
          <th className="text-right font-normal pb-1.5">Forecast</th>
          <th className="text-right font-normal pb-1.5">Δ</th>
          <th className="text-right font-normal pb-1.5">CPL</th>
          <th className="text-right font-normal pb-1.5">CVR</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(r => (
          <tr key={r.program} className="border-t border-white/5">
            <td className="py-2 text-sm text-gray-200">{r.program}</td>
            <td className="py-2 text-sm text-right font-mono text-white">{fmt(r.leads)}</td>
            <td className="py-2 text-sm text-right font-mono text-gray-500">{fmt(r.leadsForecast)}</td>
            <td className={`py-2 text-sm text-right font-mono ${tone(r.leadsDeltaPct)}`}>{signedPct(r.leadsDeltaPct, 0)}</td>
            <td className="py-2 text-sm text-right font-mono text-gray-300">{money(r.cpl)}</td>
            <td className={`py-2 text-sm text-right font-mono ${
              r.cvr !== null && r.cvrForecast !== null ? tone(r.cvr - r.cvrForecast) : 'text-gray-300'
            }`}>
              {pct(r.cvr, 2)}
            </td>
          </tr>
        ))}
        <tr className="border-t border-white/15">
          <td className="py-2 text-sm text-white font-medium">Total</td>
          <td className="py-2 text-sm text-right font-mono text-white">{fmt(total.leads)}</td>
          <td className="py-2 text-sm text-right font-mono text-gray-500">{fmt(total.forecast)}</td>
          <td className={`py-2 text-sm text-right font-mono ${tone(totalDelta)}`}>{signedPct(totalDelta, 0)}</td>
          <td className="py-2 text-sm text-right font-mono text-gray-300">{money(cohortCpl)}</td>
          <td className="py-2 text-sm text-right font-mono text-gray-300">{pct(cohortCvr, 2)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Tile({ label, value, sub, subTone }: { label: string; value: string; sub?: string; subTone?: string }) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-3.5 flex-1 min-w-[150px]">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-xl font-bold text-white font-mono mt-0.5">{value}</p>
      {sub && <p className={`text-[11px] font-mono mt-0.5 ${subTone ?? 'text-gray-500'}`}>{sub}</p>}
    </div>
  );
}

export default function WeeklyReportPage() {
  const [data, setData] = useState<WeeklyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState<string>(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('asOf') ?? ''
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/weekly${asOf ? `?asOf=${asOf}` : ''}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.error) setError(json.error);
        else { setData(json); setError(null); }
        setLoading(false);
      })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [asOf]);

  // Selecting today clears the param entirely, so the URL of a live view stays
  // clean and reloads as live rather than pinned to a date that ages out.
  const changeAsOf = (ymd: string) => {
    const isToday = !!data && ymd === data.today;
    setLoading(true);
    setAsOf(isToday ? '' : ymd);
    window.history.replaceState(null, '', isToday ? window.location.pathname : `${window.location.pathname}?asOf=${ymd}`);
  };

  if (loading) return <p className="text-gray-500 text-sm">Loading weekly report…</p>;
  if (error) return <p className="text-red-400 text-sm">Failed to load: {error}</p>;
  if (!data) return null;

  const wharton = data.families.find(f => f.family === 'wharton') ?? null;
  const columbia = data.families.find(f => f.family === 'columbia') ?? null;
  const team = data.team;

  return (
    <div className="w-full">
      {/* Controls live OUTSIDE the screenshot card so they never land in the crop */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Weekly report</h1>
          <p className="text-sm text-gray-400">
            Screenshot this card for the weekly email · {data.isToday ? 'live' : 'rewound view'}
          </p>
        </div>
        <AsOfPicker value={data.asOfDate} max={data.today} onChange={changeAsOf} />
      </div>

      <div className={`${SHOT_WIDTH} bg-[#0d1117] border border-white/10 rounded-2xl p-6`}>
        <div className="flex items-baseline justify-between gap-3 border-b border-white/15 pb-2.5">
          <p className="text-base font-semibold text-white">Certificates weekly</p>
          <p className="text-xs font-mono text-gray-400">
            Through {wharton?.keyedThrough ?? data.asOf}
            {wharton ? ` · wk ${wharton.week}` : ''}
          </p>
        </div>

        {/* Inside the screenshot card on purpose: if a source dropped out, the
            warning has to travel with any crop someone takes of this page. */}
        {data.unavailable.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5">
            <p className="text-xs text-red-300 font-medium">
              Do not send — {data.unavailable.join(', ')} did not load.
            </p>
            <p className="text-[11px] text-red-300/70 mt-0.5">
              Sections below are incomplete, not zero. Reload before screenshotting.
            </p>
          </div>
        )}

        <Section title="Enrollments vs goal">
          <div className="flex gap-3 flex-wrap">
            {wharton && <HeadlineCard f={wharton} />}
            {columbia && <HeadlineCard f={columbia} />}
          </div>
        </Section>

        {wharton && (
          <Section title={`Enrollments by program — ${wharton.label}`}>
            <ProgramTable rows={wharton.programs} blendedPct={wharton.pctOfGoal} />
            <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
              Pace is forecast-to-date from the cohort doc, not the full-cohort goal, and is read at the
              PRIOR day because enrollment counts land a day late — so the Δ is &ldquo;as of yesterday&rdquo;
              even where a figure is keyed through today. Bars are scaled against the{' '}
              {pct(wharton.pctOfGoal)} blended pace — half-width is on pace.
              {columbia && ` ${columbia.label} is a single program — ${fmt(columbia.enrolls)} of ${fmt(columbia.goal)}.`}
            </p>
          </Section>
        )}

        <Section title="Lead volume vs forecast">
          <div className="flex gap-3 flex-wrap">
            {wharton && (
              <Tile
                label={`${wharton.label} — through wk ${wharton.leads.throughWeek ?? '—'}`}
                value={fmt(wharton.leads.actual)}
                sub={`${signedPct(wharton.leads.deltaPct)} vs ${fmt(wharton.leads.forecast)} forecast`}
                subTone={tone(wharton.leads.deltaPct)}
              />
            )}
            {columbia && (
              <Tile
                label={`${columbia.label} — through wk ${columbia.leads.throughWeek ?? '—'}`}
                value={fmt(columbia.leads.actual)}
                sub={`${signedPct(columbia.leads.deltaPct)} vs ${fmt(columbia.leads.forecast)} forecast`}
                subTone={tone(columbia.leads.deltaPct)}
              />
            )}
            {wharton?.leads.lastWeek && (
              <Tile
                label={`Last full week — ${wharton.leads.lastWeek.dateRange}`}
                value={fmt(wharton.leads.lastWeek.actual)}
                sub={`${signedPct(wharton.leads.lastWeek.deltaPct)} vs ${fmt(wharton.leads.lastWeek.forecast)} forecast`}
                subTone={tone(wharton.leads.lastWeek.deltaPct)}
              />
            )}
          </div>
          {wharton && <LeadsTable rows={wharton.programs} cohortCvr={wharton.cvr} cohortCpl={wharton.cpl} />}
          <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
            Cards use COMPLETED weeks only — a part-week actual against a whole-week forecast always
            reads behind. The per-program table is the cohort-to-date block, which carries the current
            partial week. Cohort CVR {pct(wharton?.cvr, 2)} vs {pct(wharton?.cvrForecast, 2)} forecast;
            spend {money(wharton?.spend)} vs {money(wharton?.spendForecast)}.
          </p>
        </Section>

        <Section title="Enrollment team — aggregate">
          {/* Aubrey's sheet is a single current-state snapshot with no per-day
              history, so it CANNOT rewind with the rest of the page. Saying so
              beats showing today's consult count under a past date. */}
          {!data.isToday && team && (
            <p className="text-[11px] text-amber-300/90 mb-2">
              Not rewound — this sheet has no per-day history, so these are today&apos;s figures.
            </p>
          )}
          {team ? (
            <div className="flex gap-3 flex-wrap">
              {team.consults && (
                <Tile
                  label="Consults completed"
                  value={fmt(team.consults.completed)}
                  sub={`${pct(team.consults.cvr)} CVR vs ${pct(team.consults.baselineCvr)} baseline`}
                  subTone={tone(
                    team.consults.cvr !== null && team.consults.baselineCvr !== null
                      ? team.consults.cvr - team.consults.baselineCvr
                      : null
                  )}
                />
              )}
              {team.ta && (
                <Tile
                  label="Tuition assistance"
                  value={fmt(team.ta.apps)}
                  sub={`${fmt(team.ta.enrollees)} enrolled · ${pct(team.ta.cvr)} vs ${pct(team.ta.baselineCvr)}`}
                  subTone={tone(
                    team.ta.cvr !== null && team.ta.baselineCvr !== null ? team.ta.cvr - team.ta.baselineCvr : null
                  )}
                />
              )}
              {team.infoSessions && (
                <Tile
                  label={`Info sessions (${team.infoSessions.held} held)`}
                  value={fmt(team.infoSessions.attendance)}
                  sub={
                    team.infoSessions.priorAttendance !== null
                      ? `attended · vs ${fmt(team.infoSessions.priorAttendance)} ${team.infoSessions.priorLabel ?? 'prior'}`
                      : `attended · ${fmt(team.infoSessions.registrations)} registered`
                  }
                  subTone={tone(
                    team.infoSessions.priorAttendance !== null
                      ? team.infoSessions.attendance - team.infoSessions.priorAttendance
                      : null
                  )}
                />
              )}
              {team.pipeline && (
                <Tile
                  label="Advisor pipeline"
                  value={fmt(team.pipeline.sent)}
                  sub={`sent · ${fmt(team.pipeline.closed)} closed · ${team.pipeline.advisors} advisors`}
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600 italic">
              {data.teamNeedsAccess
                ? 'Enrollment-team sheet not shared with the service account.'
                : 'Enrollment-team sheet unavailable.'}
            </p>
          )}
          {team?.ta?.dataPulled && (
            <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
              Consults use the sheet&apos;s own de-duplicated Wharton + Columbia column, so it will not equal
              the two added together. TA is summed across both. TA tab stamped &ldquo;{team.ta.dataPulled}&rdquo;
              {team.dataPulled && ` while the consult tab is stamped “${team.dataPulled}” — confirm the TA figures are current.`}
            </p>
          )}
        </Section>

        {wharton && wharton.history.length > 0 && (
          <Section title="Same day out, prior cohorts">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] text-gray-500">
                  <th className="text-left font-normal pb-1.5">Cohort</th>
                  <th className="text-right font-normal pb-1.5">Enrolled</th>
                  <th className="text-right font-normal pb-1.5">% of goal</th>
                  <th className="text-right font-normal pb-1.5">Finished</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/5">
                  <td className="py-2 text-sm text-white font-medium">{wharton.label} (now)</td>
                  <td className="py-2 text-sm text-right font-mono text-white">{fmt(wharton.enrolls)}</td>
                  <td className="py-2 text-sm text-right font-mono text-white">{pct(wharton.pctOfGoal)}</td>
                  <td className="py-2 text-sm text-right font-mono text-gray-600">—</td>
                </tr>
                {wharton.history.map(h => (
                  <tr key={h.label} className="border-t border-white/5">
                    <td className="py-2 text-sm text-gray-200">{h.label}</td>
                    <td className="py-2 text-sm text-right font-mono text-gray-300">{fmt(h.enrolled)}</td>
                    <td className="py-2 text-sm text-right font-mono text-gray-300">{pct(h.pctOfGoal)}</td>
                    <td className={`py-2 text-sm text-right font-mono ${
                      h.hitGoal === null ? 'text-gray-600' : h.hitGoal ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {h.finalEnrolls !== null ? `${fmt(h.finalEnrolls)} / ${fmt(h.finalGoal)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
              Closed rows are enrollment at the same days-remaining, paired with how each cohort actually
              finished — matching a cohort that missed its goal is not the same as being on track.
            </p>
          </Section>
        )}

        <div className="mt-7 pt-3 border-t border-white/10 flex justify-between gap-3 flex-wrap">
          <p className="text-[10px] text-gray-600 leading-relaxed">
            Keyed through {wharton?.keyedThrough ?? '—'} (Wharton) · {columbia?.keyedThrough ?? '—'} (CBS)
            {team?.dataPulled && ` · team pulled ${team.dataPulled}`}
          </p>
          <div className="flex gap-3 text-[11px]">
            <Link href="/pulse" className="text-blue-400 hover:text-blue-300">Pulse</Link>
            <Link href="/cohort-performance/wharton" className="text-blue-400 hover:text-blue-300">Wharton detail</Link>
            <Link href="/cohort-performance/columbia" className="text-blue-400 hover:text-blue-300">CBS detail</Link>
            <Link href="/enrollment-team" className="text-blue-400 hover:text-blue-300">Team</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
