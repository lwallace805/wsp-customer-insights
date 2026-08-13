'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AsOfPicker from '@/components/AsOfPicker';
import type { WeeklyReport, WeeklyFamily, WeeklyProgramRow } from '@/lib/weeklyReport';

// The page is built to be SCREENSHOT, not browsed. The card is capped rather
// than fluid so the crop is a predictable shape week to week — a full-bleed
// card would stretch the tables into unreadable whitespace on a wide monitor
// and change the screenshot's proportions with the window. It still shrinks
// freely below the cap, which is what keeps it usable on a phone.
const SHOT_WIDTH = 'max-w-[880px]';

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
  goal: number | null;
}

/** Enrollments ahead of / behind that program's OWN pace, drawn from a centre
 *  line. Length is the ABSOLUTE gap in enrollments, not a percentage, so the
 *  bars are directly comparable and the eye lands on whichever program is
 *  actually moving the cohort total — a +64% AVI is only 7 enrollments, while
 *  a −40% FP&A is 19. */
function PaceBar({ delta, max }: { delta: number | null; max: number }) {
  if (delta === null || max <= 0) return <div className="h-1.5" />;
  const width = Math.min(Math.abs(delta) / max, 1) * 50;
  const ahead = delta >= 0;
  return (
    <div className="relative h-1.5 w-full min-w-[70px] bg-white/5 rounded-full">
      <div className="absolute inset-y-[-3px] left-1/2 w-px bg-white/25" />
      <div
        className={`absolute inset-y-0 rounded-full ${ahead ? 'bg-emerald-400' : 'bg-red-400'}`}
        style={ahead ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }}
      />
    </div>
  );
}

function ProgramRow({
  r,
  maxDelta,
  isTotal,
  isSubtotal,
  note,
}: {
  r: ProgramCell;
  maxDelta: number;
  isTotal?: boolean;
  isSubtotal?: boolean;
  note?: string;
}) {
  // Attainment against the program's own plan. This is the number the bar
  // encodes the direction of; % of the full-cohort goal is NOT comparable
  // across programs, because the plan expects each to sit at a different
  // share of its goal at any given day (9%–16% for Wharton right now).
  const attainment =
    r.enrolls !== null && r.enrollsPace !== null && r.enrollsPace > 0
      ? +(r.enrolls / r.enrollsPace * 100).toFixed(0)
      : null;

  const emphasised = isTotal || isSubtotal;
  return (
    <tr className={emphasised ? 'border-t border-white/15' : 'border-t border-white/5'}>
      <td className={`py-2 text-xs sm:text-sm ${emphasised ? 'text-white font-medium' : 'text-gray-200'}`}>
        {r.program}
        {note && <span className="text-[10px] text-gray-600 font-normal"> · {note}</span>}
      </td>
      <td className="py-2 text-xs sm:text-sm text-right font-mono text-white">{fmt(r.enrolls)}</td>
      <td className="py-2 text-xs sm:text-sm text-right font-mono text-gray-500">{fmt(r.enrollsPace)}</td>
      <td className="py-2 text-xs sm:text-sm text-right font-mono text-gray-500">{fmt(r.goal)}</td>
      <td className={`py-2 text-xs sm:text-sm text-right font-mono ${tone(r.enrollDelta)}`}>{signed(r.enrollDelta)}</td>
      <td className="py-2 pl-3 sm:pl-4">
        <PaceBar delta={r.enrollDelta} max={maxDelta} />
      </td>
      <td className={`py-2 pl-2 text-xs sm:text-sm text-right font-mono ${tone(attainment === null ? null : attainment - 100)}`}>
        {attainment === null ? '—' : `${attainment}%`}
      </td>
    </tr>
  );
}

/** AI (the CBS certificate) is a single-program cohort, so its WoW tab has no
 *  per-program rows at all — `programs` comes back empty. Its row here is built
 *  from the cohort's own figures, which is the same thing the Wharton Total row
 *  uses, so the two are on one basis. */
function aiRow(columbia: WeeklyFamily): ProgramCell {
  return {
    program: 'AI',
    enrolls: columbia.enrolls,
    enrollsPace: columbia.pace,
    enrollDelta: columbia.vsPace,
    goal: columbia.goal,
  };
}

