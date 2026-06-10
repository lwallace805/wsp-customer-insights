'use client';

import { useState, useEffect } from 'react';
import type { SchoolFilter } from '@/data/performance/types';

// ── Formatters ────────────────────────────────────────────────────────────────

export function fmt(n: number | null | undefined) {
  return n == null ? '—' : n.toLocaleString();
}
export function fmtDollar(n: number | null | undefined) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
export function fmtPct(n: number | null | undefined, digits = 1) {
  return n == null ? '—' : `${n.toFixed(digits)}%`;
}

// ── School filter (persists across views via localStorage) ───────────────────

const SCHOOL_FILTER_KEY = 'performance-school-filter';

export function usePersistentSchoolFilter(): [SchoolFilter, (s: SchoolFilter) => void] {
  const [school, setSchool] = useState<SchoolFilter>('all');

  useEffect(() => {
    const stored = localStorage.getItem(SCHOOL_FILTER_KEY);
    if (stored === 'all' || stored === 'wharton' || stored === 'columbia') setSchool(stored);
  }, []);

  const update = (s: SchoolFilter) => {
    setSchool(s);
    localStorage.setItem(SCHOOL_FILTER_KEY, s);
  };

  return [school, update];
}

const SCHOOL_OPTIONS: { value: SchoolFilter; label: string }[] = [
  { value: 'all', label: 'All Schools' },
  { value: 'wharton', label: 'Wharton' },
  { value: 'columbia', label: 'Columbia' },
];

export function SchoolFilterToggle({
  value,
  onChange,
}: {
  value: SchoolFilter;
  onChange: (s: SchoolFilter) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {SCHOOL_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            value === opt.value
              ? 'bg-white text-gray-900 border-white'
              : 'bg-transparent text-gray-400 border-white/15 hover:border-white/40 hover:text-gray-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-5 flex-1 min-w-[160px]">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      {sub && (
        <p className={`text-xs font-medium ${positive === undefined ? 'text-gray-400' : positive ? 'text-emerald-400' : 'text-red-400'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function DataAsOf({ asOf, live }: { asOf: string; live: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
      Data as of {asOf}
      {!live && <span className="text-amber-400/80">· snapshot</span>}
    </span>
  );
}

// ── Page header with school filter ────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  school,
  onSchoolChange,
  right,
}: {
  title: string;
  subtitle: string;
  school: SchoolFilter;
  onSchoolChange: (s: SchoolFilter) => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {right}
        <SchoolFilterToggle value={school} onChange={onSchoolChange} />
      </div>
    </div>
  );
}

// ── Chart constants (dark theme, matches enrollment charts) ──────────────────

export const CHART_COLORS = {
  emerald: '#34d399',
  blue: '#60a5fa',
  amber: '#fbbf24',
  red: '#f87171',
  violet: '#a78bfa',
  cyan: '#22d3ee',
  pink: '#f472b6',
  lime: '#a3e635',
  orange: '#fb923c',
  gray: '#6b7280',
} as const;

export const SCHOOL_COLORS = { wharton: CHART_COLORS.blue, columbia: CHART_COLORS.emerald } as const;

export const AXIS_PROPS = {
  stroke: '#4b5563',
  tick: { fill: '#9ca3af', fontSize: 11 },
} as const;

export function ChartTooltip({ active, payload, label, valueFormatter }: {
  active?: boolean;
  payload?: { name: string; value: number | null; color: string }[];
  label?: string | number;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const fmtV = valueFormatter ?? ((v: number) => v.toLocaleString());
  return (
    <div className="bg-[#1c2330] border border-white/20 rounded-lg p-3 text-xs">
      <p className="text-gray-400 font-semibold mb-2">{label}</p>
      {payload.map((entry, i) =>
        entry.value != null ? (
          <div key={i} className="flex items-center gap-2 mb-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-300">{entry.name}:</span>
            <span className="text-white font-medium">{fmtV(entry.value)}</span>
          </div>
        ) : null
      )}
    </div>
  );
}
