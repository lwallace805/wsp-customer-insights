'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, BarChart2, MessageSquare, Lightbulb,
  GraduationCap, TrendingUp, ChevronDown, Layers,
  Phone, Mic, Gauge, GitBranch, Globe, ShoppingCart, Target, Megaphone,
} from 'lucide-react';

const CUSTOMER_INSIGHTS = [
  { href: '/certificates', label: 'Certificate NPS',    icon: GraduationCap },
  { href: '/nps',          label: 'All NPS',            icon: BarChart2 },
  { href: '/surveys',      label: 'Surveys',            icon: MessageSquare },
  { href: '/insights',     label: 'Insights',           icon: Lightbulb },
];

const TOOLS = [
  { href: '/tools/employer-reimbursement', label: 'Employer Reimbursement Guide', icon: Phone },
  { href: '/tools/webinar-repurposer',     label: 'Webinar Repurposer',           icon: Mic },
];

const PERFORMANCE_DASHBOARDS = [
  { href: '/enrollment',               label: 'Enrollment Pacing',       icon: TrendingUp },
  { href: '/performance/overview',     label: 'Executive Overview',      icon: Gauge },
  { href: '/performance/trends',       label: 'Historical Trends',       icon: TrendingUp },
  { href: '/performance/channels',     label: 'Channel Performance',     icon: GitBranch },
  { href: '/performance/paid-channels', label: 'Paid Channel Performance', icon: Megaphone },
  { href: '/performance/programs',     label: 'Program Performance',     icon: GraduationCap },
  { href: '/performance/traffic',      label: 'Traffic Analytics',       icon: Globe },
  { href: '/performance/self-study',   label: 'Self-Study / Retail',     icon: ShoppingCart },
  { href: '/performance/optimization', label: 'Optimization Priorities', icon: Target },
];


type NavItem = { href: string; label: string; icon: React.ElementType; static?: boolean };

function DropdownMenu({
  label,
  items,
  activePath,
}: {
  label: string;
  items: NavItem[];
  activePath: string;
}) {
  const isGroupActive = items.some(i => !i.static && activePath.startsWith(i.href));

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
          {items.map(({ href, label: itemLabel, icon: Icon, static: isStatic }) => {
            const isActive = !isStatic && (activePath === href || activePath.startsWith(href + '/'));
            const className = `flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
              isActive
                ? 'text-gray-900 bg-gray-50 font-medium'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`;
            const icon = <Icon size={14} className={isActive ? 'text-emerald-600' : 'text-gray-400'} />;
            return isStatic ? (
              <a key={href} href={href} className={className}>
                {icon}
                {itemLabel}
              </a>
            ) : (
              <Link key={href} href={href} className={className}>
                {icon}
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
        <div className="flex items-center gap-2.5">
          <Link href="/" className="font-bold text-gray-900 text-base hover:text-emerald-700 transition-colors">
            WSP Analytics Hub
          </Link>
          {process.env.NEXT_PUBLIC_DEMO_MODE === '1' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 border border-amber-200">
              Demo data
            </span>
          )}
        </div>

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

          {/* Performance Dashboards dropdown */}
          <DropdownMenu
            label="Performance"
            items={PERFORMANCE_DASHBOARDS}
            activePath={pathname}
          />

          {/* Tools dropdown */}
          <DropdownMenu
            label="Tools"
            items={TOOLS}
            activePath={pathname}
          />

          {/* Creative Review */}
          <Link
            href="/creative"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              pathname.startsWith('/creative')
                ? 'text-gray-900 bg-gray-100 font-medium'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Layers size={14} />
            Creative Review
          </Link>

          {/* Drafts — static link */}
          <a
            href="/drafts/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              pathname.startsWith('/drafts')
                ? 'text-gray-900 bg-gray-100 font-medium'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Layers size={14} />
            Drafts
          </a>
        </div>
      </div>
    </nav>
  );
}