function ProgramTable({
  rows,
  cohortEnrolls,
  cohortPace,
  cohortGoal,
  columbia,
}: {
  rows: WeeklyProgramRow[];
  cohortEnrolls: number;
  cohortPace: number;
  cohortGoal: number;
  columbia: WeeklyFamily | null;
}) {
  if (!rows.length) {
    return <p className="text-sm text-gray-600 italic">No per-program rows in this cohort&apos;s WoW tab.</p>;
  }
  // Worst-first: the email's job is to put the gap at the top of the block.
  const sorted = [...rows].sort((a, b) => (a.enrollDelta ?? 0) - (b.enrollDelta ?? 0));

  // The Total row is the COHORT figure (deadline pacing table), not the sum of
  // the rows above it. The sheet's per-program forecast column carries rounding
  // that doesn't always close: on Aug 12 the parts summed to the cohort's 142
  // exactly, on Aug 13 they came to 148 against a cohort pace of 147 — which
  // read as the headline and the table contradicting each other. The deadline
  // table and the WoW block's OWN Total row agree on 147, so that's the
  // authoritative pair; the parts are the outlier and the gap is disclosed
  // below rather than silently absorbed into the total.
  const partsPace = sorted.reduce((s, r) => s + (r.enrollsPace ?? 0), 0);
  const partsEnrolls = sorted.reduce((s, r) => s + (r.enrolls ?? 0), 0);
  const paceGap = partsPace - cohortPace;
  const enrollGap = partsEnrolls - cohortEnrolls;

  const totalDelta = cohortEnrolls - cohortPace;
  const ai = columbia ? aiRow(columbia) : null;
  const combined = ai
    ? {
        program: 'All programs',
        enrolls: cohortEnrolls + (ai.enrolls ?? 0),
        enrollsPace: cohortPace + (ai.enrollsPace ?? 0),
        enrollDelta: totalDelta + (ai.enrollDelta ?? 0),
        goal: cohortGoal + (ai.goal ?? 0),
      }
    : null;

  const maxDelta = Math.max(
    ...sorted.map(r => Math.abs(r.enrollDelta ?? 0)),
    Math.abs(totalDelta),
    Math.abs(ai?.enrollDelta ?? 0),
    1,
  );

  return (
    <>
      <table className="w-full">
        <thead>
          <tr className="text-[11px] text-gray-500">
            <th className="text-left font-normal pb-1.5">Program</th>
            <th className="text-right font-normal pb-1.5">Enrolled</th>
            <th className="text-right font-normal pb-1.5">Pace</th>
            <th className="text-right font-normal pb-1.5">Goal</th>
            <th className="text-right font-normal pb-1.5">Δ</th>
            <th className="text-right font-normal pb-1.5 pl-3 sm:pl-4">Behind / ahead of pace</th>
            <th className="text-right font-normal pb-1.5 pl-2 whitespace-nowrap">% of pace</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => <ProgramRow key={r.program} r={r} maxDelta={maxDelta} />)}
          <ProgramRow
            isSubtotal
            maxDelta={maxDelta}
            r={{
              program: 'Wharton total',
              enrolls: cohortEnrolls,
              enrollsPace: cohortPace,
              enrollDelta: totalDelta,
              goal: cohortGoal || null,
            }}
          />
          {ai && <ProgramRow r={ai} maxDelta={maxDelta} note={columbia!.label} />}
          {combined && <ProgramRow isTotal maxDelta={maxDelta} r={combined} />}
        </tbody>
      </table>
      {(paceGap !== 0 || enrollGap !== 0) && (
        <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
          Total is the cohort figure from the deadline pacing table, which the WoW block&apos;s own Total
          row matches. The per-program rows above carry rounding and sum to{' '}
          {paceGap !== 0 && <>a pace of {fmt(partsPace)}</>}
          {paceGap !== 0 && enrollGap !== 0 && ' and '}
          {enrollGap !== 0 && <>{fmt(partsEnrolls)} enrolled</>}
          , so they don&apos;t close exactly against it.
        </p>
      )}
    </>
  );
}

function LeadRow({
  label, leads, forecast, cpl, cvr, cvrForecast, emphasised, note,
}: {
  label: string;
  leads: number | null;
  forecast: number | null;
  cpl: number | null;
  cvr: number | null;
  cvrForecast: number | null;
  emphasised?: boolean;
  note?: string;
}) {
  const deltaPct = leads !== null && forecast ? +((leads - forecast) / forecast * 100).toFixed(1) : null;
  return (
    <tr className={emphasised ? 'border-t border-white/15' : 'border-t border-white/5'}>
      <td className={`py-2 text-xs sm:text-sm ${emphasised ? 'text-white font-medium' : 'text-gray-200'}`}>
        {label}
        {note && <span className="text-[10px] text-gray-600 font-normal"> · {note}</span>}
      </td>
      <td className="py-2 text-xs sm:text-sm text-right font-mono text-white">{fmt(leads)}</td>
      <td className="py-2 text-xs sm:text-sm text-right font-mono text-gray-500">{fmt(forecast)}</td>
      <td className={`py-2 text-xs sm:text-sm text-right font-mono ${tone(deltaPct)}`}>{signedPct(deltaPct, 0)}</td>
      <td className="py-2 text-xs sm:text-sm text-right font-mono text-gray-300">{money(cpl)}</td>
      <td className={`py-2 text-xs sm:text-sm text-right font-mono ${
        cvr !== null && cvrForecast !== null ? tone(cvr - cvrForecast) : 'text-gray-300'
      }`}>
        {pct(cvr, 2)}
      </td>
    </tr>
  );
}

