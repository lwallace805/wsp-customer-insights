'use client';

const ALL_TABS = [
  'Executive Summary',
  'Cohort Comparison',
  'Wharton Pacing',
  'CBSEE Pacing',
  'All Cohorts',
  'Wharton Forecast',
  'CBSEE Forecast',
] as const;

const CBSEE_TABS = new Set<string>(['CBSEE Pacing', 'CBSEE Forecast']);

export type Tab = (typeof ALL_TABS)[number];

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  programs?: string[];
}

export default function TabNav({ active, onChange, programs }: Props) {
  const tabs = programs && !programs.includes('cbsee')
    ? ALL_TABS.filter(t => !CBSEE_TABS.has(t))
    : ALL_TABS;

  return (
    <div className="border-b border-white/10 mb-6">
      <div className="flex gap-0 overflow-x-auto">
        {tabs.map((tab) => (
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
