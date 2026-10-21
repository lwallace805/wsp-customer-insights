import type { WhartonPartnerResult } from '@/lib/whartonPartner';
import { ProgramMixChart } from './Charts';
import RunningTotalSection from './RunningTotalSection';
import { SERIES_COLORS, longDate, programColors, shortDate } from './shared';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 sm:py-14">
      <header className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
          Wall Street Prep
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1.5">Wharton Online — Enrollments</h1>
      </header>
      {children}
      <footer className="mt-12 pt-6 border-t border-white/10 text-xs text-gray-500">
        Prepared by Wall Street Prep. Figures are enrollments recorded in the cohort tracker and are
        updated each business day while enrollment is open. The cohort goal is set in line with the
        prior cohort&apos;s final enrollment.
      </footer>
    </div>
  );
}

export default function EnrollmentsView({ data }: { data: WhartonPartnerResult }) {
  if (!data.ok) {
    return (
      <Shell>
        <div className="bg-[#161b22] border border-white/10 rounded-xl p-6">
          <p className="text-gray-300">{data.reason}</p>
        </div>
      </Shell>
    );
  }

  // Set by the payload only while the page is holding on a cohort that has
  // already closed (the next one's tracker isn't connected yet). The live
  // cohort is never "closed" here, even on its last day — "0 days left" is the
  // honest reading of that day.
  const closed = data.closed;
  // Compared against the day the data runs through, not `new Date()`: the page
  // is rendered on the server, and a UTC "today" would flip this a few hours
  // early for a reader in the US.
  const earlyPassed = data.dataThrough !== null && data.earlyDeadline <= data.dataThrough;
  // Share of enrollments to date — a mix figure, not progress against a target.
  const share = (n: number) => (data.total > 0 ? (n / data.total) * 100 : 0);
  const maxEnrolls = data.programs.reduce((m, p) => Math.max(m, p.enrolls), 0);
  // Colour follows the program, not its rank: the index is taken from the
  // payload's (source) order, while the table below is sorted largest-first.
  // One colour map for the whole page: seeded by the payload's program order and
  // extended with any program that only appears in the cohort history, so the
  // table, the running-total overlay and the cohort stack cannot disagree.
  const colors = programColors(
    data.programs.map(p => p.program),
    data.programMix?.programs ?? [],
  );
  const colorOf = (program: string) => colors[program] ?? SERIES_COLORS[0];
  const ranked = [...data.programs].sort((a, b) => b.enrolls - a.enrolls);

  // Cohort-comparison table derivations. The average is taken only over rows
  // whose same-day value exists, and its final is averaged over the SAME rows,
  // so a withheld cohort can't skew the ratio.
  const pctOf = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—');
  const compRows = data.comparisons?.rows ?? [];
  const compAvgRows = compRows.filter(r => r.totalAtSamePoint !== null);
  const avgEnrolled = compAvgRows.length
    ? Math.round(compAvgRows.reduce((s, r) => s + (r.totalAtSamePoint ?? 0), 0) / compAvgRows.length)
    : null;
  const avgFinal = compAvgRows.length
    ? Math.round(compAvgRows.reduce((s, r) => s + r.final, 0) / compAvgRows.length)
    : null;

  return (
    <Shell>
      {/* ── Closed-cohort notice ─────────────────────────────────────────── */}
      {closed && (
        <div
          role="status"
          className="mb-5 bg-amber-400/[0.07] border border-amber-400/30 rounded-xl px-5 py-4 text-sm text-amber-100/90 leading-relaxed"
        >
          {`${data.cohort} enrollment closed on ${longDate(data.extendedClose)}; the figures below are that cohort's final numbers.`}
          {data.nextCohort
            ? ` ${data.nextCohort.cohort} enrollment opened on ${longDate(data.nextCohort.opened)} — its figures will appear here once its tracker is connected.`
            : ''}
        </div>
      )}

      {/* ── Headline ─────────────────────────────────────────────────────── */}
      <section className="bg-[#161b22] border border-white/10 rounded-xl p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              {data.cohort} cohort
            </h2>
            <p className="text-5xl sm:text-6xl font-bold mt-3 tabular-nums">
              {data.total.toLocaleString()}
            </p>
            <p className="text-sm text-gray-400 mt-1.5">
              {closed ? 'final enrollment' : 'total enrollments'}
              {data.dataThrough ? ` through ${longDate(data.dataThrough)}` : ''}
            </p>
          </div>
          <dl className="text-sm text-left sm:text-right space-y-2">
            {data.goal !== null && data.prior && (
              <div>
                <dt className="text-gray-500 text-xs uppercase tracking-wider">Cohort goal</dt>
                <dd className="text-gray-200 tabular-nums">
                  {data.goal.toLocaleString()}
                  <span className="text-gray-500">
                    {` · ${data.goal === data.prior.final ? 'flat to' : 'in line with'} ${data.prior.cohort}`}
                  </span>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider">Enrollment opened</dt>
              <dd className="text-gray-200 tabular-nums">{shortDate(data.opened)}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider">Early enrollment deadline</dt>
              <dd className="text-gray-200 tabular-nums">
                {shortDate(data.earlyDeadline)}
                {earlyPassed && <span className="text-gray-500"> · passed</span>}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider">Enrollment deadline</dt>
              <dd className="text-gray-200 tabular-nums">{shortDate(data.deadline)}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider">
                {closed ? 'Enrollment closed' : 'Closes (with extension)'}
              </dt>
              <dd className="text-gray-200 tabular-nums">
                {shortDate(data.extendedClose)}
                {!closed && (
                  <span className="text-gray-500">
                    {' '}· {data.daysRemaining} day{data.daysRemaining === 1 ? '' : 's'} left
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── Goal & pace vs. prior cohort ─────────────────────────────────── */}
      {data.goal !== null && data.prior && (
        <section className="bg-[#161b22] border border-white/10 rounded-xl p-6 sm:p-7 mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Pace toward the goal
          </h2>
          {/* One template literal, not JSX text: the compiler drops the space
              between an expression and a following HTML entity (&apos;). */}
          <p className="text-xs text-gray-500 mb-5">
            {`The ${data.cohort} goal ${closed ? 'was' : 'is'} set ${data.goal === data.prior.final ? 'flat to' : 'in line with'} the ${data.prior.cohort} cohort's final enrollment (${data.prior.final.toLocaleString()}). ${
              closed
                ? `Enrollment has closed, so this is the cohort's final result against that goal.`
                : `Pacing compares each cohort at the same number of days before close — enrollment is heavily deadline-weighted, so the like-for-like point matters more than percent of goal.`
            }`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Goal</p>
              <p className="text-2xl font-semibold tabular-nums mt-1">{data.goal.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">{data.prior.cohort} finished at {data.prior.final.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider">
                {closed ? 'Final enrollment' : 'Enrolled so far'}
              </p>
              <p className="text-2xl font-semibold tabular-nums mt-1">
                {data.total.toLocaleString()}
                <span className="text-sm font-normal text-gray-400"> · {((data.total / data.goal) * 100).toFixed(0)}% of goal</span>
              </p>
              {!closed && data.prior.daysToClose !== null && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {`${data.prior.daysToClose} days to close as of ${data.dataThrough ? shortDate(data.dataThrough) : 'the last keyed day'}`}
                </p>
              )}
            </div>
            {data.prior.totalAtSamePoint !== null && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider">
                  {closed && data.prior.daysToClose === 0 ? `${data.prior.cohort} final` : `${data.prior.cohort} at this point`}
                </p>
                <p className="text-2xl font-semibold tabular-nums mt-1">
                  {data.prior.totalAtSamePoint.toLocaleString()}
                  <span
                    className={`text-sm font-normal ${data.total >= data.prior.totalAtSamePoint ? 'text-emerald-400' : 'text-amber-400'}`}
                  >
                    {` · ${Math.abs(data.total - data.prior.totalAtSamePoint).toLocaleString()} ${data.total >= data.prior.totalAtSamePoint ? 'ahead' : 'behind'}`}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {closed && data.prior.daysToClose === 0 ? 'prior cohort, at its close' : 'same days to close, prior cohort'}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Cohort comparison ────────────────────────────────────────────── */}
      {data.comparisons && (
        <section className="bg-[#161b22] border border-white/10 rounded-xl p-6 sm:p-7 mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Cohort comparison
            </h2>
            <span className="text-xs text-gray-500">
              {data.comparisons.daysOut === 0 ? 'Compared at close' : `Compared at ${data.comparisons.daysOut} days out`}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            {`${
              data.comparisons.daysOut === 0
                ? 'Each cohort is shown at its close.'
                : `Each cohort is measured at the same point in its countdown — ${data.comparisons.daysOut} days before close.`
            } Earlier cohorts show their final enrollment; ${data.cohort} shows its goal.`}
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-[10px] sm:text-xs uppercase tracking-wider border-b border-white/10">
                <th className="text-left font-medium pb-2">Cohort</th>
                <th className="text-right font-medium pb-2 px-3">% of final / goal</th>
                <th className="text-right font-medium pb-2 px-3">Enrolled</th>
                <th className="text-right font-medium pb-2">Final / goal</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/5 bg-white/[0.03]">
                <td className="py-2.5 text-gray-100 font-medium">
                  {data.cohort}
                  {closed ? (
                    <span className="ml-2 align-middle text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/20 text-gray-400">
                      Closed
                    </span>
                  ) : (
                    <span className="ml-2 align-middle text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-400/40 text-amber-300">
                      Active
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-white font-medium">
                  {data.goal !== null ? pctOf(data.total, data.goal) : '—'}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-white font-medium">
                  {data.total.toLocaleString()}
                </td>
                <td className="py-2.5 text-right tabular-nums text-gray-200">
                  {data.goal !== null ? (
                    <>
                      {data.goal.toLocaleString()} <span className="text-gray-500">goal</span>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
              {avgEnrolled !== null && avgFinal !== null && (
                <tr className="border-b border-white/5 italic text-gray-500">
                  <td className="py-2.5">{`Last ${compAvgRows.length} avg`}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{pctOf(avgEnrolled, avgFinal)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{avgEnrolled.toLocaleString()}</td>
                  <td className="py-2.5 text-right tabular-nums">{avgFinal.toLocaleString()}</td>
                </tr>
              )}
              <tr>
                <td colSpan={4} className="pt-3 pb-1 text-[10px] uppercase tracking-wider text-gray-500">
                  Earlier cohorts
                </td>
              </tr>
              {compRows.map(r => (
                <tr key={r.cohort} className="border-b border-white/5">
                  <td className="py-2.5 text-gray-200">{r.cohort}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-300">
                    {r.totalAtSamePoint !== null ? pctOf(r.totalAtSamePoint, r.final) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-300">
                    {r.totalAtSamePoint !== null ? r.totalAtSamePoint.toLocaleString() : '—'}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-white">{r.final.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── By program ───────────────────────────────────────────────────── */}
      <section className="bg-[#161b22] border border-white/10 rounded-xl p-6 sm:p-7 mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">
          Enrollments by program
        </h2>

        {data.programs.length === 0 ? (
          <p className="text-sm text-gray-400">
            The program-level breakdown isn&apos;t available for this cohort yet. The cohort total
            above is unaffected.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              {/* The share bar is decoration on top of the number beside it, so
                  it's the column that goes when there isn't room for four. */}
              <tr className="text-gray-500 text-[10px] sm:text-xs uppercase tracking-wider border-b border-white/10">
                <th className="text-left font-medium pb-2">Program</th>
                <th className="text-right font-medium pb-2 px-3 w-24">Enrollments</th>
                <th className="text-right font-medium pb-2 w-16">Share</th>
                <th className="w-1/3 pl-4 hidden sm:table-cell" />
              </tr>
            </thead>
            <tbody>
              {ranked.map(p => (
                <tr key={p.program} className="border-b border-white/5">
                  <td className="py-2.5 text-gray-200">{p.program}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-white font-medium">
                    {p.enrolls.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-gray-400">
                    {share(p.enrolls).toFixed(0)}%
                  </td>
                  <td className="py-2.5 pl-4 hidden sm:table-cell">
                    <div
                      className="h-2 rounded-sm"
                      style={{
                        width: `${maxEnrolls > 0 ? (p.enrolls / maxEnrolls) * 100 : 0}%`,
                        backgroundColor: colorOf(p.program),
                      }}
                    />
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-3 font-medium text-gray-200">Total</td>
                <td className="py-3 px-3 text-right tabular-nums text-white font-semibold">
                  {data.total.toLocaleString()}
                </td>
                <td className="py-3 text-right tabular-nums text-gray-400">100%</td>
                <td className="hidden sm:table-cell" />
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {/* ── Running totals ───────────────────────────────────────────────── */}
      <section className="bg-[#161b22] border border-white/10 rounded-xl p-6 sm:p-7 mt-5">
        <RunningTotalSection
          series={data.series}
          cohort={data.cohort}
          description={`Cumulative enrollments since the cohort opened on ${shortDate(data.opened)}.${
            data.prior
              ? ` The ${data.prior.cohort} curve is aligned by days before close and runs to its final of ${data.prior.final.toLocaleString()} — the pace that matches the goal.`
              : ''
          }`}
          prior={data.prior ? {
            cohort: data.prior.cohort,
            label: `${data.prior.cohort} (prior)`,
            series: data.prior.series,
            final: data.prior.final,
          } : undefined}
          goal={data.goal}
          programs={data.programs.map(p => ({
            program: p.program,
            series: p.series,
            priorSeries: p.priorSeries,
          }))}
          colors={colors}
          totalColor={SERIES_COLORS[0]}
        />
      </section>

      {/* ── Programs' performance across cohorts ─────────────────────────── */}
      {data.programMix && (
        <section className="bg-[#161b22] border border-white/10 rounded-xl p-6 sm:p-7 mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Programs&apos; performance
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {closed
              ? 'Enrollments by program across cohorts, each at its final enrollment.'
              : `Enrollments by program across cohorts. Closed cohorts show their final enrollment; ${data.cohort} is still enrolling, so its column is a running total and will keep rising.`}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3">
            {data.programMix.programs.map(p => (
              <span key={p} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorOf(p) }} />
                {p}
              </span>
            ))}
          </div>
          <ProgramMixChart
            cohorts={data.programMix.cohorts}
            programs={[...data.programMix.programs].reverse()}
            colors={colors}
          />
          <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
            Program-level figures come from the cohort tracker and count individual (B2C) enrollments,
            so a cohort&apos;s total here can sit a few enrollments below the cohort final shown above,
            which also includes corporate enrollments.
          </p>
        </section>
      )}

    </Shell>
  );
}
