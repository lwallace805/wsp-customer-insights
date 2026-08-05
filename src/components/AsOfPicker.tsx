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
      <label
        htmlFor="as-of-date"
        className="text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap"
      >
        As of
      </label>
      <input
        id="as-of-date"
        type="date"
        value={value}
        max={max}
        onChange={e => { if (e.target.value) onChange(e.target.value); }}
        className={`bg-[#161b22] border text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark] ${
          isToday
            ? 'border-white/10 text-white'
            : 'border-amber-500/40 text-amber-300'
        }`}
      />
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