function LeadsTable({
  rows, wharton, columbia,
}: {
  rows: WeeklyProgramRow[];
  wharton: WeeklyFamily;
  columbia: WeeklyFamily | null;
}) {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => (b.leads ?? 0) - (a.leads ?? 0));

  // Same rule as the enrollments table: the subtotal is the WoW Total ROW, not
  // the sum of the program rows, because that column carries rounding that
  // doesn't always close (7,045 against a Total row of 7,044 on Aug 13). The
  // gap is disclosed below rather than absorbed.
  const partsLeads = sorted.reduce((s, r) => s + (r.leads ?? 0), 0);
  const partsForecast = sorted.reduce((s, r) => s + (r.leadsForecast ?? 0), 0);
  const leadsGap = partsLeads - (wharton.leadsCtd ?? partsLeads);
  const forecastGap = partsForecast - (wharton.leadsCtdForecast ?? partsForecast);

  const combined = columbia
    ? {
        leads: (wharton.leadsCtd ?? 0) + (columbia.leadsCtd ?? 0),
        forecast: (wharton.leadsCtdForecast ?? 0) + (columbia.leadsCtdForecast ?? 0),
      }
    : null;

  return (
    <>
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
          <LeadRow
            key={r.program}
            label={r.program}
            leads={r.leads}
            forecast={r.leadsForecast}
            cpl={r.cpl}
            cvr={r.cvr}
            cvrForecast={r.cvrForecast}
          />
        ))}
        <LeadRow
          emphasised
          label="Wharton total"
          leads={wharton.leadsCtd}
          forecast={wharton.leadsCtdForecast}
          cpl={wharton.cpl}
          cvr={wharton.cvr}
          cvrForecast={wharton.cvrForecast}
        />
        {columbia && (
          <LeadRow
            label="AI"
            note={columbia.label}
            leads={columbia.leadsCtd}
            forecast={columbia.leadsCtdForecast}
            cpl={columbia.cpl}
            cvr={columbia.cvr}
            cvrForecast={columbia.cvrForecast}
          />
        )}
        {combined && (
          <LeadRow
            emphasised
            label="All programs"
            leads={combined.leads}
            forecast={combined.forecast}
            cpl={null}
            cvr={null}
            cvrForecast={null}
          />
        )}
      </tbody>
    </table>
    {(leadsGap !== 0 || forecastGap !== 0) && (
      <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
        Wharton total is the WoW block&apos;s own Total row; its per-program rows carry rounding and sum
        to {fmt(partsLeads)} leads against a forecast of {fmt(partsForecast)}, so they don&apos;t close
        exactly against it. CPL and CVR are cohort-level and don&apos;t combine across the two, so the
        All-programs row leaves them blank rather than printing a blended figure nobody planned to.
      </p>
    )}
    </>
  );
}

/** `compare` puts the baseline next to the headline number in ABSOLUTE terms.
 *  A lone "125" with a rate underneath gave a reader no way to tell whether 125
 *  was good; "125 vs 110" answers it without them having to look anything up. */
