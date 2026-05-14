'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, BarChart2, MessageSquare, Lightbulb,
  GraduationCap, TrendingUp, ChevronDown, Users,
} from 'lucide-react';

const CUSTOMER_INSIGHTS = [
  { href: '/certificates', label: 'Certificate NPS',    icon: GraduationCap },
  { href: '/nps',          label: 'All NPS',            icon: BarChart2 },
  { href: '/surveys',      label: 'Surveys',            icon: MessageSquare },
  { href: '/insights',     label: 'Insights',           icon: Lightbulb },
];

const MARKETING_DASHBOARDS = [
  { href: '/enrollment',   label: 'Enrollment Pacing',  icon: TrendingUp },
];

const COHORT_PERFORMANCE = [
  { href: '/cohort-performance/wharton',  label: 'Wharton Online',   icon: Users },
  { href: '/cohort-performance/columbia', label: 'Columbia / CBSEE', icon: Users },
];

function DropdownMenu({
  label,
  items,
  activePath,
}: {
  label: string;
  items: { href: string; label: string; icon: React.ElementType }[];
  activePath: string;
}) {
  const isGroupActive = items.some(i => activePath.startsWith(i.href));

  return (
    <div className="relative group">
      {/* Trigger */}
      <button
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          isGroupActive
            ? 'text-gray-900 bg-gray-100 font-medium'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        {label}
        <ChevronDown
          size={13}
          className="text-gray-400 group-hover:text-gray-600 transition-transform group-hover:rotate-180 duration-150"
        />
      </button>

      {/* Dropdown panel — visible on hover */}
      <div className="absolute left-0 top-full pt-1 z-50 hidden group-hover:block">
        <div className="bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[200px]">
          {items.map(({ href, label: itemLabel, icon: Icon }) => {
            const isActive = activePath === href || activePath.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'text-gray-900 bg-gray-50 font-medium'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-emerald-600' : 'text-gray-400'} />
                {itemLabel}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-6 flex items-center justify-between h-14">
        {/* Brand */}
        <Link href="/" className="font-bold text-gray-900 text-base hover:text-emerald-700 transition-colors">
          WSP Analytics Hub
        </Link>

        {/* Links */}
        <div className="flex items-center gap-0.5">
          {/* Overview */}
          <Link
            href="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              pathname === '/'
                ? 'text-gray-900 bg-gray-100 font-medium'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Home size={14} />
            Overview
          </Link>

          {/* Customer Insights dropdown */}
          <DropdownMenu
            label="Customer Insights"
            items={CUSTOMER_INSIGHTS}
            activePath={pathname}
          />

          {/* Marketing Dashboards dropdown */}
          <DropdownMenu
            label="Marketing Dashboards"
            items={MARKETING_DASHBOARDS}
            activePath={pathname}
          />

          {/* Cohort Performance dropdown */}
          <DropdownMenu
            label="Cohort Performance"
            items={COHORT_PERFORMANCE}
            activePath={pathname}
          />
        </div>
      </div>
    </nav>
  );
}
