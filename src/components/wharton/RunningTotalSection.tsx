'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { RunningTotalChart } from './Charts';

interface ProgramSeries {
  program: string;
  series: Array<{ date: string; total: number }>;
}

/** The running-total chart plus the program selector Wharton asked for on the
 *  Sep 1 markup. Nothing is selected by default: the cohort total is the
 *  headline this page exists for, and the per-program curves are opt-in detail
 *  layered over it rather than competing with it. */
export default function RunningTotalSection({
  series, cohort, description, prior, goal, programs, colors, totalColor,
}: {
  series: Array<{ date: string; total: number }>;
  cohort: string;
  /** Built by the server component so all page copy lives in one file. */
  description: string;
  prior?: { label: string; series: Array<{ date: string; total: number }> };
  goal?: number | null;
  programs: ProgramSeries[];
  colors: Record<string, string>;
  totalColor: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape — a panel that can only be dismissed by
  // re-clicking the trigger is the classic way these traps a reader.
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

  const toggle = (program: string) =>
    setSelected(cur => (cur.includes(program) ? cur.filter(p => p !== program) : [...cur, program]));

  const overlays = programs
    .filter(p => selected.includes(p.program))
    .map(p => ({ program: p.program, color: colors[p.program], series: p.series }));

  const summary =
    selected.length === 0 ? 'None'
      : selected.length === programs.length ? 'All programs'
      : selected.length === 1 ? selected[0]
      : `${selected.length} selected`;

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
              aria-haspopup="true"
              className="flex items-center gap-2 text-xs bg-[#0d1117] border border-white/15 rounded-lg
                         px-3 py-1.5 text-gray-300 hover:border-white/30 transition-colors"
            >
              <span className="text-gray-500">Show programs:</span>
              <span className="text-gray-200">{summary}</span>
              <ChevronDown size={13} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-[#161b22] border border-white/15
                              rounded-lg shadow-xl py-1 min-w-[190px]">
                {programs.map(p => (
                  <label
                    key={p.program}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-300
                               hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(p.program)}
                      onChange={() => toggle(p.program)}
                      className="accent-blue-500"
                    />
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: colors[p.program] }}
                    />
                    {p.program}
                  </label>
                ))}
                <div className="border-t border-white/10 mt-1 pt-1 flex">
                  <button
                    type="button"
                    onClick={() => setSelected(programs.map(p => p.program))}
                    className="flex-1 text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 text-left"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected([])}
                    className="flex-1 text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 text-right"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-4">{description}</p>

      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3 text-xs">
        <span className="flex items-center gap-1.5 text-gray-400">
          <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: totalColor }} />
          {cohort}
        </span>
        {prior && (
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="inline-block w-3 border-t border-dashed border-gray-400" />
            {prior.label} (prior cohort)
          </span>
        )}
        {overlays.map(o => (
          <span key={o.program} className="flex items-center gap-1.5 text-gray-400">
            <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: o.color }} />
            {o.program}
          </span>
        ))}
      </div>

      <RunningTotalChart
        series={series}
        currentLabel={cohort}
        prior={prior}
        goal={goal}
        overlays={overlays}
      />
    </>
  );
}