function Tile({
  label, value, compare, sub, subTone,
}: {
  label: string;
  value: string;
  compare?: string;
  sub?: string;
  subTone?: string;
}) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-3.5 flex-1 min-w-[150px]">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-xl font-bold text-white font-mono mt-0.5">
        {value}
        {compare && <span className="text-xs font-normal text-gray-500"> vs {compare}</span>}
      </p>
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
    // Header and card share ONE centred column at the same width. Previously the
    // header spanned the full page while the card was pinned left at 760px, so
    // on a wide monitor the "as of" control floated ~700px away from the thing
    // it controlled and the layout read as broken rather than deliberate.
    <div className={`${SHOT_WIDTH} mx-auto w-full`}>
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

      <div className="bg-[#0d1117] border border-white/10 rounded-2xl p-4 sm:p-6">
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
          <Section title="Enrollments by program">
            <ProgramTable
              rows={wharton.programs}
              cohortEnrolls={wharton.enrolls}
              cohortPace={wharton.pace}
              cohortGoal={wharton.goal}
              columbia={columbia}
            />
            <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
              Pace is each program&apos;s own forecast-to-date from the cohort doc, read at the PRIOR day
              because enrollment counts land a day late — so the Δ is &ldquo;as of yesterday&rdquo; even
              where a figure is keyed through today. Bars run from the centre line and are sized by the
              gap in ENROLLMENTS, so the longest bar is whichever program is moving the cohort total
              most. &ldquo;% of pace&rdquo; is how much of its OWN plan a program has enrolled — 100% is
              exactly on plan, 65% is a third short of it, 150% is half again ahead. It is not a share
              of the full-cohort goal, which the plan never expects every program to reach at the same
              time.
              {columbia && (
                <> AI is {columbia.label}, a single-program cohort, so it has no per-program breakdown of
                its own. It sits {columbia.daysRemaining - (wharton?.daysRemaining ?? 0)}{' '}
                days further from its deadline than Wharton, so All programs adds two cohorts at points in
                their cycles — each row&apos;s pace is already its own cohort&apos;s plan for today, which
                is what makes the sum meaningful.</>
              )}
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
          {wharton && <LeadsTable rows={wharton.programs} wharton={wharton} columbia={columbia} />}
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
                  compare={`${fmt(team.consults.baseline)} baseline`}
                  sub={`${fmt(team.consults.enrollees)} enrolled vs ${fmt(team.consults.baselineEnrollees)} · CVR ${pct(team.consults.cvr)} vs ${pct(team.consults.baselineCvr)}`}
                  subTone={tone(
                    team.consults.cvr !== null && team.consults.baselineCvr !== null
                      ? team.consults.cvr - team.consults.baselineCvr
                      : null
                  )}
                />
              )}
              {team.ta && (
                <Tile
                  label="TA applications"
                  value={fmt(team.ta.apps)}
                  compare={`${fmt(team.ta.baselineApps)} baseline`}
                  sub={`${fmt(team.ta.enrollees)} enrolled vs ${fmt(team.ta.baselineEnrollees)} · CVR ${pct(team.ta.cvr)} vs ${pct(team.ta.baselineCvr)}`}
                  subTone={tone(
                    team.ta.cvr !== null && team.ta.baselineCvr !== null ? team.ta.cvr - team.ta.baselineCvr : null
                  )}
                />
              )}
              {team.infoSessions && (
                <Tile
                  label={`Info sessions attended (${team.infoSessions.held} held)`}
                  value={fmt(team.infoSessions.attendance)}
                  compare={
                    team.infoSessions.priorAttendance !== null
                      ? `${fmt(team.infoSessions.priorAttendance)} ${team.infoSessions.priorLabel ?? 'prior'}`
                      : undefined
                  }
                  sub={`${fmt(team.infoSessions.registrations)} registered`}
                  subTone={tone(
                    team.infoSessions.priorAttendance !== null
                      ? team.infoSessions.attendance - team.infoSessions.priorAttendance
                      : null
                  )}
                />
              )}
              {team.pipeline && (
                <Tile
                  label="Forecast to close"
                  value={fmt(team.pipeline.forecastToClose)}
                  sub={`${fmt(team.pipeline.forecastClosed)} closed so far · ${pct(team.pipeline.forecastCvr, 0)} hit rate`}
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
              Consults and TA show actual vs the team&apos;s own baseline window. Consults use the
              sheet&apos;s de-duplicated Wharton + Columbia column, so it will not equal the two added
              together; TA is summed across both. Forecast to close is the advisors&apos; live list from
              the Funnel Health tab
              {team.pipeline?.dateRange ? `, covering ${team.pipeline.dateRange}` : ''}{' '}
              — leads they expect to enroll, not outbound volume. TA tab stamped &ldquo;{team.ta.dataPulled}&rdquo;
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
                  <th className="text-right font-normal pb-1.5">Cohort total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/5">
                  <td className="py-2 text-xs sm:text-sm text-white font-medium">{wharton.label} (now)</td>
                  <td className="py-2 text-xs sm:text-sm text-right font-mono text-white">{fmt(wharton.enrolls)}</td>
                  <td className="py-2 text-xs sm:text-sm text-right font-mono text-white">{pct(wharton.pctOfGoal)}</td>
                  <td className="py-2 text-xs sm:text-sm text-right font-mono text-gray-600">—</td>
                </tr>
                {wharton.history.map(h => (
                  <tr key={h.label} className="border-t border-white/5">
                    <td className="py-2 text-xs sm:text-sm text-gray-200">{h.label}</td>
                    <td className="py-2 text-xs sm:text-sm text-right font-mono text-gray-300">{fmt(h.enrolled)}</td>
                    <td className="py-2 text-xs sm:text-sm text-right font-mono text-gray-300">{pct(h.pctOfGoal)}</td>
                    <td className={`py-2 text-xs sm:text-sm text-right font-mono ${
                      h.hitGoal === null ? 'text-gray-600' : h.hitGoal ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {fmt(h.finalEnrolls)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
              Enrolled is each cohort at the SAME days-remaining Fall &apos;26 is at now; cohort total is
              what it finished with, green where that beat its goal. Matching a cohort that missed is not
              the same as being on track.
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
