'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { RunningTotalChart } from './Charts';

interface ProgramSeries {
  program: string;
  series: Array<{ date: string; total: number }>;
  priorSeries: Array<{ date: string; total: number }> | null;
}

const ALL = '__all__';

/** The running total, with a one-at-a-time program selector.
 *
 *  Deliberately single-select. The point of the view is a like-for-like pace
 *  comparison against the prior cohort, and that only holds when both curves
 *  describe the same thing: all programs against the prior cohort's total, or
 *  ONE program against that same program a cohort ago. Letting several programs
 *  on at once would put them all against a single prior line that belongs to
 *  none of them. */
export default function RunningTotalSection({
  series, cohort, description, prior, goal, programs, colors, totalColor,
}: {
  series: Array<{ date: string; total: number }>;
  cohort: string;
  /** Copy for the all-programs view; built by the server component. */
  description: string;
  prior?: { cohort: string; label: string; series: Array<{ date: string; total: number }>; final: number };
  goal?: number | null;
  programs: ProgramSeries[];
  colors: Record<string, string>;
  totalColor: string;
}) {
  const [selected, setSelected] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = selected === ALL ? null : programs.find(p => p.program === selected) ?? null;
  const choose = (value: string) => { setSelected(value); setOpen(false); };

  // A program's prior curve comes from the prior cohort's own per-program grid;
  // the goal is a cohort-level number, so it is NOT drawn over one program —
  // a 1,000 line above a single program's curve would read as that program's
  // target.
  const chartSeries = active ? active.series : series;
  const chartColor = active ? colors[active.program] : totalColor;
  const chartGoal = active ? null : goal;
  const chartPrior = active
    ? (active.priorSeries && prior
        ? { label: `${prior.cohort} ${active.program}`, series: active.priorSeries }
        : undefined)
    : prior;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Running total</h2>

        {programs.length > 0 && (
          <div className="relative" ref={wrapRef}>
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              aria-haspopup="listbox"
              className="flex items-center gap-2 text-xs bg-[#0d1117] border border-white/15 rounded-lg
                         px-3 py-1.5 text-gray-300 hover:border-white/30 transition-colors"
            >
              <span className="text-gray-500">Show:</span>
              <span className="text-gray-200">{active ? active.program : 'All programs'}</span>
              <ChevronDown size={13} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div
                role="listbox"
                className="absolute right-0 top-full mt-1 z-20 bg-[#161b22] border border-white/15
                           rounded-lg shadow-xl py-1 min-w-[180px]"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={selected === ALL}
                  onClick={() => choose(ALL)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-white/5
                              ${selected === ALL ? 'text-white' : 'text-gray-300'}`}
                >
                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: totalColor }} />
                  All programs
                </button>
                <div className="border-t border-white/10 my-1" />
                {programs.map(p => (
                  <button
                    key={p.program}
                    type="button"
                    role="option"
                    aria-selected={selected === p.program}
                    onClick={() => choose(p.program)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-white/5
                                ${selected === p.program ? 'text-white' : 'text-gray-300'}`}
                  >
                    <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[p.program] }} />
                    {p.program}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-4">
        {active
          ? `${active.program} enrollments to date${
              chartPrior && prior
                ? `, against ${prior.cohort}'s ${active.program} at the same number of days before close.`
                : `. No ${prior?.cohort ?? 'prior cohort'} comparison is available for this program.`
            }`
          : description}
      </p>

      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartColor }} />
          {active ? `${cohort} · ${active.program}` : cohort}
        </span>
        {chartPrior && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: '#9aa4b2' }} />
            {active ? `${chartPrior.label} (prior cohort)` : `${prior?.cohort} (prior cohort)`}
          </span>
        )}
      </div>

      <RunningTotalChart
        series={chartSeries}
        currentLabel={active ? `${cohort} · ${active.program}` : cohort}
        prior={chartPrior}
        goal={chartGoal}
        color={chartColor}
      />
    </>
  );
}
