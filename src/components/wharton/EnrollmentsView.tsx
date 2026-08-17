import type { WhartonPartnerResult } from '@/lib/whartonPartner';
import { ProgramLinesChart, RunningTotalChart } from './Charts';
import { SERIES_COLORS, longDate, shortDate } from './shared';

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
        updated each business day.
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

  const closed = data.daysRemaining === 0;
  // Share of enrollments to date — a mix figure, not progress against a target.
  const share = (n: number) => (data.total > 0 ? (n / data.total) * 100 : 0);
  const maxEnrolls = data.programs.reduce((m, p) => Math.max(m, p.enrolls), 0);
  // Colour follows the program, not its rank: the index is taken from the
  // payload's (source) order, while the table below is sorted largest-first.
  const colorOf = (program: string) => {
    const i = data.programs.findIndex(p => p.program === program);
    return SERIES_COLORS[i % SERIES_COLORS.length];
  };
  const ranked = [...data.programs].sort((a, b) => b.enrolls - a.enrolls);

  return (
    <Shell>
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
              total enrollments{data.dataThrough ? ` through ${longDate(data.dataThrough)}` : ''}
            </p>
          </div>
          <dl className="text-sm text-left sm:text-right space-y-2">
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wider">Enrollment opened</dt>
              <dd className="text-gray-200 tabular-nums">{shortDate(data.opened)}</dd>
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
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Running total
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Cumulative enrollments since the cohort opened on {shortDate(data.opened)}.
        </p>
        <RunningTotalChart series={data.series} />
      </section>

      {data.programs.length > 0 && (
        <section className="bg-[#161b22] border border-white/10 rounded-xl p-6 sm:p-7 mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Running total by program
          </h2>
          <p className="text-xs text-gray-500 mb-4">Cumulative enrollments, each program separately.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3">
            {data.programs.map(p => (
              <span key={p.program} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colorOf(p.program) }}
                />
                {p.program}
              </span>
            ))}
          </div>
          <ProgramLinesChart programs={data.programs} />
        </section>
      )}
    </Shell>
  );
}
