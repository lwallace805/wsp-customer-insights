'use client';

const TABS = [
  'Overview',
  'Pacing',
  'Full Funnel',
  'Leads',
  'Lower Funnel',
  'By Program',
  'By Channel',
  'Paid Media',
] as const;

export type Tab = (typeof TABS)[number];

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export default function TabNav({ active, onChange }: Props) {
  return (
    <div className="border-b border-white/10 mb-6">
      <div className="flex gap-0 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 -mb-px ${
              active === tab
                ? 'border-white text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
