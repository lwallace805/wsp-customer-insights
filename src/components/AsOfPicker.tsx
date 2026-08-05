'use client';

// "As of" date control, shared by Pulse and the enrollment dashboard.
//
// Rewinding re-renders every number as it stood at the close of that day — the
// pacing line stops there, the countdown is that day's, and the comparison rows
// are read at that day's point in each prior cohort's curve. Future dates aren't
// selectable: there's no data past the last keyed day, and allowing them would
// quietly render as "today" while the input claimed otherwise.

interface Props {
  /** Currently rendered day, YYYY-MM-DD. */
  value: string;
  /** Today in ET, YYYY-MM-DD — the latest selectable day. */
  max: string;
  onChange: (ymd: string) => void;
}

export default function AsOfPicker({ value, max, onChange }: Props) {
  const isToday = value === max;

  return (
    <div className="flex items-center gap-2">
      {/* Label and field share one bordered shell so the control reads as a
          single affordance — a bare "As of" next to a dark input disappeared
          into the header. */}
      <div
        className={`flex items-center gap-2 rounded-lg border pl-3 pr-1 py-1 transition-colors ${
          isToday
            ? 'bg-[#161b22] border-white/10 hover:border-white/25'
            : 'bg-amber-500/10 border-amber-500/40'
        }`}
      >
        <label
          htmlFor="as-of-date"
          className={`text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer ${
            isToday ? 'text-gray-400' : 'text-amber-300'
          }`}
        >
          As of
        </label>
        <input
          id="as-of-date"
          type="date"
          value={value}
          max={max}
          onChange={e => { if (e.target.value) onChange(e.target.value); }}
          title="Show every number as it stood at the close of this day"
          className={`bg-transparent border-0 text-sm font-medium px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-white/25 rounded [color-scheme:dark] ${
            isToday ? 'text-white' : 'text-amber-200'
          }`}
        />
      </div>
      {!isToday && (
        <button
          type="button"
          onClick={() => onChange(max)}
          className="text-xs font-semibold text-amber-300 hover:text-amber-200 border border-amber-500/40 rounded-lg px-2.5 py-1.5 whitespace-nowrap"
          title="Return to today"
        >
          Viewing past · Reset
        </button>
      )}
    </div>
  );
}
